import type { Workbook } from 'exceljs';
import { gruposDaPlanilha, nomesPrioridade, nomesSituacao, totaisDaLinha, valoresDaLinha, type Planilha } from '@supervisao/core';
import { cabecalho, celulaDeLink, cor, formatoNumero, formatoValor, larguras, preencher } from './estilos.ts';

export const COLUNAS_ITENS = ['Setor', 'Item', 'Produto escolhido', 'Loja', 'Qtd', 'Preço mín. (un.)', 'Preço ref. (un.)', 'Preço máx. (un.)', 'Total mín.', 'Total ref.', 'Total máx.', 'Status do preço', 'Prioridade', 'Incluir?', 'Link', 'Observações'];

export interface PosicaoItens
{
  primeira: number;
  ultima: number;
}

// as linhas saem agrupadas na ordem dos grupos, e dentro do grupo na ordem em que vieram
export function abaItens(wb: Workbook, p: Planilha): PosicaoItens
{
  const ws = wb.addWorksheet('Itens', { views: [{ state: 'frozen', ySplit: 1 }] });
  const valor = formatoValor(p.moeda, p.unidade);
  cabecalho(ws, 1, COLUNAS_ITENS);
  larguras(ws, [16, 22, 40, 20, 6, 14, 14, 14, 14, 14, 14, 14, 13, 9, 12, 50]);

  const ordenadas = gruposDaPlanilha(p).flatMap((g) => p.linhas.filter((l) => l.grupo === g));
  ordenadas.forEach((l, i) =>
  {
    const r = i + 2;
    const v = valoresDaLinha(l);
    const t = totaisDaLinha(l);
    const linha = ws.getRow(r);
    linha.values = [l.grupo, l.item, l.detalhe, l.loja, l.qtd, v.min, v.ref, v.max, undefined, undefined, undefined, nomesSituacao[l.situacao], nomesPrioridade[l.prioridade], l.incluir ? 'Sim' : 'Não', undefined, l.observacao];
    (['I', 'J', 'K'] as const).forEach((col, k) =>
    {
      const origem = (['F', 'G', 'H'] as const)[k]!;
      ws.getCell(`${col}${r}`).value = { formula: `E${r}*${origem}${r}`, result: [t.min, t.ref, t.max][k]! };
    });
    celulaDeLink(ws.getCell(`O${r}`), l.link);
    for (const col of ['F', 'G', 'H', 'I', 'J', 'K']) ws.getCell(`${col}${r}`).numFmt = valor;
    ws.getCell(`E${r}`).numFmt = formatoNumero;
    for (const col of ['E', 'L', 'M', 'N']) ws.getCell(`${col}${r}`).alignment = { horizontal: 'center', vertical: 'top' };
    for (const col of ['B', 'C', 'P']) ws.getCell(`${col}${r}`).alignment = { wrapText: true, vertical: 'top' };
    if (l.situacao === 'estimativa')
    {
      for (const col of ['F', 'G', 'H']) preencher(ws.getCell(`${col}${r}`), cor.estimativaFundo);
      preencher(ws.getCell(`L${r}`), cor.estimativaStatus);
    }
    else preencher(ws.getCell(`L${r}`), cor.verificadoFundo);
    if (!l.incluir) linha.font = { italic: true, color: { argb: cor.suave } };
  });

  const primeira = 2;
  const ultima = Math.max(ordenadas.length + 1, 2);
  ws.autoFilter = { from: 'A1', to: `P${Math.max(ultima, 1)}` };

  const total = ultima + 2;
  ws.getCell(`A${total}`).value = 'TOTAL (itens com Incluir? = Sim)';
  for (const col of ['I', 'J', 'K'])
  {
    const c = ws.getCell(`${col}${total}`);
    c.value = { formula: `SUMIFS(${col}${primeira}:${col}${ultima},N${primeira}:N${ultima},"Sim")`, result: ordenadas.filter((l) => l.incluir).reduce((s, l) => s + totaisDaLinha(l)[col === 'I' ? 'min' : col === 'J' ? 'ref' : 'max'], 0) };
    c.numFmt = valor;
  }
  ws.getRow(total).font = { bold: true };
  for (let c = 1; c <= 16; c++) preencher(ws.getCell(total, c), cor.total);
  return { primeira, ultima };
}
