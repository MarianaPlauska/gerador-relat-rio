import type { CardSnapshot, Pessoa } from '../tipos';
import { numeroBr, semAcento } from './normalizar';

// CSV com aspas: campo entre aspas pode ter vírgula, quebra de linha e "" para aspas
export function lerCsv(texto: string): string[][]
{
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++)
  {
    const c = texto[i]!;
    if (aspas)
    {
      if (c === '"' && texto[i + 1] === '"')
      {
        campo += '"';
        i++;
      }
      else if (c === '"') aspas = false;
      else campo += c;
    }
    else if (c === '"') aspas = true;
    else if (c === ',')
    {
      linha.push(campo);
      campo = '';
    }
    else if (c === '\n' || c === '\r')
    {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    }
    else campo += c;
  }
  if (campo || linha.length)
  {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

export const ehCsvDeDemandas = (texto: string) => /^﻿?ID,Time,Abertura,/.test(texto);

// 10/01/2028 08:00 -> 2028-01-10
const dataCsv = (v: string) =>
{
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

export interface LeituraCsv
{
  cards: CardSnapshot[];
  // o painel repete alguns IDs; fica a linha mais recente
  repetidos: string[];
}

// "Exportar CSV" da lista de Demandas do painel
export function lerCsvDemandas(texto: string, opcoes: { prefixo: string; pessoas: Pessoa[] }): LeituraCsv
{
  const [cabecalho, ...linhas] = lerCsv(texto.replace(/^﻿/, ''));
  const col = (nome: string) => cabecalho!.findIndex((c) => semAcento(c.trim()) === semAcento(nome));
  const i = {
    id: col('ID'), abertura: col('Abertura'), tipo: col('Tipo'), descricao: col('Descricao'), status: col('Status'),
    prioridade: col('Prioridade'), responsavel: col('Responsavel'), conclusao: col('Conclusao'), horas: col('Horas'),
  };
  const porCodigo = new Map<string, CardSnapshot>();
  const repetidos: string[] = [];
  for (const l of linhas)
  {
    const codigo = l[i.id]?.trim() ?? '';
    if (!codigo.startsWith(`${opcoes.prefixo}-`)) continue;
    if (porCodigo.has(codigo))
    {
      repetidos.push(codigo);
      continue;
    }
    const nome = l[i.responsavel]?.trim() ?? '';
    const pessoa = opcoes.pessoas.find((p) => semAcento(p.nome) === semAcento(nome));
    const horas = l[i.horas]?.trim();
    const card: CardSnapshot = { codigo, responsaveis: !nome || /^sem respons/i.test(nome) ? [] : [pessoa?.id ?? nome], origens: ['demandas'] };
    // campo vazio fica de fora para não apagar o que outra leitura trouxe
    const definir = <K extends keyof CardSnapshot>(chave: K, valor: CardSnapshot[K] | undefined) =>
    {
      if (valor !== undefined && valor !== '') card[chave] = valor;
    };
    definir('titulo', l[i.descricao]?.split('\n').map((x) => x.trim()).find(Boolean));
    definir('sistema', l[i.tipo]?.trim());
    definir('abertura', dataCsv(l[i.abertura] ?? ''));
    definir('statusCard', l[i.status]?.trim());
    definir('prioridadeCard', l[i.prioridade]?.trim());
    definir('concluidoEm', dataCsv(l[i.conclusao] ?? ''));
    definir('horasAteConcluir', horas ? numeroBr(horas) : undefined);
    porCodigo.set(codigo, card);
  }
  return { cards: [...porCodigo.values()], repetidos };
}
