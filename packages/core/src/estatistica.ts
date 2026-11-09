import { diasUteisEntre, segundaDaSemana } from './datas';
import { horasPlanejadas } from './plano';
import type { ItemPlano, Pessoa, PlanoSemana, Snapshot, TotaisPainel } from './tipos';

export interface ResumoSerie
{
  n: number;
  media: number;
  mediana: number;
  desvio: number;
  minimo: number;
  maximo: number;
  // variação média por período (mínimos quadrados)
  inclinacao: number;
  ultimo: number;
}

const umaCasa = (n: number) => Math.round(n * 10) / 10;

export function resumirSerie(valores: number[]): ResumoSerie | undefined
{
  const n = valores.length;
  if (!n) return undefined;
  const media = valores.reduce((s, v) => s + v, 0) / n;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(n / 2);
  const mediana = n % 2 ? ordenados[meio]! : (ordenados[meio - 1]! + ordenados[meio]!) / 2;
  // desvio-padrão amostral
  const desvio = n > 1 ? Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)) : 0;
  const mx = (n - 1) / 2;
  const sxx = valores.reduce((s, _, i) => s + (i - mx) ** 2, 0);
  const inclinacao = sxx ? valores.reduce((s, v, i) => s + (i - mx) * (v - media), 0) / sxx : 0;
  return {
    n,
    media: umaCasa(media),
    mediana: umaCasa(mediana),
    desvio: umaCasa(desvio),
    minimo: ordenados[0]!,
    maximo: ordenados[n - 1]!,
    inclinacao: umaCasa(inclinacao),
    ultimo: valores[n - 1]!,
  };
}

// um valor por semana: o da última foto de cada semana, até a semana informada
export function serieSemanal(fotos: Snapshot[], chave: keyof TotaisPainel, ateSemana: string): { semana: string; valor: number }[]
{
  const porSemana = new Map<string, Snapshot>();
  for (const f of [...fotos].sort((a, b) => a.data.localeCompare(b.data)))
  {
    const semana = segundaDaSemana(f.data);
    if (semana <= ateSemana && f.totais[chave] !== undefined) porSemana.set(semana, f);
  }
  return [...porSemana].sort(([a], [b]) => a.localeCompare(b)).map(([semana, f]) => ({ semana, valor: f.totais[chave]! }));
}

export interface LinhaPareto
{
  rotulo: string;
  qtd: number;
  pct: number;
  pctAcumulado: number;
}

export function pareto(rotulos: string[]): LinhaPareto[]
{
  const contagem = new Map<string, number>();
  for (const r of rotulos) contagem.set(r, (contagem.get(r) ?? 0) + 1);
  let acumulado = 0;
  return [...contagem]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([rotulo, qtd]) =>
    {
      acumulado += qtd;
      return { rotulo, qtd, pct: umaCasa((qtd / rotulos.length) * 100), pctAcumulado: umaCasa((acumulado / rotulos.length) * 100) };
    });
}

export interface UsoPessoa
{
  pessoa: Pessoa;
  horas: number;
  utilizacaoPct?: number | undefined;
}

export interface EstatisticasPlano
{
  total: number;
  porStatus: Record<ItemPlano['status'], number>;
  causas: LinhaPareto[];
  // dias úteis entre a data combinada e a entrega; negativo = entregou antes
  desvioEntrega?: ResumoSerie | undefined;
  entregasNoCombinado: number;
  entregasComData: number;
  horasPlanejadas: number;
  capacidade: number;
  utilizacaoPct?: number | undefined;
  uso: UsoPessoa[];
}

export function estatisticasDoPlano(plano: PlanoSemana, pessoas: Pessoa[], feriados: string[] = []): EstatisticasPlano
{
  const itens = plano.pessoas.flatMap((pp) => pp.itens);
  const porStatus: Record<ItemPlano['status'], number> = { a_fazer: 0, fazendo: 0, feito: 0, bloqueado: 0, adiado: 0 };
  for (const i of itens) porStatus[i.status]++;
  const desvios = itens
    .filter((i) => i.status === 'feito' && i.entregueEm && (i.ateOriginal ?? i.ate))
    .map((i) => diasUteisEntre(i.ateOriginal ?? i.ate!, i.entregueEm!, feriados));
  const uso: UsoPessoa[] = plano.pessoas.flatMap((pp) =>
  {
    const pessoa = pessoas.find((p) => p.id === pp.pessoaId);
    const horas = horasPlanejadas(pp);
    if (!pessoa || !horas) return [];
    return [{ pessoa, horas, utilizacaoPct: pessoa.capacidadeHorasSemana ? Math.round((horas / pessoa.capacidadeHorasSemana) * 100) : undefined }];
  });
  const horas = uso.reduce((s, u) => s + u.horas, 0);
  const capacidade = uso.reduce((s, u) => s + u.pessoa.capacidadeHorasSemana, 0);
  return {
    total: itens.length,
    porStatus,
    causas: pareto(itens.filter((i) => i.status !== 'feito' && i.causa).map((i) => i.causa!)),
    desvioEntrega: resumirSerie(desvios),
    entregasNoCombinado: desvios.filter((d) => d <= 0).length,
    entregasComData: desvios.length,
    horasPlanejadas: horas,
    capacidade,
    utilizacaoPct: capacidade ? Math.round((horas / capacidade) * 100) : undefined,
    uso,
  };
}

// número ISO da semana no ano, para numerar o relatório
export function semanaDoAno(iso: string): number
{
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const data = new Date(Date.UTC(a!, m! - 1, d!));
  const dia = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - dia);
  const inicioAno = Date.UTC(data.getUTCFullYear(), 0, 1);
  return Math.ceil(((data.getTime() - inicioAno) / 86_400_000 + 1) / 7);
}

// onde o valor atual cai em relação à faixa usual (média mais ou menos um desvio-padrão)
export function posicaoNaFaixa(r: ResumoSerie): 'acima' | 'abaixo' | 'dentro' | undefined
{
  if (r.n < 3 || !r.desvio) return undefined;
  if (r.ultimo > r.media + r.desvio) return 'acima';
  if (r.ultimo < r.media - r.desvio) return 'abaixo';
  return 'dentro';
}
