import type { CardSnapshot, EtapaCard, OrigemLeitura, Pessoa, Ritmo, Situacao } from '../tipos';
import { aplicarRegrasDescarte } from './descarte';
import { dataBrParaIso, numeroBr, semAcento } from './normalizar';

const RE_DATA = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})/g;
const RE_DATA_UMA = /\d{2}\/\d{2}\/\d{2}/;
// o que a coluna ID/sistema do cronograma mostra; a imagem às vezes lê SST como "SSsT"
const RE_SISTEMA_NO_FIM = /\s*[—–-]?\s*(S+s?T-\w+|Kitu Sistema|Suporte Kitu|Outras Aplica[cç][oõ]es ou de Terceiros|Direcionamento)\s*$/i;
const RE_ETAPAS = /(?<![\d/])(\d{1,3})\s*\/\s*(\d{1,3})(?![\d/])/;
const RE_STATUS = /·?\s*(rodando h[aá]\s*[\d,.]+\s*d|aguardando start|parad[ao][^\t\n]*)/i;
const RE_NOME_COM_STATUS = /([A-ZÀ-Ý][a-zà-ÿ]+(?: [A-ZÀ-Ý][a-zà-ÿ]+)+)\s*·\s*(?:rodando|aguardando|parad)/;
const RE_CRITICIDADE = /^(1|2|3|—|-)$/;
const RE_SISTEMA_CRITICIDADE_ETAPA = /^(.+?)\s+([123]\.?|—|–)\s+(.+)$/;

const situacoes: [RegExp, Situacao][] = [
  [/conclu[ií]do/i, 'concluido'],
  [/vence em at[eé] 15 dias/i, 'vence_15_dias'],
  [/atrasad[oa]/i, 'atrasado'],
  [/a iniciar/i, 'a_iniciar'],
  [/em execu[cç][aã]o/i, 'em_execucao'],
  [/sem data/i, 'sem_data'],
];

// a leitura de imagem às vezes cola as palavras (ex.: "emrisco")
const ritmos: [RegExp, Ritmo][] = [
  [/no\s*ritmo/i, 'no_ritmo'],
  [/em\s*risco/i, 'em_risco'],
  [/atrasad[oa]/i, 'atrasado'],
];

const RE_FIM_DA_SECAO = /\n[^\n]*(fila\s*[—–-]|quem est[aá] cuidando|ocioso entre etapas|pr[oó]ximos 10 vencimentos)/i;

// aviso do fragmento sem código; some quando a correlação em lote liga o fragmento a um card
export const AVISO_CONTINUACAO = 'continuação do texto, sem código';

export interface OpcoesLeitura
{
  prefixo: string;
  pessoas: Pessoa[];
  origem?: OrigemLeitura;
  hoje?: string;
  regrasDescarte?: string[] | undefined;
}

export function detectarOrigem(texto: string): OrigemLeitura
{
  const t = semAcento(texto);
  if (/o que foi pedido|\+ o que vai fazer|adicionar etapa|concluir card|subtarefa|ocioso entre etapas|\d+\s+de\s+\d+\s+concluidas/.test(t)) return 'card';
  if (/registros filtrados|solicitante\s+tipo/.test(t)) return 'demandas';
  // listas do cronograma têm a coluna de vencimento; os chips de filtro ("A iniciar") não mudam isso
  if (/\bvenc\b/.test(t) && /situacao/.test(t)) return 'cronograma';
  if (/fila|a iniciar|ordenadas pela abertura/.test(t) && !/ritmo/.test(t)) return 'fila';
  if (/no\s*ritmo|em\s*risco|etapa atual|rodando ha/.test(t)) return 'em_execucao';
  return 'cronograma';
}

// separa o texto em pedaços que começam no código do card (ex.: DEV-218)
export function lerCards(textoLido: string, opcoes: OpcoesLeitura): CardSnapshot[]
{
  // detecta a tela pelo texto original antes de remover cabeçalhos/palavras descartadas
  const origem = opcoes.origem ?? detectarOrigem(textoLido);
  const textoLimpo = aplicarRegrasDescarte(textoLido, opcoes.regrasDescarte);
  // a imagem às vezes separa o código: "DEV -077"
  const texto = textoLimpo.replace(new RegExp(`\\b${opcoes.prefixo} ?- ?(?=[0-9A-Z]{2,4}\\b)`, 'g'), `${opcoes.prefixo}-`);
  if (origem === 'card') return lerCardAberto(texto, opcoes);
  if (origem === 'cronograma' && /item\s+venc\.?\s+card\s+onda/.test(semAcento(texto))) return lerVencimentos(texto, opcoes);
  // aceita letras depois do prefixo para não perder card que a imagem leu errado (ex.: DEV-NS)
  const re = new RegExp(`\\b${opcoes.prefixo}-[0-9A-Z]{2,4}\\b`, 'g');
  const marcas = [...texto.matchAll(re)];
  const porCodigo = new Map<string, CardSnapshot>();
  marcas.forEach((m, i) =>
  {
    const inicio = m.index + m[0].length;
    const fim = marcas[i + 1]?.index ?? texto.length;
    const { codigo, corrigido } = corrigirCodigo(m[0], opcoes.prefixo);
    const trecho = texto.slice(inicio, fim);
    const card = origem === 'demandas' ? lerDemanda(codigo, trecho, opcoes.pessoas, opcoes.regrasDescarte) : lerTrecho(codigo, trecho, origem, opcoes.pessoas);
    card.avisosLeitura = [...(corrigido ? ['código corrigido, confira'] : []), ...(card.avisosLeitura ?? []), ...avisar(card, origem, opcoes.hoje)];
    const anterior = porCodigo.get(card.codigo);
    porCodigo.set(card.codigo, anterior ? juntarCard(anterior, card) : card);
  });
  return marcarCodigosEstranhos([...porCodigo.values()]);
}

// a imagem às vezes cola as palavras ("KituSistema", "SuporteKitu", "Emandamento")
const RE_TIPO = /Kitu\s*Sistema|Suporte\s*Kitu|Outras Aplica[cç][oõ]es ou de Terceiros|Direcionamento/i;
const RE_STATUS_CARD = /em\s*andamento|planejado|novo|resolvido|cancelado|aguardando (?:cliente|time \S+)/i;
// o que vem depois do nome do responsável quando o tempo não foi lido ("Bmin e Emandamento", "158in (e Emandamento")
const RE_COLUNAS_FINAIS = /min\b|andamento|resolvido|planejado|cancelado|\(\s*e\s*\w+/i;
// coluna Tempo da lista ("0 min", "3 h"); a imagem lê 0 como O
const RE_TEMPO = /\b[O0o\d][\d,]*\s*(?:min|h|d)\b/;

// "KituSistema" -> "Kitu Sistema"
function tipoCanonico(lido: string | undefined): string | undefined
{
  if (!lido) return undefined;
  const sem = semAcento(lido).replace(/\s+/g, '');
  return sem === 'kitusistema' ? 'Kitu Sistema' : sem === 'suportekitu' ? 'Suporte Kitu' : lido;
}

// nome completo, ou nome e sobrenome em linhas diferentes (a coluna quebra "Mariana / Coutinho")
function pessoasNoTexto(normal: string, pessoas: Pessoa[]): Pessoa[]
{
  return pessoas.filter((p) =>
  {
    const partes = semAcento(p.nome).split(' ');
    return normal.includes(semAcento(p.nome)) || (partes.length > 1 && new RegExp(`\\b${partes[0]}\\b[\\s\\S]*\\b${partes.at(-1)}\\b`).test(normal));
  });
}

// lista de Demandas: ID + abertura, solicitante, tipo, descrição, responsável, tempo, status
function lerDemanda(codigo: string, trecho: string, pessoas: Pessoa[], regrasDescarte?: string[]): CardSnapshot
{
  const card: CardSnapshot = { codigo, responsaveis: [], origens: ['demandas'], fontesCorrelacionadas: ['lista'] };
  const normal = semAcento(trecho);
  const achadas = pessoasNoTexto(normal, pessoas);
  card.responsaveis = achadas.map((p) => p.id);
  if (card.responsaveis.length > 0) card.responsavelEtapaAtual = card.responsaveis[0];

  const abertura = trecho.match(/(?:^|\n)[\s\t]*(\d{2}\/\d{2}\/\d{2,4})/);
  if (abertura) card.abertura = lerDatas(abertura[1]!).datas[0];
  const comeca = trecho.match(/come[cç]a\s+(\d{2}\/\d{2}\/\d{2,4})/i);
  if (comeca) card.planejadoPara = lerDatas(comeca[1]!).datas[0];

  // captura selo de prioridade (Baixa, Média, Alta, Crítica, Urgente)
  const prioMatch = trecho.match(/\b(cr[ií]tica|cr[ií]tico|urgente|alta|m[eé]dia|baixa)\b/i);
  if (prioMatch)
  {
    const pTxt = semAcento(prioMatch[1]!).toLowerCase();
    card.prioridadeCard = (pTxt === 'critica' || pTxt === 'critico') ? 'Crítica' : pTxt === 'media' ? 'Média' : pTxt[0]!.toUpperCase() + pTxt.slice(1);
    card.criticidade = (pTxt === 'critica' || pTxt === 'critico' || pTxt === 'urgente') ? 3 : pTxt === 'alta' ? 2 : 1;
  }

  // o status vem depois do tempo; antes dele "novo" pode ser parte da descrição
  const tempo = trecho.match(RE_TEMPO);
  if (tempo)
  {
    const mTempo = tempo[0].replace(/^[Oo]/, '0').match(/([\d,]+)\s*(min|h|d)/i);
    if (mTempo)
    {
      const val = numeroBr(mTempo[1]!);
      const un = mTempo[2]!.toLowerCase();
      card.tempoTotalMin = Math.round(un === 'h' ? val * 60 : un === 'd' ? val * 480 : val);
    }
  }
  const aposTempo = tempo ? trecho.slice(tempo.index! + tempo[0].length) : trecho;
  const status = aposTempo.match(RE_STATUS_CARD)?.[0];
  if (status)
  {
    const statusLido = /^em\s*andamento$/i.test(status) ? 'Em andamento' : status;
    card.statusCard = statusLido[0]!.toUpperCase() + statusLido.slice(1).toLowerCase().replace(/time (\S)/, (_, l: string) => `Time ${l.toUpperCase()}`);
    const stNorm = semAcento(card.statusCard).toLowerCase();
    if (stNorm === 'resolvido') card.situacao = 'concluido';
    else if (stNorm === 'em andamento') card.situacao = 'em_execucao';
    else if (stNorm === 'novo' || stNorm === 'planejado') card.situacao = 'a_iniciar';
  }
  card.sistema = tipoCanonico(trecho.match(RE_TIPO)?.[0]);
  // uma linha de card que perdeu o código (a imagem leu "DEV28A" ou só "DEV") fica dentro do trecho do card de cima: cada card tem uma linha começando pela data
  if ((trecho.match(/(?:^|\n)[ \t]*\d{2}\/\d{2}\/\d{2,4}/g) ?? []).length > 1) card.avisosLeitura = ['mais de um card no mesmo trecho, confira'];

  if (trecho.includes('\t'))
  {
    const celulas = trecho.split(/\t|\r?\n/).map((c) => c.trim()).filter(Boolean);
    const i = celulas.findIndex((c) => RE_TIPO.test(c));
    if (i >= 0 && celulas[i + 1])
    {
      const d = celulas[i + 1]!;
      card.titulo = d;
      card.descricaoCompleta = d;
      return card;
    }
  }

  // imagem: extrai todas as linhas que compõem a descrição da tarefa, descartando linhas puras de metadados
  const linhas = trecho.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const ehLinhaMetadadosPura = (l: string): boolean =>
  {
    if (/^(\d{2}\/\d{2}\/\d{2,4}|come[cç]a\s+\d{2}\/\d{2}\/\d{2,4})$/i.test(l)) return true;
    if (/^[—–\-+=._·•\s]+$/.test(l)) return true;
    if (/^[•·-]?\s*(cr[ií]tic[ao]|urgente|alta|m[eé]dia|baixa)\s*$/i.test(l)) return true;
    if (/^(Kitu Sistema|Suporte Kitu|Outras Aplica[cç][oõ]es ou de Terceiros|Direcionamento)\s*$/i.test(l)) return true;
    if (/^[O0o\d][\d,.]*\s*(?:min|h|d)$/i.test(l)) return true;
    if (/^[•·-]?\s*(em andamento|novo|resolvido|planejado|cancelado)\s*$/i.test(l)) return true;
    if (/^(id|solicitante|tipo|descri[cç][aã]o|respons[aá]vel|tempo|status|sat\.?)$/i.test(semAcento(l))) return true;
    if (achadas.some((p) => semAcento(l).toLowerCase() === semAcento(p.nome).toLowerCase())) return true;
    return false;
  };

  const linhasUteis = linhas.filter((l) => !ehLinhaMetadadosPura(l));

  const limparLinha = (linha: string): string =>
  {
    let l = linha;
    const mTipo = l.match(RE_TIPO);
    if (mTipo && l.indexOf(mTipo[0]) < 15)
    {
      l = l.slice(l.indexOf(mTipo[0]) + mTipo[0].length);
    }
    // Remove datas e selos de prioridade no início em qualquer ordem; a bolinha do selo às vezes vira uma letra solta ("e crítico")
    l = l.replace(/^(\d{2}\/\d{2}\/\d{2,4}\s*|[•·*-]?\s*(?:[eo]\s+)?(?:cr[ií]tic[ao]|urgente|alta|m[eé]dia|baixa)\s+)+/i, '');
    const cTempo = l.search(RE_TEMPO);
    if (cTempo >= 0)
    {
      l = l.slice(0, cTempo);
    }
    else
    {
      // sem tempo legível, o que vem depois do nome do responsável, perto do fim da linha, são as colunas Tempo e Status
      for (const p of achadas)
      {
        const reNome = new RegExp(`\\b(?:${p.nome}|${p.nome.split(' ')[0]})\\b`, 'gi');
        const ultimo = [...l.matchAll(reNome)].at(-1);
        if (!ultimo) continue;
        const resto = l.slice(ultimo.index + ultimo[0].length);
        if (resto.length <= 30 && RE_COLUNAS_FINAIS.test(resto))
        {
          l = l.slice(0, ultimo.index);
          break;
        }
      }
    }
    // tempo lido pela metade ("Mariana Coutinho B,2h" vira "Mariana Coutinho B,"): sobra uma letra solta depois do nome
    for (const p of achadas)
    {
      const m = l.match(new RegExp(`\\b${p.nome}\\b([^A-Za-z]*[A-Za-z][^A-Za-z]*)$`, 'i'));
      if (m) l = l.slice(0, m.index);
    }
    for (const p of achadas)
    {
      const partes = p.nome.split(' ');
      const reCompletoFim = new RegExp(`\\s*\\b${p.nome}\\b\\s*$`, 'i');
      const rePrimeiroFim = new RegExp(`\\s*\\b${partes[0]}\\b\\s*$`, 'i');
      const reSobrenomeFim = new RegExp(`\\s*\\b${partes.slice(1).join(' ')}\\b\\s*$`, 'i');
      const reCompletoIni = new RegExp(`^\\s*\\b${p.nome}\\b\\s*`, 'i');
      const rePrimeiroIni = new RegExp(`^\\s*\\b${partes[0]}\\b\\s*`, 'i');
      const reSobrenomeIni = new RegExp(`^\\s*\\b${partes.slice(1).join(' ')}\\b\\s*`, 'i');

      l = l.replace(reCompletoFim, '').replace(reSobrenomeFim, '').replace(rePrimeiroFim, '');
      l = l.replace(reCompletoIni, '').replace(rePrimeiroIni, '').replace(reSobrenomeIni, '');
    }
    l = l.replace(/^[—–\-+=_·•\s]+|[—–\-+=_·•\s]+$/g, '').trim();
    return l;
  };

  const partesDescricao = linhasUteis.map(limparLinha).filter(Boolean);
  const textoJunto = partesDescricao.join(' ').replace(/\s{2,}/g, ' ').trim();
  const textoDescricao = aplicarRegrasDescarte(textoJunto, regrasDescarte).replace(/\s{2,}/g, ' ').trim();

  if (textoDescricao)
  {
    card.titulo = textoDescricao;
    card.descricaoCompleta = textoDescricao;
  }

  return card;
}

const situacaoEtapa = (texto: string): EtapaCard['situacao'] | undefined =>
{
  const t = semAcento(texto);
  if (/nao iniciada/.test(t)) return 'nao_iniciada';
  if (/\bconcluid[ao]\b|\bfeita\b/.test(t)) return 'concluida';
  if (/rodando|em andamento|iniciada/.test(t)) return 'rodando';
  return undefined;
};

// "rodando há 15,8 h" -> 15.8 (horas)
function tempoRodandoEmHoras(texto: string): number | undefined
{
  const m = texto.match(/rodando h[aá]\s*([\d,.]+)\s*(h|min|d)/i);
  if (!m) return undefined;
  const v = numeroBr(m[1]!);
  const u = m[2]!.toLowerCase();
  return Math.round((u === 'min' ? v / 60 : u === 'd' ? v * 8 : v) * 10) / 10;
}

// "desde 16/11/2026 16:25" -> 2026-11-16T16:25
function desdeDe(texto: string): string | undefined
{
  const m = texto.match(/desde\s+(\d{2}\/\d{2}\/\d{2,4})(?:\s+(\d{2}:\d{2}))?/i);
  const data = m ? lerDatas(m[1]!).datas[0] : undefined;
  return data ? (m?.[2] ? `${data}T${m[2]}` : data) : undefined;
}

// extrai etapas no formato moderno do painel ("1 Validação dos requisitos Rodrigo Cinelli • rodando há 15,8 h desde 16/11/2026 16:25")
function lerEtapasModernas(texto: string, pessoas: Pessoa[]): EtapaCard[]
{
  const inicioEtapas = texto.search(/\bEtapas\b|\d+\s+de\s+\d+\s+conclu[ií]das|#\s+ETAPA/i);
  const escopo = inicioEtapas >= 0 ? texto.slice(inicioEtapas) : texto;
  const linhas = escopo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(Etapas\b|#\s*ETAPA|\+\s*o que vai fazer|\+\s*pessoa|Concluir card$)/i.test(l));

  // agrupa pelos índices numéricos de etapa (1, 2, 3...)
  const blocos: { ordem: number; texto: string }[] = [];
  for (const l of linhas)
  {
    const mNum = l.match(/^(\d{1,2})(?:\s+(.+))?$/);
    if (mNum && Number(mNum[1]) >= 1 && Number(mNum[1]) <= 30 && (!blocos.length || Number(mNum[1]) === blocos.at(-1)!.ordem + 1 || Number(mNum[1]) === 1))
    {
      blocos.push({ ordem: Number(mNum[1]), texto: mNum[2] ?? '' });
    }
    else if (blocos.length)
    {
      blocos.at(-1)!.texto += ` ${l}`;
    }
  }

  const resultado: EtapaCard[] = [];
  for (const b of blocos)
  {
    const bruto = b.texto.replace(/\b(?:Concluir\s+Subtarefa|Subtarefa|Concluir\s+card|\+\s*o que vai fazer|\+\s*pessoa)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!bruto) continue;

    const norm = semAcento(bruto);
    const pessoaCad = pessoas.find((p) => norm.includes(semAcento(p.nome)));
    let nomePessoaTexto = pessoaCad?.nome;
    if (!nomePessoaTexto)
    {
      const mNome = bruto.match(/\b([A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý][a-zà-ÿ]+)\b(?=[\s\S]*(?:rodando|n[aã]o iniciada|conclu[ií]d|v\b))/);
      if (mNome) nomePessoaTexto = mNome[1];
    }

    let nomeEtapa = bruto;
    if (nomePessoaTexto)
    {
      const idx = semAcento(bruto).toLowerCase().indexOf(semAcento(nomePessoaTexto).toLowerCase());
      if (idx > 0) nomeEtapa = bruto.slice(0, idx).trim();
    }
    nomeEtapa = nomeEtapa.replace(/\s+[v•·-]\s*$/i, '').replace(/\s*(?:rodando h[aá].*|n[aã]o iniciada.*)$/i, '').trim();
    if (!nomeEtapa) continue;

    const sit = situacaoEtapa(bruto) ?? 'outra';
    const tempoRodandoHoras = tempoRodandoEmHoras(bruto);
    const desde = desdeDe(bruto);

    resultado.push({
      ordem: b.ordem,
      nome: nomeEtapa,
      pessoa: pessoaCad?.id ?? nomePessoaTexto,
      situacao: sit,
      origemEtapa: 'print',
      ...(tempoRodandoHoras !== undefined ? { tempoRodandoHoras } : {}),
      ...(desde ? { desde } : {}),
    });
  }
  return resultado;
}

// card aberto no painel: cabeçalho (código, abertura, tipo, prazo de resposta, ritmo), "O que foi pedido" e lista de etapas.
function lerCardAberto(texto: string, opcoes: OpcoesLeitura): CardSnapshot[]
{
  const lido = texto.match(new RegExp(`\\b${opcoes.prefixo}-[0-9A-Z]{2,4}\\b`))?.[0];
  const temPedidoOuEtapas = /o que foi pedido|\d+\s+de\s+\d+\s+conclu[ií]das|ocioso entre etapas|rodando h[aá]\s*[\d,]+|\+\s*o que vai fazer/i.test(semAcento(texto));
  if (!lido && !temPedidoOuEtapas)
  {
    // print só com o meio ou o fim do texto do pedido (cortado entre duas imagens): só vale se foi marcado como card aberto
    const continuacao = texto.split(/\r?\n/).map((l) => l.trim()).filter((l) => /[A-Za-zÀ-ÿ]{3}/.test(l)).join('\n');
    if (opcoes.origem !== 'card' || continuacao.length < 25) return [];
    return [{
      codigo: '__ORFAO__',
      titulo: continuacao.split('\n')[0]!.slice(0, 120),
      descricaoCompleta: continuacao,
      responsaveis: [],
      origens: ['card'],
      fontesCorrelacionadas: ['pedido'],
      avisosLeitura: [AVISO_CONTINUACAO],
    }];
  }

  const codigo = lido ? corrigirCodigo(lido, opcoes.prefixo).codigo : '__ORFAO__';
  const card: CardSnapshot = { codigo, responsaveis: [], origens: ['card'], fontesCorrelacionadas: [] };

  const abertura = texto.match(/abertura[\s\S]*?(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/i);
  if (abertura)
  {
    card.abertura = lerDatas(abertura[1]!).datas[0]!;
    if (abertura[2]) card.aberturaHora = abertura[2];
  }
  const prazo = texto.match(/prazo de resposta[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
  if (prazo) card.vencimento = lerDatas(prazo[1]!).datas[0]!;
  const tipo = tipoCanonico(texto.match(RE_TIPO)?.[0]);
  if (tipo) card.sistema = tipo;
  const posPrazoConsumido = texto.search(/prazo consumido/i);
  if (posPrazoConsumido >= 0)
  {
    const ritmo = ritmos.find(([r]) => r.test(texto.slice(posPrazoConsumido)))?.[1];
    if (ritmo) card.ritmoPainel = ritmo;
  }

  // Extrai "O QUE FOI PEDIDO" (Imagem 2)
  const mPedido = texto.match(/o que foi pedido\b[^\n]*\r?\n([\s\S]+?)(?=\r?\n\s*(?:Etapas\b|\d+\s+de\s+\d+\s+conclu[ií]das|#\s*ETAPA\b|TIME\b|ABERTURA\b)|$)/i);
  if (mPedido)
  {
    const brutoLimpo = mPedido[1]!
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\[?editar\]?\s*$/i, '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    const limpo = aplicarRegrasDescarte(brutoLimpo, opcoes.regrasDescarte).trim();
    if (limpo.length > 3)
    {
      card.descricaoCompleta = limpo;
      card.fontesCorrelacionadas = [...new Set([...(card.fontesCorrelacionadas ?? []), 'pedido'])];
      if (!card.titulo)
      {
        const primeiraLinha = limpo.split(/\r?\n/)[0]!;
        card.titulo = limpo.length <= 120 ? limpo.replace(/\r?\n/g, ' ') : primeiraLinha;
      }
    }
  }

  // Cabeçalho de Etapas: "0 de 3 concluídas · ocioso entre etapas: 0 min úteis"
  const mResumoEtapas = texto.match(/(\d+)\s+de\s+(\d+)\s+conclu[ií]das/i);
  if (mResumoEtapas)
  {
    card.etapasConcluidas = Number(mResumoEtapas[1]);
    card.etapasTotal = Number(mResumoEtapas[2]);
  }
  const mOcioso = texto.match(/ocioso entre etapas:\s*([\d,.]+)\s*(min|h)/i);
  if (mOcioso)
  {
    const v = numeroBr(mOcioso[1]!);
    card.ociosoEtapasMin = mOcioso[2]!.toLowerCase() === 'h' ? Math.round(v * 60) : Math.round(v);
  }

  const etapas: EtapaCard[] = [];
  // o Tesseract lê a linha da etapa em três: número e selo de tempo (antes do nome), "nome responsável v" e "desde ..." (depois)
  const contextos: { etapa: EtapaCard; antes: string; resto: string; depois: string }[] = [];
  let pendente = '';
  for (const linha of texto.split(/\r?\n/))
  {
    const celulas = linha.split('\t').map((c) => c.trim());
    // texto com tabulação: "1  Nome  pessoa  situação"
    if (celulas.length >= 3 && /^\d+$/.test(celulas[0]!))
    {
      const pessoa = opcoes.pessoas.find((p) => semAcento(celulas[2]!).includes(semAcento(p.nome)));
      etapas.push({ ordem: etapas.length + 1, nome: celulas[1]!, pessoa: pessoa?.id, situacao: situacaoEtapa(celulas.slice(2).join(' ')) ?? 'outra' });
      continue;
    }
    const m = linha.match(/^\s*(.+?)\s+(?:[—–-]+\s*ningu[eé]m\s*[—–-]+|(\p{Lu}\p{Ll}+(?: \p{Lu}\p{Ll}+)+))\s+v\b/u);
    if (m && !/^(etapa|responsavel)/i.test(semAcento(m[1]!)))
    {
      const pessoa = m[2] ? opcoes.pessoas.find((p) => semAcento(p.nome) === semAcento(m[2]!)) : undefined;
      const etapa: EtapaCard = { ordem: etapas.length + 1, nome: m[1]!.trim(), pessoa: pessoa?.id ?? m[2], situacao: situacaoEtapa(pendente) ?? situacaoEtapa(linha) ?? 'outra', origemEtapa: 'print' };
      etapas.push(etapa);
      contextos.push({ etapa, antes: pendente, resto: linha.slice(m[0].length), depois: '' });
      pendente = '';
    }
    else
    {
      pendente += ` ${linha}`;
      if (contextos.length) contextos.at(-1)!.depois += ` ${linha}`;
    }
  }
  // o tempo rodando vem antes do nome (ou na mesma linha) e o "desde" vem depois; o tempo da etapa seguinte, que vem nas linhas de "depois", não entra
  for (const { etapa, antes, resto, depois } of contextos)
  {
    const horas = tempoRodandoEmHoras(`${antes} ${resto}`);
    const desde = desdeDe(`${resto} ${depois}`);
    if (horas !== undefined) etapa.tempoRodandoHoras = horas;
    if (desde) etapa.desde = desde;
  }

  if (etapas.length === 0)
  {
    const modernas = lerEtapasModernas(texto, opcoes.pessoas);
    etapas.push(...modernas);
  }

  if (etapas.length)
  {
    card.etapas = etapas;
    card.etapasTotal = card.etapasTotal ?? etapas.length;
    card.etapasConcluidas = card.etapasConcluidas ?? etapas.filter((e) => e.situacao === 'concluida').length;
    card.fontesCorrelacionadas = [...new Set([...(card.fontesCorrelacionadas ?? []), 'etapas'])];
    const atual = etapas.find((e) => e.situacao === 'rodando') ?? etapas.find((e) => e.situacao !== 'concluida');
    if (atual)
    {
      card.etapaAtual = atual.nome;
      card.etapaAtualStatus = atual.situacao === 'rodando' ? 'rodando' : 'aguardando_start';
      if (atual.tempoRodandoHoras !== undefined)
      {
        card.etapaAtualRodandoHaDias = Math.round((atual.tempoRodandoHoras / 8) * 10) / 10;
      }
      if (atual.pessoa)
      {
        card.responsavelEtapaAtual = atual.pessoa;
        card.responsaveis = [...new Set(etapas.map((e) => e.pessoa).filter((p): p is string => !!p))];
      }
    }
  }
  card.avisosLeitura = etapas.length || card.descricaoCompleta ? [] : ['sem etapas'];
  return [card];
}

// a imagem lê 0 como O: DEV-O080 -> DEV-080
function corrigirCodigo(lido: string, prefixo: string): { codigo: string; corrigido: boolean }
{
  let numero = lido.slice(prefixo.length + 1).replace(/O/g, '0');
  if (/^0\d{3}$/.test(numero)) numero = numero.slice(1);
  const codigo = `${prefixo}-${numero}`;
  return { codigo, corrigido: codigo !== lido };
}

// número muito acima dos outros costuma ser 0 lido como 9 (DEV-048 -> DEV-948)
function marcarCodigosEstranhos(cards: CardSnapshot[]): CardSnapshot[]
{
  const numeroDe = (c: CardSnapshot) => Number(c.codigo.split('-').at(-1));
  const numeros = cards.map(numeroDe).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (numeros.length < 5) return cards;
  const mediana = numeros[Math.floor(numeros.length / 2)]!;
  for (const c of cards)
  {
    if (numeroDe(c) > mediana * 3) c.avisosLeitura = [...(c.avisosLeitura ?? []), 'código estranho, confira'];
  }
  return cards;
}

// a imagem lê 0 como 6 ou 8 no dia (63/11/26); só corrige o que não pode ser data
export function lerDatas(trecho: string): { datas: string[]; corrigida: boolean }
{
  let corrigida = false;
  const datas = [...trecho.matchAll(RE_DATA)].map((d) =>
  {
    let dia = d[1]!;
    let mes = d[2]!;
    if (Number(dia) > 31)
    {
      dia = `0${dia[1]}`;
      corrigida = true;
    }
    if (Number(mes) > 12)
    {
      mes = `0${mes[1]}`;
      corrigida = true;
    }
    return dataBrParaIso(dia, mes, d[3]!);
  });
  return { datas, corrigida };
}

// "Próximos 10 vencimentos": o código vem depois do título.
// Imagem: "título VENC CARD onda situação", com o resto do título e o sistema nas linhas de baixo.
// Texto com tabulação: o título vem nas linhas de cima e o sistema antes do vencimento.
function lerVencimentos(texto: string, opcoes: OpcoesLeitura): CardSnapshot[]
{
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const reCodigo = new RegExp(`\\b${opcoes.prefixo}-[0-9A-Z]{2,4}\\b`);
  const comCodigo = linhas.map((l, i) => (reCodigo.test(l) ? i : -1)).filter((i) => i >= 0);
  const cards = comCodigo.map((i, k): CardSnapshot =>
  {
    const linha = linhas[i]!;
    const { codigo, corrigido } = corrigirCodigo(linha.match(reCodigo)![0], opcoes.prefixo);
    const antesDaData = linha.slice(0, Math.max(0, linha.search(RE_DATA_UMA))).trim();
    let titulo: string[];
    let sistema: string | undefined;
    if (linha.includes('\t'))
    {
      titulo = linhas.slice((comCodigo[k - 1] ?? -1) + 1, i).filter((l) => !/item\s+venc/.test(semAcento(l)));
      sistema = antesDaData || undefined;
    }
    else
    {
      const depois = linhas.slice(i + 1, comCodigo[k + 1] ?? linhas.length);
      const ultima = depois.at(-1);
      const ehSistema = ultima !== undefined && !/[★*]/.test(ultima) && (RE_SISTEMA_NO_FIM.test(ultima) || ultima.length <= 30);
      sistema = ehSistema ? ultima : undefined;
      titulo = [antesDaData, ...(ehSistema ? depois.slice(0, -1) : depois)];
    }
    const textoTitulo = titulo.join(' ');
    const { datas, corrigida } = lerDatas(linha);
    const card: CardSnapshot = { codigo, responsaveis: [], origens: ['cronograma'] };
    card.titulo = textoTitulo.replace(/[★*]/g, '').replace(/\s+/g, ' ').trim() || undefined;
    card.sistema = sistema;
    card.vencimento = datas[0];
    card.situacao = situacoes.find(([r]) => r.test(linha))?.[1];
    if (/[★*]/.test(textoTitulo)) card.dataFixada = true;
    card.avisosLeitura = [
      ...(corrigido ? ['código corrigido, confira'] : []),
      ...(corrigida ? ['data corrigida, confira'] : []),
      ...(card.vencimento ? [] : ['sem vencimento']),
    ];
    return card;
  });
  return marcarCodigosEstranhos(cards);
}

// aponta o que provavelmente foi lido errado ou ficou faltando
function avisar(card: CardSnapshot, origem: OrigemLeitura, hoje?: string): string[]
{
  const avisos: string[] = [];
  if (!/-\d+$/.test(card.codigo)) avisos.push('código ilegível');
  if (origem === 'demandas')
  {
    if (!card.statusCard) avisos.push('sem status');
    if (!card.responsaveis.length) avisos.push('sem pessoa');
    return avisos;
  }
  if (origem === 'cronograma')
  {
    if (!card.vencimento) avisos.push('sem vencimento');
    if (!card.situacao) avisos.push('sem situação');
    return avisos;
  }
  if (card.etapasTotal === undefined) avisos.push('sem etapas');
  if (!card.previsao) avisos.push('sem previsão');
  if (!card.responsavelEtapaAtual) avisos.push('sem pessoa');
  if (origem === 'em_execucao' && !card.ritmoPainel) avisos.push('sem ritmo');
  if (hoje && card.previsao)
  {
    const dias = (Date.parse(card.previsao) - Date.parse(hoje)) / 86_400_000;
    if (dias < -60 || dias > 400) avisos.push('previsão estranha');
  }
  return avisos;
}

function lerTrecho(codigo: string, trechoBruto: string, origem: OrigemLeitura, pessoas: Pessoa[]): CardSnapshot
{
  const card: CardSnapshot = { codigo, responsaveis: [], origens: [origem] };
  const corte = trechoBruto.search(RE_FIM_DA_SECAO);
  const trecho = corte >= 0 ? trechoBruto.slice(0, corte) : trechoBruto;
  const normal = semAcento(trecho);

  const { datas, corrigida } = lerDatas(trecho);
  if (corrigida) card.avisosLeitura = ['data corrigida, confira'];
  if (origem === 'cronograma')
  {
    card.inicio = datas[0];
    card.vencimento = datas[1];
  }
  else if (datas.length >= 2)
  {
    card.inicio = datas[0];
    card.previsao = datas[1];
  }
  else
  {
    card.previsao = datas[0];
  }

  const etapas = trecho.match(RE_ETAPAS);
  if (etapas)
  {
    card.etapasConcluidas = Number(etapas[1]);
    card.etapasTotal = Number(etapas[2]);
  }

  // a imagem lê a estrela como *
  if (/[★*]/.test(trecho)) card.dataFixada = true;

  if (origem === 'cronograma')
  {
    card.situacao = situacoes.find(([r]) => r.test(trecho))?.[1];
  }
  else
  {
    card.ritmoPainel = ritmos.find(([r]) => r.test(trecho))?.[1];
  }

  const rodando = normal.match(/rodando ha\s*([\d,.]+)\s*d/);
  if (rodando)
  {
    card.etapaAtualStatus = 'rodando';
    card.etapaAtualRodandoHaDias = numeroBr(rodando[1]!);
  }
  else if (normal.includes('aguardando start')) card.etapaAtualStatus = 'aguardando_start';
  else if (/parad[ao]|na fila/.test(normal)) card.etapaAtualStatus = 'parada_na_fila';

  const nomesAchados: string[] = [];
  for (const p of pessoas)
  {
    if (normal.includes(semAcento(p.nome)))
    {
      card.responsaveis.push(p.id);
      nomesAchados.push(p.nome);
    }
  }
  const nomeLivre = trecho.match(RE_NOME_COM_STATUS)?.[1];
  if (card.responsaveis.length === 0 && nomeLivre)
  {
    card.responsaveis.push(nomeLivre);
    nomesAchados.push(nomeLivre);
  }
  card.responsavelEtapaAtual = card.responsaveis[0];

  // o que sobra de cada pedaço depois de tirar datas, números, nomes e status é texto livre
  const livres: string[] = [];
  for (const bruto of trecho.split(/\t|\r?\n/))
  {
    let s = bruto.trim();
    if (RE_CRITICIDADE.test(s))
    {
      if (s !== '—' && s !== '-') card.criticidade = Number(s) as 1 | 2 | 3;
      continue;
    }
    s = s.replace(RE_DATA, '').replace(RE_ETAPAS, '').replace(/[★*]/g, '').replace(RE_STATUS, '');
    for (const n of nomesAchados) s = s.replace(new RegExp(n, 'i'), '');
    // a etiqueta de ritmo vem com bolinha e borda, que a imagem lê como "(e emrisco )"
    s = s.replace(/\(?\s*\b[eo]?\s*(no\s*ritmo|em\s*risco|atrasad[oa])\s*\)?/gi, '');
    for (const [r] of situacoes) s = s.replace(r, '');
    s = s.replace(/^[\s·•|-]+|[\s·•|-]+$/g, '').replace(/\s+/g, ' ').trim();
    if (s.length > 1) livres.push(s);
  }

  if (origem === 'cronograma' && !trecho.includes('\t'))
  {
    // imagem: "título sistema início venc situação" numa linha só; o que vem antes da 1a data é título + sistema
    const primeira = trecho.split(/\r?\n/).find((l) => RE_DATA_UMA.test(l)) ?? '';
    const antes = primeira.slice(0, primeira.search(RE_DATA_UMA)).replace(/^[\s—–-]+/, '');
    const sistema = antes.match(RE_SISTEMA_NO_FIM);
    card.sistema = sistema?.[1];
    card.titulo = (sistema ? antes.slice(0, sistema.index) : antes).replace(/[\s—–.-]+$/, '').trim() || livres[0];
  }
  else if (origem === 'cronograma')
  {
    card.titulo = livres[0];
    card.sistema = livres[1];
  }
  else if (!trecho.includes('\t') && livres.length === 2 && RE_SISTEMA_CRITICIDADE_ETAPA.test(livres[0]!))
  {
    // leitura de imagem: "Kitu Sistema 2 Modelagem" numa linha e a descrição na outra
    const m = livres[0]!.match(RE_SISTEMA_CRITICIDADE_ETAPA)!;
    card.sistema = m[1];
    if (m[2] && /[123]/.test(m[2])) card.criticidade = Number(m[2][0]) as 1 | 2 | 3;
    card.etapaAtual = m[3];
    card.titulo = livres[1];
  }
  else
  {
    card.sistema = livres[0];
    if (livres.length >= 3)
    {
      card.titulo = livres.slice(1, -1).join(' ');
      card.etapaAtual = livres.at(-1);
    }
    else
    {
      card.titulo = livres[1];
    }
  }

  return card;
}

// une duas leituras do mesmo card; o que veio depois tem prioridade, preservando descrição completa e fontes
const ORDEM_FONTES = ['lista', 'pedido', 'etapas'];
export function juntarCard(antigo: CardSnapshot, novo: CardSnapshot): CardSnapshot
{
  const definidos = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined));
  // a ordem das fontes é fixa (lista, pedido, etapas); senão ela dependeria de qual print foi mesclado primeiro
  const posicaoFonte = (f: string): number => (ORDEM_FONTES.includes(f) ? ORDEM_FONTES.indexOf(f) : ORDEM_FONTES.length);
  const fontes = [...new Set([...(antigo.fontesCorrelacionadas ?? []), ...(novo.fontesCorrelacionadas ?? [])])].sort((a, b) => posicaoFonte(a) - posicaoFonte(b));
  const descricaoCompleta = (novo.descricaoCompleta?.length ?? 0) >= (antigo.descricaoCompleta?.length ?? 0)
    ? (novo.descricaoCompleta ?? antigo.descricaoCompleta)
    : antigo.descricaoCompleta;

  // Preserva etapas vindas de print ou editadas manualmente quando o novo card só traz etapas automáticas ou nenhuma
  let etapasMescladas = novo.etapas ?? antigo.etapas;
  if (antigo.etapas?.length && novo.etapas?.length)
  {
    const antigoEhPrintOuManual = antigo.etapas.some((e) => e.origemEtapa === 'print' || e.origemEtapa === 'manual');
    const novoEhPrintOuManual = novo.etapas.some((e) => e.origemEtapa === 'print' || e.origemEtapa === 'manual');
    if (antigoEhPrintOuManual && !novoEhPrintOuManual)
    {
      etapasMescladas = antigo.etapas;
    }
  }

  return {
    ...antigo,
    ...definidos,
    ...(etapasMescladas ? { etapas: etapasMescladas } : {}),
    ...(descricaoCompleta ? { descricaoCompleta } : {}),
    ...(fontes.length ? { fontesCorrelacionadas: fontes } : {}),
    responsaveis: [...new Set([...antigo.responsaveis, ...novo.responsaveis])],
    origens: [...new Set([...antigo.origens, ...novo.origens])],
  };
}
