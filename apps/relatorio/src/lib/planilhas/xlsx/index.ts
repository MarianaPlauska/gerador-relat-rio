import type { Planilha } from '@supervisao/core';
import { abaAlternativas } from './alternativas.ts';
import { abaItens } from './itens.ts';
import { abaResumo } from './resumo.ts';

const tipoXlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// a biblioteca é grande: só carrega quando a usuária pede o download
export async function gerarXlsx(p: Planilha): Promise<Blob>
{
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default ?? modulo;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OrbisOS';
  // o Resumo soma a aba Itens: as linhas dela começam na 2 e vão uma por linha da planilha
  abaResumo(wb, p, { primeira: 2, ultima: Math.max(p.linhas.length + 1, 2) });
  abaItens(wb, p);
  if (p.comAlternativas) abaAlternativas(wb, p);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: tipoXlsx });
}

export async function baixarXlsx(p: Planilha): Promise<void>
{
  const blob = await gerarXlsx(p);
  const nome = p.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'planilha';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
