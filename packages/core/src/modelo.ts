import { nomesTotais } from './leitor/totais';
import type { PlanoPessoa, PlanoSemana, TotaisPainel } from './tipos';

export const nomesSecoes = {
  resumo: 'Sumário executivo',
  apresentacao: 'Apresentação e metodologia',
  comparativo: 'Indicadores do painel',
  ondas: 'Projetos por onda',
  fluxo: 'Fluxo e previsão',
  estatistica: 'Análise estatística',
  execucao: 'Execução do plano',
  time: 'Desempenho por pessoa',
  analise: 'Constatações',
  frentes: 'Frentes de trabalho e dores',
  atencao: 'Pontos de atenção',
  riscos: 'Riscos e plano B',
  compromissos: 'Compromissos com a gestão',
  notas: 'Conclusões e encaminhamentos',
  plano: 'Anexo: plano detalhado',
  movimento: 'Anexo: movimento dos cards',
  glossario: 'Anexo: glossário',
} as const;
export type SecaoPadrao = keyof typeof nomesSecoes;

// o que cada seção mostra, para o pedido de modelo e para a tela
export const descricoesSecoes: Record<SecaoPadrao, string> = {
  resumo: 'semáforo, resumo escrito, quadro-resumo dos indicadores-chave e principais constatações',
  apresentacao: 'objetivo, fontes de dados e metodologia',
  comparativo: 'tabela de todos os indicadores do painel (anterior x atual), operação do time (etapas, ocioso, tempo limpo), gráficos de evolução e distribuição do ritmo',
  ondas: 'resumo por onda do cronograma (prioridade 1, 2...): janela, itens, concluídos e próximo vencimento',
  fluxo: 'projeção da meta de prazo no fim do mês, tempo de entrega por prioridade (p50 e p85), cards parados além do normal e etapas onde as demandas se acumulam',
  estatistica: 'média, mediana, desvio-padrão, mínimo, máximo e tendência de cada indicador, com leitura dos resultados',
  execucao: 'itens do plano por situação, prazo das entregas, capacidade, Pareto das causas e itens não concluídos',
  time: 'resultado por pessoa, gráfico do plano por pessoa, ritmo das demandas por responsável e dificuldades',
  analise: 'constatações automáticas separadas em atenção, positivas e outras',
  frentes: 'matriz de frentes de trabalho por pessoa e dores atacadas',
  atencao: 'alertas do plano e demandas em risco, atrasadas ou com previsão vencida',
  riscos: 'registro de riscos com plano B e decisão necessária',
  compromissos: 'compromissos assumidos com a gestão e se foram cumpridos',
  notas: 'destaques, decisões pedidas, próximos passos e quadro de aprovação',
  plano: 'anexo com o plano completo de cada pessoa',
  movimento: 'anexo com os cards que mudaram de etapa, ritmo ou previsão',
  glossario: 'anexo com o dicionário do painel e os termos do relatório',
};

export type Bloco =
  | { tipo: 'secao'; secao: SecaoPadrao }
  | { tipo: 'texto'; titulo: string; texto: string }
  | { tipo: 'grafico'; indicador: keyof TotaisPainel; titulo?: string | undefined; comMeta?: boolean | undefined }
  | { tipo: 'tabela'; indicadores: (keyof TotaisPainel)[]; titulo?: string | undefined }
  | { tipo: 'quebra' };

export interface Modelo
{
  id: string;
  nome: string;
  descricao: string;
  // título grande da capa
  titulo: string;
  // vai no número do relatório: RS-DEV-2026-S46
  sigla: string;
  periodo: 'semana' | 'livre';
  capa: 'completa' | 'curta';
  sumario: boolean;
  blocos: Bloco[];
}

const secoes = (...lista: SecaoPadrao[]): Bloco[] => lista.map((secao) => ({ tipo: 'secao', secao }));

export const modelosProntos: Modelo[] = [
  {
    id: 'semanal',
    nome: 'Semanal completo',
    descricao: 'Relatório técnico oficial da semana, com estatística e anexos.',
    titulo: 'Acompanhamento Semanal',
    sigla: 'RS',
    periodo: 'semana',
    capa: 'completa',
    sumario: true,
    blocos: secoes('resumo', 'apresentacao', 'comparativo', 'ondas', 'fluxo', 'estatistica', 'execucao', 'time', 'analise', 'frentes', 'atencao', 'riscos', 'compromissos', 'notas', 'plano', 'movimento', 'glossario'),
  },
  {
    id: 'executivo',
    nome: 'Executivo',
    descricao: 'Duas a três páginas para a gestão ler em poucos minutos: situação, prazo, atenção, riscos e decisões.',
    titulo: 'Resumo Executivo',
    sigla: 'RE',
    periodo: 'semana',
    capa: 'curta',
    sumario: false,
    blocos: [
      ...secoes('resumo'),
      { tipo: 'grafico', indicador: 'dentroDoPrazoPct', titulo: 'Dentro do prazo (%) por semana, com a meta do painel', comMeta: true },
      ...secoes('atencao', 'riscos', 'notas'),
    ],
  },
  {
    id: 'periodo',
    nome: 'Período / mensal',
    descricao: 'Do dia X ao dia Y: evolução dos indicadores, estatística, entregas e compromissos de todo o período.',
    titulo: 'Relatório do Período',
    sigla: 'RP',
    periodo: 'livre',
    capa: 'completa',
    sumario: true,
    blocos: secoes('resumo', 'apresentacao', 'comparativo', 'ondas', 'fluxo', 'estatistica', 'execucao', 'time', 'analise', 'riscos', 'compromissos', 'notas', 'glossario'),
  },
];

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehIndicador = (v: unknown): v is keyof TotaisPainel => ehTexto(v) && v in nomesTotais;
const ehSecao = (v: unknown): v is SecaoPadrao => ehTexto(v) && v in nomesSecoes;

function lerBloco(b: unknown, posicao: number, erros: string[]): Bloco | undefined
{
  const o = (b ?? {}) as Record<string, unknown>;
  const onde = `Bloco ${posicao}`;
  switch (o.tipo)
  {
    case 'secao':
      if (ehSecao(o.secao)) return { tipo: 'secao', secao: o.secao };
      erros.push(`${onde}: seção "${String(o.secao)}" não existe.`);
      return undefined;
    case 'texto':
      return { tipo: 'texto', titulo: ehTexto(o.titulo) ? o.titulo : 'Observações', texto: ehTexto(o.texto) ? o.texto : '' };
    case 'grafico':
      if (ehIndicador(o.indicador)) return { tipo: 'grafico', indicador: o.indicador, titulo: ehTexto(o.titulo) ? o.titulo : undefined, comMeta: o.comMeta === true };
      erros.push(`${onde}: indicador "${String(o.indicador)}" não existe.`);
      return undefined;
    case 'tabela':
    {
      const lista = Array.isArray(o.indicadores) ? o.indicadores : [];
      const validos = lista.filter(ehIndicador);
      for (const x of lista.filter((x) => !ehIndicador(x))) erros.push(`${onde}: indicador "${String(x)}" não existe.`);
      if (validos.length) return { tipo: 'tabela', indicadores: validos, titulo: ehTexto(o.titulo) ? o.titulo : undefined };
      erros.push(`${onde}: tabela sem indicadores válidos.`);
      return undefined;
    }
    case 'quebra':
      return { tipo: 'quebra' };
    default:
      erros.push(`${onde}: tipo "${String(o.tipo)}" não existe.`);
      return undefined;
  }
}

// lê um modelo colado (de uma IA, de um arquivo ou de um backup); o que não reconhece vira erro e fica de fora
export function validarModelo(texto: string): { modelo?: Modelo; erros: string[] }
{
  const erros: string[] = [];
  const bruto = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let o: Record<string, unknown>;
  try
  {
    o = JSON.parse(bruto) as Record<string, unknown>;
  }
  catch
  {
    return { erros: ['O texto não é um JSON válido. Copie só o bloco que começa com { e termina com }.'] };
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { erros: ['O JSON precisa ser um objeto com nome e blocos.'] };
  const blocos = (Array.isArray(o.blocos) ? o.blocos : []).map((b, i) => lerBloco(b, i + 1, erros)).filter((b): b is Bloco => !!b);
  if (!blocos.length) return { erros: [...erros, 'O modelo não tem nenhum bloco válido.'] };
  const nome = ehTexto(o.nome) && o.nome.trim() ? o.nome.trim() : 'Modelo sem nome';
  return {
    modelo: {
      id: ehTexto(o.id) && o.id.trim() ? o.id.trim() : `m${Date.now().toString(36)}`,
      nome,
      descricao: ehTexto(o.descricao) ? o.descricao : '',
      titulo: ehTexto(o.titulo) && o.titulo.trim() ? o.titulo.trim() : nome,
      sigla: ehTexto(o.sigla) && /^[A-Z]{2,4}$/.test(o.sigla) ? o.sigla : 'RM',
      periodo: o.periodo === 'livre' ? 'livre' : 'semana',
      capa: o.capa === 'curta' ? 'curta' : 'completa',
      sumario: o.sumario !== false,
      blocos,
    },
    erros,
  };
}

// texto para colar num chat de IA gratuito; a resposta volta pela caixa de importar
export function pedidoDeModelo(descricao: string): string
{
  const exemplo = modelosProntos.find((m) => m.id === 'executivo')!;
  return [
    'Você vai montar um modelo de relatório para o sistema OrbisOS.',
    'Responda SOMENTE com um JSON válido, sem texto antes ou depois.',
    'Use apenas os tipos de bloco, seções e indicadores listados abaixo. Não invente nomes.',
    '',
    '## Campos do modelo',
    '- nome: nome curto do modelo',
    '- descricao: uma frase dizendo para que serve',
    '- titulo: título grande da capa',
    '- sigla: 2 a 4 letras maiúsculas que vão no número do relatório (ex.: RS, RE, RP)',
    '- periodo: "semana" (uma semana) ou "livre" (do dia X ao dia Y)',
    '- capa: "completa" (página só para a capa) ou "curta" (faixa no topo da primeira página)',
    '- sumario: true ou false',
    '- blocos: lista em ordem do que aparece no relatório',
    '',
    '## Tipos de bloco',
    '- {"tipo": "secao", "secao": "<seção>"}: uma seção pronta (lista abaixo)',
    '- {"tipo": "texto", "titulo": "...", "texto": "..."}: texto livre; linhas que começam com "-" viram lista',
    '- {"tipo": "grafico", "indicador": "<indicador>", "titulo": "...", "comMeta": true}: gráfico de linha do indicador semana a semana; comMeta mostra a meta do painel',
    '- {"tipo": "tabela", "indicadores": ["<indicador>", ...], "titulo": "..."}: tabela anterior x atual x variação',
    '- {"tipo": "quebra"}: começa uma página nova',
    '',
    '## Seções prontas',
    ...(Object.keys(nomesSecoes) as SecaoPadrao[]).map((s) => `- ${s}: ${nomesSecoes[s]} (${descricoesSecoes[s]})`),
    '',
    '## Indicadores do painel',
    ...(Object.keys(nomesTotais) as (keyof TotaisPainel)[]).map((k) => `- ${k}: ${nomesTotais[k]}`),
    '',
    '## Exemplo',
    JSON.stringify({ ...exemplo, id: undefined }, null, 2),
    '',
    '## O modelo que eu quero',
    descricao.trim() || '(descreva aqui o modelo)',
  ].join('\n');
}

// junta os planos das semanas do período num só, por pessoa, para os KPIs de semana servirem no período
export function planoDoPeriodo(planos: PlanoSemana[], inicio: string, fim: string): PlanoSemana | undefined
{
  const dentro = planos.filter((p) => p.inicio >= inicio && p.inicio <= fim).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!dentro.length) return undefined;
  const porPessoa = new Map<string, PlanoPessoa>();
  for (const plano of dentro)
  {
    for (const pp of plano.pessoas)
    {
      const atual = porPessoa.get(pp.pessoaId);
      if (!atual)
      {
        porPessoa.set(pp.pessoaId, { ...pp, itens: [...pp.itens] });
        continue;
      }
      atual.itens.push(...pp.itens);
      if (pp.dificuldade?.trim()) atual.dificuldade = pp.dificuldade;
    }
  }
  const confirmados = dentro.map((p) => p.confirmadoEm).filter((d): d is string => !!d);
  const fechados = dentro.map((p) => p.fechadoEm).filter((d): d is string => !!d);
  const plano: PlanoSemana = { inicio, pessoas: [...porPessoa.values()] };
  if (confirmados.length) plano.confirmadoEm = confirmados[0]!;
  if (fechados.length === dentro.length) plano.fechadoEm = fechados.at(-1)!;
  return plano;
}
