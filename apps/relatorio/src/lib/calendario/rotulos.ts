import type { BarraCalendario, EventoCalendario } from '@supervisao/core';

const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomesSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const maiuscula = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

export const rotuloMes = (ym: string) => `${maiuscula(nomesMes[Number(ym.slice(5, 7)) - 1] ?? '')} de ${ym.slice(0, 4)}`;

export function rotuloDia(iso: string): string
{
  const [ano, m, d] = iso.split('-').map(Number) as [number, number, number];
  const semana = nomesSemana[new Date(Date.UTC(ano, m - 1, d)).getUTCDay()] ?? '';
  return `${maiuscula(semana)}, ${d} de ${nomesMes[m - 1] ?? ''}`;
}

export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const textoEvento = (evento: EventoCalendario) => [evento.titulo, evento.detalhe].filter(Boolean).join(' · ');

// ausência, reunião, início e onda são períodos ou fatos, não prazos: não atrasam
const semPrazo = new Set(['ausencia', 'reuniao', 'inicio', 'onda']);
export const atrasado = (evento: EventoCalendario, hojeIso: string) => !evento.concluido && evento.fim < hojeIso && !semPrazo.has(evento.tipo);

export interface CelulaDia
{
  iso: string;
  numero: number;
  fora: boolean;
  fimDeSemana: boolean;
  pontos: EventoCalendario[];
  extra: number;
}
export interface SemanaVista
{
  id: string;
  barras: BarraCalendario[];
  faixas: number;
  celulas: CelulaDia[];
}
