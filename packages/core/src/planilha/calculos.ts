import type { LinhaPlanilha, Planilha, PrioridadeLinha } from './tipos';

export interface Cenarios
{
  min: number;
  ref: number;
  max: number;
}

export interface TotalGrupo extends Cenarios
{
  grupo: string;
  // linhas incluídas
  itens: number;
  // parte da referência que é só estimativa, e quanto isso pesa
  estimado: number;
  pctEstimado: number;
}

export interface UsoDoOrcamento
{
  usado: number;
  pct: number;
  // positivo sobra, negativo estoura
  diferenca: number;
  estoura: boolean;
}

export interface Ocupacao
{
  orcamento: number;
  min: UsoDoOrcamento;
  ref: UsoDoOrcamento;
  max: UsoDoOrcamento;
  porGrupo: { grupo: string; ref: number; pctDoOrcamento: number }[];
}

export interface SugestaoDeCortes
{
  // linhas a tirar do total, na ordem em que saem
  cortes: LinhaPlanilha[];
  novoTotal: number;
  cabe: boolean;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;
const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

// o valor que faltar assume a referência, depois o mínimo, depois o máximo
export function valoresDaLinha(l: LinhaPlanilha): Cenarios
{
  const ref = l.ref ?? l.min ?? l.max ?? 0;
  return { min: l.min ?? ref, ref, max: l.max ?? ref };
}

export function totaisDaLinha(l: LinhaPlanilha): Cenarios
{
  const v = valoresDaLinha(l);
  return { min: arredondar(v.min * l.qtd), ref: arredondar(v.ref * l.qtd), max: arredondar(v.max * l.qtd) };
}

// grupos na ordem da planilha; grupo que só aparece nas linhas entra no fim
export function gruposDaPlanilha(p: Planilha): string[]
{
  return [...new Set([...p.grupos, ...p.linhas.map((l) => l.grupo)])];
}

export function totaisPorGrupo(p: Planilha): TotalGrupo[]
{
  return gruposDaPlanilha(p).map((grupo) =>
  {
    const incluidas = p.linhas.filter((l) => l.grupo === grupo && l.incluir);
    const soma: Cenarios = { min: 0, ref: 0, max: 0 };
    let estimado = 0;
    for (const l of incluidas)
    {
      const t = totaisDaLinha(l);
      soma.min += t.min;
      soma.ref += t.ref;
      soma.max += t.max;
      if (l.situacao === 'estimativa') estimado += t.ref;
    }
    return { grupo, itens: incluidas.length, min: arredondar(soma.min), ref: arredondar(soma.ref), max: arredondar(soma.max), estimado: arredondar(estimado), pctEstimado: pct(estimado, soma.ref) };
  });
}

export function totalGeral(p: Planilha): TotalGrupo
{
  const grupos = totaisPorGrupo(p);
  const soma = (f: (g: TotalGrupo) => number) => arredondar(grupos.reduce((s, g) => s + f(g), 0));
  const ref = soma((g) => g.ref);
  const estimado = soma((g) => g.estimado);
  return { grupo: 'TOTAL', itens: soma((g) => g.itens), min: soma((g) => g.min), ref, max: soma((g) => g.max), estimado, pctEstimado: pct(estimado, ref) };
}

// sugestões e itens que ficaram de fora: soma da referência de quem não está incluído
export function foraDoTotal(p: Planilha): number
{
  return arredondar(p.linhas.filter((l) => !l.incluir).reduce((s, l) => s + totaisDaLinha(l).ref, 0));
}

function uso(usado: number, orcamento: number): UsoDoOrcamento
{
  return { usado, pct: pct(usado, orcamento), diferenca: arredondar(orcamento - usado), estoura: usado > orcamento };
}

export function ocupacao(p: Planilha): Ocupacao | undefined
{
  if (p.orcamento === undefined || p.orcamento <= 0) return undefined;
  const total = totalGeral(p);
  return {
    orcamento: p.orcamento,
    min: uso(total.min, p.orcamento),
    ref: uso(total.ref, p.orcamento),
    max: uso(total.max, p.orcamento),
    porGrupo: totaisPorGrupo(p).map((g) => ({ grupo: g.grupo, ref: g.ref, pctDoOrcamento: pct(g.ref, p.orcamento!) })),
  };
}

const pesoDoCorte: Record<PrioridadeLinha, number> = { desejavel: 0, importante: 1, essencial: 2 };

// se a referência passa do orçamento: tira primeiro o desejável, depois o importante, do mais caro ao mais barato; o essencial nunca sai
export function sugestaoDeCortes(p: Planilha): SugestaoDeCortes
{
  const total = totalGeral(p).ref;
  if (p.orcamento === undefined || total <= p.orcamento) return { cortes: [], novoTotal: total, cabe: true };
  const candidatas = p.linhas
    .filter((l) => l.incluir && l.prioridade !== 'essencial')
    .sort((a, b) => pesoDoCorte[a.prioridade] - pesoDoCorte[b.prioridade] || totaisDaLinha(b).ref - totaisDaLinha(a).ref);
  const cortes: LinhaPlanilha[] = [];
  let novoTotal = total;
  for (const l of candidatas)
  {
    if (novoTotal <= p.orcamento) break;
    cortes.push(l);
    novoTotal = arredondar(novoTotal - totaisDaLinha(l).ref);
  }
  return { cortes, novoTotal, cabe: novoTotal <= p.orcamento };
}

// deixa de incluir as linhas sugeridas; os dados continuam na planilha
export function aplicarCortes(p: Planilha, ids: string[]): void
{
  for (const l of p.linhas) if (ids.includes(l.id)) l.incluir = false;
}
