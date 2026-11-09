export function semAcento(texto: string): string
{
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// junta tudo numa linha só, minúscula e sem acento, para os padrões de totais
export function achatar(texto: string): string
{
  return semAcento(texto).replace(/[·•|\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// 10/11/26 -> 2026-11-10
export function dataBrParaIso(dia: string, mes: string, ano: string): string
{
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes}-${dia}`;
}

export function numeroBr(texto: string): number
{
  return Number(texto.replace(',', '.'));
}
