import { describe, expect, it } from 'vitest';
import { modelosProntos, pedidoDeModelo, planoDoPeriodo, validarModelo } from './modelo';
import type { PlanoSemana } from './tipos';

describe('modelos', () =>
{
  it('os modelos prontos passam na validação sem erro', () =>
  {
    for (const m of modelosProntos)
    {
      const r = validarModelo(JSON.stringify(m));
      expect(r.erros).toEqual([]);
      expect(r.modelo).toEqual(m);
    }
  });

  it('descarta bloco desconhecido e avisa', () =>
  {
    const r = validarModelo('```json\n{"nome":"Teste","blocos":[{"tipo":"secao","secao":"riscos"},{"tipo":"secao","secao":"xyz"},{"tipo":"grafico","indicador":"inventado"},{"tipo":"tabela","indicadores":["concluidos","nada"]},{"tipo":"quebra"}]}\n```');
    expect(r.modelo?.blocos).toEqual([{ tipo: 'secao', secao: 'riscos' }, { tipo: 'tabela', indicadores: ['concluidos'], titulo: undefined }, { tipo: 'quebra' }]);
    expect(r.erros).toEqual(['Bloco 2: seção "xyz" não existe.', 'Bloco 3: indicador "inventado" não existe.', 'Bloco 4: indicador "nada" não existe.']);
    expect(r.modelo?.sigla).toBe('RM');
  });

  it('recusa texto que não é JSON', () =>
  {
    expect(validarModelo('quero um relatório bonito').modelo).toBeUndefined();
  });

  it('o pedido para a IA traz blocos, seções e indicadores', () =>
  {
    const texto = pedidoDeModelo('Um relatório só de riscos');
    expect(texto).toContain('dentroDoPrazoPct: Dentro do prazo (%)');
    expect(texto).toContain('- riscos: Riscos e plano B');
    expect(texto.endsWith('Um relatório só de riscos')).toBe(true);
  });

  it('junta os planos das semanas do período', () =>
  {
    const planos: PlanoSemana[] = [
      { inicio: '2026-11-02', confirmadoEm: '2026-11-02', fechadoEm: '2026-11-06', pessoas: [{ pessoaId: 'ana', itens: [{ id: '1', descricao: 'a', tipo: 'planejado', status: 'feito' }] }] },
      { inicio: '2026-11-09', confirmadoEm: '2026-11-09', pessoas: [{ pessoaId: 'ana', dificuldade: 'fila', itens: [{ id: '2', descricao: 'b', tipo: 'planejado', status: 'a_fazer' }] }, { pessoaId: 'bia', itens: [] }] },
      { inicio: '2026-11-16', pessoas: [] },
    ];
    const p = planoDoPeriodo(planos, '2026-11-01', '2026-11-13')!;
    expect(p.pessoas.map((x) => [x.pessoaId, x.itens.map((i) => i.id), x.dificuldade])).toEqual([['ana', ['1', '2'], 'fila'], ['bia', [], undefined]]);
    expect(p.confirmadoEm).toBe('2026-11-02');
    expect(p.fechadoEm).toBeUndefined();
    expect(planos[0]!.pessoas[0]!.itens).toHaveLength(1);
  });
});
