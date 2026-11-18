import type { CardSnapshot, Pessoa, Ritmo, TotaisPainel } from '../tipos';
import { derivarRitmoCard, enriquecerCard, estimarHorasCard, ordenarCardsResumidos } from './etapas-auto';
import type { ModeloEstimativa } from './estimativa';
import { semAcento } from './normalizar';

export interface PontoGraficoLinhaCard
{
  codigo: string;
  assunto: string;
  prioridade: string;
  horasEstimadas: number;
  horasRodando: number;
  progressoEtapasPct: number;
  ritmo: Ritmo;
  destaqueDemora: boolean;
}

export interface GargaloDemoraCard
{
  codigo: string;
  assunto: string;
  responsavel?: string | undefined;
  etapaCritica: string;
  horas: number;
  motivo: string;
  prioridade: string;
}

export interface MetricasAutomaticasPasta
{
  totais: TotaisPainel;
  mediaHorasPorCard: number;
  totalHorasEstipuladas: number;
  totalHorasRodando: number;
  etapasConcluidasCount: number;
  etapasTotalCount: number;
  cardsPorPrioridade: CardSnapshot[];
  gargalosDemora: GargaloDemoraCard[];
  pontosDeAtencao: string[];
  serieGraficoLinha: PontoGraficoLinhaCard[];
}

// Calcula automaticamente todos os indicadores (em risco, média, tempo, etapas), gargalos de demora e série para gráfico em linha
export function calcularMetricasAutomaticasDosCards(
  cardsBrutos: CardSnapshot[],
  totaisManuais: TotaisPainel = {},
  pessoas: Pessoa[] = [],
  modelo?: ModeloEstimativa,
): MetricasAutomaticasPasta
{
  const cards = cardsBrutos.map((c) => enriquecerCard(c, modelo));
  const total = cards.length;

  const concluidos = cards.filter(
    (c) =>
      c.situacao === 'concluido' ||
      semAcento(c.statusCard ?? '').toLowerCase() === 'resolvido' ||
      (c.etapas && c.etapas.length > 0 && c.etapas.every((e) => e.situacao === 'concluida')),
  ).length;

  const emAndamento = cards.filter(
    (c) =>
      c.situacao !== 'concluido' &&
      (c.situacao === 'em_execucao' ||
        semAcento(c.statusCard ?? '').toLowerCase() === 'em andamento' ||
        c.etapas?.some((e) => e.situacao === 'rodando')),
  ).length;

  const aindaPlanejado = Math.max(0, total - concluidos - emAndamento);
  const comEtapaRodando = cards.filter((c) => c.etapas?.some((e) => e.situacao === 'rodando')).length;

  const ativos = cards.filter((c) => c.situacao !== 'concluido' && semAcento(c.statusCard ?? '').toLowerCase() !== 'resolvido');
  const ritmoAtrasadas = ativos.filter((c) => derivarRitmoCard(c) === 'atrasado').length;
  const ritmoEmRisco = ativos.filter((c) => derivarRitmoCard(c) === 'em_risco').length;
  const ritmoNoRitmo = Math.max(0, ativos.length - ritmoAtrasadas - ritmoEmRisco);

  let etapasConcluidasCount = 0;
  let etapasTotalCount = 0;
  const temposEtapasMin: number[] = [];
  let totalHorasEstipuladas = 0;
  let totalHorasRodando = 0;

  for (const c of cards)
  {
    const hEst = c.horasEstimadas ?? estimarHorasCard(c);
    totalHorasEstipuladas += hEst;
    const etapas = c.etapas ?? [];
    etapasTotalCount += etapas.length;
    etapasConcluidasCount += etapas.filter((e) => e.situacao === 'concluida').length;

    for (const et of etapas)
    {
      if (et.tempoRodandoHoras !== undefined && et.tempoRodandoHoras > 0)
      {
        totalHorasRodando += et.tempoRodandoHoras;
        temposEtapasMin.push(Math.round(et.tempoRodandoHoras * 60));
      }
      else if (et.horasEstimadas !== undefined && et.horasEstimadas > 0)
      {
        temposEtapasMin.push(Math.round(et.horasEstimadas * 60));
      }
    }
  }

  temposEtapasMin.sort((a, b) => a - b);
  const tempoMedianoEtapaMin = temposEtapasMin.length
    ? temposEtapasMin[Math.floor(temposEtapasMin.length / 2)]!
    : 90;

  const mediaHorasPorCard = total > 0 ? Math.round((totalHorasEstipuladas / total) * 10) / 10 : 0;
  const concluidosPct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const dentroDoPrazoPct = total > 0 ? Math.round(((total - ritmoAtrasadas) / total) * 100) : 100;

  const totais: TotaisPainel = {
    itensCronograma: total,
    concluidos,
    concluidosPct,
    aindaPlanejado,
    emExecucao: emAndamento,
    demandasEmAndamento: emAndamento,
    etapaRodando: comEtapaRodando,
    ritmoNoRitmo,
    ritmoEmRisco,
    ritmoAtrasadas,
    dentroDoPrazoPct,
    metaPct: totaisManuais.metaPct ?? 85,
    concluidasNoPeriodo: concluidos,
    etapasConcluidas: etapasConcluidasCount,
    tempoMedianoEtapaMin,
    tempoLimpoMedianaH: mediaHorasPorCard,
    tempoLimpoMediaDias: Math.round((mediaHorasPorCard / 8) * 10) / 10,
    emAbertoAgora: total - concluidos,
    foraDoPrazo: ritmoAtrasadas,
    ...Object.fromEntries(Object.entries(totaisManuais).filter(([, v]) => v !== undefined)),
  };

  const cardsPorPrioridade = ordenarCardsResumidos(cards, 'prioridade_maior');

  const resolverNome = (idOuNome?: string) =>
  {
    if (!idOuNome) return undefined;
    return pessoas.find((p) => p.id === idOuNome || semAcento(p.nome).toLowerCase() === semAcento(idOuNome).toLowerCase())?.nome ?? idOuNome;
  };

  const gargalosDemora: GargaloDemoraCard[] = cardsPorPrioridade
    .filter((c) => c.situacao !== 'concluido' && semAcento(c.statusCard ?? '').toLowerCase() !== 'resolvido')
    .map((c) =>
    {
      const etapaMaisLenta = [...(c.etapas ?? [])].sort((a, b) => (b.tempoRodandoHoras ?? b.horasEstimadas ?? 0) - (a.tempoRodandoHoras ?? a.horasEstimadas ?? 0))[0];
      const maxRodando = Math.max(0, ...(c.etapas?.map((e) => e.tempoRodandoHoras ?? 0) ?? [0]));
      const horas = maxRodando > 0 ? maxRodando : (c.horasEstimadas ?? 4);
      const prio = c.prioridadeCard ?? (c.criticidade === 3 ? 'Crítica' : c.criticidade === 2 ? 'Alta' : 'Normal');
      const motivo = maxRodando > 0
        ? `Etapa "${etapaMaisLenta?.nome ?? 'Atual'}" rodando há ${maxRodando}h`
        : `${prio} com ~${horas}h estipuladas (${c.etapasConcluidas ?? 0}/${c.etapasTotal ?? 3} etapas concluídas)`;
      return {
        codigo: c.codigo,
        assunto: c.assunto ?? c.titulo ?? 'Demanda',
        responsavel: resolverNome(c.responsavelEtapaAtual ?? c.responsaveis[0]),
        etapaCritica: etapaMaisLenta?.nome ?? c.etapaAtual ?? 'Validação dos requisitos',
        horas,
        motivo,
        prioridade: prio,
      };
    })
    .sort((a, b) => b.horas - a.horas);

  const pontosDeAtencao: string[] = [];
  if (gargalosDemora.length > 0)
  {
    const top = gargalosDemora[0]!;
    pontosDeAtencao.push(
      `Maior concentração de tempo em ${top.codigo}${top.responsavel ? ` (${top.responsavel})` : ''}: ${top.motivo}.`,
    );
  }
  const criticasAbertas = cardsPorPrioridade.filter((c) => (c.prioridadeCard === 'Crítica' || c.prioridadeCard === 'Alta') && c.situacao !== 'concluido');
  if (criticasAbertas.length > 0)
  {
    pontosDeAtencao.push(
      `${criticasAbertas.length} demanda(s) de prioridade Alta/Crítica ativa(s): ${criticasAbertas.map((c) => `${c.codigo} (${c.prioridadeCard})`).join(', ')}.`,
    );
  }
  if (ritmoEmRisco > 0 || ritmoAtrasadas > 0)
  {
    pontosDeAtencao.push(
      `Termômetro de risco: ${ritmoAtrasadas} atrasada(s) e ${ritmoEmRisco} em risco de um total de ${total} demandas (média de ${mediaHorasPorCard}h por card).`,
    );
  }
  if (pontosDeAtencao.length === 0 && total > 0)
  {
    pontosDeAtencao.push(`Fluxo estável: ${concluidos}/${total} demandas concluídas e nenhuma etapa crítica travada.`);
  }

  const serieGraficoLinha: PontoGraficoLinhaCard[] = cardsPorPrioridade.map((c) =>
  {
    const horasRodando = Math.round((c.etapas?.reduce((acc, e) => acc + (e.tempoRodandoHoras ?? (e.situacao === 'concluida' ? (e.horasEstimadas ?? 1) : 0)), 0) ?? 0) * 10) / 10;
    const totalEt = c.etapas?.length || 3;
    const feitasEt = c.etapas?.filter((e) => e.situacao === 'concluida').length ?? 0;
    const progressoEtapasPct = Math.round((feitasEt / totalEt) * 100);
    const ritmo = derivarRitmoCard(c);
    return {
      codigo: c.codigo,
      assunto: c.assunto ?? c.titulo ?? c.codigo,
      prioridade: c.prioridadeCard ?? 'Normal',
      horasEstimadas: c.horasEstimadas ?? 4,
      horasRodando,
      progressoEtapasPct,
      ritmo,
      destaqueDemora: ritmo === 'atrasado' || ritmo === 'em_risco' || horasRodando >= 8,
    };
  });

  return {
    totais,
    mediaHorasPorCard,
    totalHorasEstipuladas: Math.round(totalHorasEstipuladas * 10) / 10,
    totalHorasRodando: Math.round(totalHorasRodando * 10) / 10,
    etapasConcluidasCount,
    etapasTotalCount,
    cardsPorPrioridade,
    gargalosDemora,
    pontosDeAtencao,
    serieGraficoLinha,
  };
}
