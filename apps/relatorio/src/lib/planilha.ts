import { agoraLocal, linhasDoTexto, listaParaCsv, type Lista } from '@supervisao/core';

// .xlsx (primeira aba) ou .csv/.txt; tudo vira linhas de texto para o core
export async function lerArquivoPlanilha(arquivo: File): Promise<string[][]>
{
  if (!/\.xlsx$/i.test(arquivo.name)) return linhasDoTexto(await arquivo.text());
  const { readSheet } = await import('read-excel-file/browser');
  const linhas = await readSheet(arquivo);
  return linhas.map((linha) => linha.map((c) =>
  {
    if (c === null || c === undefined) return '';
    if (c instanceof Date) return c.toISOString().slice(0, 10).split('-').reverse().join('/');
    return String(c).trim();
  }));
}

export function baixarCsv(lista: Lista): void
{
  const blob = new Blob([listaParaCsv(lista)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${lista.nome.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${agoraLocal().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
