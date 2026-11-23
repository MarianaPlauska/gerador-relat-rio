import { describe, expect, it } from 'vitest';
import { chaveDoItemPlano, historicoDaFila } from './historico-semanal';

describe('histórico da fila', () =>
{
  it('calcula saldo, saídas maiores que entradas e backlog crescendo 2 semanas seguidas', () =>
  {
    const h = historicoDaFila([
      { semana: '2026-11-16', entradas: 5, saidas: 4, backlog: 32 },
      { semana: '2026-11-02', entradas: 6, saidas: 8, backlog: 28 },
      { semana: '2026-11-09', entradas: 7, saidas: 5, backlog: 30 },
      { semana: '2026-11-23', backlog: 31 },
    ]);
    expect(h.map((x) => x.semana)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(h[0]).toMatchObject({ saldo: 2, saidasOk: true, cresceu2Seguidas: false });
    expect(h[1]).toMatchObject({ saldo: -2, saidasOk: false, backlogCresceu: true, cresceu2Seguidas: false });
    expect(h[2]).toMatchObject({ backlogCresceu: true, cresceu2Seguidas: true });
    expect(h[3]).toMatchObject({ backlogCresceu: false, cresceu2Seguidas: false, saldo: undefined });
  });

  it('a chave do item ignora acento, caixa e espaços', () =>
  {
    expect(chaveDoItemPlano({ cardCodigo: 'DEV-1', descricao: '  Concluir   Modelagem ' })).toBe(chaveDoItemPlano({ cardCodigo: 'DEV-1', descricao: 'concluir modelagem' }));
    expect(chaveDoItemPlano({ descricao: 'Revisão' })).toBe('|revisao');
  });
});
