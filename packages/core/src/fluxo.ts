import { diasUteisEntre } from './datas';
import { resumirSerie } from './estatistica';
import { semAcento } from './leitor/normalizar';
import type { CardSnapshot } from './tipos';

// Fase 6, 7 e 8. Métricas de fluxo no estilo Kanban: tempo de entrega com percentis (p50 e p85),
// idade do trabalho em aberto contra o p85 da mesma prioridade, e onde as demandas se acumulam por etapa.
// Os números de cada card vêm do painel (abertura, horas até concluir); aqui só se resume o que ele mostra.

const DIA = 86_400_000;
const umaCasa = (n: number) => Math.round(n * 10) / 10;

export function percentil(valores: number[], p: number): number
{
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return 0;
  const pos = (v.length - 1) * p;
  const base = Math.floor(pos);
  return v[base]! + (v[Math.min(base + 1, v.length - 1)]! - v[base]!) * (pos - base);
}

const status = (c: CardSnapshot) => semAcento(c.statusCard ?? '');
export const estaConcluido = (c: CardSnapshot) => c.situacao === 'concluido' || /resolvido|cancelado|conclu/.test(status(c));
// planejado tem data futura de começo; não é trabalho parado
const estaEmAberto = (c: CardSnapshot) => !estaConcluido(c) && !/planejado/.test(status(c));

export interface TempoDeEntrega
{
  n: number;
  p50: number;
  p85: number;
}

export interface TemposDeEntrega
{
  geral?: TempoDeEntrega | undefined;
  porPrioridade: Record<string, TempoDeEntrega>;
}

// em dias corridos, só o que foi resolvido (cancelado não é entrega) e com horas registradas
export function temposDeEntrega(cards: CardSnapshot[]): TemposDeEntrega
{
  const entregues = cards.filter((c) => /resolvido/.test(status(c)) && (c.horasAteConcluir ?? 0) > 0);
  const resumir = (lista: CardSnapshot[]): TempoDeEntrega | undefined =>
  {
    const dias = lista.map((c) => c.horasAteConcluir! / 24);
    return dias.length ? { n: dias.length, p50: umaCasa(percentil(dias, 0.5)), p85: umaCasa(percentil(dias, 0.85)) } : undefined;
  };
  const porPrioridade: Record<string, TempoDeEntrega> = {};
  for (const prioridade of new Set(entregues.map((c) => c.prioridadeCard ?? 'Sem prioridade')))
  {
    const r = resumir(entregues.filter((c) => (c.prioridadeCard ?? 'Sem prioridade') === prioridade));
    if (r) porPrioridade[prioridade] = r;
  }
  return { geral: resumir(entregues), porPrioridade };
}

export interface CardParado
{
  card: CardSnapshot;
  idadeDias: number;
  limiteDias: number;
  // de onde veio o limite: a prioridade do card ou o geral, quando a prioridade tem poucas entregas
  base: string;
}

// "parado além do normal": aberto há mais tempo que 85% das entregas da mesma prioridade levaram
export function cardsParados(cards: CardSnapshot[], hoje: string, tempos: TemposDeEntrega, minimoPorPrioridade = 5): CardParado[]
{
  const parados: CardParado[] = [];
  for (const card of cards.filter(estaEmAberto))
  {
    if (!card.abertura || card.abertura > hoje) continue;
    const daPrioridade = tempos.porPrioridade[card.prioridadeCard ?? ''];
    const ref = daPrioridade && daPrioridade.n >= minimoPorPrioridade ? daPrioridade : tempos.geral;
    if (!ref) continue;
    const idadeDias = umaCasa((Date.parse(hoje) - Date.parse(card.abertura)) / DIA);
    if (idadeDias > ref.p85) parados.push({ card, idadeDias, limiteDias: ref.p85, base: ref === daPrioridade ? card.prioridadeCard! : 'geral' });
  }
  return parados.sort((a, b) => b.idadeDias / b.limiteDias - a.idadeDias / a.limiteDias);
}

export interface Gargalo
{
  etapa: string;
  quantidade: number;
  // esperando começar (parada na fila ou aguardando start)
  esperando: number;
  maiorRodandoDias?: number | undefined;
  codigos: string[];
}

// onde as demandas em aberto estão paradas: agrupa pela etapa atual
export function gargalosPorEtapa(cards: CardSnapshot[]): Gargalo[]
{
  const grupos = new Map<string, Gargalo>();
  for (const c of cards.filter((x) => x.etapaAtual && !estaConcluido(x)))
  {
    const chave = semAcento(c.etapaAtual!).trim();
    const g = grupos.get(chave) ?? { etapa: c.etapaAtual!, quantidade: 0, esperando: 0, codigos: [] };
    g.quantidade++;
    if (c.etapaAtualStatus === 'parada_na_fila' || c.etapaAtualStatus === 'aguardando_start') g.esperando++;
    if (c.etapaAtualRodandoHaDias !== undefined) g.maiorRodandoDias = Math.max(g.maiorRodandoDias ?? 0, c.etapaAtualRodandoHaDias);
    g.codigos.push(c.codigo);
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || b.esperando - a.esperando);
}

export interface ProjecaoMeta
{
  atual: number;
  meta: number;
  projetado: number;
  ate: string;
  semanasRestantes: number;
  // pontos percentuais por semana: o ritmo de agora e o necessário para chegar na meta
  ritmoAtual: number;
  ritmoNecessario: number;
  veredito: 'bate' | 'perto' | 'nao_bate';
}

// Fase 7: no ritmo das últimas semanas (tendência linear), onde o "dentro do prazo" chega no fim do mês
export function projetarMeta(serie: { semana: string; valor: number }[], meta: number | undefined, ate: string, folga = 3): ProjecaoMeta | undefined
{
  const recentes = serie.slice(-8);
  const r = resumirSerie(recentes.map((x) => x.valor));
  if (!r || r.n < 3 || meta === undefined) return undefined;
  const semanasRestantes = Math.max(0, umaCasa((Date.parse(ate) - Date.parse(recentes.at(-1)!.semana)) / (7 * DIA)));
  const projetado = umaCasa(Math.min(100, Math.max(0, r.ultimo + r.inclinacao * semanasRestantes)));
  const ritmoNecessario = semanasRestantes ? umaCasa((meta - r.ultimo) / semanasRestantes) : 0;
  const veredito = projetado >= meta ? 'bate' : projetado >= meta - folga ? 'perto' : 'nao_bate';
  return { atual: r.ultimo, meta, projetado, ate, semanasRestantes, ritmoAtual: r.inclinacao, ritmoNecessario, veredito };
}

// dia 0 do mês seguinte é o último dia deste
export function fimDoMes(iso: string): string
{
  const [ano, mes] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano!, mes!, 0)).toISOString().slice(0, 10);
}

export interface Vencendo
{
  card: CardSnapshot;
  data: string;
  tipo: 'vencimento' | 'previsão';
  diasUteis: number;
}

// Fase 8: o que vence (ou tem previsão) de hoje até 2 dias úteis à frente e ainda não terminou
export function vencendoEm48h(cards: CardSnapshot[], hoje: string, feriados: string[] = []): Vencendo[]
{
  const lista: Vencendo[] = [];
  for (const card of cards.filter((c) => !estaConcluido(c)))
  {
    const data = card.vencimento ?? card.previsao;
    if (!data || data < hoje) continue;
    const diasUteis = diasUteisEntre(hoje, data, feriados);
    if (diasUteis <= 2) lista.push({ card, data, tipo: card.vencimento ? 'vencimento' : 'previsão', diasUteis });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export interface ResumoDoFluxo
{
  projecao?: ProjecaoMeta | undefined;
  tempos: TemposDeEntrega;
  parados: CardParado[];
  gargalos: Gargalo[];
}

// o que a central e o relatório mostram sobre fluxo, a partir da foto do dia e da série semanal do prazo
export function resumoDoFluxo(cards: CardSnapshot[], hoje: string, seriePrazo: { semana: string; valor: number }[], meta: number | undefined): ResumoDoFluxo
{
  const tempos = temposDeEntrega(cards);
  return {
    projecao: projetarMeta(seriePrazo, meta, fimDoMes(hoje)),
    tempos,
    parados: cardsParados(cards, hoje, tempos),
    gargalos: gargalosPorEtapa(cards),
  };
}

const br = (n: number) => n.toLocaleString('pt-BR');

export const textoProjecao = (p: ProjecaoMeta) =>
  p.veredito === 'bate'
    ? `No ritmo das últimas semanas (${p.ritmoAtual > 0 ? '+' : ''}${br(p.ritmoAtual)} p.p. por semana), o dentro do prazo chega a ${br(p.projetado)}% em ${p.ate.slice(8, 10)}/${p.ate.slice(5, 7)} e bate a meta de ${p.meta}%.`
    : `No ritmo das últimas semanas (${p.ritmoAtual > 0 ? '+' : ''}${br(p.ritmoAtual)} p.p. por semana), o dentro do prazo chega a ${br(p.projetado)}% em ${p.ate.slice(8, 10)}/${p.ate.slice(5, 7)}, ${p.veredito === 'perto' ? 'perto' : 'abaixo'} da meta de ${p.meta}%.${p.semanasRestantes >= 1 ? ` Para bater, precisa subir ${br(p.ritmoNecessario)} p.p. por semana.` : ''}`;
