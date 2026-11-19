import type { Cell, Worksheet } from 'exceljs';

export const cor = {
  cabecalho: 'FF1F4E5F',
  textoCabecalho: 'FFFFFFFF',
  total: 'FFDCE6EA',
  estimativaFundo: 'FFFFF2CC',
  verificadoFundo: 'FFE2F0D9',
  estimativaStatus: 'FFFBE5D6',
  suave: 'FF7F7F7F',
  titulo: 'FF1F4E5F',
  link: 'FF0563C1',
};

export const formatoMoeda = '"R$" #,##0.00';
export const formatoNumero = '#,##0.##';
export const formatoValor = (moeda: boolean, unidade?: string) => (moeda ? formatoMoeda : unidade ? `#,##0.0 "${unidade}"` : formatoNumero);

export function preencher(cell: Cell, argb: string): void
{
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export function cabecalho(ws: Worksheet, linha: number, titulos: string[]): void
{
  titulos.forEach((t, i) =>
  {
    const c = ws.getCell(linha, i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: cor.textoCabecalho } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    preencher(c, cor.cabecalho);
  });
  ws.getRow(linha).height = 28;
}

export function larguras(ws: Worksheet, lista: number[]): void
{
  lista.forEach((w, i) =>
  {
    ws.getColumn(i + 1).width = w;
  });
}

export function celulaDeLink(cell: Cell, url?: string): void
{
  if (!url)
  {
    cell.value = '-';
    cell.alignment = { horizontal: 'center' };
    return;
  }
  cell.value = { text: 'abrir link', hyperlink: url };
  cell.font = { color: { argb: cor.link }, underline: true };
  cell.alignment = { horizontal: 'center' };
}

export function tituloDaAba(ws: Worksheet, titulo: string, subtitulo: string, colunas: number): void
{
  ws.getCell('A1').value = titulo;
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: cor.titulo } };
  ws.getCell('A2').value = subtitulo;
  ws.getCell('A2').font = { italic: true, color: { argb: cor.suave } };
  ws.mergeCells(2, 1, 2, colunas);
}
