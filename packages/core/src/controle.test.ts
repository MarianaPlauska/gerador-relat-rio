import { describe, expect, it } from 'vitest';
import { aplicarControle } from './controle';
import type { CardSnapshot } from './tipos';

const card: CardSnapshot = {
  codigo: 'DEV-198', responsaveis: ['mariana-coutinho'], origens: ['em_execucao'],
  etapasConcluidas: 2, etapasTotal: 15, etapaAtual: 'Modelagem', responsavelEtapaAtual: 'mariana-coutinho',
};

describe('aplicarControle', () =>
{
  it('usa o que eu marquei depois da foto', () =>
  {
    const r = aplicarControle(card, '2026-11-09', { etapasConcluidas: 3, etapaAtual: 'Front-end', atualizadoEm: '2026-11-10' });
    expect(r.etapasConcluidas).toBe(3);
    expect(r.etapaAtual).toBe('Front-end');
    expect(r.etapasTotal).toBe(15);
    expect(r.responsavelEtapaAtual).toBe('mariana-coutinho');
  });

  it('foto mais nova do painel ganha do meu controle', () =>
  {
    const r = aplicarControle(card, '2026-11-12', { etapasConcluidas: 3, atualizadoEm: '2026-11-10' });
    expect(r.etapasConcluidas).toBe(2);
  });

  it('sem controle devolve o card do painel', () =>
  {
    expect(aplicarControle(card, '2026-11-09')).toBe(card);
  });
});
