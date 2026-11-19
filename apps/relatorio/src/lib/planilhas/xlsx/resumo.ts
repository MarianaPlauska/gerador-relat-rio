import type { Workbook, Worksheet } from 'exceljs';
import { foraDoTotal, ocupacao, totaisPorGrupo, totalGeral, type Planilha } from '@supervisao/core';
import { cabecalho, cor, formatoValor, larguras, preencher, tituloDaAba } from './estilos.ts';
import type { PosicaoItens } from './itens.ts';

const COLUNAS = ['Setor', 'Itens incluídos', 'Total mínimo', 'Total referência', 'Total máximo', 'Parte estimada (ref.)', '% estimado'];

function notas(ws: Worksheet, linha: number, titulo: string, frases: string[]): number
{
  if (!frases.length) return linha;
  ws.getCell(linha, 1).value = titulo;
  ws.getCell(linha, 1).font = { bold: true, size: 12, color: { argb: cor.titulo } };
  let r = linha + 1;
  for (const frase of frases)
  {
    ws.mergeCells(r, 1, r, 7);
    const c = ws.getCell(r, 1);
    c.value = `• ${frase}`;
    c.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r).height = Math.max(1, Math.ceil(frase.length / 105)) * 15;
    r++;
  }
  return r + 1;
}

// as somas são fórmulas sobre a aba Itens: se ela editar lá, o Excel recalcula
export function abaResumo(wb: Workbook, p: Planilha, pos: PosicaoItens): void
{
  const ws = wb.addWorksheet('Resumo');
  const valor = formatoValor(p.moeda);
  tituloDaAba(ws, p.nome, p.objetivo || 'Resumo por grupo. Os valores somam só os itens com Incluir? = Sim.', 7);
  larguras(ws, [30, 14, 18, 18, 18, 20, 12]);
  cabecalho(ws, 4, COLUNAS);

  const faixa = (col: string) => `Itens!$${col}$${pos.primeira}:$${col}$${pos.ultima}`;
  const grupos = totaisPorGrupo(p);
  grupos.forEach((g, i) =>
  {
    const r = 5 + i;
    ws.getCell(`A${r}`).value = g.grupo;
    const filtro = `${faixa('A')},$A${r},${faixa('N')},"Sim"`;
    ws.getCell(`B${r}`).value = { formula: `COUNTIFS(${filtro})`, result: g.itens };
    ws.getCell(`C${r}`).value = { formula: `SUMIFS(${faixa('I')},${filtro})`, result: g.min };
    ws.getCell(`D${r}`).value = { formula: `SUMIFS(${faixa('J')},${filtro})`, result: g.ref };
    ws.getCell(`E${r}`).value = { formula: `SUMIFS(${faixa('K')},${filtro})`, result: g.max };
    ws.getCell(`F${r}`).value = { formula: `SUMIFS(${faixa('J')},${filtro},${faixa('L')},"Estimativa")`, result: g.estimado };
    ws.getCell(`G${r}`).value = { formula: `IF(D${r}=0,0,F${r}/D${r})`, result: g.pctEstimado / 100 };
    ws.getCell(`B${r}`).alignment = { horizontal: 'center' };
    for (const col of ['C', 'D', 'E', 'F']) ws.getCell(`${col}${r}`).numFmt = valor;
    ws.getCell(`G${r}`).numFmt = '0%';
  });

  const total = 5 + grupos.length;
  const t = totalGeral(p);
  const ultimoGrupo = total - 1;
  ws.getCell(`A${total}`).value = 'TOTAL';
  ws.getCell(`B${total}`).value = { formula: `SUM(B5:B${ultimoGrupo})`, result: t.itens };
  (['C', 'D', 'E', 'F'] as const).forEach((col, k) =>
  {
    ws.getCell(`${col}${total}`).value = { formula: `SUM(${col}5:${col}${ultimoGrupo})`, result: [t.min, t.ref, t.max, t.estimado][k]! };
    ws.getCell(`${col}${total}`).numFmt = valor;
  });
  ws.getCell(`G${total}`).value = { formula: `IF(D${total}=0,0,F${total}/D${total})`, result: t.pctEstimado / 100 };
  ws.getCell(`G${total}`).numFmt = '0%';
  ws.getCell(`B${total}`).alignment = { horizontal: 'center' };
  ws.getRow(total).font = { bold: true };
  for (let c = 1; c <= 7; c++) preencher(ws.getCell(total, c), cor.total);

  const fora = total + 2;
  const sugestoes = foraDoTotal(p);
  ws.getCell(`A${fora}`).value = 'Fora do total (Incluir? = Não)';
  ws.getCell(`D${fora}`).value = { formula: `SUMIFS(${faixa('J')},${faixa('N')},"Não")`, result: sugestoes };
  ws.getCell(`A${fora + 1}`).value = 'Total se incluir tudo (referência)';
  ws.getCell(`A${fora + 1}`).font = { bold: true };
  ws.getCell(`D${fora + 1}`).value = { formula: `D${total}+D${fora}`, result: t.ref + sugestoes };
  ws.getCell(`D${fora + 1}`).font = { bold: true };
  ws.getCell(`D${fora}`).numFmt = valor;
  ws.getCell(`D${fora + 1}`).numFmt = valor;

  let linha = fora + 3;
  const o = ocupacao(p);
  if (o)
  {
    ws.getCell(`A${linha}`).value = 'Orçamento';
    ws.getCell(`A${linha}`).font = { bold: true, size: 12, color: { argb: cor.titulo } };
    ws.getCell(`D${linha}`).value = o.orcamento;
    ws.getCell(`D${linha}`).numFmt = valor;
    ws.getCell(`D${linha}`).font = { bold: true };
    preencher(ws.getCell(`D${linha}`), cor.estimativaFundo);
    const orc = `$D$${linha}`;
    cabecalho(ws, linha + 1, ['Cenário', 'Usado', '% do orçamento', 'Sobra (+) ou estoura (-)']);
    (['min', 'ref', 'max'] as const).forEach((k, i) =>
    {
      const r = linha + 2 + i;
      const col = (['C', 'D', 'E'] as const)[i]!;
      ws.getCell(`A${r}`).value = ['Mínimo', 'Referência', 'Máximo'][i];
      ws.getCell(`B${r}`).value = { formula: `${col}${total}`, result: o[k].usado };
      ws.getCell(`C${r}`).value = { formula: `IF(${orc}=0,0,B${r}/${orc})`, result: o[k].pct / 100 };
      ws.getCell(`D${r}`).value = { formula: `${orc}-B${r}`, result: o[k].diferenca };
      ws.getCell(`B${r}`).numFmt = valor;
      ws.getCell(`C${r}`).numFmt = '0%';
      ws.getCell(`D${r}`).numFmt = valor;
      if (o[k].estoura) ws.getCell(`D${r}`).font = { bold: true, color: { argb: 'FFC00000' } };
    });
    linha += 7;
  }
  linha = notas(ws, linha, 'Como ler', p.notas.comoLer);
  linha = notas(ws, linha, 'Premissas', p.notas.premissas);
  notas(ws, linha, 'Pontos de atenção', p.notas.atencao);
}
