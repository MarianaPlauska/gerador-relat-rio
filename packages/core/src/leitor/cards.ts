import type { CardSnapshot, OrigemLeitura, Pessoa, Ritmo, Situacao } from '../tipos';
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

export interface OpcoesLeitura
{
  prefixo: string;
  pessoas: Pessoa[];
  origem?: OrigemLeitura;
  hoje?: string;
}

export function detectarOrigem(texto: string): OrigemLeitura
{
  const t = semAcento(texto);
  // listas do cronograma têm a coluna de vencimento; os chips de filtro ("A iniciar") não mudam isso
  if (/\bvenc\b/.test(t) && /situacao/.test(t)) return 'cronograma';
  if (/fila|a iniciar|ordenadas pela abertura/.test(t) && !/ritmo/.test(t)) return 'fila';
  if (/no\s*ritmo|em\s*risco|etapa atual|rodando ha/.test(t)) return 'em_execucao';
  return 'cronograma';
}

// separa o texto em pedaços que começam no código do card (ex.: DEV-218)
export function lerCards(texto: string, opcoes: OpcoesLeitura): CardSnapshot[]
{
  const origem = opcoes.origem ?? detectarOrigem(texto);
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
    const card = lerTrecho(codigo, texto.slice(inicio, fim), origem, opcoes.pessoas);
    card.avisosLeitura = [...(corrigido ? ['código corrigido, confira'] : []), ...(card.avisosLeitura ?? []), ...avisar(card, origem, opcoes.hoje)];
    const anterior = porCodigo.get(card.codigo);
    porCodigo.set(card.codigo, anterior ? juntarCard(anterior, card) : card);
  });
  return marcarCodigosEstranhos([...porCodigo.values()]);
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
function lerDatas(trecho: string): { datas: string[]; corrigida: boolean }
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

// une duas leituras do mesmo card; o que veio depois tem prioridade
export function juntarCard(antigo: CardSnapshot, novo: CardSnapshot): CardSnapshot
{
  const definidos = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined));
  return {
    ...antigo,
    ...definidos,
    responsaveis: [...new Set([...antigo.responsaveis, ...novo.responsaveis])],
    origens: [...new Set([...antigo.origens, ...novo.origens])],
  };
}
