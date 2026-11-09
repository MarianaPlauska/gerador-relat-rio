import { describe, expect, it } from 'vitest';
import { pessoasExemplo, planoExemplo, snapshotExemplo } from './exemplo';

describe('dados de exemplo', () =>
{
  const ids = new Set(pessoasExemplo.map((p) => p.id));

  it('responsáveis existem na lista de pessoas', () =>
  {
    for (const c of snapshotExemplo.cards)
    {
      for (const r of c.responsaveis) expect(ids.has(r)).toBe(true);
      if (c.responsavelEtapaAtual) expect(c.responsaveis).toContain(c.responsavelEtapaAtual);
    }
  });

  it('etapas concluídas não passam do total', () =>
  {
    for (const c of snapshotExemplo.cards) expect(c.etapasConcluidas).toBeLessThanOrEqual(c.etapasTotal);
  });

  it('itens do plano apontam para cards existentes', () =>
  {
    const codigos = new Set(snapshotExemplo.cards.map((c) => c.codigo));
    for (const p of planoExemplo.pessoas)
    {
      for (const i of p.itens) if (i.cardCodigo) expect(codigos.has(i.cardCodigo)).toBe(true);
    }
  });
});
