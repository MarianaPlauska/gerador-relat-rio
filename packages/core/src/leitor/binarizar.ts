// Cálculos de imagem em tons de cinza (0 a 255) usados antes da leitura do texto; ficam aqui por serem puros e testáveis.

// limiar de Otsu: o corte que mais separa o tom do texto do tom do fundo
export function limiarOtsu(cinzas: Uint8ClampedArray): number
{
  const hist = new Uint32Array(256);
  for (const v of cinzas) hist[v]!++;
  const total = cinzas.length;
  let somaTotal = 0;
  for (let i = 0; i < 256; i++) somaTotal += i * hist[i]!;
  let somaFundo = 0;
  let pesoFundo = 0;
  let melhor = 0;
  let maxVar = -1;
  for (let t = 0; t < 256; t++)
  {
    pesoFundo += hist[t]!;
    if (pesoFundo === 0) continue;
    const pesoFrente = total - pesoFundo;
    if (pesoFrente === 0) break;
    somaFundo += t * hist[t]!;
    const mediaFundo = somaFundo / pesoFundo;
    const mediaFrente = (somaTotal - somaFundo) / pesoFrente;
    const variancia = pesoFundo * pesoFrente * (mediaFundo - mediaFrente) ** 2;
    if (variancia > maxVar)
    {
      maxVar = variancia;
      melhor = t;
    }
  }
  return melhor;
}

// preto e branco por um corte só para a imagem toda
export function binarizarOtsu(cinzas: Uint8ClampedArray): Uint8ClampedArray
{
  const limiar = limiarOtsu(cinzas);
  return cinzas.map((v) => (v > limiar ? 255 : 0));
}

// limiar local (Bradley e Roth): cada ponto é comparado com a média da vizinhança, via imagem integral;
// aguenta fundo com degradê, selos coloridos e linhas de tabela zebradas
export function binarizarAdaptativa(cinzas: Uint8ClampedArray, largura: number, altura: number, raio: number, sensibilidade = 0.13): Uint8ClampedArray
{
  const larguraIntegral = largura + 1;
  const integral = new Float64Array(larguraIntegral * (altura + 1));
  for (let y = 0; y < altura; y++)
  {
    let linha = 0;
    for (let x = 0; x < largura; x++)
    {
      linha += cinzas[y * largura + x]!;
      integral[(y + 1) * larguraIntegral + (x + 1)] = integral[y * larguraIntegral + (x + 1)]! + linha;
    }
  }
  const saida = new Uint8ClampedArray(cinzas.length);
  for (let y = 0; y < altura; y++)
  {
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(altura - 1, y + raio);
    for (let x = 0; x < largura; x++)
    {
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(largura - 1, x + raio);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const soma = integral[(y1 + 1) * larguraIntegral + (x1 + 1)]! - integral[y0 * larguraIntegral + (x1 + 1)]! - integral[(y1 + 1) * larguraIntegral + x0]! + integral[y0 * larguraIntegral + x0]!;
      saida[y * largura + x] = cinzas[y * largura + x]! * area < soma * (1 - sensibilidade) ? 0 : 255;
    }
  }
  return saida;
}
