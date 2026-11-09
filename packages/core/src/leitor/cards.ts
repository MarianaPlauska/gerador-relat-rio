import type { CardSnapshot, OrigemLeitura, Pessoa, Ritmo, Situacao } from '../tipos';
import { dataBrParaIso, numeroBr, semAcento } from './normalizar';

const RE_DATA = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})/g;
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
  if (/fila|a iniciar|ordenadas pela abertura/.test(t) && !/ritmo/.test(t)) return 'fila';
  if (/no\s*ritmo|em\s*risco|etapa atual|rodando ha/.test(t)) return 'em_execucao';
  return 'cronograma';
}

// separa o texto em pedaços que começam no código do card (ex.: DEV-218)
export function lerCards(texto: string, opcoes: OpcoesLeitura): CardSnapshot[]
{
  const origem = opcoes.origem ?? detectarOrigem(texto);
  // aceita letras depois do prefixo para não perder card que a imagem leu errado (ex.: DEV-NS)
  const re = new RegExp(`\\b${opcoes.prefixo}-[0-9A-Z]{2,4}\\b`, 'g');
  const marcas = [...texto.matchAll(re)];
  const porCodigo = new Map<string, CardSnapshot>();
  marcas.forEach((m, i) =>
  {
    const inicio = m.index + m[0].length;
    const fim = marcas[i + 1]?.index ?? texto.length;
    const card = lerTrecho(m[0], texto.slice(inicio, fim), origem, opcoes.pessoas);
    card.avisosLeitura = avisar(card, origem, opcoes.hoje);
    const anterior = porCodigo.get(card.codigo);
    porCodigo.set(card.codigo, anterior ? juntarCard(anterior, card) : card);
  });
  return [...porCodigo.values()];
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

  const datas = [...trecho.matchAll(RE_DATA)].map((d) => dataBrParaIso(d[1]!, d[2]!, d[3]!));
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

  if (trecho.includes('★')) card.dataFixada = true;

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
    s = s.replace(RE_DATA, '').replace(RE_ETAPAS, '').replace(/★/g, '').replace(RE_STATUS, '');
    for (const n of nomesAchados) s = s.replace(new RegExp(n, 'i'), '');
    // a etiqueta de ritmo vem com bolinha e borda, que a imagem lê como "(e emrisco )"
    s = s.replace(/\(?\s*\b[eo]?\s*(no\s*ritmo|em\s*risco|atrasad[oa])\s*\)?/gi, '');
    for (const [r] of situacoes) s = s.replace(r, '');
    s = s.replace(/^[\s·•|-]+|[\s·•|-]+$/g, '').replace(/\s+/g, ' ').trim();
    if (s.length > 1) livres.push(s);
  }

  if (origem === 'cronograma')
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
