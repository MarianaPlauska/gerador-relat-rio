// listas de checagem da supervisora (ex.: teste de agendamentos por empresa): etapas livres, uma linha por item

export interface EtapaLista
{
  id: string;
  nome: string;
}

export interface ItemLista
{
  id: string;
  nome: string;
  // etiqueta livre, como no painel: "Só escritório", "Risco baixo", "Complexo"
  marcador?: string | undefined;
  // etapa feita -> data em que foi marcada
  feitas: Record<string, string>;
  // o que foi feito e por quê
  notas: string;
  atualizadoEm: string;
}

export interface Lista
{
  id: string;
  nome: string;
  descricao: string;
  etapas: EtapaLista[];
  itens: ItemLista[];
  criadaEm: string;
}

export const modelosDeLista: { nome: string; descricao: string; etapas: string[] }[] = [
  {
    nome: 'Teste de agendamentos',
    descricao: 'Empresa por empresa: conferir agendamentos, baixar a planilha, subir no sistema e organizar nas abas.',
    etapas: ['Verificar se há agendamentos', 'Baixar a planilha', 'Subir no sistema da empresa', 'Organizar cada um na sua aba'],
  },
];

export const idCurto = () => Math.random().toString(36).slice(2, 10);

export function novaLista(nome: string, etapas: string[], descricao = '', hoje = new Date().toISOString().slice(0, 10)): Lista
{
  return { id: idCurto(), nome, descricao, etapas: etapas.map((e) => e.trim()).filter(Boolean).map((nomeEtapa) => ({ id: idCurto(), nome: nomeEtapa })), itens: [], criadaEm: hoje };
}

export type SituacaoItem = 'nao_iniciado' | 'em_andamento' | 'concluido';

export function situacaoDoItem(lista: Lista, item: ItemLista): { feitas: number; total: number; situacao: SituacaoItem }
{
  const total = lista.etapas.length;
  const feitas = lista.etapas.filter((e) => item.feitas[e.id]).length;
  return { feitas, total, situacao: !feitas ? 'nao_iniciado' : feitas === total ? 'concluido' : 'em_andamento' };
}

export function progressoDaLista(lista: Lista): { concluidos: number; emAndamento: number; naoIniciados: number; total: number; pct: number }
{
  const s = lista.itens.map((i) => situacaoDoItem(lista, i).situacao);
  const concluidos = s.filter((x) => x === 'concluido').length;
  return {
    concluidos,
    emAndamento: s.filter((x) => x === 'em_andamento').length,
    naoIniciados: s.filter((x) => x === 'nao_iniciado').length,
    total: s.length,
    pct: s.length ? Math.round((concluidos / s.length) * 100) : 0,
  };
}

// etiquetas que aparecem embaixo do nome, no painel e nos prints
const RE_MARCADOR = /^(s[oó] escrit[oó]rio|risco (?:baixo|m[eé]dio|alto)|complexo)$/i;

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// texto colado do Excel (nome [tab] marcador), uma linha por item, ou o texto lido de um print
export function itensDoTexto(texto: string, jaExistem: string[] = [], hoje = new Date().toISOString().slice(0, 10)): ItemLista[]
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
    itens.push({ id: idCurto(), nome, marcador: segunda || undefined, feitas: {}, notas: '', atualizadoEm: hoje });
  }
  return itens;
}
