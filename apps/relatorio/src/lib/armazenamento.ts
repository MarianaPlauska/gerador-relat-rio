import { pessoasExemplo, type Pessoa, type Snapshot } from '@supervisao/core';

const CHAVE = 'relatorio-semanal-v1';

export interface Dados
{
  pessoas: Pessoa[];
  prefixo: string;
  fotos: Snapshot[];
}

function padrao(): Dados
{
  return { pessoas: pessoasExemplo, prefixo: 'DEV', fotos: [] };
}

export function carregar(): Dados
{
  try
  {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...padrao(), ...JSON.parse(bruto) } : padrao();
  }
  catch
  {
    return padrao();
  }
}

export function salvar(dados: Dados): void
{
  localStorage.setItem(CHAVE, JSON.stringify(dados));
}

export function exportarJson(dados: Dados): void
{
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importarJson(arquivo: File): Promise<Dados>
{
  return { ...padrao(), ...JSON.parse(await arquivo.text()) };
}
