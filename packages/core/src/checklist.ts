import { diasUteisEntre } from './datas';
import { semAcento } from './leitor/normalizar';

// listas de checagem da supervisora (ex.: implantação por empresa): fases com data, etapas livres,
// uma linha por item, cada etapa feita / não se aplica / travada, e um diário com data de tudo

export interface EtapaLista
{
  id: string;
  nome: string;
}

export interface FaseLista
{
  id: string;
  nome: string;
  // data prevista da fase
  data?: string | undefined;
}

export type EstadoEtapa = 'feito' | 'nao_se_aplica' | 'travado';

export interface MarcaEtapa
{
  estado: EstadoEtapa;
  em: string;
  motivo?: string | undefined;
}

export interface ItemLista
{
  id: string;
  nome: string;
  // etiqueta livre: "Só escritório", "Risco baixo", "Complexo"
  marcador?: string | undefined;
  faseId?: string | undefined;
  cnpjs?: number | undefined;
  responsavel?: string | undefined;
  marcas: Record<string, MarcaEtapa>;
  // observação fixa do item; o dia a dia vai no diário
  notas: string;
  atualizadoEm: string;
  // formato antigo, só para converter
  feitas?: Record<string, string> | undefined;
}

export interface RegistroDiario
{
  id: string;
  // data e hora (ISO)
  quando: string;
  itemId?: string | undefined;
  etapaId?: string | undefined;
  tipo: 'nota' | 'feito' | 'nao_se_aplica' | 'travado' | 'desfeito' | 'moveu';
  texto: string;
}

export interface Lista
{
  id: string;
  nome: string;
  descricao: string;
  etapas: EtapaLista[];
  fases: FaseLista[];
  itens: ItemLista[];
  diario: RegistroDiario[];
  criadaEm: string;
}

export const modelosDeLista: { nome: string; descricao: string; etapas: string[]; fases?: string[] }[] = [
  {
    nome: 'Teste de agendamentos',
    descricao: 'Empresa por empresa: conferir agendamentos, baixar a planilha, subir no sistema e organizar nas abas.',
    etapas: ['Verificar se há agendamentos', 'Baixar a planilha', 'Subir no sistema da empresa', 'Organizar cada um na sua aba'],
  },
  {
    nome: 'Implantação',
    descricao: 'Implantação de empresas por fase: do cadastro do cliente aos acessos.',
    etapas: ['Cliente', 'Contrato', 'Amb./Riscos', 'Ex. amb.', 'BD', 'Treinam.', 'Exames', 'Acessos', 'PPNet'],
    fases: ['Fase 1', 'Fase 2', 'Fase 3'],
  },
];

export const idCurto = () => Math.random().toString(36).slice(2, 10);
// hora local sem fuso (2026-11-13T17:44:00): em UTC, o que é feito depois das 21h cairia no dia seguinte
export function agoraLocal(): string
{
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}
const agora = agoraLocal;

export function novaLista(nome: string, etapas: string[], descricao = '', hoje = agora().slice(0, 10), fases: string[] = []): Lista
{
  return {
    id: idCurto(),
    nome,
    descricao,
    etapas: etapas.map((e) => e.trim()).filter(Boolean).map((n) => ({ id: idCurto(), nome: n })),
    fases: fases.map((n) => ({ id: idCurto(), nome: n })),
    itens: [],
    diario: [],
    criadaEm: hoje,
  };
}

// listas salvas antes das fases e do diário: "feitas" vira marca "feito"
export function migrarLista(l: Lista): Lista
{
  return {
    ...l,
    fases: l.fases ?? [],
    diario: l.diario ?? [],
    itens: l.itens.map(({ feitas, ...i }) => ({
      ...i,
      marcas: i.marcas ?? Object.fromEntries(Object.entries(feitas ?? {}).map(([etapa, em]) => [etapa, { estado: 'feito' as const, em }])),
    })),
  };
}

export type SituacaoItem = 'nao_iniciado' | 'em_andamento' | 'travado' | 'concluido';

// "não se aplica" sai da conta: 7 de 8 aplicáveis é mais honesto que 7 de 9
export function situacaoDoItem(lista: Lista, item: ItemLista): { feitas: number; total: number; travadas: number; situacao: SituacaoItem }
{
  const marcas = lista.etapas.map((e) => item.marcas[e.id]?.estado);
  const total = marcas.filter((m) => m !== 'nao_se_aplica').length;
  const feitas = marcas.filter((m) => m === 'feito').length;
  const travadas = marcas.filter((m) => m === 'travado').length;
  const situacao: SituacaoItem = total > 0 && feitas === total ? 'concluido' : travadas ? 'travado' : feitas ? 'em_andamento' : 'nao_iniciado';
  return { feitas, total, travadas, situacao };
}

export interface Progresso
{
  total: number;
  concluidos: number;
  emAndamento: number;
  travados: number;
  naoIniciados: number;
  cnpjs: number;
  cnpjsConcluidos: number;
  pct: number;
}

export function progressoDosItens(lista: Lista, itens: ItemLista[]): Progresso
{
  const s = itens.map((i) => situacaoDoItem(lista, i).situacao);
  const concluidos = s.filter((x) => x === 'concluido').length;
  return {
    total: itens.length,
    concluidos,
    emAndamento: s.filter((x) => x === 'em_andamento').length,
    travados: s.filter((x) => x === 'travado').length,
    naoIniciados: s.filter((x) => x === 'nao_iniciado').length,
    cnpjs: itens.reduce((t, i) => t + (i.cnpjs ?? 0), 0),
    cnpjsConcluidos: itens.filter((_, k) => s[k] === 'concluido').reduce((t, i) => t + (i.cnpjs ?? 0), 0),
    pct: itens.length ? Math.round((concluidos / itens.length) * 100) : 0,
  };
}

export const progressoDaLista = (lista: Lista) => progressoDosItens(lista, lista.itens);
export const itensDaFase = (lista: Lista, faseId: string | undefined) => lista.itens.filter((i) => (i.faseId ?? undefined) === faseId);

export type SituacaoFase = 'concluida' | 'em_execucao' | 'prevista' | 'atrasada';

export function situacaoDaFase(lista: Lista, fase: FaseLista, hoje: string): SituacaoFase
{
  const p = progressoDosItens(lista, itensDaFase(lista, fase.id));
  if (p.total && p.concluidos === p.total) return 'concluida';
  if (fase.data && fase.data < hoje) return 'atrasada';
  if (p.concluidos || p.emAndamento || p.travados || (fase.data && fase.data === hoje)) return 'em_execucao';
  return 'prevista';
}

// pendências por etapa: quantos itens ainda faltam em cada uma (só os que se aplicam)
export function pendenciasPorEtapa(lista: Lista, itens = lista.itens): { etapa: EtapaLista; pendentes: ItemLista[]; travados: ItemLista[] }[]
{
  return lista.etapas.map((etapa) => ({
    etapa,
    pendentes: itens.filter((i) => !i.marcas[etapa.id]),
    travados: itens.filter((i) => i.marcas[etapa.id]?.estado === 'travado'),
  }));
}

// marca, troca ou limpa a situação de uma etapa e registra no diário
export function marcarEtapa(lista: Lista, item: ItemLista, etapaId: string, estado: EstadoEtapa | undefined, texto = '', quando = agora()): RegistroDiario
{
  if (estado) item.marcas[etapaId] = { estado, em: quando.slice(0, 10), motivo: estado === 'travado' ? texto || undefined : undefined };
  else delete item.marcas[etapaId];
  item.atualizadoEm = quando.slice(0, 10);
  const registro: RegistroDiario = { id: idCurto(), quando, itemId: item.id, etapaId, tipo: estado ?? 'desfeito', texto };
  lista.diario.push(registro);
  return registro;
}

export function anotar(lista: Lista, texto: string, itemId?: string, etapaId?: string, quando = agora()): RegistroDiario
{
  const registro: RegistroDiario = { id: idCurto(), quando, itemId, etapaId, tipo: 'nota', texto };
  lista.diario.push(registro);
  return registro;
}

export function moverParaFase(lista: Lista, itens: ItemLista[], faseId: string | undefined, quando = agora())
{
  const fase = lista.fases.find((f) => f.id === faseId)?.nome ?? 'sem fase';
  for (const item of itens)
  {
    if (item.faseId === faseId) continue;
    item.faseId = faseId;
    item.atualizadoEm = quando.slice(0, 10);
    lista.diario.push({ id: idCurto(), quando, itemId: item.id, tipo: 'moveu', texto: `para ${fase}` });
  }
}

export interface LinhaDiario extends RegistroDiario
{
  lista: string;
  item?: string | undefined;
  etapa?: string | undefined;
}

// o diário de todas as listas num período (datas ISO, inclusivas), do mais novo para o mais antigo
export function diarioDoPeriodo(listas: Lista[], inicio: string, fim: string): LinhaDiario[]
{
  return listas
    .flatMap((l) => l.diario
      .filter((r) => r.quando.slice(0, 10) >= inicio && r.quando.slice(0, 10) <= fim)
      .map((r) => ({ ...r, lista: l.nome, item: l.itens.find((i) => i.id === r.itemId)?.nome, etapa: l.etapas.find((e) => e.id === r.etapaId)?.nome })))
    .sort((a, b) => b.quando.localeCompare(a.quando));
}

const verbo: Record<RegistroDiario['tipo'], string> = { nota: 'anotou', feito: 'feito', nao_se_aplica: 'não se aplica', travado: 'travado', desfeito: 'desmarcado', moveu: 'moveu' };

// "KIARGOS / BD: feito - planilha subiu"; "KIARGOS: moveu para Fase 2"; "KIARGOS: ligar amanhã"
export function textoDaLinha(r: LinhaDiario): string
{
  const onde = [r.item, r.etapa].filter(Boolean).join(' / ');
  const corpo = r.tipo === 'nota' ? r.texto : r.tipo === 'moveu' ? `moveu ${r.texto}` : `${verbo[r.tipo]}${r.texto ? ` - ${r.texto}` : ''}`;
  return onde ? `${onde}: ${corpo}` : corpo;
}

// mensagem curta do dia para o Teams, a partir do diário
export function mensagemDoDia(listas: Lista[], dia: string): string
{
  const linhas: string[] = [`Implantação e checagens - ${dia.slice(8, 10)}/${dia.slice(5, 7)}`];
  for (const l of listas)
  {
    const p = progressoDaLista(l);
    const doDia = diarioDoPeriodo([l], dia, dia);
    linhas.push('', `${l.nome}: ${p.concluidos}/${p.total} concluídos (${p.pct}%)${p.travados ? `, ${p.travados} ${p.travados === 1 ? 'travado' : 'travados'}` : ''}`);
    const feitos = doDia.filter((r) => r.tipo === 'feito').length;
    if (feitos) linhas.push(`- ${feitos} ${feitos === 1 ? 'etapa concluída' : 'etapas concluídas'} hoje`);
    for (const r of doDia.filter((x) => x.tipo === 'travado' || x.tipo === 'nota' || (x.tipo === 'feito' && x.texto)).reverse()) linhas.push(`- ${textoDaLinha(r)}`);
  }
  return linhas.join('\n');
}

export interface AvisoFase
{
  lista: string;
  fase: string;
  data: string;
  pendentes: number;
  nivel: 'alto' | 'medio';
}

// fase que chegou na data (alto) ou chega em até 2 dias úteis (médio) com itens não concluídos
export function avisosDeFase(listas: Lista[], hoje: string, feriados: string[] = []): AvisoFase[]
{
  const avisos: AvisoFase[] = [];
  for (const l of listas)
  {
    for (const f of l.fases.filter((x) => x.data))
    {
      const p = progressoDosItens(l, itensDaFase(l, f.id));
      const pendentes = p.total - p.concluidos;
      if (!pendentes) continue;
      if (f.data! <= hoje) avisos.push({ lista: l.nome, fase: f.nome, data: f.data!, pendentes, nivel: 'alto' });
      else if (diasUteisEntre(hoje, f.data!, feriados) <= 2) avisos.push({ lista: l.nome, fase: f.nome, data: f.data!, pendentes, nivel: 'medio' });
    }
  }
  return avisos;
}

// etiquetas que aparecem embaixo do nome, no painel e nos prints
const RE_MARCADOR = /^(s[oó] escrit[oó]rio|risco (?:baixo|m[eé]dio|alto)|complexo)$/i;

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// texto colado (um nome por linha, ou nome [tab] etiqueta) ou o texto lido de um print
export function itensDoTexto(texto: string, jaExistem: string[] = [], hoje = agora().slice(0, 10)): ItemLista[]
{
  const vistos = new Set(jaExistem.map((n) => n.trim().toLowerCase()));
  const itens: ItemLista[] = [];
  // linha ilegível do print: a etiqueta logo abaixo dela não pode ir para o item anterior
  let anteriorDescartada = false;
  for (const bruta of texto.split(/\r?\n/))
  {
    const [primeira, segunda] = bruta.split('\t').map((c) => c.trim());
    if (!primeira) continue;
    // linha de caixas lidas como números ("Gusta) ' 8 3 8 9 8"): não dá para saber o nome
    if ((primeira.match(/(?:^|\s)\d(?=\s|$)/g) ?? []).length >= 3)
    {
      anteriorDescartada = true;
      continue;
    }
    // print: tira aspas e letra solta do começo, número da linha, as caixas ("[| [>|"), contadores e o "Em andamento 4/9 etapas"
    const nome = primeira
      .replace(/^["'”“\s]+/, '')
      .replace(/^(\d+|\p{Ll})[\s.)-]+(?=\S)/u, '')
      .replace(/\s+\d*\s*[[(|>].*$/, '')
      .replace(/(\s+-)+(\s|$).*$/, '')
      .replace(/\s+(\d+\s*)?(em andamento.*|\d+\/\d+ etapas.*)?$/i, '')
      .replace(/\s+\d+$/, '')
      .trim();
    if (!nome || /^\d+$/.test(nome)) continue;
    if (RE_MARCADOR.test(nome))
    {
      const anterior = itens.at(-1);
      if (anterior && !anterior.marcador && !anteriorDescartada) anterior.marcador = capitalizar(nome);
      anteriorDescartada = false;
      continue;
    }
    anteriorDescartada = false;
    if (vistos.has(nome.toLowerCase())) continue;
    vistos.add(nome.toLowerCase());
    itens.push({ id: idCurto(), nome, marcador: segunda || undefined, marcas: {}, notas: '', atualizadoEm: hoje });
  }
  return itens;
}

// ---------- planilha (Excel colado, CSV ou .xlsx já lido em linhas) ----------

export type CampoPlanilha = 'nome' | 'cnpjs' | 'fase' | 'marcador' | 'responsavel' | 'notas' | 'ignorar' | { etapa: string };

const camposConhecidos: [RegExp, CampoPlanilha][] = [
  [/^(empresa|nome|cliente final|razao social|item)$/, 'nome'],
  [/^(cnpjs?|qtd cnpjs?|quantidade de cnpjs?)$/, 'cnpjs'],
  [/^(fase|onda|grupo)$/, 'fase'],
  [/^(etiqueta|marcador|tipo|perfil|risco)$/, 'marcador'],
  [/^(responsavel|quem)$/, 'responsavel'],
  [/^(anotac(ao|oes)|notas?|observac(ao|oes)|obs)$/, 'notas'],
  [/^(#|n|nº|no|status|situacao|progresso|etapas)$/, 'ignorar'],
];

const chave = (s: string) => semAcento(s).replace(/[^a-z0-9#º ]/g, ' ').replace(/\s+/g, ' ').trim();

// texto colado do Excel vem separado por tabulação; CSV do Excel brasileiro, por ponto e vírgula
export function linhasDoTexto(texto: string): string[][]
{
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = linhas[0]?.includes('\t') ? '\t' : (linhas[0]?.split(';').length ?? 0) > (linhas[0]?.split(',').length ?? 0) ? ';' : ',';
  return linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}

// cada coluna do cabeçalho vira um campo; o que não é campo conhecido vira etapa (existente ou nova)
export function mapearCabecalho(cabecalho: string[], lista: Lista): CampoPlanilha[]
{
  return cabecalho.map((titulo) =>
  {
    const k = chave(titulo);
    if (!k) return 'ignorar';
    const conhecido = camposConhecidos.find(([re]) => re.test(k))?.[1];
    if (conhecido) return conhecido;
    const etapa = lista.etapas.find((e) => chave(e.nome) === k);
    return { etapa: etapa?.nome ?? titulo.trim() };
  });
}

export function estadoDaCelula(valor: string): { estado: EstadoEtapa; motivo?: string } | undefined
{
  const v = chave(valor);
  if (!v || /^(nao|n|0|false|pendente|falta|nao iniciado)$/.test(v)) return undefined;
  if (/^(n a|na|nao se aplica|nsa|nao aplica)$/.test(v)) return { estado: 'nao_se_aplica' };
  if (/^(travad[oa]|bloquead[oa]|impedid[oa])/.test(v)) return { estado: 'travado', motivo: valor.replace(/^\s*\S+\s*[:-]?\s*/, '') || undefined };
  return { estado: 'feito' };
}

export interface PreviaImportacao
{
  campos: CampoPlanilha[];
  etapasNovas: string[];
  fasesNovas: string[];
  novos: number;
  atualizados: number;
  ignoradas: number;
}

// lê a planilha sem mexer na lista, para mostrar o que vai acontecer
export function previaDaPlanilha(linhas: string[][], lista: Lista): PreviaImportacao
{
  const [cabecalho = [], ...dados] = linhas;
  const campos = mapearCabecalho(cabecalho, lista);
  const iNome = campos.indexOf('nome');
  const iFase = campos.indexOf('fase');
  const existentes = new Set(lista.itens.map((i) => chave(i.nome)));
  const nomes = dados.map((l) => l[iNome < 0 ? 0 : iNome]?.trim() ?? '').filter(Boolean);
  const fases = new Set(lista.fases.map((f) => chave(f.nome)));
  return {
    campos,
    etapasNovas: campos.filter((c): c is { etapa: string } => typeof c === 'object' && !lista.etapas.some((e) => e.nome === c.etapa)).map((c) => c.etapa),
    fasesNovas: iFase < 0 ? [] : [...new Set(dados.map((l) => l[iFase]?.trim() ?? '').filter((f) => f && !fases.has(chave(f))))],
    novos: nomes.filter((n) => !existentes.has(chave(n))).length,
    atualizados: nomes.filter((n) => existentes.has(chave(n))).length,
    ignoradas: dados.length - nomes.length,
  };
}

// aplica a planilha: cria etapas e fases que faltam, cria ou atualiza itens pelo nome e registra no diário
export function importarPlanilha(linhas: string[][], lista: Lista, quando = agora()): PreviaImportacao
{
  const previa = previaDaPlanilha(linhas, lista);
  for (const nome of previa.etapasNovas) lista.etapas.push({ id: idCurto(), nome });
  for (const nome of previa.fasesNovas) lista.fases.push({ id: idCurto(), nome });
  const etapaPorNome = new Map(lista.etapas.map((e) => [e.nome, e.id]));
  const fasePorChave = new Map(lista.fases.map((f) => [chave(f.nome), f.id]));
  const iNome = Math.max(0, previa.campos.indexOf('nome'));
  for (const linha of linhas.slice(1))
  {
    const nome = linha[iNome]?.trim();
    if (!nome) continue;
    let item = lista.itens.find((i) => chave(i.nome) === chave(nome));
    if (!item)
    {
      item = { id: idCurto(), nome, marcas: {}, notas: '', atualizadoEm: quando.slice(0, 10) };
      lista.itens.push(item);
    }
    previa.campos.forEach((campo, k) =>
    {
      const valor = linha[k]?.trim() ?? '';
      if (campo === 'cnpjs' && valor) item!.cnpjs = Number(valor.replace(',', '.')) || undefined;
      else if (campo === 'fase' && valor) item!.faseId = fasePorChave.get(chave(valor));
      else if (campo === 'marcador' && valor) item!.marcador = valor;
      else if (campo === 'responsavel' && valor) item!.responsavel = valor;
      else if (campo === 'notas' && valor) item!.notas = valor;
      else if (typeof campo === 'object')
      {
        const etapaId = etapaPorNome.get(campo.etapa)!;
        const e = estadoDaCelula(valor);
        if (e && item!.marcas[etapaId]?.estado !== e.estado) item!.marcas[etapaId] = { estado: e.estado, em: quando.slice(0, 10), motivo: e.motivo };
      }
    });
    item.atualizadoEm = quando.slice(0, 10);
  }
  lista.diario.push({ id: idCurto(), quando, tipo: 'nota', texto: `Planilha importada: ${previa.novos} novos, ${previa.atualizados} atualizados.` });
  return previa;
}

const nomeEstado: Record<EstadoEtapa, string> = { feito: 'Feito', nao_se_aplica: 'Não se aplica', travado: 'Travado' };
const nomeSituacao: Record<SituacaoItem, string> = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', travado: 'Travado', concluido: 'Concluído' };

// CSV com ";" e BOM: abre direto no Excel em português, com acentos
export function listaParaCsv(lista: Lista): string
{
  const celula = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecalho = ['Fase', 'Empresa', 'Etiqueta', 'CNPJs', 'Responsável', ...lista.etapas.map((e) => e.nome), 'Situação', 'Anotações'];
  const linhas = lista.itens.map((i) =>
  {
    const s = situacaoDoItem(lista, i);
    return [
      lista.fases.find((f) => f.id === i.faseId)?.nome ?? '', i.nome, i.marcador ?? '', i.cnpjs ?? '', i.responsavel ?? '',
      ...lista.etapas.map((e) => { const m = i.marcas[e.id]; return m ? `${nomeEstado[m.estado]}${m.motivo ? `: ${m.motivo}` : ''}` : ''; }),
      `${nomeSituacao[s.situacao]} (${s.feitas}/${s.total})`, i.notas,
    ];
  });
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

export { nomeSituacao, nomeEstado };
