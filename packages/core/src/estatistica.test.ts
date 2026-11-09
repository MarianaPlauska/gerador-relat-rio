import { describe, expect, it } from 'vitest';
import { estatisticasDoPlano, pareto, posicaoNaFaixa, resumirSerie, semanaDoAno, serieSemanal } from './estatistica';
import type { PlanoSemana, Snapshot } from './tipos';

describe('resumirSerie', () =>
{
  it('calcula média, mediana, desvio amostral e tendência', () =>
  {
    const r = resumirSerie([60, 62, 66, 70])!;
    expect(r.media).toBe(64.5);
    expect(r.mediana).toBe(64);
    expect(r.desvio).toBe(4.4);
    expect(r.minimo).toBe(60);
    expect(r.maximo).toBe(70);
    expect(r.inclinacao).toBe(3.4);
    expect(r.ultimo).toBe(70);
  });

  it('com um valor só não tem desvio nem tendência', () =>
  {
    expect(resumirSerie([5])).toMatchObject({ n: 1, desvio: 0, inclinacao: 0 });
    expect(resumirSerie([])).toBeUndefined();
  });
});

describe('serieSemanal', () =>
{
  it('usa a última foto de cada semana e para na semana pedida', () =>
  {
    const f = (data: string, v: number): Snapshot => ({ data, totais: { concluidos: v }, cards: [] });
    const serie = serieSemanal([f('2026-11-03', 10), f('2026-11-05', 12), f('2026-11-10', 15), f('2026-11-17', 20)], 'concluidos', '2026-11-09');
    expect(serie).toEqual([{ semana: '2026-11-02', valor: 12 }, { semana: '2026-11-09', valor: 15 }]);
  });
});

describe('pareto', () =>
{
  it('ordena pela frequência e acumula o percentual', () =>
  {
    expect(pareto(['a', 'b', 'a', 'c'])).toEqual([
      { rotulo: 'a', qtd: 2, pct: 50, pctAcumulado: 50 },
      { rotulo: 'b', qtd: 1, pct: 25, pctAcumulado: 75 },
      { rotulo: 'c', qtd: 1, pct: 25, pctAcumulado: 100 },
    ]);
  });
});

describe('estatisticasDoPlano', () =>
{
  it('conta status, causas, desvio de entrega e utilização', () =>
  {
    const plano: PlanoSemana = {
      inicio: '2026-11-09',
      pessoas: [
        {
          pessoaId: 'p1',
          itens: [
            { id: '1', descricao: 'a', tipo: 'planejado', status: 'feito', ateOriginal: '2026-11-10', ate: '2026-11-10', entregueEm: '2026-11-12', horasEstimadas: 20 },
            { id: '2', descricao: 'b', tipo: 'planejado', status: 'feito', ate: '2026-11-12', entregueEm: '2026-11-11', horasEstimadas: 10 },
            { id: '3', descricao: 'c', tipo: 'planejado', status: 'adiado', causa: 'bloqueio', horasEstimadas: 14 },
          ],
        },
      ],
    };
    const e = estatisticasDoPlano(plano, [{ id: 'p1', nome: 'Ana', capacidadeHorasSemana: 40 }]);
    expect(e.total).toBe(3);
    expect(e.porStatus.feito).toBe(2);
    expect(e.causas).toEqual([{ rotulo: 'bloqueio', qtd: 1, pct: 100, pctAcumulado: 100 }]);
    expect(e.desvioEntrega?.media).toBe(0.5);
    expect(e.entregasNoCombinado).toBe(1);
    expect(e.entregasComData).toBe(2);
    expect(e.utilizacaoPct).toBe(110);
  });
});

describe('semanaDoAno', () =>
{
  it('segue a ISO 8601', () =>
  {
    expect(semanaDoAno('2026-11-09')).toBe(46);
    expect(semanaDoAno('2026-01-01')).toBe(1);
  });
});

describe('posicaoNaFaixa', () =>
{
  it('compara o último valor com média e desvio', () =>
  {
    expect(posicaoNaFaixa(resumirSerie([60, 61, 60, 70])!)).toBe('acima');
    expect(posicaoNaFaixa(resumirSerie([60, 62, 61])!)).toBe('dentro');
    expect(posicaoNaFaixa(resumirSerie([60, 62])!)).toBeUndefined();
  });
});
