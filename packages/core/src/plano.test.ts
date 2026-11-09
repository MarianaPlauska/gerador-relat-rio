import { describe, expect, it } from 'vitest';
import { pessoasExemplo } from './exemplo';
import
{
  alertasDoItem, alertasDoPlano, confirmarPlano, datasAlteradasNoPainel, kpisDosItens, mapaDeDores, mapaDeFrentes, pendenciasDaSemana, sugerirItens,
} from './plano';
import type { CardSnapshot, ItemPlano, PlanoSemana } from './tipos';

const card = (codigo: string, extra: Partial<CardSnapshot> = {}): CardSnapshot =>
  ({ codigo, responsaveis: [], origens: ['em_execucao'], ...extra });
const item = (id: string, extra: Partial<ItemPlano> = {}): ItemPlano =>
  ({ id, descricao: 'x', tipo: 'planejado', status: 'a_fazer', ...extra });

describe('alertasDoItem', () =>
{
  it('avisa quando a entrega passa da previsão do painel', () =>
  {
    const a = alertasDoItem(item('1', { cardCodigo: 'DEV-198', ate: '2026-11-13' }), 'mariana-coutinho', '2026-11-09', card('DEV-198', { previsao: '2026-11-11' }));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ nivel: 'medio', texto: 'DEV-198: entrega em 13/11 passa da previsão do painel (11/11)' });
  });

  it('vencimento pesa mais que previsão', () =>
  {
    const a = alertasDoItem(item('1', { cardCodigo: 'DEV-1', ate: '2026-11-20' }), 'p', '2026-11-09', card('DEV-1', { previsao: '2026-11-11', vencimento: '2026-11-15' }));
    expect(a.map((x) => x.nivel)).toEqual(['alto']);
  });

  it('dentro do combinado não gera alerta', () =>
  {
    expect(alertasDoItem(item('1', { cardCodigo: 'DEV-1', ate: '2026-11-10' }), 'p', '2026-11-09', card('DEV-1', { previsao: '2026-11-11' }))).toEqual([]);
  });

  it('previsão vencida e ritmo atrasado viram alerta alto', () =>
  {
    const a = alertasDoItem(item('1', { cardCodigo: 'DEV-1' }), 'p', '2026-11-09', card('DEV-1', { previsao: '2026-11-05', ritmoPainel: 'atrasado' }));
    expect(a.map((x) => x.nivel)).toEqual(['alto', 'alto']);
  });

  it('item feito não alerta', () =>
  {
    expect(alertasDoItem(item('1', { cardCodigo: 'DEV-1', status: 'feito', ate: '2026-12-01' }), 'p', '2026-11-09', card('DEV-1', { previsao: '2026-11-11' }))).toEqual([]);
  });
});

describe('alertasDoPlano', () =>
{
  it('avisa quando as horas passam da capacidade', () =>
  {
    const plano: PlanoSemana = { inicio: '2026-11-09', pessoas: [{ pessoaId: 'mariana-coutinho', itens: [item('1', { horasEstimadas: 30 }), item('2', { horasEstimadas: 15 })] }] };
    const a = alertasDoPlano(plano, [], pessoasExemplo);
    expect(a[0]!.texto).toBe('Mariana Coutinho: 45h planejadas passam da capacidade de 40h');
  });
});

describe('kpisDosItens', () =>
{
  it('conta feitos, alterados e continuidade no cronograma', () =>
  {
    const cards = [card('A', { previsao: '2026-11-11', vencimento: '2026-11-20' }), card('B', { previsao: '2026-11-10' })];
    const k = kpisDosItens([
      item('1', { cardCodigo: 'A', status: 'feito', entregueEm: '2026-11-11' }),
      item('2', { cardCodigo: 'B', status: 'feito', entregueEm: '2026-11-12' }),
      item('3', { ate: '2026-11-14', ateOriginal: '2026-11-12' }),
      item('4', { status: 'adiado' }),
      item('5', { tipo: 'nao_planejado', status: 'feito', ate: '2026-11-10' }),
    ], cards);
    expect(k).toEqual({
      planejados: 4, feitos: 2, pctFeitos: 50, naoPlanejadosFeitos: 1, alterados: 2,
      feitosComLimite: 3, dentroDoCronograma: 2, pctDentroDoCronograma: 67,
    });
  });
});

describe('datasAlteradasNoPainel', () =>
{
  it('lista previsões que mudaram entre fotos', () =>
  {
    const m = datasAlteradasNoPainel([card('A', { previsao: '2026-11-13' }), card('B', { previsao: '2026-11-10' })], [card('A', { previsao: '2026-11-11' }), card('B', { previsao: '2026-11-10' })]);
    expect(m).toEqual([{ codigo: 'A', campo: 'previsao', de: '2026-11-11', para: '2026-11-13' }]);
  });
});

describe('mapas de frentes e dores', () =>
{
  const plano: PlanoSemana = {
    inicio: '2026-11-09',
    pessoas: [
      { pessoaId: 'a', itens: [item('1', { frente: 'Agendamento', dor: 'CPF inválido' }), item('2')] },
      { pessoaId: 'b', itens: [item('3', { frente: 'Agendamento', dor: 'CPF inválido' })] },
    ],
  };

  it('agrupa itens por frente e pessoa, sem frente por último', () =>
  {
    const f = mapaDeFrentes(plano);
    expect(f.map((l) => l.frente)).toEqual(['Agendamento', 'Sem frente']);
    expect(Object.keys(f[0]!.porPessoa)).toEqual(['a', 'b']);
  });

  it('junta quem ataca a mesma dor', () =>
  {
    expect(mapaDeDores(plano)[0]!.itens.map((x) => x.pessoaId)).toEqual(['a', 'b']);
  });
});

describe('confirmar e levar pendências', () =>
{
  const plano: PlanoSemana = {
    inicio: '2026-11-09',
    pessoas: [{ pessoaId: 'm', itens: [item('1', { ate: '2026-11-11', status: 'feito' }), item('2', { ate: '2026-11-12', frente: 'CIPA' })] }],
  };

  it('confirmar guarda a data combinada', () =>
  {
    const c = confirmarPlano(plano, '2026-11-09');
    expect(c.confirmadoEm).toBe('2026-11-09');
    expect(c.pessoas[0]!.itens.map((i) => i.ateOriginal)).toEqual(['2026-11-11', '2026-11-12']);
  });

  it('só o que não foi feito volta, sem data', () =>
  {
    const p = pendenciasDaSemana(plano, () => 'novo');
    expect(p[0]!.itens).toEqual([{ id: 'novo', descricao: 'x', frente: 'CIPA', tipo: 'planejado', status: 'a_fazer', cardCodigo: undefined, objetivo: undefined, dor: undefined, horasEstimadas: undefined }]);
  });
});

describe('sugerirItens', () =>
{
  it('sugere os cards da pessoa com entrega na previsão ou na sexta', () =>
  {
    let n = 0;
    const s = sugerirItens([
      card('A', { responsavelEtapaAtual: 'm', etapaAtual: 'Modelagem', previsao: '2026-11-11' }),
      card('B', { responsavelEtapaAtual: 'm', previsao: '2027-02-12' }),
      card('C', { responsavelEtapaAtual: 'm' }),
      card('D', { responsavelEtapaAtual: 'outra' }),
    ], 'm', '2026-11-09', ['C'], () => String(++n));
    expect(s.map((i) => [i.cardCodigo, i.descricao, i.ate])).toEqual([
      ['A', 'Concluir Modelagem', '2026-11-11'],
      ['B', 'Avançar o card', '2026-11-13'],
    ]);
  });
});
