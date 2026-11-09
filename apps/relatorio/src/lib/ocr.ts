import { createWorker } from 'tesseract.js';

// amplia, passa para cinza e inverte o tema escuro: o leitor erra menos com texto preto no branco
async function prepararImagem(imagem: Blob): Promise<HTMLCanvasElement>
{
  const bitmap = await createImageBitmap(imagem);
  const escala = 2;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * escala;
  canvas.height = bitmap.height * escala;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let soma = 0;
  for (let i = 0; i < px.length; i += 4) soma += (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
  const escuro = soma / (px.length / 4) < 128;
  for (let i = 0; i < px.length; i += 4)
  {
    let cinza = (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
    if (escuro) cinza = 255 - cinza;
    px[i] = px[i + 1] = px[i + 2] = cinza;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function lerImagem(imagem: Blob, progresso: (p: number) => void): Promise<string>
{
  const worker = await createWorker('por', 1, {
    logger: (m) =>
    {
      if (m.status === 'recognizing text') progresso(m.progress);
    },
  });
  try
  {
    const { data } = await worker.recognize(await prepararImagem(imagem));
    return data.text;
  }
  finally
  {
    await worker.terminate();
  }
}
