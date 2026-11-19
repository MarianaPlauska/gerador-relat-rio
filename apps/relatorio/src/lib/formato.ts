// formatos pt-BR compartilhados pelas telas novas
export function moeda(n: number | undefined, comMoeda = true): string
{
  if (n === undefined) return '-';
  return n.toLocaleString('pt-BR', comMoeda ? { style: 'currency', currency: 'BRL' } : { maximumFractionDigits: 2 });
}

export const dataBr = (iso?: string): string => (iso ? iso.split('-').reverse().join('/') : '-');
