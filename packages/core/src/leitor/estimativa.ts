import type { CardSnapshot, Snapshot } from '../tipos';
import { semAcento } from './normalizar';

// Aprende, com as demandas já concluídas do projeto, quanto tempo cada tipo de demanda realmente leva.
// Só entram demandas com tempo real informado pelo painel (tempoTotalMin): estimativa não pode ensinar estimativa.

export interface AmostraEstimativa
{
  mediana: number;
  amostras: number;
}

export interface ModeloEstimativa
{
  // chave "sistema|prioridade", com partes vazias para os níveis menos específicos
  chaves: Record<string, AmostraEstimativa>;
  totalAmostras: number;
}

export const MINIMO_AMOSTRAS = 3;
export const AMOSTRAS_CONFIANCA_TOTAL = 8;
const LIMITE_HORAS = 60;

const concluido = (c: CardSnapshot): boolean =>
  c.situacao === 'concluido' || !!c.concluidoEm || semAcento(c.statusCard ?? '').toLowerCase() === 'resolvido';

function prioridadeNormal(c: CardSnapshot): string
{
  const p = semAcento(c.prioridadeCard ?? '').toLowerCase();
  if (c.criticidade === 3 || p === 'critica' || p === 'urgente') return 'critica';
  if (c.criticidade === 2 || p === 'alta') return 'alta';
  if (p === 'baixa') return 'baixa';
  if (p === 'media') return 'media';
  return '';
}

// do mais específico para o mais geral
export function chavesDoCard(c: CardSnapshot): string[]
{
  const sistema = semAcento(c.sistema ?? '').trim();
  const prio = prioridadeNormal(c);
  return [...new Set([`${sistema}|${prio}`, `|${prio}`, `${sistema}|`, '|'])];
}

function mediana(valores: number[]): number
{
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio]! : (v[meio - 1]! + v[meio]!) / 2;
}

export function aprenderEstimativas(fotos: Snapshot[]): ModeloEstimativa
{
  // vale o último retrato de cada card
  const ultimo = new Map<string, CardSnapshot>();
  for (const f of [...fotos].sort((a, b) => a.data.localeCompare(b.data)))
  {
    for (const c of f.cards) ultimo.set(c.codigo, c);
  }
  const baldes = new Map<string, number[]>();
  let total = 0;
  for (const c of ultimo.values())
  {
    if (!concluido(c) || !c.tempoTotalMin || c.tempoTotalMin <= 0) continue;
    const horas = Math.min(LIMITE_HORAS, c.tempoTotalMin / 60);
    total++;
    for (const chave of chavesDoCard(c)) baldes.set(chave, [...(baldes.get(chave) ?? []), horas]);
  }
  const chaves: Record<string, AmostraEstimativa> = {};
  for (const [chave, valores] of baldes) chaves[chave] = { mediana: Math.round(mediana(valores) * 10) / 10, amostras: valores.length };
  return { chaves, totalAmostras: total };
}

// a amostra mais específica que já tem demandas suficientes
export function amostraParaCard(modelo: ModeloEstimativa | undefined, c: CardSnapshot): (AmostraEstimativa & { chave: string }) | undefined
{
  if (!modelo) return undefined;
  for (const chave of chavesDoCard(c))
  {
    const a = modelo.chaves[chave];
    if (a && a.amostras >= MINIMO_AMOSTRAS) return { ...a, chave };
  }
  return undefined;
}

export function descreverChave(chave: string): string
{
  const [sistema, prio] = chave.split('|');
  const partes = [sistema ? `do tipo ${sistema}` : '', prio ? `de prioridade ${prio}` : ''].filter(Boolean);
  return partes.length ? `demandas ${partes.join(' ')}` : 'todas as demandas concluídas';
}
