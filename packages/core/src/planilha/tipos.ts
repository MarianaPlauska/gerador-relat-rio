// planilha organizada a partir de material solto (prompt, ideias, links) por uma IA gratuita:
// grupos na ordem pedida, itens com valores e link ao lado, alternativas, notas e orçamento

export type SituacaoLinha = 'verificado' | 'estimativa';
export type PrioridadeLinha = 'essencial' | 'importante' | 'desejavel';

export interface LinhaPlanilha
{
  id: string;
  grupo: string;
  item: string;
  detalhe: string;
  qtd: number;
  loja: string;
  // valores unitários: o que faltar assume a referência
  min?: number | undefined;
  ref?: number | undefined;
  max?: number | undefined;
  situacao: SituacaoLinha;
  prioridade: PrioridadeLinha;
  incluir: boolean;
  link?: string | undefined;
  observacao: string;
}

export interface Alternativa
{
  id: string;
  item: string;
  opcao: string;
  loja: string;
  valor?: number | undefined;
  // AAAA-MM-DD
  data?: string | undefined;
  link?: string | undefined;
  observacao: string;
}

export interface NotasPlanilha
{
  comoLer: string[];
  premissas: string[];
  atencao: string[];
}

export interface Planilha
{
  id: string;
  nome: string;
  objetivo: string;
  criadoEm: string;
  atualizadoEm: string;
  // valores em reais; sem moeda os números são só quantidades ou pontos
  moeda: boolean;
  // a aba Alternativas só existe quando a usuária pede
  comAlternativas: boolean;
  orcamento?: number | undefined;
  // ordem dos grupos
  grupos: string[];
  linhas: LinhaPlanilha[];
  alternativas: Alternativa[];
  notas: NotasPlanilha;
}

export const nomesSituacao: Record<SituacaoLinha, string> = { verificado: 'Verificado', estimativa: 'Estimativa' };
export const nomesPrioridade: Record<PrioridadeLinha, string> = { essencial: 'Essencial', importante: 'Importante', desejavel: 'Desejável' };
