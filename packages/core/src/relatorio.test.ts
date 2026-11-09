import { describe, expect, it } from 'vitest';
import { compararTotais, ritmoPorPessoa, semaforoPrazo } from './relatorio';
import { pessoasExemplo } from './exemplo';
import type { CardSnapshot } from './tipos';

describe('compararTotais', () =>
{
  it('diz se cada número melhorou ou piorou', () =>
  {
    const linhas = compararTotais({ dentroDoPrazoPct: 70, atrasadosVencimento: 1, itensCronograma: 212 }, { dentroDoPrazoPct: 68, atrasadosVencimento: 3, itensCronograma: 212 });
    const por = Object.fromEntries(linhas.map((l) => [l.chave, l]));
    expect(por.dentroDoPrazoPct).toMatchObject({ diferenca: 2, tendencia: 'melhorou' });
    expect(por.atrasadosVencimento).toMatchObject({ diferenca: -2, tendencia: 'melhorou' });
    expect(por.itensCronograma).toMatchObject({ diferenca: 0, tendencia: 'igual' });
  });

  it('sem foto anterior não inventa diferença', () =>
  {
    const [l] = compararTotais({ eficiencia: 91 });
    expect(l!.diferenca).toBeUndefined();
    expect(l!.tendencia).toBe('neutra');
  });
});

describe('ritmoPorPessoa', () =>
{
  it('conta pelo responsável da etapa atual', () =>
  {
    const card = (codigo: string, quem: string, ritmo?: CardSnapshot['ritmoPainel']): CardSnapshot =>
      ({ codigo, responsaveis: [quem], responsavelEtapaAtual: quem, ritmoPainel: ritmo, origens: ['em_execucao'] });
    const r = ritmoPorPessoa([card('A', 'mariana-coutinho', 'em_risco'), card('B', 'mariana-coutinho', 'no_ritmo'), card('C', 'mariana-coutinho')], pessoasExemplo);
    expect(r.find((x) => x.pessoa.id === 'mariana-coutinho')!.contagem).toEqual({ no_ritmo: 1, em_risco: 1, atrasado: 0, semRitmo: 1, total: 3 });
  });
});

describe('semaforoPrazo', () =>
{
  it('usa a distância até a meta do painel', () =>
  {
    expect(semaforoPrazo(85, 85, 5)).toBe('verde');
    expect(semaforoPrazo(81, 85, 5)).toBe('amarelo');
    expect(semaforoPrazo(70, 85, 5)).toBe('vermelho');
    expect(semaforoPrazo(undefined, 85, 5)).toBeUndefined();
  });
});
