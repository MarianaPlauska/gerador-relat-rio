export type Ritmo = 'no_ritmo' | 'em_risco' | 'atrasado';

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

// situação da lista do cronograma (cada item cai em uma só)
export type Situacao = 'concluido' | 'atrasado' | 'vence_15_dias' | 'a_iniciar' | 'em_execucao' | 'sem_data';

export type OrigemLeitura = 'em_execucao' | 'fila' | 'cronograma' | 'demandas' | 'card' | (string & {});

// período em que a pessoa não está disponível (férias, atestado, folga); conta como dia sem expediente no cronograma
export interface Ausencia
{
  de: string;
  ate: string;
  motivo?: string | undefined;
}

export interface Pessoa
{
  id: string;
  nome: string;
  capacidadeHorasSemana: number;
  pastas?: string[] | undefined;
  pastasRemovidas?: string[] | undefined;
  removidaDaOrganizacao?: boolean | undefined;
  historicoDe?: string | undefined;
  historicoAte?: string | undefined;
  ausencias?: Ausencia[] | undefined;
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
  // do card aberto: texto integral de "O que foi pedido" e lista de etapas com tempos
  descricaoCompleta?: string | undefined;
  assunto?: string | undefined;
  aberturaHora?: string | undefined;
  tempoTotalMin?: number | undefined;
  // "Novo · 3,3 d de atraso" na lista de demandas
  atrasoDias?: number | undefined;
  ociosoEtapasMin?: number | undefined;
  horasEstimadas?: number | undefined;
  // de onde veio o tempo estipulado: digitado pela pessoa, regra fixa ou mediana das demandas parecidas já concluídas
  origemHoras?: 'manual' | 'regra' | 'historico' | undefined;
  notaHoras?: string | undefined;
  fontesCorrelacionadas?: string[] | undefined;
  cardsRelacionados?: string[] | undefined;
  impactoSemana?: string | undefined;
  etapas?: EtapaCard[];
  comentario?: string | undefined;
  origens: OrigemLeitura[];
  avisosLeitura?: string[];
}

export interface EtapaCard
{
  ordem: number;
  nome: string;
  descricao?: string | undefined;
  pessoa?: string | undefined;
  situacao: 'nao_iniciada' | 'rodando' | 'concluida' | 'outra';
  tempoRodandoHoras?: number | undefined;
  horasEstimadas?: number | undefined;
  desde?: string | undefined;
  // etapa feita: "feita · 10 d" e "09/11/26 → 19/11/26"
  duracaoDias?: number | undefined;
  inicio?: string | undefined;
  fim?: string | undefined;
  origemEtapa?: 'print' | 'automatica' | 'manual' | undefined;
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
  pasta?: string | undefined;
  totais: TotaisPainel;
  cards: CardSnapshot[];
  ondas?: Onda[] | undefined;
  anotacao?: Anotacao | undefined;
  capturas?: CapturaLida[] | undefined;
}

// cada print ou trecho colado no painel: guarda o que foi transcrito e o que saiu dele
export interface CapturaLida
{
  id: string;
  nome: string;
  origem: OrigemLeitura;
  texto: string;
  imagemDataUrl?: string | undefined;
  // quando a imagem fica na nuvem (Firestore) em vez de dentro do registro
  imagemId?: string | undefined;
  // print de uma pessoa (clicando no responsável no painel): os cards ficam com ela, e o plano dela vem junto
  pessoaId?: string | undefined;
  oQueVaiFazer?: string | undefined;
  porque?: string | undefined;
  totais: (keyof TotaisPainel)[];
  cards: string[];
  ondas: number;
  avisos: string[];
  sugestoes: string[];
  // o que a supervisora acha desta etapa/print
  comentario?: string | undefined;
  // texto do print que não virou card nem total, e o que já tinha sido visto antes
  naoReconhecido?: string[] | undefined;
  // % das linhas com conteúdo que viraram card, total ou foram descartadas por regra
  coberturaPct?: number | undefined;
  repetidos?: { codigo: string; mudou: string[] }[] | undefined;
  novos?: string[] | undefined;
  porPessoa?: { pessoa: string; tarefas: string[] }[] | undefined;
  // o que este print preencheu na tarefa: o pedido, as etapas, os campos da tela
  trouxe?: string | undefined;
  cardPaiVinculado?: string | undefined;
  // card pai escolhido à mão na tela; vale sobre o que o sistema descobriu
  cardPaiManual?: string | undefined;
  confiancaVinculoPct?: number | undefined;
  motivoVinculo?: string | undefined;
}

// uma entrada do diário da pasta: prints + comentários unidos em um texto, guardada com dia e motivo
export interface RegistroPainel
{
  id: string;
  pasta: string;
  data: string;
  criadoEm: string;
  motivo: string;
  resumo: string;
  texto: string;
  capturas: CapturaLida[];
  cards: string[];
}

// o que a supervisão escreveu e o material de explicações gerado sobre a etapa
export interface EtapaAnotada
{
  texto: string;
  descricao?: string | undefined;
  feito: boolean;
  cards?: string[] | undefined;
}

export interface Anotacao
{
  texto: string;
  resumo: string;
  palavrasDaAutora?: string | undefined;
  etapas: EtapaAnotada[];
  cards?: string[] | undefined;
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
