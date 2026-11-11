export type Ritmo = 'no_ritmo' | 'em_risco' | 'atrasado';

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

// situação da lista do cronograma (cada item cai em uma só)
export type Situacao = 'concluido' | 'atrasado' | 'vence_15_dias' | 'a_iniciar' | 'em_execucao' | 'sem_data';

export type OrigemLeitura = 'em_execucao' | 'fila' | 'cronograma' | 'demandas' | 'card';

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
  // lista de Demandas: abertura do card, status do card ("Planejado", "Novo"...) e quando o planejado começa
  abertura?: string;
  statusCard?: string;
  planejadoPara?: string;
  // do CSV exportado da lista de Demandas: prioridade e horas da abertura até a conclusão, como o painel calcula
  prioridadeCard?: string;
  horasAteConcluir?: number;
  // do card aberto: a lista de etapas
  etapas?: EtapaCard[];
  origens: OrigemLeitura[];
  avisosLeitura?: string[];
}

export interface EtapaCard
{
  ordem: number;
  nome: string;
  pessoa?: string | undefined;
  situacao: 'nao_iniciada' | 'rodando' | 'concluida' | 'outra';
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
  etapasConcluidas?: number;
  // variações que o painel mostra contra os 30 dias anteriores
  etapasConcluidasVariacao?: number;
  tempoMedianoEtapaMin?: number;
  ociosoPct?: number;
  ociosoHoras?: number;
  tempoLimpoMedianaH?: number;
  tempoLimpoVariacaoH?: number;
  tempoLimpoMediaDias?: number;
}

// linha do "Resumo por onda" do painel de projetos
export interface Onda
{
  nome: string;
  inicio?: string | undefined;
  fim?: string | undefined;
  itens?: number | undefined;
  concluidos?: number | undefined;
  pct?: number | undefined;
  proximoVencimento?: string | undefined;
  situacao?: string | undefined;
}

export interface Snapshot
{
  data: string;
  totais: TotaisPainel;
  cards: CardSnapshot[];
  ondas?: Onda[] | undefined;
}

export interface ItemPlano
{
  id: string;
  cardCodigo?: string;
  descricao: string;
  objetivo?: string;
  // frente de trabalho e dor do cliente/área que o item ataca
  frente?: string;
  dor?: string;
  // data combinada para entregar; a original fica guardada para saber se foi alterada
  ate?: string;
  ateOriginal?: string;
  tipo: 'planejado' | 'nao_planejado';
  horasEstimadas?: number;
  horasRealizadas?: number;
  status: 'a_fazer' | 'fazendo' | 'feito' | 'bloqueado' | 'adiado';
  entregueEm?: string;
  motivoNaoFeito?: string;
  causa?: 'requisito_mudou' | 'dependencia_externa' | 'estimativa_errada' | 'bloqueio' | 'urgencia' | 'outro';
}

export interface PlanoPessoa
{
  pessoaId: string;
  itens: ItemPlano[];
  // maior problema ou dificuldade da pessoa na semana
  dificuldade?: string;
  observacao?: string;
}

export interface PlanoSemana
{
  inicio: string;
  pessoas: PlanoPessoa[];
  // a partir daqui as datas combinadas ficam guardadas e mudança conta como alteração
  confirmadoEm?: string;
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

// o que eu marquei no meu acompanhamento entre uma foto do painel e outra
export interface ControleCard
{
  etapasConcluidas?: number;
  etapaAtual?: string;
  responsavelEtapaAtual?: string;
  etapaAtualStatus?: CardSnapshot['etapaAtualStatus'];
  atualizadoEm: string;
}
