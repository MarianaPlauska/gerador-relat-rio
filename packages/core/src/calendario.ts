import type { Ata } from './ata';
import { segundaDaSemana, somarDias } from './datas';
import type { CardSnapshot, Onda, Pessoa, PlanoSemana, Risco, Snapshot } from './tipos';

export type TipoEventoCalendario = 'vencimento' | 'previsao' | 'inicio' | 'onda' | 'plano' | 'combinado' | 'risco' | 'ausencia' | 'reuniao' | 'marca';

export const tiposEventoCalendario: { id: TipoEventoCalendario; nome: string }[] = [
  { id: 'vencimento', nome: 'Vencimento' },
  { id: 'previsao', nome: 'Previsão' },
  { id: 'inicio', nome: 'Início' },
  { id: 'onda', nome: 'Onda' },
  { id: 'plano', nome: 'Plano' },
  { id: 'combinado', nome: 'Combinado' },
  { id: 'risco', nome: 'Risco' },
  { id: 'ausencia', nome: 'Ausência' },
  { id: 'reuniao', nome: 'Reunião' },
  { id: 'marca', nome: 'Minha marca' },
];

export interface EventoCalendario
{
  id: string;
  tipo: TipoEventoCalendario;
  titulo: string;
  detalhe?: string | undefined;
  inicio: string;
  fim: string;
  pessoa?: string | undefined;
  concluido: boolean;
  href: string;
}

// marca que a pessoa põe à mão no calendário (um dia ou um período)
export interface MarcaCalendario
{
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  detalhe?: string | undefined;
  feita?: boolean | undefined;
}

export interface GradeMes
{
  anoMes: string;
  inicio: string;
  fim: string;
  semanas: string[][];
}

export interface BarraCalendario
{
  evento: EventoCalendario;
  coluna: number;
  span: number;
  faixa: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}

export interface FontesCalendario
{
  fotos: Pick<Snapshot, 'data' | 'pasta' | 'cards' | 'ondas'>[];
  planos: PlanoSemana[];
  pessoas: Pessoa[];
  atas: Pick<Ata, 'id' | 'titulo' | 'data' | 'combinados'>[];
  riscos: Pick<Risco, 'id' | 'descricao' | 'decisaoNecessaria' | 'prazoDecisao' | 'status'>[];
  marcasCalendario?: MarcaCalendario[] | undefined;
}

function diaIso(valor?: string | undefined): string | undefined
{
  if (!valor) return undefined;
  const d = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const [ano, mes, dia] = d.split('-').map(Number);
  if (!ano || !mes || !dia) return undefined;
  const volta = new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10);
  return volta === d ? d : undefined;
}

const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function pastaDe(foto: { pasta?: string | undefined }): string
{
  const nome = foto.pasta?.trim();
  return nome ? nome.toUpperCase() : 'DEV';
}

function fotosMaisRecentes<T extends { data: string; pasta?: string | undefined }>(fotos: T[]): T[]
{
  const mapa = new Map<string, T>();
  for (const foto of fotos)
  {
    const atual = mapa.get(pastaDe(foto));
    if (!atual || foto.data >= atual.data) mapa.set(pastaDe(foto), foto);
  }
  return [...mapa.values()];
}

function juntar(partes: (string | undefined)[]): string | undefined
{
  const texto = partes.filter((p): p is string => !!p && p.trim().length > 0).join(' · ');
  return texto || undefined;
}

function eventosDoCard(pasta: string, card: CardSnapshot): EventoCalendario[]
{
  const venc = diaIso(card.vencimento);
  const prev = diaIso(card.previsao);
  const ini = diaIso(card.inicio) ?? diaIso(card.planejadoPara);
  const pessoa = card.responsaveis.find((r) => r.trim());
  const assunto = (card.titulo ?? card.assunto ?? '').trim();
  const titulo = assunto ? `${card.codigo} · ${assunto}` : card.codigo;
  const feito = card.situacao === 'concluido' || !!diaIso(card.concluidoEm);
  const marcas: { tipo: TipoEventoCalendario; data: string }[] = [];
  if (venc) marcas.push({ tipo: 'vencimento', data: venc });
  if (prev && prev !== venc) marcas.push({ tipo: 'previsao', data: prev });
  if (!venc && !prev && ini) marcas.push({ tipo: 'inicio', data: ini });
  return marcas.map((marca) => ({
    id: `${pasta}|${card.codigo}|${marca.tipo}|${marca.data}`,
    tipo: marca.tipo,
    titulo,
    detalhe: juntar([pasta, pessoa, ini && ini !== marca.data ? `início ${curto(ini)}` : undefined]),
    inicio: marca.data,
    fim: marca.data,
    pessoa,
    concluido: feito,
    href: `/cards?q=${encodeURIComponent(card.codigo)}`,
  }));
}

function eventosDaOnda(pasta: string, onda: Onda, indice: number): EventoCalendario[]
{
  const ini = diaIso(onda.inicio);
  const fim = diaIso(onda.fim);
  const venc = diaIso(onda.proximoVencimento);
  const titulo = onda.nome.trim() || `Onda ${indice + 1}`;
  const detalhe = juntar([
    pasta,
    onda.situacao,
    onda.itens !== undefined ? `${onda.concluidos ?? 0}/${onda.itens}` : undefined,
    venc ? `próximo vencimento ${curto(venc)}` : undefined,
  ]);
  const href = '/painel';
  if (ini && fim && fim >= ini)
  {
    return [{ id: `${pasta}|onda|${indice}|${ini}`, tipo: 'onda', titulo, detalhe, inicio: ini, fim, concluido: false, href }];
  }
  const data = ini && fim ? venc : ini ?? fim ?? venc;
  if (!data) return [];
  return [{ id: `${pasta}|onda|${indice}|${data}`, tipo: 'onda', titulo, detalhe, inicio: data, fim: data, concluido: false, href }];
}

// a última foto de cada pasta vale como o cronograma de agora; o resto entra pelas datas que já estão no plano, nas atas, nos riscos e nas ausências
export function eventosDoCronograma(fontes: FontesCalendario): EventoCalendario[]
{
  const eventos: EventoCalendario[] = [];
  for (const foto of fotosMaisRecentes(fontes.fotos))
  {
    const pasta = pastaDe(foto);
    for (const card of foto.cards) eventos.push(...eventosDoCard(pasta, card));
    foto.ondas?.forEach((onda, indice) => eventos.push(...eventosDaOnda(pasta, onda, indice)));
  }

  const nomePorId = new Map(fontes.pessoas.map((p) => [p.id, p.nome]));
  for (const plano of fontes.planos)
  {
    for (const grupo of plano.pessoas)
    {
      const pessoa = nomePorId.get(grupo.pessoaId);
      for (const item of grupo.itens)
      {
        const ate = diaIso(item.ate);
        if (!ate) continue;
        eventos.push({
          id: `plano|${plano.inicio}|${item.id}`,
          tipo: 'plano',
          titulo: item.descricao,
          detalhe: juntar([pessoa, item.frente]),
          inicio: ate,
          fim: ate,
          pessoa,
          concluido: item.status === 'feito',
          href: '/semana',
        });
      }
    }
  }

  for (const ata of fontes.atas)
  {
    const data = diaIso(ata.data);
    if (data)
    {
      eventos.push({
        id: `ata|${ata.id}`,
        tipo: 'reuniao',
        titulo: ata.titulo,
        detalhe: 'reunião',
        inicio: data,
        fim: data,
        concluido: false,
        href: `/atas?id=${encodeURIComponent(ata.id)}`,
      });
    }
    for (const combinado of ata.combinados)
    {
      const prazo = diaIso(combinado.prazo);
      if (!prazo) continue;
      eventos.push({
        id: `combinado|${ata.id}|${combinado.id}`,
        tipo: 'combinado',
        titulo: combinado.tarefa,
        detalhe: juntar([combinado.responsavel, ata.titulo]),
        inicio: prazo,
        fim: prazo,
        pessoa: combinado.responsavel,
        concluido: combinado.situacao === 'concluido',
        href: `/atas?id=${encodeURIComponent(ata.id)}`,
      });
    }
  }

  for (const risco of fontes.riscos)
  {
    const prazo = diaIso(risco.prazoDecisao);
    if (!prazo) continue;
    eventos.push({
      id: `risco|${risco.id}`,
      tipo: 'risco',
      titulo: risco.decisaoNecessaria?.trim() || risco.descricao,
      detalhe: 'decisão',
      inicio: prazo,
      fim: prazo,
      concluido: risco.status !== 'aberto',
      href: '/semana',
    });
  }

  for (const pessoa of fontes.pessoas)
  {
    for (const ausencia of pessoa.ausencias ?? [])
    {
      const de = diaIso(ausencia.de);
      const ate = diaIso(ausencia.ate);
      if (!de || !ate || ate < de) continue;
      eventos.push({
        id: `ausencia|${pessoa.id}|${de}|${ate}`,
        tipo: 'ausencia',
        titulo: ausencia.motivo?.trim() || 'Ausência',
        detalhe: pessoa.nome,
        inicio: de,
        fim: ate,
        pessoa: pessoa.nome,
        concluido: false,
        href: '/painel',
      });
    }
  }

  for (const marca of fontes.marcasCalendario ?? [])
  {
    const de = diaIso(marca.inicio);
    const ate = diaIso(marca.fim) ?? de;
    if (!de || !ate || ate < de || !marca.titulo.trim()) continue;
    eventos.push({
      id: `marca|${marca.id}`,
      tipo: 'marca',
      titulo: marca.titulo.trim(),
      detalhe: marca.detalhe?.trim() || undefined,
      inicio: de,
      fim: ate,
      concluido: !!marca.feita,
      href: `/calendario?dia=${de}`,
    });
  }

  return eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.tipo.localeCompare(b.tipo) || a.titulo.localeCompare(b.titulo));
}

export function gradeDoMes(anoMes: string): GradeMes
{
  if (!/^\d{4}-\d{2}$/.test(anoMes)) throw new Error('mês inválido');
  const ano = Number(anoMes.slice(0, 4));
  const mes = Number(anoMes.slice(5, 7));
  if (mes < 1 || mes > 12) throw new Error('mês inválido');
  const inicio = `${anoMes}-01`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${anoMes}-${String(ultimo).padStart(2, '0')}`;
  const semanas: string[][] = [];
  for (let cursor = segundaDaSemana(inicio); cursor <= fim; cursor = somarDias(cursor, 7))
  {
    semanas.push([0, 1, 2, 3, 4, 5, 6].map((i) => somarDias(cursor, i)));
  }
  return { anoMes, inicio, fim, semanas };
}

function deslocamento(de: string, ate: string): number
{
  let n = 0;
  for (let d = de; d < ate && n < 8; d = somarDias(d, 1)) n++;
  return n;
}

function cruza(aIni: string, aFim: string, bIni: string, bFim: string): boolean
{
  return aIni <= bFim && bIni <= aFim;
}

// barras só para o que ocupa mais de um dia; o recorte é a semana visível (segunda a domingo)
export function barrasDaSemana(eventos: EventoCalendario[], semana: string[]): BarraCalendario[]
{
  const seg = semana[0];
  const dom = semana[6];
  if (!seg || !dom) return [];
  const candidatas = eventos
    .filter((evento) => evento.fim > evento.inicio && evento.inicio <= dom && evento.fim >= seg)
    .map((evento) =>
    {
      const ini = evento.inicio < seg ? seg : evento.inicio;
      const fim = evento.fim > dom ? dom : evento.fim;
      return { evento, ini, fim, coluna: deslocamento(seg, ini) + 1, span: deslocamento(ini, fim) + 1, faixa: 0 };
    })
    .sort((a, b) => a.coluna - b.coluna || b.span - a.span || a.evento.titulo.localeCompare(b.evento.titulo));

  const faixas: { ini: string; fim: string }[][] = [];
  for (const barra of candidatas)
  {
    let faixa = faixas.findIndex((ocupadas) => ocupadas.every((o) => !cruza(o.ini, o.fim, barra.ini, barra.fim)));
    if (faixa === -1)
    {
      faixa = faixas.length;
      faixas.push([]);
    }
    faixas[faixa]?.push({ ini: barra.ini, fim: barra.fim });
    barra.faixa = faixa;
  }

  return candidatas.map((barra) => ({
    evento: barra.evento,
    coluna: barra.coluna,
    span: barra.span,
    faixa: barra.faixa,
    continuaAntes: barra.evento.inicio < seg,
    continuaDepois: barra.evento.fim > dom,
  }));
}

export function pontosDoDia(eventos: EventoCalendario[], dia: string): EventoCalendario[]
{
  return eventos.filter((evento) => evento.inicio === evento.fim && evento.inicio === dia);
}

export function eventosNoDia(eventos: EventoCalendario[], dia: string): EventoCalendario[]
{
  return eventos.filter((evento) => evento.inicio <= dia && evento.fim >= dia);
}
