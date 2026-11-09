import type { CardSnapshot, CorSemaforo, Pessoa, Ritmo, TotaisPainel } from './tipos';

export type Tendencia = 'melhorou' | 'piorou' | 'igual' | 'neutra';

export interface LinhaComparativo
{
  chave: keyof TotaisPainel;
  anterior?: number;
  atual?: number;
  diferenca?: number;
  tendencia: Tendencia;
}

const melhorSeSobe: (keyof TotaisPainel)[] = [
  'concluidos', 'concluidosPct', 'dentroDoPrazoPct', 'concluidasNoPeriodo', 'ritmoNoRitmo',
  'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade', 'qualidadePct',
];
const melhorSeDesce: (keyof TotaisPainel)[] = [
  'atrasadosVencimento', 'foraDoPrazo', 'ritmoAtrasadas', 'ritmoEmRisco', 'previsaoVencida',
  'paradasEntreEtapas', 'idade7a15Dias', 'idadeMais15Dias',
];

// compara os números do painel entre duas fotos, sem recalcular nada
export function compararTotais(atual: TotaisPainel, anterior: TotaisPainel = {}): LinhaComparativo[]
{
  const chaves = [...new Set([...Object.keys(atual), ...Object.keys(anterior)])] as (keyof TotaisPainel)[];
  return chaves.map((chave) =>
  {
    const a = anterior[chave];
    const b = atual[chave];
    const diferenca = a !== undefined && b !== undefined ? b - a : undefined;
    let tendencia: Tendencia = 'neutra';
    if (diferenca === 0) tendencia = 'igual';
    else if (diferenca !== undefined && melhorSeSobe.includes(chave)) tendencia = diferenca > 0 ? 'melhorou' : 'piorou';
    else if (diferenca !== undefined && melhorSeDesce.includes(chave)) tendencia = diferenca < 0 ? 'melhorou' : 'piorou';
    return { chave, anterior: a, atual: b, diferenca, tendencia };
  });
}

export type ContagemRitmo = Record<Ritmo, number> & { semRitmo: number; total: number };

export function ritmoPorPessoa(cards: CardSnapshot[], pessoas: Pessoa[]): { pessoa: Pessoa; contagem: ContagemRitmo }[]
{
  return pessoas.map((pessoa) =>
  {
    const contagem: ContagemRitmo = { no_ritmo: 0, em_risco: 0, atrasado: 0, semRitmo: 0, total: 0 };
    for (const c of cards.filter((c) => c.responsavelEtapaAtual === pessoa.id))
    {
      if (c.ritmoPainel) contagem[c.ritmoPainel]++;
      else contagem.semRitmo++;
      contagem.total++;
    }
    return { pessoa, contagem };
  });
}

// verde na meta, amarelo até X pontos abaixo, vermelho além disso
export function semaforoPrazo(dentroDoPrazoPct: number | undefined, metaPct: number | undefined, amareloAte: number): CorSemaforo | undefined
{
  if (dentroDoPrazoPct === undefined || metaPct === undefined) return undefined;
  if (dentroDoPrazoPct >= metaPct) return 'verde';
  return metaPct - dentroDoPrazoPct <= amareloAte ? 'amarelo' : 'vermelho';
}
