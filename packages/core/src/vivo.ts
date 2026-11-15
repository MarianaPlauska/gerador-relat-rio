import { diasUteisEntre } from './datas';
import { idCurto } from './checklist';

// relatório vivo: um relatório que fica aberto e é preenchido aos poucos, todo dia.
// Tem um checklist (itens avulsos ou diários que zeram a cada dia) e um diário por campo;
// o texto de cada campo do relatório sai das entradas, em ordem de data. Os números vêm do painel.

export type CampoVivo = 'resumo' | 'destaques' | 'decisoes' | 'proximosPassos';

export const nomesCampoVivo: Record<CampoVivo, string> = {
  resumo: 'Resumo',
  destaques: 'Destaques e conquistas',
  decisoes: 'Decisões e apoio da gestão',
  proximosPassos: 'Próximos passos',
};

export const camposVivo = Object.keys(nomesCampoVivo) as CampoVivo[];

export interface ItemVivo
{
  id: string;
  texto: string;
  // diário: volta a ficar pendente no dia seguinte
  diario: boolean;
  // data (AAAA-MM-DD) em que foi marcado
  feitoEm?: string | undefined;
}

export interface EntradaViva
{
  id: string;
  // data e hora (ISO local)
  quando: string;
  campo: CampoVivo;
  texto: string;
}

export interface RelatorioVivo
{
  id: string;
  nome: string;
  modeloId: string;
  inicio: string;
  fim: string;
  // período livre (início x fim) ou semana
  livre: boolean;
  criadoEm: string;
  itens: ItemVivo[];
  entradas: EntradaViva[];
  encerradoEm?: string | undefined;
}

export const itensPadraoVivo: { texto: string; diario: boolean }[] = [
  { texto: 'Colar o painel do gestor', diario: true },
  { texto: 'Registrar o que andou hoje', diario: true },
  { texto: 'Conferir os alertas e os riscos', diario: false },
  { texto: 'Registrar decisões que dependem da gestão', diario: false },
  { texto: 'Revisar o resumo', diario: false },
  { texto: 'Gerar o PDF e enviar', diario: false },
];

export function novoVivo(nome: string, modeloId: string, inicio: string, fim: string, livre: boolean, agora: string): RelatorioVivo
{
  return {
    id: idCurto(),
    nome: nome.trim() || 'Relatório vivo',
    modeloId,
    inicio,
    fim,
    livre,
    criadoEm: agora,
    itens: itensPadraoVivo.map((i) => ({ id: idCurto(), ...i })),
    entradas: [],
  };
}

export const itemFeito = (item: ItemVivo, hoje: string): boolean => (item.diario ? item.feitoEm === hoje : item.feitoEm !== undefined);

export function alternarItem(item: ItemVivo, hoje: string): void
{
  item.feitoEm = itemFeito(item, hoje) ? undefined : hoje;
}

export function progressoVivo(v: RelatorioVivo, hoje: string): { feitos: number; total: number; pct: number }
{
  const total = v.itens.length;
  const feitos = v.itens.filter((i) => itemFeito(i, hoje)).length;
  return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 };
}

export function registrar(v: RelatorioVivo, campo: CampoVivo, texto: string, quando: string): EntradaViva | undefined
{
  const limpo = texto.trim();
  if (!limpo) return undefined;
  const entrada: EntradaViva = { id: idCurto(), quando, campo, texto: limpo };
  v.entradas.push(entrada);
  return entrada;
}

export const entradasDoCampo = (v: RelatorioVivo, campo: CampoVivo): EntradaViva[] =>
  v.entradas.filter((e) => e.campo === campo).sort((a, b) => a.quando.localeCompare(b.quando));

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// uma linha por entrada, com a data na frente; linhas com "-" viram lista no PDF
export function textoDoCampo(v: RelatorioVivo, campo: CampoVivo): string
{
  return entradasDoCampo(v, campo).map((e) => `- ${dataBr(e.quando)}: ${e.texto.replace(/\s*\n\s*/g, ' ')}`).join('\n');
}

// campos que têm entradas viram o texto do relatório; os outros ficam como estavam
export function camposParaRelatorio(v: RelatorioVivo): Partial<Record<CampoVivo, string>>
{
  const saida: Partial<Record<CampoVivo, string>> = {};
  for (const campo of camposVivo)
  {
    const texto = textoDoCampo(v, campo);
    if (texto) saida[campo] = texto;
  }
  return saida;
}

// dias úteis desde o último registro (ou desde a criação), para lembrar de preencher
export function diasSemRegistro(v: RelatorioVivo, hoje: string, feriados: string[] = []): number
{
  const ultimo = v.entradas.map((e) => e.quando.slice(0, 10)).sort().at(-1) ?? v.criadoEm.slice(0, 10);
  return ultimo >= hoje ? 0 : diasUteisEntre(ultimo, hoje, feriados);
}

export const registrouHoje = (v: RelatorioVivo, hoje: string): boolean => v.entradas.some((e) => e.quando.startsWith(hoje));

export function migrarVivo(v: Partial<RelatorioVivo>): RelatorioVivo
{
  return {
    id: v.id ?? idCurto(),
    nome: v.nome ?? 'Relatório vivo',
    modeloId: v.modeloId ?? 'semanal',
    inicio: v.inicio ?? '',
    fim: v.fim ?? '',
    livre: v.livre ?? false,
    criadoEm: v.criadoEm ?? '',
    itens: v.itens ?? [],
    entradas: v.entradas ?? [],
    encerradoEm: v.encerradoEm,
  };
}
