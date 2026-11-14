import { tamanhoDoNo, type Fluxograma, type NoFluxo } from '@supervisao/core';
import { cores } from './graficos.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// quebra o texto em linhas de até n letras
function linhas(texto: string, n: number): string[]
{
  const saida: string[] = [];
  let atual = '';
  for (const p of texto.split(/\s+/).filter(Boolean))
  {
    if (atual && (atual + ' ' + p).length > n)
    {
      saida.push(atual);
      atual = p;
    }
    else atual = atual ? `${atual} ${p}` : p;
  }
  if (atual) saida.push(atual);
  return saida.slice(0, 4);
}

const letrasPorLinha = { inicio: 16, fim: 16, passo: 24, decisao: 17, nota: 26 } as const;

// mesmo desenho do editor, em svg puro e nas cores claras do pdf
export function svgDoFluxo(f: Pick<Fluxograma, 'nos' | 'ligacoes'>, fonte = 'IBM Plex Sans'): { svg: string; largura: number; altura: number }
{
  if (!f.nos.length) return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', largura: 10, altura: 10 };
  const caixa = (n: NoFluxo) => ({ ...tamanhoDoNo(n.tipo), x: n.x, y: n.y });
  const minX = Math.min(...f.nos.map((n) => n.x)) - 70;
  const minY = Math.min(...f.nos.map((n) => n.y)) - 20;
  const largura = Math.max(...f.nos.map((n) => n.x + caixa(n).largura)) - minX + 70;
  const altura = Math.max(...f.nos.map((n) => n.y + caixa(n).altura)) - minY + 20;
  const porId = new Map(f.nos.map((n) => [n.id, n]));
  const partes: string[] = [];
  const seta = (x: number, y: number, dx: number, dy: number) =>
  {
    const ox = -dy * 4;
    const oy = dx * 4;
    partes.push(`<polygon points="${x},${y} ${x - dx * 8 + ox},${y - dy * 8 + oy} ${x - dx * 8 - ox},${y - dy * 8 - oy}" fill="${cores.tinta}"/>`);
  };

  for (const l of f.ligacoes)
  {
    const a = porId.get(l.de);
    const b = porId.get(l.para);
    if (!a || !b) continue;
    const ca = caixa(a);
    const cb = caixa(b);
    let d: string;
    let meio: [number, number];
    if (b.y >= a.y + ca.altura - 1)
    {
      const tx = b.x + cb.largura / 2;
      const ty = b.y;
      if (l.saida === 'lado')
      {
        const sx = a.x + ca.largura;
        const sy = a.y + ca.altura / 2;
        d = `M${sx},${sy} C${tx},${sy} ${tx},${sy} ${tx},${ty}`;
        meio = [(sx + tx) / 2, sy - 6];
      }
      else
      {
        const sx = a.x + ca.largura / 2;
        const sy = a.y + ca.altura;
        const dy = (ty - sy) / 2;
        d = `M${sx},${sy} C${sx},${sy + dy} ${tx},${ty - dy} ${tx},${ty}`;
        meio = [(sx + tx) / 2, sy + Math.min(dy, 22)];
      }
      seta(tx, ty, 0, 1);
    }
    else
    {
      // volta para cima: sai e entra pela direita, como no editor
      const sx = a.x + ca.largura;
      const sy = a.y + ca.altura / 2;
      const tx = b.x + cb.largura;
      const ty = b.y + cb.altura * 0.22;
      const fora = Math.max(sx, tx) + 55;
      d = `M${sx},${sy} C${fora},${sy} ${fora},${ty} ${tx},${ty}`;
      meio = [fora - 14, (sy + ty) / 2];
      seta(tx, ty, -1, 0);
    }
    partes.push(`<path d="${d}" fill="none" stroke="${cores.tinta}" stroke-width="1.3"/>`);
    if (l.rotulo)
    {
      const w = l.rotulo.length * 6 + 10;
      partes.push(`<rect x="${meio[0] - w / 2}" y="${meio[1] - 8}" width="${w}" height="15" rx="3" fill="#ffffff" stroke="${cores.grade}"/>`);
      partes.push(`<text x="${meio[0]}" y="${meio[1] + 3}" font-family="${fonte}" font-size="9" text-anchor="middle" fill="${cores.tinta}">${esc(l.rotulo)}</text>`);
    }
  }

  for (const n of f.nos)
  {
    const c = caixa(n);
    const cx = n.x + c.largura / 2;
    const cy = n.y + c.altura / 2;
    if (n.tipo === 'inicio' || n.tipo === 'fim')
      partes.push(`<rect x="${n.x}" y="${n.y}" width="${c.largura}" height="${c.altura}" rx="${c.altura / 2}" fill="${n.tipo === 'inicio' ? cores.marcaClara : cores.tinta}" stroke="${cores.tinta}" stroke-width="1.2"/>`);
    else if (n.tipo === 'decisao')
      partes.push(`<polygon points="${cx},${n.y} ${n.x + c.largura},${cy} ${cx},${n.y + c.altura} ${n.x},${cy}" fill="#fff6dc" stroke="${cores.amarelo}" stroke-width="1.4"/>`);
    else if (n.tipo === 'nota')
      partes.push(`<rect x="${n.x}" y="${n.y}" width="${c.largura}" height="${c.altura}" rx="4" fill="#f6f4ef" stroke="${cores.cinza}" stroke-dasharray="4 3"/>`);
    else
      partes.push(`<rect x="${n.x}" y="${n.y}" width="${c.largura}" height="${c.altura}" rx="8" fill="#ffffff" stroke="${cores.tinta}" stroke-width="1.2"/>`);
    const ls = linhas(n.texto, letrasPorLinha[n.tipo]);
    const cor = n.tipo === 'fim' ? '#ffffff' : cores.tinta;
    const peso = n.tipo === 'inicio' || n.tipo === 'fim' ? ' font-weight="600"' : '';
    ls.forEach((t, i) =>
    {
      const y = cy + (i - (ls.length - 1) / 2) * 13 + 4;
      partes.push(`<text x="${cx}" y="${y}" font-family="${fonte}" font-size="10.5"${peso} text-anchor="middle" fill="${cor}"${n.tipo === 'nota' ? ' font-style="italic"' : ''}>${esc(t)}</text>`);
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="${minX} ${minY} ${largura} ${altura}">${partes.join('')}</svg>`;
  return { svg, largura, altura };
}

function baixar(blob: Blob, nome: string): void
{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

const nomeArquivo = (f: Fluxograma) => `fluxo-${f.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}`;

export function baixarSvg(f: Fluxograma): void
{
  baixar(new Blob([svgDoFluxo(f).svg], { type: 'image/svg+xml' }), `${nomeArquivo(f)}.svg`);
}

// png em 2x, com fundo branco, para colar no Teams ou num slide
export async function baixarPng(f: Fluxograma): Promise<void>
{
  const { svg, largura, altura } = svgDoFluxo(f, 'IBM Plex Sans, Arial, sans-serif');
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = largura * 2;
  canvas.height = altura * 2;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  canvas.toBlob((b) => b && baixar(b, `${nomeArquivo(f)}.png`), 'image/png');
}
