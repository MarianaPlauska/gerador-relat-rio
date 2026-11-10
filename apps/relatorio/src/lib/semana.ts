import
{
  alertasDoPlano, analisarSemana, compararSemanas, definicoesPadrao, fotoDaSemana, planoDoPeriodo, segundaDaSemana, semaforoPrazo, somarDias,
  type CorSemaforo, type DadosSemana,
} from '@supervisao/core';
import type { Dados, NotasRelatorio } from './armazenamento.ts';

export const hoje = () => new Date().toISOString().slice(0, 10);

export function semanasDisponiveis(dados: Dados): string[]
{
  const atual = segundaDaSemana(hoje());
  return [...new Set([atual, ...dados.fotos.map((f) => segundaDaSemana(f.data)), ...dados.planos.map((p) => p.inicio)])].sort().reverse();
}

export interface Periodo
{
  inicio: string;
  fim: string;
  livre: boolean;
  // só na semana: segunda da semana usada na comparação
  comparar?: string | undefined;
}

export const periodoDaSemana = (inicio: string, comparar = somarDias(inicio, -7)): Periodo => ({ inicio, fim: somarDias(inicio, 4), livre: false, comparar });

export function contextoDoRelatorio(dados: Dados, periodo: Periodo)
{
  const { inicio, fim, livre } = periodo;
  let atual: DadosSemana;
  let anterior: DadosSemana | undefined;
  let promessasAnteriores;
  let promessas;
  if (livre)
  {
    // início x fim: a foto de antes do período (ou a primeira dele) contra a última do período
    const ordenadas = [...dados.fotos].sort((a, b) => a.data.localeCompare(b.data));
    const final = ordenadas.filter((f) => f.data >= inicio && f.data <= fim).at(-1);
    const base = ordenadas.filter((f) => f.data < inicio).at(-1) ?? ordenadas.find((f) => f.data >= inicio && f.data <= fim && f !== final);
    atual = { inicio, foto: final, plano: planoDoPeriodo(dados.planos, segundaDaSemana(inicio), fim) };
    anterior = base ? { inicio: segundaDaSemana(base.data), foto: base } : undefined;
    promessas = dados.promessas.filter((p) => p.semana >= segundaDaSemana(inicio) && p.semana <= fim);
    promessasAnteriores = promessas.filter((p) => p.cumprida !== undefined);
  }
  else
  {
    const inicioAnterior = periodo.comparar ?? somarDias(inicio, -7);
    atual = { inicio, foto: fotoDaSemana(dados.fotos, inicio), plano: dados.planos.find((p) => p.inicio === inicio) };
    const candidato: DadosSemana = { inicio: inicioAnterior, foto: fotoDaSemana(dados.fotos, inicioAnterior), plano: dados.planos.find((p) => p.inicio === inicioAnterior) };
    anterior = candidato.foto || candidato.plano ? candidato : undefined;
    promessasAnteriores = dados.promessas.filter((p) => p.semana === inicioAnterior);
    promessas = [...promessasAnteriores, ...dados.promessas.filter((p) => p.semana === inicio)];
  }
  const comp = compararSemanas(atual, anterior, dados.pessoas);
  const meta = atual.foto?.totais.metaPct ?? definicoesPadrao.metas.dentroDoPrazoPorMes[fim.slice(0, 7)];
  const frasesDaSemana = analisarSemana(comp, atual, anterior, promessasAnteriores, meta);
  // as frases do core falam de semana; no período o mesmo texto vale para o intervalo
  const frases = livre
    ? frasesDaSemana.map((f) => ({ ...f, texto: f.texto.replace('na semana)', 'no período)').replace('Plano da semana:', 'Planos do período:').replace('compromissos da semana anterior', 'compromissos do período') }))
    : frasesDaSemana;
  const alertas = atual.plano ? alertasDoPlano(atual.plano, atual.foto?.cards ?? [], dados.pessoas) : [];
  return { atual, anterior, comp, frases, meta, alertas, promessasAnteriores, promessas, fim, livre };
}

export type Contexto = ReturnType<typeof contextoDoRelatorio>;

export const contextoDaSemana = (dados: Dados, inicio: string, inicioAnterior?: string) => contextoDoRelatorio(dados, periodoDaSemana(inicio, inicioAnterior));

export const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
export const dataMedia = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '-');

export function semaforoDoRelatorio(ctx: Contexto, notas: NotasRelatorio): CorSemaforo | undefined
{
  return notas.semaforo ?? semaforoPrazo(ctx.atual.foto?.totais.dentroDoPrazoPct, ctx.meta, definicoesPadrao.semaforo.amareloAte);
}
