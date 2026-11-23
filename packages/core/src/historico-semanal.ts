// fila semana a semana: entradas, saídas, saldo e backlog, para as metas "backlog sem crescer 2 semanas seguidas"
// e "saídas maiores ou iguais às entradas na maioria das semanas"
export interface SemanaDaFila
{
  semana: string;
  entradas?: number | undefined;
  saidas?: number | undefined;
  backlog?: number | undefined;
  prazoPct?: number | undefined;
  qualidadePct?: number | undefined;
}

export interface LinhaHistorico extends SemanaDaFila
{
  // saídas menos entradas: positivo, a fila diminuiu
  saldo?: number | undefined;
  backlogCresceu?: boolean | undefined;
  // segunda semana seguida com backlog maior
  cresceu2Seguidas: boolean;
  saidasOk?: boolean | undefined;
}

export function historicoDaFila(semanas: SemanaDaFila[]): LinhaHistorico[]
{
  const ordenadas = [...semanas].sort((a, b) => a.semana.localeCompare(b.semana));
  return ordenadas.map((s, i) =>
  {
    const ant = ordenadas[i - 1]?.backlog;
    const antAnt = ordenadas[i - 2]?.backlog;
    const cresceu = s.backlog !== undefined && ant !== undefined ? s.backlog > ant : undefined;
    return {
      ...s,
      saldo: s.entradas !== undefined && s.saidas !== undefined ? s.saidas - s.entradas : undefined,
      backlogCresceu: cresceu,
      cresceu2Seguidas: !!cresceu && antAnt !== undefined && ant! > antAnt,
      saidasOk: s.entradas !== undefined && s.saidas !== undefined ? s.saidas >= s.entradas : undefined,
    };
  });
}

export const chaveDoItemPlano = (item: { cardCodigo?: string | undefined; descricao: string }): string =>
  `${item.cardCodigo ?? ''}|${item.descricao.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
