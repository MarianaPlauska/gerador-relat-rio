import { somarDias } from './datas';
import type { CardSnapshot, ItemPlano, Pessoa, PlanoPessoa, PlanoSemana } from './tipos';

export interface Alerta
{
  nivel: 'alto' | 'medio';
  texto: string;
  pessoaId: string;
  itemId?: string;
  cardCodigo?: string;
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// compara o que eu planejei com o que o painel do gestor espera do card
export function alertasDoItem(item: ItemPlano, pessoaId: string, inicioSemana: string, card?: CardSnapshot): Alerta[]
{
  const alertas: Alerta[] = [];
  const base = { pessoaId, itemId: item.id, cardCodigo: item.cardCodigo };
  if (item.status === 'feito') return alertas;
  if (item.cardCodigo && !card)
  {
    alertas.push({ ...base, nivel: 'medio', texto: `${item.cardCodigo} não está na foto do painel` });
    return alertas;
  }
  if (!card) return alertas;
  if (item.ate && card.vencimento && item.ate > card.vencimento)
  {
    alertas.push({ ...base, nivel: 'alto', texto: `${card.codigo}: entrega em ${dataCurta(item.ate)} passa do vencimento do painel (${dataCurta(card.vencimento)})` });
  }
  else if (item.ate && card.previsao && item.ate > card.previsao)
  {
    alertas.push({ ...base, nivel: 'medio', texto: `${card.codigo}: entrega em ${dataCurta(item.ate)} passa da previsão do painel (${dataCurta(card.previsao)})` });
  }
  if (card.previsao && card.previsao < inicioSemana)
  {
    alertas.push({ ...base, nivel: 'alto', texto: `${card.codigo}: previsão do painel já venceu em ${dataCurta(card.previsao)}` });
  }
  if (card.ritmoPainel === 'atrasado')
  {
    alertas.push({ ...base, nivel: 'alto', texto: `${card.codigo}: atrasado no ritmo do painel` });
  }
  return alertas;
}

export function horasPlanejadas(pp: PlanoPessoa): number
{
  return pp.itens.reduce((soma, i) => soma + (i.horasEstimadas ?? 0), 0);
}

export function alertasDoPlano(plano: PlanoSemana, cards: CardSnapshot[], pessoas: Pessoa[]): Alerta[]
{
  const porCodigo = new Map(cards.map((c) => [c.codigo, c]));
  const alertas: Alerta[] = [];
  for (const pp of plano.pessoas)
  {
    const pessoa = pessoas.find((p) => p.id === pp.pessoaId);
    const horas = horasPlanejadas(pp);
    if (pessoa && horas > pessoa.capacidadeHorasSemana)
    {
      alertas.push({ pessoaId: pp.pessoaId, nivel: 'medio', texto: `${pessoa.nome}: ${horas}h planejadas passam da capacidade de ${pessoa.capacidadeHorasSemana}h` });
    }
    for (const item of pp.itens)
    {
      alertas.push(...alertasDoItem(item, pp.pessoaId, plano.inicio, item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined));
    }
  }
  return alertas;
}

export interface KpisSemana
{
  planejados: number;
  feitos: number;
  pctFeitos?: number;
  naoPlanejadosFeitos: number;
  alterados: number;
  feitosComLimite: number;
  dentroDoCronograma: number;
  pctDentroDoCronograma?: number;
}

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : undefined);

// limite do cronograma: a data mais cedo entre previsão e vencimento do card; sem card, a data combinada no plano
function limiteDoItem(item: ItemPlano, card?: CardSnapshot): string | undefined
{
  const datas = [card?.previsao, card?.vencimento].filter((d): d is string => !!d).sort();
  return datas[0] ?? item.ateOriginal ?? item.ate;
}

export function kpisDosItens(itens: ItemPlano[], cards: CardSnapshot[]): KpisSemana
{
  const porCodigo = new Map(cards.map((c) => [c.codigo, c]));
  const planejados = itens.filter((i) => i.tipo === 'planejado');
  const feitos = planejados.filter((i) => i.status === 'feito').length;
  const alterados = itens.filter((i) => i.status === 'adiado' || (i.ateOriginal && i.ate !== i.ateOriginal)).length;
  let feitosComLimite = 0;
  let dentroDoCronograma = 0;
  for (const item of itens.filter((i) => i.status === 'feito'))
  {
    const limite = limiteDoItem(item, item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined);
    const entrega = item.entregueEm ?? item.ate;
    if (!limite || !entrega) continue;
    feitosComLimite++;
    if (entrega <= limite) dentroDoCronograma++;
  }
  return {
    planejados: planejados.length,
    feitos,
    pctFeitos: pct(feitos, planejados.length),
    naoPlanejadosFeitos: itens.filter((i) => i.tipo === 'nao_planejado' && i.status === 'feito').length,
    alterados,
    feitosComLimite,
    dentroDoCronograma,
    pctDentroDoCronograma: pct(dentroDoCronograma, feitosComLimite),
  };
}

export interface MudancaDeData
{
  codigo: string;
  campo: 'previsao' | 'vencimento';
  de: string;
  para: string;
}

// cards que tiveram previsão ou vencimento mudados no painel entre duas fotos
export function datasAlteradasNoPainel(atual: CardSnapshot[], anterior: CardSnapshot[]): MudancaDeData[]
{
  const antes = new Map(anterior.map((c) => [c.codigo, c]));
  const mudancas: MudancaDeData[] = [];
  for (const c of atual)
  {
    const a = antes.get(c.codigo);
    if (!a) continue;
    for (const campo of ['previsao', 'vencimento'] as const)
    {
      const de = a[campo];
      const para = c[campo];
      if (de && para && de !== para) mudancas.push({ codigo: c.codigo, campo, de, para });
    }
  }
  return mudancas;
}

export interface LinhaFrente
{
  frente: string;
  porPessoa: Record<string, ItemPlano[]>;
}

const SEM_FRENTE = 'Sem frente';

export function mapaDeFrentes(plano: PlanoSemana): LinhaFrente[]
{
  const linhas = new Map<string, LinhaFrente>();
  for (const pp of plano.pessoas)
  {
    for (const item of pp.itens)
    {
      const frente = item.frente?.trim() || SEM_FRENTE;
      const linha = linhas.get(frente) ?? { frente, porPessoa: {} };
      (linha.porPessoa[pp.pessoaId] ??= []).push(item);
      linhas.set(frente, linha);
    }
  }
  const ordem = (f: string) => (f === SEM_FRENTE ? '￿' : f);
  return [...linhas.values()].sort((a, b) => ordem(a.frente).localeCompare(ordem(b.frente)));
}

export function mapaDeDores(plano: PlanoSemana): { dor: string; itens: { pessoaId: string; item: ItemPlano }[] }[]
{
  const dores = new Map<string, { pessoaId: string; item: ItemPlano }[]>();
  for (const pp of plano.pessoas)
  {
    for (const item of pp.itens)
    {
      const dor = item.dor?.trim();
      if (dor) dores.set(dor, [...(dores.get(dor) ?? []), { pessoaId: pp.pessoaId, item }]);
    }
  }
  return [...dores.entries()].map(([dor, itens]) => ({ dor, itens }));
}

// guarda as datas combinadas; mudar depois disso conta como item alterado
export function confirmarPlano(plano: PlanoSemana, hoje: string): PlanoSemana
{
  return {
    ...plano,
    confirmadoEm: hoje,
    pessoas: plano.pessoas.map((pp) => ({ ...pp, itens: pp.itens.map((i) => ({ ...i, ateOriginal: i.ate })) })),
  };
}

// o que não foi feito na semana anterior volta como pendência, sem data combinada
export function pendenciasDaSemana(anterior: PlanoSemana, novoId: () => string): PlanoPessoa[]
{
  return anterior.pessoas.map((pp) => ({
    pessoaId: pp.pessoaId,
    itens: pp.itens
      .filter((i) => i.status !== 'feito')
      .map((i) => ({
        id: novoId(),
        cardCodigo: i.cardCodigo,
        descricao: i.descricao,
        objetivo: i.objetivo,
        frente: i.frente,
        dor: i.dor,
        horasEstimadas: i.horasEstimadas,
        tipo: 'planejado' as const,
        status: 'a_fazer' as const,
      })),
  }));
}

// um item por card em que a pessoa está na etapa atual, com entrega na previsão (ou na sexta)
export function sugerirItens(cards: CardSnapshot[], pessoaId: string, inicioSemana: string, jaNoPlano: string[], novoId: () => string): ItemPlano[]
{
  const sexta = somarDias(inicioSemana, 4);
  return cards
    .filter((c) => c.responsavelEtapaAtual === pessoaId && c.origens.includes('em_execucao') && !jaNoPlano.includes(c.codigo))
    .map((c) =>
    {
      const ate = c.previsao && c.previsao <= sexta ? c.previsao : sexta;
      return {
        id: novoId(),
        cardCodigo: c.codigo,
        descricao: !c.etapaAtual ? 'Avançar o card' : /^concluir/i.test(c.etapaAtual) ? c.etapaAtual : `Concluir ${c.etapaAtual}`,
        ate,
        ateOriginal: ate,
        tipo: 'planejado' as const,
        status: 'a_fazer' as const,
      };
    });
}
