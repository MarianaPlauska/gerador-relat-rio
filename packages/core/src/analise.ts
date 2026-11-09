import { segundaDaSemana } from './datas';
import { horasPlanejadas, kpisDosItens, mapaDeDores, mapaDeFrentes, alertasDoPlano, type KpisSemana } from './plano';
import { compararTotais, type LinhaComparativo } from './relatorio';
import type { ItemPlano, Pessoa, PlanoSemana, Promessa, Ritmo, Snapshot, TotaisPainel } from './tipos';

export interface DadosSemana
{
  inicio: string;
  foto?: Snapshot;
  plano?: PlanoSemana;
}

export interface MudancaCard
{
  codigo: string;
  titulo?: string;
  etapasAntes?: number;
  etapasDepois?: number;
  etapasTotal?: number;
  ritmoAntes?: Ritmo;
  ritmoDepois?: Ritmo;
  previsaoAntes?: string;
  previsaoDepois?: string;
}

export interface ComparativoPessoa
{
  pessoa: Pessoa;
  atual: KpisSemana;
  anterior?: KpisSemana;
  horas: number;
  alertas: number;
}

export interface ComparativoSemanas
{
  totais: LinhaComparativo[];
  planoAtual?: KpisSemana;
  planoAnterior?: KpisSemana;
  pessoas: ComparativoPessoa[];
  cards: MudancaCard[];
  entraram: string[];
  sairam: string[];
}

export type Tom = 'positivo' | 'atencao' | 'neutro';

export interface Frase
{
  tom: Tom;
  texto: string;
}

// a foto mais recente tirada dentro da semana
export function fotoDaSemana(fotos: Snapshot[], inicio: string): Snapshot | undefined
{
  return fotos.filter((f) => segundaDaSemana(f.data) === inicio).sort((a, b) => a.data.localeCompare(b.data)).at(-1);
}

// valor de um total do painel em cada foto, para gráfico de evolução
export function historico(fotos: Snapshot[], chave: keyof TotaisPainel): { data: string; valor: number }[]
{
  return [...fotos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .filter((f) => f.totais[chave] !== undefined)
    .map((f) => ({ data: f.data, valor: f.totais[chave]! }));
}

const emExecucao = (foto?: Snapshot) => (foto?.cards ?? []).filter((c) => c.origens.includes('em_execucao'));
const itensDo = (plano?: PlanoSemana) => plano?.pessoas.flatMap((pp) => pp.itens) ?? [];

export function compararSemanas(atual: DadosSemana, anterior: DadosSemana | undefined, pessoas: Pessoa[]): ComparativoSemanas
{
  const cardsAtuais = emExecucao(atual.foto);
  const cardsAntes = emExecucao(anterior?.foto);
  const antes = new Map(cardsAntes.map((c) => [c.codigo, c]));
  const agora = new Set(cardsAtuais.map((c) => c.codigo));
  const alertas = atual.plano ? alertasDoPlano(atual.plano, atual.foto?.cards ?? [], pessoas) : [];

  return {
    totais: compararTotais(atual.foto?.totais ?? {}, anterior?.foto?.totais),
    planoAtual: atual.plano ? kpisDosItens(itensDo(atual.plano), atual.foto?.cards ?? []) : undefined,
    planoAnterior: anterior?.plano ? kpisDosItens(itensDo(anterior.plano), anterior.foto?.cards ?? []) : undefined,
    pessoas: pessoas.map((pessoa) =>
    {
      const pp = atual.plano?.pessoas.find((x) => x.pessoaId === pessoa.id);
      const ppAntes = anterior?.plano?.pessoas.find((x) => x.pessoaId === pessoa.id);
      return {
        pessoa,
        atual: kpisDosItens(pp?.itens ?? [], atual.foto?.cards ?? []),
        anterior: ppAntes ? kpisDosItens(ppAntes.itens, anterior?.foto?.cards ?? []) : undefined,
        horas: pp ? horasPlanejadas(pp) : 0,
        alertas: alertas.filter((a) => a.pessoaId === pessoa.id).length,
      };
    }),
    cards: cardsAtuais
      .filter((c) => antes.has(c.codigo))
      .map((c) =>
      {
        const a = antes.get(c.codigo)!;
        return {
          codigo: c.codigo,
          titulo: c.titulo,
          etapasAntes: a.etapasConcluidas,
          etapasDepois: c.etapasConcluidas,
          etapasTotal: c.etapasTotal,
          ritmoAntes: a.ritmoPainel,
          ritmoDepois: c.ritmoPainel,
          previsaoAntes: a.previsao,
          previsaoDepois: c.previsao,
        };
      }),
    entraram: cardsAtuais.filter((c) => !antes.has(c.codigo)).map((c) => c.codigo),
    sairam: cardsAntes.filter((c) => !agora.has(c.codigo)).map((c) => c.codigo),
  };
}

const pesoRitmo: Record<Ritmo, number> = { no_ritmo: 0, em_risco: 1, atrasado: 2 };
const nomeRitmo: Record<Ritmo, string> = { no_ritmo: 'no ritmo', em_risco: 'em risco', atrasado: 'atrasado' };
const nomeCausa: Record<NonNullable<ItemPlano['causa']>, string> = {
  requisito_mudou: 'requisito mudou',
  dependencia_externa: 'dependência externa',
  estimativa_errada: 'estimativa errada',
  bloqueio: 'bloqueio',
  urgencia: 'urgência',
  outro: 'outro',
};
const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
const lista = (itens: string[], max = 4) => (itens.length > max ? `${itens.slice(0, max).join(', ')} e mais ${itens.length - max}` : itens.join(', '));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// escreve as frases da semana a partir dos números; nada de inventar, só comparar
export function analisarSemana(
  comp: ComparativoSemanas,
  atual: DadosSemana,
  anterior: DadosSemana | undefined,
  promessasAnteriores: Promessa[],
  metaPadrao?: number,
): Frase[]
{
  const frases: Frase[] = [];
  const t = atual.foto?.totais ?? {};
  const a = anterior?.foto?.totais ?? {};
  const desde = anterior?.foto ? ` desde ${dataCurta(anterior.foto.data)}` : '';

  const meta = t.metaPct ?? metaPadrao;
  if (t.dentroDoPrazoPct !== undefined)
  {
    const delta = a.dentroDoPrazoPct !== undefined ? t.dentroDoPrazoPct - a.dentroDoPrazoPct : undefined;
    const variacao = delta === undefined ? '' : delta === 0 ? ' (estável na semana)' : ` (${delta > 0 ? '+' : ''}${delta} pp na semana)`;
    if (meta === undefined) frases.push({ tom: 'neutro', texto: `Dentro do prazo em ${t.dentroDoPrazoPct}%${variacao}.` });
    else if (t.dentroDoPrazoPct >= meta) frases.push({ tom: 'positivo', texto: `Dentro do prazo em ${t.dentroDoPrazoPct}%${variacao}, na meta de ${meta}%.` });
    else frases.push({ tom: 'atencao', texto: `Dentro do prazo em ${t.dentroDoPrazoPct}%${variacao}, ${meta - t.dentroDoPrazoPct} pp abaixo da meta de ${meta}%.` });
  }

  if (t.concluidos !== undefined && a.concluidos !== undefined)
  {
    const d = t.concluidos - a.concluidos;
    frases.push(d > 0
      ? { tom: 'positivo', texto: `${plural(d, 'item concluído', 'itens concluídos')} no cronograma${desde} (de ${a.concluidos} para ${t.concluidos}).` }
      : { tom: 'atencao', texto: `Nenhum item novo concluído no cronograma${desde}.` });
  }

  if (t.ritmoAtrasadas !== undefined && a.ritmoAtrasadas !== undefined && t.ritmoAtrasadas !== a.ritmoAtrasadas)
  {
    const caiu = t.ritmoAtrasadas < a.ritmoAtrasadas;
    frases.push({ tom: caiu ? 'positivo' : 'atencao', texto: `Demandas atrasadas no ritmo ${caiu ? 'caíram' : 'subiram'} de ${a.ritmoAtrasadas} para ${t.ritmoAtrasadas}.` });
  }
  if (t.ritmoEmRisco !== undefined && a.ritmoEmRisco !== undefined && t.ritmoEmRisco !== a.ritmoEmRisco)
  {
    const caiu = t.ritmoEmRisco < a.ritmoEmRisco;
    frases.push({ tom: caiu ? 'positivo' : 'atencao', texto: `Demandas em risco ${caiu ? 'caíram' : 'subiram'} de ${a.ritmoEmRisco} para ${t.ritmoEmRisco}.` });
  }

  const p = comp.planoAtual;
  if (p && p.planejados > 0)
  {
    const antes = comp.planoAnterior?.pctFeitos !== undefined ? `, contra ${comp.planoAnterior.pctFeitos}% na semana anterior` : '';
    const tom: Tom = (p.pctFeitos ?? 0) >= 80 ? 'positivo' : (p.pctFeitos ?? 0) >= 50 ? 'neutro' : 'atencao';
    frases.push({ tom, texto: `Plano da semana: ${p.feitos} de ${p.planejados} itens feitos (${p.pctFeitos}%)${antes}.` });
  }
  if (p?.naoPlanejadosFeitos)
  {
    frases.push({ tom: 'neutro', texto: `${plural(p.naoPlanejadosFeitos, 'item não planejado entrou e foi feito', 'itens não planejados entraram e foram feitos')}.` });
  }
  if (p?.pctDentroDoCronograma !== undefined)
  {
    frases.push({
      tom: p.pctDentroDoCronograma >= 80 ? 'positivo' : 'atencao',
      texto: `${p.pctDentroDoCronograma}% das entregas (${p.dentroDoCronograma} de ${p.feitosComLimite}) ficaram dentro da previsão do card.`,
    });
  }

  const itens = itensDo(atual.plano);
  if (p?.alterados)
  {
    const causas = new Map<string, number>();
    for (const i of itens.filter((i) => i.causa)) causas.set(nomeCausa[i.causa!], (causas.get(nomeCausa[i.causa!]) ?? 0) + 1);
    const [causa, vezes] = [...causas.entries()].sort((x, y) => y[1] - x[1])[0] ?? [];
    frases.push({ tom: 'atencao', texto: `${plural(p.alterados, 'item teve', 'itens tiveram')} data mudada ou foram adiados${causa ? `; causa mais citada: ${causa} (${vezes})` : ''}.` });
  }

  for (const cp of comp.pessoas.filter((x) => x.horas > x.pessoa.capacidadeHorasSemana))
  {
    frases.push({ tom: 'atencao', texto: `${cp.pessoa.nome} está com ${cp.horas}h planejadas para ${cp.pessoa.capacidadeHorasSemana}h de capacidade.` });
  }
  const maisAlertas = [...comp.pessoas].sort((x, y) => y.alertas - x.alertas)[0];
  if (maisAlertas && maisAlertas.alertas >= 2)
  {
    frases.push({ tom: 'atencao', texto: `${maisAlertas.pessoa.nome} concentra ${maisAlertas.alertas} alertas de entrega além do que o painel espera.` });
  }

  const parados = comp.cards.filter((c) => c.etapasAntes !== undefined && c.etapasAntes === c.etapasDepois).map((c) => c.codigo);
  if (parados.length) frases.push({ tom: 'atencao', texto: `Sem avanço de etapa${desde}: ${lista(parados)}.` });
  const avancaram = comp.cards.filter((c) => c.etapasAntes !== undefined && c.etapasDepois !== undefined && c.etapasDepois > c.etapasAntes);
  if (avancaram.length)
  {
    const etapas = avancaram.reduce((s, c) => s + c.etapasDepois! - c.etapasAntes!, 0);
    frases.push({ tom: 'positivo', texto: `${plural(avancaram.length, 'card avançou', 'cards avançaram')} ${plural(etapas, 'etapa', 'etapas')} no total${desde}.` });
  }

  const pioraram = comp.cards.filter((c) => c.ritmoAntes && c.ritmoDepois && pesoRitmo[c.ritmoDepois] > pesoRitmo[c.ritmoAntes]);
  if (pioraram.length)
  {
    frases.push({ tom: 'atencao', texto: `Pioraram de ritmo: ${lista(pioraram.map((c) => `${c.codigo} (${nomeRitmo[c.ritmoAntes!]} para ${nomeRitmo[c.ritmoDepois!]})`), 3)}.` });
  }
  const melhoraram = comp.cards.filter((c) => c.ritmoAntes && c.ritmoDepois && pesoRitmo[c.ritmoDepois] < pesoRitmo[c.ritmoAntes]);
  if (melhoraram.length) frases.push({ tom: 'positivo', texto: `Voltaram a melhorar de ritmo: ${lista(melhoraram.map((c) => c.codigo))}.` });

  const previsoes = comp.cards.filter((c) => c.previsaoAntes && c.previsaoDepois && c.previsaoAntes !== c.previsaoDepois);
  if (previsoes.length)
  {
    frases.push({ tom: 'atencao', texto: `O painel mudou a previsão de ${plural(previsoes.length, 'card', 'cards')}: ${lista(previsoes.map((c) => `${c.codigo} (${dataCurta(c.previsaoAntes)} para ${dataCurta(c.previsaoDepois)})`), 3)}.` });
  }

  if (comp.entraram.length && anterior?.foto) frases.push({ tom: 'neutro', texto: `Entraram em execução: ${lista(comp.entraram)}.` });
  if (comp.sairam.length) frases.push({ tom: 'neutro', texto: `Saíram da execução (concluídos ou pausados): ${lista(comp.sairam)}.` });

  const fechadas = promessasAnteriores.filter((x) => x.cumprida !== undefined);
  if (fechadas.length)
  {
    const cumpridas = fechadas.filter((x) => x.cumprida).length;
    frases.push({ tom: cumpridas === fechadas.length ? 'positivo' : 'atencao', texto: `${cumpridas} de ${fechadas.length} compromissos da semana anterior cumpridos.` });
  }

  if (atual.plano)
  {
    const frentes = mapaDeFrentes(atual.plano).filter((f) => f.frente !== 'Sem frente');
    const dores = mapaDeDores(atual.plano);
    const compartilhadas = frentes.filter((f) => Object.keys(f.porPessoa).length > 1).map((f) => f.frente);
    if (frentes.length)
    {
      const juntas = compartilhadas.length ? `; ${lista(compartilhadas, 3)} ${compartilhadas.length === 1 ? 'tem' : 'têm'} mais de uma pessoa` : '';
      frases.push({ tom: 'neutro', texto: `Time atuando em ${plural(frentes.length, 'frente', 'frentes')} e ${plural(dores.length, 'dor', 'dores')}${juntas}.` });
    }
  }

  return frases;
}

// rascunho do texto de abertura: o que pede atenção primeiro, depois o que foi bem
export function resumoSugerido(frases: Frase[]): string
{
  const atencao = frases.filter((f) => f.tom === 'atencao').slice(0, 2);
  const positivo = frases.filter((f) => f.tom === 'positivo').slice(0, 1);
  return [...frases.slice(0, 1), ...atencao, ...positivo]
    .filter((f, i, todas) => todas.indexOf(f) === i)
    .map((f) => f.texto)
    .join(' ');
}
