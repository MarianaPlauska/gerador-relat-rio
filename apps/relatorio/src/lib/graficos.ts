// gráficos em svg puro: o mesmo desenho vai para a tela e para o pdf
export const cores = {
  tinta: '#1f2328',
  suave: '#6b6f76',
  grade: '#e7e4de',
  laranja: '#e8590c',
  laranjaClaro: '#fbc9a8',
  verde: '#2e9e5b',
  amarelo: '#f08c2e',
  vermelho: '#d64545',
  cinza: '#b8b4ad',
};

export interface OpcoesGrafico
{
  largura?: number;
  fonte?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');

function texto(x: number, y: number, conteudo: string, fonte: string, extra = ''): string
{
  return `<text x="${x}" y="${y}" font-family="${fonte}" ${extra}>${esc(conteudo)}</text>`;
}

// linha do tempo de um indicador, com a meta tracejada
export function svgLinha(
  pontos: { rotulo: string; valor: number }[],
  { largura = 520, fonte = 'IBM Plex Sans', meta, sufixo = '', altura = 190, cor = cores.laranja }: OpcoesGrafico & { meta?: number; sufixo?: string; altura?: number; cor?: string } = {},
): string
{
  const esq = 36;
  const dir = 16;
  const topo = 18;
  const base = altura - 28;
  const valores = [...pontos.map((p) => p.valor), ...(meta !== undefined ? [meta] : [])];
  const max = Math.max(...valores) * 1.1 || 1;
  const min = Math.max(0, Math.min(...valores) - (max - Math.min(...valores)) * 0.3);
  const y = (v: number) => base - ((v - min) / (max - min || 1)) * (base - topo);
  const passo = pontos.length > 1 ? (largura - esq - dir) / (pontos.length - 1) : 0;
  const x = (i: number) => (pontos.length > 1 ? esq + i * passo : largura / 2);
  const partes: string[] = [];
  for (let i = 0; i <= 3; i++)
  {
    const v = min + ((max - min) * i) / 3;
    partes.push(`<line x1="${esq}" x2="${largura - dir}" y1="${y(v)}" y2="${y(v)}" stroke="${cores.grade}" stroke-width="1"/>`);
    partes.push(texto(esq - 6, y(v) + 4, fmt(Math.round(v)), fonte, `font-size="9" fill="${cores.suave}" text-anchor="end"`));
  }
  if (meta !== undefined)
  {
    partes.push(`<line x1="${esq}" x2="${largura - dir}" y1="${y(meta)}" y2="${y(meta)}" stroke="${cores.tinta}" stroke-width="1.2" stroke-dasharray="5 4"/>`);
    partes.push(texto(largura - dir, y(meta) - 5, `meta ${fmt(meta)}${sufixo}`, fonte, `font-size="9" fill="${cores.tinta}" text-anchor="end"`));
  }
  if (pontos.length > 1)
  {
    const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join(' ');
    partes.push(`<path d="${caminho} L${x(pontos.length - 1)},${base} L${x(0)},${base} Z" fill="${cor}" fill-opacity="0.08"/>`);
    partes.push(`<path d="${caminho}" fill="none" stroke="${cor}" stroke-width="2.5"/>`);
  }
  pontos.forEach((p, i) =>
  {
    partes.push(`<circle cx="${x(i)}" cy="${y(p.valor)}" r="3.5" fill="#fff" stroke="${cor}" stroke-width="2"/>`);
    partes.push(texto(x(i), y(p.valor) - 9, `${fmt(p.valor)}${sufixo}`, fonte, `font-size="10" font-weight="bold" fill="${cores.tinta}" text-anchor="middle"`));
    partes.push(texto(x(i), altura - 8, p.rotulo, fonte, `font-size="9" fill="${cores.suave}" text-anchor="middle"`));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">${partes.join('')}</svg>`;
}

export function svgSparkline(valores: number[], largura = 120, altura = 34, cor = cores.laranja): string
{
  if (valores.length < 2) return '';
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const y = (v: number) => altura - 4 - ((v - min) / (max - min || 1)) * (altura - 8);
  const x = (i: number) => 3 + (i * (largura - 6)) / (valores.length - 1);
  const caminho = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const ultimo = valores.length - 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"><path d="${caminho}" fill="none" stroke="${cor}" stroke-width="2"/><circle cx="${x(ultimo)}" cy="${y(valores[ultimo]!)}" r="3" fill="${cor}"/></svg>`;
}

// uma barra por linha, dividida em partes coloridas
export function svgBarrasEmpilhadas(
  linhas: { rotulo: string; partes: { valor: number; cor: string }[] }[],
  { largura = 520, fonte = 'IBM Plex Sans' }: OpcoesGrafico = {},
): string
{
  const rotulo = 130;
  const alturaLinha = 26;
  const altura = linhas.length * alturaLinha + 4;
  const util = largura - rotulo - 30;
  const max = Math.max(1, ...linhas.map((l) => l.partes.reduce((s, p) => s + p.valor, 0)));
  const partes: string[] = [];
  linhas.forEach((l, i) =>
  {
    const yl = i * alturaLinha + 4;
    partes.push(texto(0, yl + 14, l.rotulo, fonte, `font-size="10" fill="${cores.tinta}"`));
    partes.push(`<rect x="${rotulo}" y="${yl + 2}" width="${util}" height="16" rx="3" fill="#f3f1ed"/>`);
    let xi = rotulo;
    for (const p of l.partes.filter((p) => p.valor > 0))
    {
      const w = (p.valor / max) * util;
      partes.push(`<rect x="${xi}" y="${yl + 2}" width="${w}" height="16" fill="${p.cor}"/>`);
      if (w > 14) partes.push(texto(xi + w / 2, yl + 14, String(p.valor), fonte, `font-size="9" font-weight="bold" fill="#fff" text-anchor="middle"`));
      xi += w;
    }
    const total = l.partes.reduce((s, p) => s + p.valor, 0);
    partes.push(texto(largura - 4, yl + 14, String(total), fonte, `font-size="10" font-weight="bold" fill="${cores.tinta}" text-anchor="end"`));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">${partes.join('')}</svg>`;
}

// duas barras por linha: semana anterior (clara) e esta semana (forte)
export function svgBarrasComparadas(
  linhas: { rotulo: string; antes?: number; agora: number }[],
  { largura = 520, fonte = 'IBM Plex Sans', max = 100, sufixo = '%', legendaAntes = 'semana anterior', legendaAgora = 'esta semana' }:
    OpcoesGrafico & { max?: number; sufixo?: string; legendaAntes?: string; legendaAgora?: string } = {},
): string
{
  const rotulo = 130;
  const alturaLinha = 36;
  const topo = 22;
  const altura = topo + linhas.length * alturaLinha;
  const util = largura - rotulo - 46;
  const w = (v: number) => (Math.min(v, max) / max) * util;
  const partes: string[] = [
    `<rect x="0" y="4" width="10" height="10" rx="2" fill="${cores.laranjaClaro}"/>`,
    texto(14, 13, legendaAntes, fonte, `font-size="9" fill="${cores.suave}"`),
    `<rect x="100" y="4" width="10" height="10" rx="2" fill="${cores.laranja}"/>`,
    texto(114, 13, legendaAgora, fonte, `font-size="9" fill="${cores.suave}"`),
  ];
  linhas.forEach((l, i) =>
  {
    const yl = topo + i * alturaLinha;
    partes.push(texto(0, yl + 18, l.rotulo, fonte, `font-size="10" fill="${cores.tinta}"`));
    if (l.antes !== undefined)
    {
      partes.push(`<rect x="${rotulo}" y="${yl + 3}" width="${Math.max(w(l.antes), 1)}" height="11" rx="2" fill="${cores.laranjaClaro}"/>`);
      partes.push(texto(rotulo + w(l.antes) + 4, yl + 12, `${fmt(l.antes)}${sufixo}`, fonte, `font-size="8" fill="${cores.suave}"`));
    }
    partes.push(`<rect x="${rotulo}" y="${yl + 16}" width="${Math.max(w(l.agora), 1)}" height="13" rx="2" fill="${cores.laranja}"/>`);
    partes.push(texto(rotulo + w(l.agora) + 4, yl + 26, `${fmt(l.agora)}${sufixo}`, fonte, `font-size="9" font-weight="bold" fill="${cores.tinta}"`));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">${partes.join('')}</svg>`;
}
