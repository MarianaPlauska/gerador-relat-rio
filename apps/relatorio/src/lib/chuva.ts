// chuva de caracteres estilo terminal, usada como action do svelte: <canvas use:chuva={{ fundo, cor }}>
const caracteres = '01アイウエオカキクケコサシスセソタチツテト<>/{}=;#$%'.split('');

export function chuva(canvas: HTMLCanvasElement, { fundo, cor, tamanho = 14, fps = 18 }: { fundo: string; cor: string; tamanho?: number; fps?: number })
{
  const ctx = canvas.getContext('2d')!;
  let colunas: number[] = [];
  let quadro = 0;
  let ultimo = 0;

  function ajustar()
  {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    colunas = Array.from({ length: Math.ceil(canvas.width / tamanho) }, () => Math.random() * -50);
  }

  function desenhar(t: number)
  {
    quadro = requestAnimationFrame(desenhar);
    if (t - ultimo < 1000 / fps) return;
    ultimo = t;
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${tamanho}px "Courier Prime", monospace`;
    colunas.forEach((y, i) =>
    {
      const letra = caracteres[Math.floor(Math.random() * caracteres.length)]!;
      ctx.fillStyle = Math.random() > 0.96 ? '#ffffff' : cor;
      ctx.fillText(letra, i * tamanho, y * tamanho);
      colunas[i] = y * tamanho > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
    });
  }

  ajustar();
  window.addEventListener('resize', ajustar);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) quadro = requestAnimationFrame(desenhar);

  return {
    destroy()
    {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', ajustar);
    },
  };
}
