import { chaveDoItemPlano, historicoDaFila, segundaDaSemana, somarDias, type ItemPlano, type LinhaHistorico } from '@supervisao/core';
import type { Dados } from './armazenamento.ts';

export type EtapaItem = { texto: string; feita: boolean; horasEstimadas?: number | undefined; horasReais?: number | undefined };

// meta de entregas no prazo combinada com a gestão: 75% em novembro, 80% em dezembro, 85% a partir de janeiro
export const metaDoMes = (data: string): number => (Number(data.slice(5, 7)) === 11 ? 75 : Number(data.slice(5, 7)) === 12 ? 80 : 85);

// item que veio de uma semana anterior: as últimas etapas registradas para o mesmo card e descrição
export function etapasHerdadas(dados: Dados, semana: string, item: ItemPlano): EtapaItem[]
{
  const chave = chaveDoItemPlano(item);
  const anteriores = Object.keys(dados.governancaSemanal ?? {}).filter((s) => s < semana).sort().reverse();
  for (const s of anteriores)
  {
    const igual = dados.planos.find((p) => p.inicio === s)?.pessoas.flatMap((pp) => pp.itens).find((x) => chaveDoItemPlano(x) === chave);
    const lista = igual ? dados.governancaSemanal?.[s]?.etapasPorItem?.[igual.id] : undefined;
    if (lista?.length) return lista;
  }
  return [];
}

export const etapasDoItem = (dados: Dados, semana: string, item: ItemPlano): EtapaItem[] =>
  dados.governancaSemanal?.[semana]?.etapasPorItem?.[item.id] ?? etapasHerdadas(dados, semana, item);

export function backlogDaSemana(dados: Dados, semana: string): number | undefined
{
  const manual = dados.governancaSemanal?.[semana]?.backlogFimSemana;
  if (manual !== undefined) return manual;
  const f = dados.fotos.filter((x) => x.data <= somarDias(semana, 4)).sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  return f?.totais.emAbertoAgora ?? f?.totais.demandasEmAndamento;
}

// entradas, saídas, saldo, backlog, prazo e qualidade das últimas semanas até a informada
export function historicoDasSemanas(dados: Dados, ate: string, quantas = 8): LinhaHistorico[]
{
  const semanas = [...new Set([...dados.planos.map((p) => p.inicio), ...Object.keys(dados.governancaSemanal ?? {}), ...dados.fotos.map((f) => segundaDaSemana(f.data))])]
    .filter((s) => s <= ate)
    .sort()
    .slice(-quantas);
  return historicoDaFila(semanas.map((s) =>
  {
    const g = dados.governancaSemanal?.[s];
    const f = dados.fotos.filter((x) => x.data >= s && x.data <= somarDias(s, 4)).sort((a, b) => a.data.localeCompare(b.data)).at(-1);
    return {
      semana: s,
      entradas: g?.entradasSemana,
      saidas: g?.saidasSemana ?? f?.totais.concluidasNoPeriodo,
      backlog: backlogDaSemana(dados, s),
      prazoPct: f?.totais.dentroDoPrazoPct,
      qualidadePct: f?.totais.qualidadePct ?? f?.totais.eficienciaQualidade ?? g?.qualidadeManualPct,
    };
  }));
}
