// regras de cálculo em um só lugar. "confirmado: false" = valor provisório

export type RegraAtribuicao = 'etapa_atual' | 'todos_envolvidos' | 'primeiro_responsavel';

export interface Definicoes
{
  contagemDias: { tipo: 'uteis' | 'corridos'; confirmado: boolean };
  feriados: string[];
  ritmo: {
    // diferença em pontos percentuais entre prazo consumido e etapas concluídas
    limiarEmRisco: number;
    limiarAtrasado: number;
    base: 'vencimento' | 'previsao';
    confirmado: boolean;
  };
  venceEmAte: { dias: number; incluiHoje: boolean; confirmado: boolean };
  dentroDoPrazo: {
    janela: 'mes_calendario';
    referencia: 'vencimento' | 'previsao';
    confirmado: boolean;
  };
  concluidos: { cancelaNoDenominador: boolean; reabertoContaConcluido: boolean; confirmado: boolean };
  atribuicao: RegraAtribuicao;
  metas: {
    dentroDoPrazoPorMes: Record<string, number>;
    qualidade: number;
  };
  semaforo: {
    // distância até a meta em pontos percentuais
    amareloAte: number;
    confirmado: boolean;
  };
}

export const definicoesPadrao: Definicoes = {
  contagemDias: { tipo: 'uteis', confirmado: true },
  feriados: ['2026-11-15', '2026-11-20', '2026-12-25', '2027-01-01'],
  ritmo: { limiarEmRisco: 20, limiarAtrasado: 50, base: 'vencimento', confirmado: false },
  venceEmAte: { dias: 15, incluiHoje: true, confirmado: false },
  dentroDoPrazo: { janela: 'mes_calendario', referencia: 'vencimento', confirmado: true },
  concluidos: { cancelaNoDenominador: true, reabertoContaConcluido: false, confirmado: false },
  atribuicao: 'etapa_atual',
  metas: {
    dentroDoPrazoPorMes: { '2026-11': 75, '2026-12': 80, '2027-01': 85 },
    qualidade: 95,
  },
  semaforo: { amareloAte: 5, confirmado: false },
};

export const nomesAtribuicao: Record<RegraAtribuicao, string> = {
  etapa_atual: 'responsável da etapa atual',
  todos_envolvidos: 'todos os envolvidos',
  primeiro_responsavel: 'primeiro responsável',
};
