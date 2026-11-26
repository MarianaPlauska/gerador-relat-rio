import type { CardSnapshot, Pessoa } from '../tipos';
import { numeroBr, semAcento } from './normalizar';

// o Excel em português costuma exportar "CSV" com ; em vez de , (o , é o separador decimal no Brasil): olha a primeira linha e usa o que aparece mais
function detectarSeparador(texto: string): ',' | ';'
{
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? '';
  const porPontoVirgula = (primeiraLinha.match(/;/g) ?? []).length;
  const porVirgula = (primeiraLinha.match(/,/g) ?? []).length;
  return porPontoVirgula > porVirgula ? ';' : ',';
}

// CSV com aspas: campo entre aspas pode ter o separador, quebra de linha e "" para aspas
export function lerCsv(texto: string, separador: ',' | ';' = detectarSeparador(texto)): string[][]
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
    else if (c === separador)
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

export const ehCsvDeDemandas = (texto: string) => /^﻿?["']?ID["']?[,;]\s*["']?Time["']?[,;]\s*["']?Abertura["']?[,;]/i.test(texto);

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
  // nenhum ID começa com o prefixo da pasta aberta: as linhas foram lidas assim mesmo, e estes são os prefixos achados
  outrosPrefixos?: string[];
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
  const codigoDe = (l: string[]) => l[i.id]?.trim().toUpperCase() ?? '';
  const comId = linhas.filter((l) => /^[A-Z][A-Z0-9]*-\d+$/.test(codigoDe(l)));
  const daPasta = comId.filter((l) => codigoDe(l).startsWith(`${opcoes.prefixo.toUpperCase()}-`));
  // a pasta pode ter outro nome que o prefixo dos IDs (pasta "Kitu", IDs DEV-): o CSV é estruturado, então lê tudo
  for (const l of daPasta.length ? daPasta : comId)
  {
    const codigo = codigoDe(l);
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
  const outrosPrefixos = daPasta.length ? [] : [...new Set(comId.map((l) => codigoDe(l).split('-')[0]!))];
  return { cards: [...porCodigo.values()], repetidos, ...(outrosPrefixos.length ? { outrosPrefixos } : {}) };
}
