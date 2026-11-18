import { describe, expect, it } from 'vitest';
import { binarizarAdaptativa, binarizarOtsu, limiarOtsu } from './binarizar';

describe('binarização para a leitura de imagem', () =>
{
  it('Otsu separa dois tons e o corte cai entre eles', () =>
  {
    const cinzas = new Uint8ClampedArray([...Array<number>(60).fill(30), ...Array<number>(40).fill(220)]);
    const limiar = limiarOtsu(cinzas);
    expect(limiar).toBeGreaterThanOrEqual(30);
    expect(limiar).toBeLessThan(220);
    expect([...binarizarOtsu(cinzas)]).toEqual([...Array<number>(60).fill(0), ...Array<number>(40).fill(255)]);
  });

  it('o adaptativo acha o texto mesmo com fundo em degradê, onde um corte só falha', () =>
  {
    // 40x10: fundo vai de 120 a 250 da esquerda para a direita; "letra" 60 pontos mais escura que o fundo ao redor
    const largura = 40;
    const altura = 10;
    const cinzas = new Uint8ClampedArray(largura * altura);
    for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) cinzas[y * largura + x] = Math.round(120 + (x / (largura - 1)) * 130);
    const letras = [[5, 4], [6, 4], [30, 5], [31, 5]] as const;
    for (const [x, y] of letras) cinzas[y * largura + x] = cinzas[y * largura + x]! - 60;

    const adaptativa = binarizarAdaptativa(cinzas, largura, altura, 6);
    for (const [x, y] of letras) expect(adaptativa[y * largura + x]).toBe(0);
    // o fundo longe das letras continua branco, dos dois lados do degradê
    expect(adaptativa[1 * largura + 2]).toBe(255);
    expect(adaptativa[8 * largura + 37]).toBe(255);
  });
});
