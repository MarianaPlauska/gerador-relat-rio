import { createWorker, PSM } from 'tesseract.js';

// amplia, passa para cinza, inverte o tema escuro e estica o contraste: o leitor erra menos com texto preto no branco
async function prepararImagem(imagem: Blob): Promise<HTMLCanvasElement>
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
  for (let i = 0; i < total; i++)
  {
    let c = escuro ? 255 - cinzas[i]! : cinzas[i]!;
    c = Math.max(0, Math.min(255, ((c - baixo) * 255) / (alto - baixo)));
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = c;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// gera uma cópia nítida em JPEG (data URL) para guardar no registro, ampliar no modal e usar no relatório PDF/link
export async function miniaturaDataUrl(imagem: Blob, larguraMax = 1280): Promise<string>
{
  const bitmap = await createImageBitmap(imagem);
  const escala = Math.min(1, larguraMax / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.84);
}

// quanto o texto parece do painel: códigos de card, datas e palavras de verdade
function pontuar(texto: string, prefixo: string): number
{
  const codigos = texto.match(new RegExp(`\\b${prefixo} ?- ?[0-9A-Z]{2,4}\\b`, 'g'))?.length ?? 0;
  const datas = texto.match(/\d{2}\/\d{2}\/\d{2,4}/g)?.length ?? 0;
  const palavras = texto.match(/[A-Za-zÀ-ÿ]{4,}/g)?.length ?? 0;
  const lixo = texto.match(/[^\sA-Za-zÀ-ÿ0-9/:.,%()·\-—–★*+_|]/g)?.length ?? 0;
  return codigos * 12 + datas * 4 + palavras - lixo * 2;
}

// duas leituras com formas diferentes de ver a página (bloco único e colunas); fica a que parece mais com o painel
export async function lerImagem(imagem: Blob, progresso: (p: number) => void, prefixo = 'DEV'): Promise<string>
{
  const canvas = await prepararImagem(imagem);
  const modos = [PSM.SINGLE_BLOCK, PSM.AUTO];
  let fase = 0;
  const worker = await createWorker('por', 1, {
    logger: (m) =>
    {
      if (m.status === 'recognizing text') progresso((fase + m.progress) / modos.length);
    },
  });
  try
  {
    let melhor = '';
    let pontos = -Infinity;
    for (const modo of modos)
    {
      await worker.setParameters({ tessedit_pageseg_mode: modo, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      const { data } = await worker.recognize(canvas);
      const p = pontuar(data.text, prefixo);
      if (p > pontos)
      {
        pontos = p;
        melhor = data.text;
      }
      fase++;
    }
    return melhor;
  }
  finally
  {
    await worker.terminate();
  }
}
