import type { Pessoa, PlanoSemana, Snapshot } from './tipos';

// time real; capacidade provisória até a supervisora confirmar
export const pessoasExemplo: Pessoa[] = [
  { id: 'rodrigo-cinelli', nome: 'Rodrigo Cinelli', capacidadeHorasSemana: 40 },
  { id: 'douglas-cerqueira', nome: 'Douglas Cerqueira', capacidadeHorasSemana: 40 },
  { id: 'mariana-coutinho', nome: 'Mariana Coutinho', capacidadeHorasSemana: 40 },
  { id: 'evandro-medeiros', nome: 'Evandro Medeiros', capacidadeHorasSemana: 40 },
];

export function fotoVazia(data: string): Snapshot
{
  return { data, totais: {}, cards: [] };
}

export const planoExemplo: PlanoSemana = {
  inicio: '2026-11-09',
  pessoas: [
    {
      pessoaId: 'mariana-coutinho',
      itens: [
        {
          id: 'p1', cardCodigo: 'DEV-198', descricao: 'Concluir modelagem', objetivo: 'liberar implementação',
          tipo: 'planejado', horasEstimadas: 12, status: 'a_fazer',
        },
      ],
    },
  ],
};
