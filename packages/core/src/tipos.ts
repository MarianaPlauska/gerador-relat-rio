export type Ritmo = 'no_ritmo' | 'em_risco' | 'atrasado';

export type SituacaoPainel = 'planejado' | 'em_andamento' | 'concluido' | 'cancelado' | 'aguardando_terceiro';

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

export interface Pessoa
{
  id: string;
  nome: string;
  capacidadeHorasSemana: number;
}

export interface CardSnapshot
{
  codigo: string;
  titulo: string;
  sistemaOuIdItem?: string;
  prioridade: number;
  criticidade?: 1 | 2 | 3;
  inicio: string;
  vencimento: string;
  previsao?: string;
  dataFixada: boolean;
  concluidoEm?: string;
  reaberto?: boolean;
  etapasConcluidas: number;
  etapasTotal: number;
  etapaAtual?: string;
  responsavelEtapaAtual?: string;
  responsaveis: string[];
  etapaAtualStatus?: 'rodando' | 'aguardando_start' | 'parada_na_fila';
  etapaAtualRodandoHaDias?: number;
  ritmoPainel?: Ritmo;
  situacaoPainel: SituacaoPainel;
  comQuem?: 'com_a_gente' | 'com_o_cliente' | 'com_times_internos';
}

export interface Snapshot
{
  data: string;
  cards: CardSnapshot[];
}

export interface ItemPlano
{
  id: string;
  cardCodigo?: string;
  descricao: string;
  tipo: 'planejado' | 'nao_planejado';
  horasEstimadas: number;
  horasRealizadas?: number;
  status: 'a_fazer' | 'fazendo' | 'feito' | 'bloqueado' | 'adiado';
  motivoNaoFeito?: string;
  causa?: 'requisito_mudou' | 'dependencia_externa' | 'estimativa_errada' | 'bloqueio' | 'urgencia' | 'outro';
}

export interface PlanoPessoa
{
  pessoaId: string;
  itens: ItemPlano[];
  observacao?: string;
}

export interface PlanoSemana
{
  inicio: string;
  pessoas: PlanoPessoa[];
  fechadoEm?: string;
}

export interface Risco
{
  id: string;
  cardCodigo?: string;
  pessoaId?: string;
  descricao: string;
  origem: 'automatico' | 'manual';
  probabilidade: 'baixa' | 'media' | 'alta';
  impacto: 'baixo' | 'medio' | 'alto';
  impactoEmDias?: number;
  gatilho: string;
  planoB: string;
  decisaoNecessaria?: string;
  prazoDecisao?: string;
  sinalizadoEm: string;
  status: 'aberto' | 'mitigado' | 'ocorreu' | 'descartado';
  resultado?: string;
}

export interface Promessa
{
  id: string;
  semana: string;
  texto: string;
  cumprida?: boolean;
  justificativa?: string;
}

export interface ComentarioSecao
{
  secaoId: string;
  texto: string;
  incluirNoRelatorio: boolean;
}
