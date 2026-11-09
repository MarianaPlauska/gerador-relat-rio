import { describe, expect, it } from 'vitest';
import { pessoasExemplo, planoExemplo } from './exemplo';

describe('dados de exemplo', () =>
{
  it('plano aponta para pessoas existentes', () =>
  {
    const ids = new Set(pessoasExemplo.map((p) => p.id));
    for (const p of planoExemplo.pessoas) expect(ids.has(p.pessoaId)).toBe(true);
  });
});
