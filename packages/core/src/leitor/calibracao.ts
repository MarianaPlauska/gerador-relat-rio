import type { CardSnapshot, Snapshot } from '../tipos';
import { segundaDaSemana } from '../datas';
import { estimarHorasCard } from './etapas-auto';
import { semAcento } from './normalizar';

// o que o histórico diz sobre o ritmo real de entrega de uma pessoa, em horas por semana
export interface CalibracaoPessoa
{
  // semanas com entrega observável (a primeira semana de fotos só serve de ponto de partida)
  semanasAmostra: number;
  velocidadeMediaHorasSemana: number;
  desvioHorasSemana: number;
  // 0 a 100: quanto o histórico pesa na probabilidade (4 semanas ou mais = 100)
  confiancaPct: number;
  usouHistorico: boolean;
  horasPorSemana: { semana: string; horas: number }[];
}

const SEMANAS_PARA_CONFIANCA_TOTAL = 4;

const concluido = (c: CardSnapshot): boolean =>
  c.situacao === 'concluido' || !!c.concluidoEm || semAcento(c.statusCard ?? '').toLowerCase() === 'resolvido';

// tempo real gasto quando o painel informa; senão a estimativa do card como se estivesse aberto
export function horasEntregues(c: CardSnapshot): number
{
  if (c.tempoTotalMin && c.tempoTotalMin > 0) return Math.min(60, Math.round((c.tempoTotalMin / 60) * 10) / 10);
  if (c.horasEstimadas && c.horasEstimadas > 0) return c.horasEstimadas;
  const { situacao: _s, statusCard: _t, concluidoEm: _c, etapas: _e, etapasConcluidas: _ec, ...aberto } = c;
  return estimarHorasCard(aberto as CardSnapshot);
}

// função de distribuição da normal padrão (aproximação de Abramowitz e Stegun)
export function normalCdf(z: number): number
{
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// horas entregues por semana: o que ficou concluído de uma semana para outra entre as fotos do projeto
export function calcularCalibracaoPessoa(fotosOrdenadas: Snapshot[], pertence: (c: CardSnapshot) => boolean, ultimasSemanas = 8): CalibracaoPessoa
{
  const porSemana = new Map<string, Snapshot[]>();
  for (const f of fotosOrdenadas)
  {
    const semana = segundaDaSemana(f.data);
    porSemana.set(semana, [...(porSemana.get(semana) ?? []), f]);
  }
  const semanas = [...porSemana.keys()].sort();

  const jaConcluidos = new Set<string>();
  const amostras: { semana: string; horas: number }[] = [];
  semanas.forEach((semana, i) =>
  {
    const fotos = porSemana.get(semana)!;
    const ativa = fotos.some((f) => f.cards.some(pertence));
    // vale a última foto da semana: é o retrato mais completo do que fechou
    const meusDaUltima = fotos.at(-1)!.cards.filter(pertence);
    const fechados = meusDaUltima.filter(concluido);
    const novos = fechados.filter((c) => !jaConcluidos.has(c.codigo));
    for (const c of fechados) jaConcluidos.add(c.codigo);
    // a primeira semana observada traz o passado todo junto: não conta como entrega daquela semana
    if (i === 0 || !ativa) return;
    amostras.push({ semana, horas: Math.round(novos.reduce((acc, c) => acc + horasEntregues(c), 0) * 10) / 10 });
  });

  const recentes = amostras.slice(-ultimasSemanas);
  const n = recentes.length;
  const media = n ? recentes.reduce((acc, a) => acc + a.horas, 0) / n : 0;
  const variancia = n > 1 ? recentes.reduce((acc, a) => acc + (a.horas - media) ** 2, 0) / (n - 1) : 0;
  return {
    semanasAmostra: n,
    velocidadeMediaHorasSemana: Math.round(media * 10) / 10,
    desvioHorasSemana: Math.round(Math.sqrt(variancia) * 10) / 10,
    confiancaPct: Math.min(100, Math.round((n / SEMANAS_PARA_CONFIANCA_TOTAL) * 100)),
    usouHistorico: n >= 1,
    horasPorSemana: recentes,
  };
}

// mistura a probabilidade pela folga da semana (heurística) com a chance estatística de caber mais um serviço,
// dando mais peso ao histórico conforme há semanas observadas
export function calibrarProbabilidade(opcoes: {
  probabilidadeBasePct: number;
  cargaHoras: number;
  capacidadeHoras: number;
  servicoHoras?: number;
  calibracao: CalibracaoPessoa;
}): { probabilidadePct: number; capacidadeCalibradaHoras: number; horasLivresCalibradas: number }
{
  const { probabilidadeBasePct, cargaHoras, capacidadeHoras, calibracao } = opcoes;
  const servico = opcoes.servicoHoras ?? 4;
  const peso = Math.min(1, calibracao.semanasAmostra / SEMANAS_PARA_CONFIANCA_TOTAL);
  const efetiva = Math.min(capacidadeHoras, Math.max(capacidadeHoras * 0.25, calibracao.velocidadeMediaHorasSemana));
  const capacidadeCalibradaHoras = Math.round((peso * efetiva + (1 - peso) * capacidadeHoras) * 10) / 10;
  const sigma = Math.max(calibracao.desvioHorasSemana, capacidadeCalibradaHoras * 0.15, 1);
  const pEstatistica = normalCdf((capacidadeCalibradaHoras - (cargaHoras + servico)) / sigma) * 100;
  const mistura = (1 - peso) * probabilidadeBasePct + peso * pEstatistica;
  return {
    probabilidadePct: Math.min(98, Math.max(5, Math.round(mistura))),
    capacidadeCalibradaHoras,
    horasLivresCalibradas: Math.max(0, Math.round((capacidadeCalibradaHoras - cargaHoras) * 10) / 10),
  };
}
