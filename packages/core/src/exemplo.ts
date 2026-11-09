import type { CardSnapshot, Pessoa, PlanoSemana, Snapshot } from './tipos';

// dados fictícios só para desenvolvimento, até chegar o export real

export const pessoasExemplo: Pessoa[] = [
  { id: 'ana', nome: 'Ana', capacidadeHorasSemana: 40 },
  { id: 'bruno', nome: 'Bruno', capacidadeHorasSemana: 40 },
  { id: 'carla', nome: 'Carla', capacidadeHorasSemana: 30 },
];

const cards: CardSnapshot[] = [
  {
    codigo: 'DEV-080', titulo: 'Integração de faturamento', prioridade: 1, criticidade: 1,
    inicio: '2026-10-19', vencimento: '2026-11-20', dataFixada: true,
    etapasConcluidas: 0, etapasTotal: 4, etapaAtual: 'Análise', responsavelEtapaAtual: 'ana',
    responsaveis: ['ana', 'bruno'], etapaAtualStatus: 'parada_na_fila',
    situacaoPainel: 'em_andamento', comQuem: 'com_a_gente',
  },
  {
    codigo: 'DEV-081', titulo: 'Relatório de glosas', prioridade: 1,
    inicio: '2026-10-26', vencimento: '2026-11-27', dataFixada: false,
    etapasConcluidas: 2, etapasTotal: 4, etapaAtual: 'Desenvolvimento', responsavelEtapaAtual: 'bruno',
    responsaveis: ['bruno', 'carla'], etapaAtualStatus: 'rodando', etapaAtualRodandoHaDias: 2,
    situacaoPainel: 'em_andamento', comQuem: 'com_a_gente',
  },
  {
    codigo: 'DEV-082', titulo: 'Ajuste de cadastro', prioridade: 2,
    inicio: '2026-10-05', vencimento: '2026-11-04', dataFixada: false,
    etapasConcluidas: 1, etapasTotal: 3, etapaAtual: 'Homologação', responsavelEtapaAtual: 'carla',
    responsaveis: ['carla'], etapaAtualStatus: 'aguardando_start',
    situacaoPainel: 'em_andamento', comQuem: 'com_o_cliente',
  },
  {
    codigo: 'DEV-083', titulo: 'Tela de autorização', prioridade: 1,
    inicio: '2026-10-01', vencimento: '2026-11-06', dataFixada: false, concluidoEm: '2026-11-05',
    etapasConcluidas: 3, etapasTotal: 3, responsaveis: ['ana'],
    situacaoPainel: 'concluido',
  },
  {
    codigo: 'DEV-084', titulo: 'Exportação de lotes', prioridade: 3,
    inicio: '2026-11-23', vencimento: '2026-12-18', dataFixada: false,
    etapasConcluidas: 0, etapasTotal: 3, responsaveis: ['bruno'],
    situacaoPainel: 'planejado',
  },
];

export const snapshotExemplo: Snapshot = { data: '2026-11-08T18:00:00', cards };

export const planoExemplo: PlanoSemana = {
  inicio: '2026-11-09',
  pessoas: [
    {
      pessoaId: 'ana',
      itens: [
        { id: 'p1', cardCodigo: 'DEV-080', descricao: 'Concluir análise', tipo: 'planejado', horasEstimadas: 16, status: 'a_fazer' },
        { id: 'p2', descricao: 'Suporte produção', tipo: 'nao_planejado', horasEstimadas: 6, status: 'feito', horasRealizadas: 8 },
      ],
    },
    {
      pessoaId: 'bruno',
      itens: [
        { id: 'p3', cardCodigo: 'DEV-081', descricao: 'Desenvolver relatório', tipo: 'planejado', horasEstimadas: 30, status: 'fazendo' },
      ],
    },
  ],
};
