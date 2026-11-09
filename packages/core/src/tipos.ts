export type Ritmo = 'no_ritmo' | 'em_risco' | 'atrasado';

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

// situação da lista do cronograma (cada item cai em uma só)
export type Situacao = 'concluido' | 'atrasado' | 'vence_15_dias' | 'a_iniciar' | 'em_execucao' | 'sem_data';

export type OrigemLeitura = 'em_execucao' | 'fila' | 'cronograma';

export interface Pessoa
{
  id: string;
  nome: string;
  capacidadeHorasSemana: number;
}

// tudo opcional porque cada tela do painel mostra só parte do card
export interface CardSnapshot
{
  codigo: string;
  sistema?: string;
  titulo?: string;
  prioridade?: number;
  criticidade?: 1 | 2 | 3;
  inicio?: string;
  vencimento?: string;
  previsao?: string;
  dataFixada?: boolean;
  concluidoEm?: string;
  reaberto?: boolean;
  etapasConcluidas?: number;
  etapasTotal?: number;
  etapaAtual?: string;
  responsavelEtapaAtual?: string;
  responsaveis: string[];
  etapaAtualStatus?: 'rodando' | 'aguardando_start' | 'parada_na_fila';
  etapaAtualRodandoHaDias?: number;
  ritmoPainel?: Ritmo;
  situacao?: Situacao;
  comQuem?: 'com_a_gente' | 'com_o_cliente' | 'com_times_internos';
  origens: OrigemLeitura[];
  avisosLeitura?: string[];
}

// números exatamente como aparecem no painel do gestor
export interface TotaisPainel
{
  itensCronograma?: number;
  aindaPlanejado?: number;
  emExecucao?: number;
  vencem15Dias?: number;
  atrasadosVencimento?: number;
  datasFixadas?: number;
  concluidos?: number;
  concluidosPct?: number;
  demandasEmAndamento?: number;
  etapaRodando?: number;
  paradasEntreEtapas?: number;
  ritmoAtrasadas?: number;
  ritmoEmRisco?: number;
  ritmoNoRitmo?: number;
  emAbertoAgora?: number;
  foraDoPrazo?: number;
  dentroDoPrazoPct?: number;
  metaPct?: number;
  concluidasNoPeriodo?: number;
  previsoesSemana?: number;
  previsaoVencida?: number;
  eficiencia?: number;
  eficienciaPrazo?: number;
  eficienciaVazao?: number;
  eficienciaQualidade?: number;
  qualidadePct?: number;
  idadeAte1Dia?: number;
  idade1a3Dias?: number;
  idade3a7Dias?: number;
  idade7a15Dias?: number;
  idadeMais15Dias?: number;
}

export interface Snapshot
{
  data: string;
  totais: TotaisPainel;
  cards: CardSnapshot[];
}

export interface ItemPlano
{
  id: string;
  cardCodigo?: string;
  descricao: string;
  objetivo?: string;
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
