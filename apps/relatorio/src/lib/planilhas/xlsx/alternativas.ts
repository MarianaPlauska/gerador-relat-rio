import type { Workbook } from 'exceljs';
import type { Planilha } from '@supervisao/core';
import { dataBr } from '../../formato.ts';
import { cabecalho, celulaDeLink, formatoValor, larguras, tituloDaAba } from './estilos.ts';

export function abaAlternativas(wb: Workbook, p: Planilha): void
{
  const ws = wb.addWorksheet('Alternativas', { views: [{ state: 'frozen', ySplit: 4 }] });
  tituloDaAba(ws, 'Alternativas e variação de valor', 'Compare opções e, no futuro, anote novas cotações: copie uma linha e mude a data e o valor.', 7);
  larguras(ws, [26, 44, 28, 16, 12, 12, 50]);
  cabecalho(ws, 4, ['Item', 'Opção / produto', 'Loja', 'Valor', 'Data', 'Link', 'Observação']);
  p.alternativas.forEach((a, i) =>
  {
    const r = 5 + i;
    ws.getRow(r).values = [a.item, a.opcao, a.loja, a.valor, a.data ? dataBr(a.data) : '', undefined, a.observacao];
    ws.getCell(`D${r}`).numFmt = formatoValor(p.moeda, p.unidade);
    ws.getCell(`E${r}`).alignment = { horizontal: 'center' };
    celulaDeLink(ws.getCell(`F${r}`), a.link);
    for (const col of ['B', 'G']) ws.getCell(`${col}${r}`).alignment = { wrapText: true, vertical: 'top' };
  });
  ws.autoFilter = { from: 'A4', to: `G${Math.max(4 + p.alternativas.length, 4)}` };
}
