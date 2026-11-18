import { binarizarAdaptativa, binarizarOtsu } from '@supervisao/core';
import { createWorker, PSM } from 'tesseract.js';

type Preparo = 'contraste' | 'otsu' | 'adaptativa';

// amplia, passa para cinza, inverte o tema escuro e estica o contraste: o leitor erra menos com texto preto no branco.
// 'otsu' e 'adaptativa' deixam a imagem só em preto e branco (limiar global ou local) para prints com fundo irregular,
// selos coloridos ou compressão que borra as letras
async function prepararImagem(imagem: Blob, preparo: Preparo = 'contraste'): Promise<HTMLCanvasElement>
{
  const bitmap = await createImageBitmap(imagem);
  // prints pequenos ganham mais ampliação; os grandes não passam de ~3200 px de largura
  const escala = Math.max(1.5, Math.min(3, 3200 / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const total = px.length / 4;
  const cinzas = new Uint8ClampedArray(total);
  let soma = 0;
  for (let i = 0; i < total; i++)
  {
    const c = px[i * 4]! * 0.299 + px[i * 4 + 1]! * 0.587 + px[i * 4 + 2]! * 0.114;
    cinzas[i] = c;
    soma += c;
  }
  const escuro = soma / total < 128;
  // histograma para esticar o contraste entre o 2º e o 98º percentil
  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i++) hist[escuro ? 255 - cinzas[i]! : cinzas[i]!]!++;
  const corte = (p: number) =>
  {
    let acum = 0;
    for (let v = 0; v < 256; v++)
    {
      acum += hist[v]!;
      if (acum >= total * p) return v;
    }
    return 255;
  };
  const baixo = corte(0.02);
  const alto = Math.max(baixo + 1, corte(0.98));
  const esticada = new Uint8ClampedArray(total);
  for (let i = 0; i < total; i++)
  {
    const c = escuro ? 255 - cinzas[i]! : cinzas[i]!;
    esticada[i] = Math.max(0, Math.min(255, ((c - baixo) * 255) / (alto - baixo)));
  }
  const final = preparo === 'otsu' ? binarizarOtsu(esticada) : preparo === 'adaptativa' ? binarizarAdaptativa(esticada, canvas.width, canvas.height, Math.round(escala * 14)) : esticada;
  for (let i = 0; i < total; i++) px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = final[i]!;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// a cópia guardada no registro, no PDF e no link (e na nuvem) precisa caber num documento do Firestore (1 MB):
// começa nítido e vai baixando largura e qualidade até ficar abaixo do teto de caracteres
export async function miniaturaDataUrl(imagem: Blob, larguraMax = 1280, tetoCaracteres = 700_000): Promise<string>
{
  const bitmap = await createImageBitmap(imagem);
  let ultima = '';
  for (const largura of [larguraMax, Math.round(larguraMax * 0.8), Math.round(larguraMax * 0.62), Math.round(larguraMax * 0.5)])
  {
    const escala = Math.min(1, largura / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.84, 0.72, 0.6])
    {
      ultima = canvas.toDataURL('image/jpeg', qualidade);
      if (ultima.length <= tetoCaracteres) return ultima;
    }
  }
  return ultima;
}

// quanto o texto parece do painel: códigos de card, datas e palavras de verdade
export function pontuar(texto: string, prefixo: string): number
{
  const codigos = texto.match(new RegExp(`\\b${prefixo} ?- ?[0-9A-Z]{2,4}\\b`, 'g'))?.length ?? 0;
  const datas = texto.match(/\d{2}\/\d{2}\/\d{2,4}/g)?.length ?? 0;
  const palavras = texto.match(/[A-Za-zÀ-ÿ]{4,}/g)?.length ?? 0;
  const lixo = texto.match(/[^\sA-Za-zÀ-ÿ0-9/:.,%()·\-—–★*+_|]/g)?.length ?? 0;
  return codigos * 12 + datas * 4 + palavras - lixo * 2;
}

// leitura boa o bastante para não gastar mais passadas: muita coisa reconhecida e pouco símbolo solto
function leituraBoa(texto: string, pontos: number): boolean
{
  const lixo = texto.match(/[^\sA-Za-zÀ-ÿ0-9/:.,%()·\-—–★*+_|]/g)?.length ?? 0;
  return pontos >= 60 && lixo / Math.max(1, texto.length) < 0.04;
}

// primeiro lê com o contraste esticado, em duas formas de ver a página (bloco único e colunas);
// só se o resultado ficar fraco tenta o preto e branco (Otsu e adaptativo) e fica com a melhor leitura
export async function lerImagem(imagem: Blob, progresso: (p: number) => void, prefixo = 'DEV'): Promise<string>
{
  const variantes: Preparo[] = ['contraste', 'otsu', 'adaptativa'];
  const modos = [PSM.SINGLE_BLOCK, PSM.AUTO];
  let passo = 0;
  let totalPassos = modos.length;
  const worker = await createWorker('por', 1, {
    logger: (m) =>
    {
      if (m.status === 'recognizing text') progresso(Math.min(1, (passo + m.progress) / totalPassos));
    },
  });
  try
  {
    let melhor = '';
    let pontos = -Infinity;
    let melhorModo: PSM = modos[0]!;
    const ler = async (canvas: HTMLCanvasElement, modo: PSM) =>
    {
      await worker.setParameters({ tessedit_pageseg_mode: modo, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      const { data } = await worker.recognize(canvas);
      // a confiança do próprio leitor entra no desempate: texto limpo vence texto parecido com lixo
      const p = pontuar(data.text, prefixo) + data.confidence * 0.4;
      if (p > pontos)
      {
        pontos = p;
        melhor = data.text;
        melhorModo = modo;
      }
      passo++;
    };

    const base = await prepararImagem(imagem, variantes[0]);
    for (const modo of modos) await ler(base, modo);

    if (!leituraBoa(melhor, pontuar(melhor, prefixo)))
    {
      totalPassos += variantes.length - 1;
      for (const preparo of variantes.slice(1))
      {
        await ler(await prepararImagem(imagem, preparo), melhorModo);
      }
    }
    progresso(1);
    return melhor;
  }
  finally
  {
    await worker.terminate();
  }
}
