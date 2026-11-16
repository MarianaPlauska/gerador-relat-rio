import { agoraLocal, idCurto, type Lista } from './checklist';
import { interpretarAnotacao } from './leitor/anotacao';
import type { PlanoSemana } from './tipos';

export type TipoNo = 'inicio' | 'passo' | 'decisao' | 'fim' | 'nota';

export interface NoFluxo
{
  id: string;
  tipo: TipoNo;
  texto: string;
  // canto de cima à esquerda, como o editor usa
  x: number;
  y: number;
}

export interface LigacaoFluxo
{
  id: string;
  de: string;
  para: string;
  // de uma decisão: sim, não...
  rotulo?: string | undefined;
  // bolinha de saída do nó de origem: 'baixo' (padrão) ou 'lado'
  saida?: 'baixo' | 'lado' | undefined;
}

export interface Fluxograma
{
  id: string;
  nome: string;
  descricao: string;
  nos: NoFluxo[];
  ligacoes: LigacaoFluxo[];
  criadoEm: string;
  atualizadoEm: string;
}

export const nomesTipoNo: Record<TipoNo, string> = {
  inicio: 'Início',
  passo: 'Passo',
  decisao: 'Decisão',
  fim: 'Fim',
  nota: 'Nota',
};

// o editor e o pdf desenham os nós com estas medidas
export function tamanhoDoNo(tipo: TipoNo): { largura: number; altura: number }
{
  if (tipo === 'inicio' || tipo === 'fim') return { largura: 140, altura: 44 };
  if (tipo === 'decisao') return { largura: 200, altura: 100 };
  return { largura: 180, altura: 64 };
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ehInicio = (s: string) => /^(inicio|comeco|start|begin)\b/.test(normal(s));
const ehFim = (s: string) => /^(fim|final|termino|end|encerra)\b/.test(normal(s));

export function novoFluxograma(nome: string, descricao = '', agora = agoraLocal()): Fluxograma
{
  return { id: idCurto(), nome: nome.trim() || 'Fluxo sem nome', descricao, nos: [], ligacoes: [], criadoEm: agora, atualizadoEm: agora };
}

interface Rascunho
{
  nos: NoFluxo[];
  ligacoes: LigacaoFluxo[];
}

function montador()
{
  const r: Rascunho = { nos: [], ligacoes: [] };
  return {
    r,
    no(tipo: TipoNo, texto: string): string
    {
      const id = `n${r.nos.length + 1}`;
      r.nos.push({ id, tipo, texto: texto.trim(), x: 0, y: 0 });
      return id;
    },
    ligar(de: string, para: string, rotulo?: string)
    {
      if (r.ligacoes.some((l) => l.de === de && l.para === para)) return;
      r.ligacoes.push({ id: `l${r.ligacoes.length + 1}`, de, para, ...(rotulo ? { rotulo } : {}) });
    },
  };
}

const opostos: Record<string, string> = { sim: 'não', nao: 'sim', não: 'sim' };

// passos em texto, um por linha:
//   Receber pedido
//   Se faltar documento? sim: Pedir ao responsável / não: Agendar
//   Nota: texto solto
//   Fim
// ramos que levam a "fim" vão para o fim; "voltar para X" liga a um passo que já existe
export function fluxoDosPassos(texto: string): Rascunho
{
  const m = montador();
  const linhas = texto.split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+\s*[.)-]|[-*•]|passo\s*\d+\s*[:.-]?)\s*/i, '').trim())
    .filter(Boolean);
  let abertos: { de: string; rotulo?: string | undefined }[] = [];
  const referencias: { de: string; alvo: string; rotulo?: string | undefined }[] = [];
  let fim: string | undefined;
  const pegarFim = () => (fim ??= m.no('fim', 'Fim'));
  const fechar = (para: string) =>
  {
    for (const a of abertos) m.ligar(a.de, para, a.rotulo);
    abertos = [];
  };

  if (!linhas.length || !ehInicio(linhas[0]!)) abertos = [{ de: m.no('inicio', 'Início') }];
  for (const linha of linhas)
  {
    const nota = linha.match(/^(?:nota|obs(?:erva[cç][aã]o)?)\s*[:.-]\s*(.+)$/i);
    if (nota)
    {
      m.no('nota', nota[1]!);
      continue;
    }
    if (ehInicio(linha) && linha.length < 20)
    {
      const id = m.no('inicio', linha.replace(/[.:]$/, ''));
      fechar(id);
      abertos = [{ de: id }];
      continue;
    }
    if (ehFim(linha) && linha.length < 20)
    {
      fechar(pegarFim());
      continue;
    }
    const decisao = linha.match(/^(?:se\s+)?([^?]+\?)\s*(.*)$/i);
    if (decisao)
    {
      const pergunta = decisao[1]!.charAt(0).toUpperCase() + decisao[1]!.slice(1);
      const id = m.no('decisao', pergunta);
      fechar(id);
      const ramos = decisao[2]!.split(/\s*[/;|]\s*/).map((r) => r.match(/^([^:>]+?)\s*(?::|->|=>)\s*(.+)$/)).filter((r) => r !== null);
      const usados: string[] = [];
      for (const ramo of ramos)
      {
        const rotulo = ramo[1]!.trim().toLowerCase();
        const alvo = ramo[2]!.trim();
        usados.push(normal(rotulo));
        const volta = alvo.match(/^(?:voltar?|ir|retorna[r]?)\s+(?:para|ao|a|à|pro)\s+(?:o\s+|a\s+|passo\s+)?(.+)$/i);
        if (ehFim(alvo)) m.ligar(id, pegarFim(), rotulo);
        else if (volta) referencias.push({ de: id, alvo: volta[1]!, rotulo });
        else
        {
          const passo = m.no('passo', alvo);
          m.ligar(id, passo, rotulo);
          abertos.push({ de: passo });
        }
      }
      // ramo não escrito segue para a próxima linha
      if (!abertos.length)
      {
        const outro = usados.length === 1 ? opostos[usados[0]!] : ramos.length ? undefined : 'sim';
        abertos.push({ de: id, rotulo: outro });
      }
      continue;
    }
    const id = m.no('passo', linha);
    fechar(id);
    abertos = [{ de: id }];
  }
  if (abertos.length) fechar(pegarFim());

  for (const ref of referencias)
  {
    const alvo = normal(ref.alvo.replace(/[.]$/, ''));
    const no = m.r.nos.find((n) => normal(n.texto) === alvo) ?? m.r.nos.find((n) => n.tipo !== 'nota' && normal(n.texto).includes(alvo));
    m.ligar(ref.de, no ? no.id : m.no('passo', ref.alvo), ref.rotulo);
  }
  return m.r;
}

const formas: [RegExp, TipoNo | 'redondo'][] = [
  [/^\(\[(.*)\]\)$/s, 'redondo'],
  [/^\(\((.*)\)\)$/s, 'redondo'],
  [/^\{\{(.*)\}\}$/s, 'decisao'],
  [/^\{(.*)\}$/s, 'decisao'],
  [/^\[\[(.*)\]\]$/s, 'passo'],
  [/^\[\((.*)\)\]$/s, 'passo'],
  [/^>(.*)\]$/s, 'nota'],
  [/^\[(.*)\]$/s, 'passo'],
  [/^\((.*)\)$/s, 'redondo'],
];

function textoMermaid(s: string): string
{
  return s.trim().replace(/^"(.*)"$/s, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/#quot;/g, '"').replace(/\s+/g, ' ').trim();
}

// flowchart do Mermaid, o formato que as IAs gratuitas já sabem escrever
export function fluxoDoMermaid(texto: string): Rascunho
{
  const m = montador();
  const ids = new Map<string, string>();
  const definidos = new Map<string, { forma: TipoNo | 'redondo'; texto: string }>();
  const arestas: { de: string; para: string; rotulo?: string | undefined }[] = [];
  const ordem: string[] = [];
  const ver = (id: string) =>
  {
    if (!ordem.includes(id)) ordem.push(id);
  };
  const forma = /([\p{L}\p{N}_]+)\s*(\(\[[^\]]*\]\)|\(\([^)]*\)\)|\{\{[^}]*\}\}|\[\[[^\]]*\]\]|\[\([^)]*\)\]|\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|>[^\]]*\])/gu;
  const seta = /^\s*(?:--\s*([^->][^>]*?)\s*-->|(?:-->|==>|-\.->|---|===|-\.-)\s*(?:\|([^|]*)\|)?)\s*/;

  for (const bruta of texto.split(/\r?\n|;/))
  {
    const linha = bruta.replace(/%%.*$/, '').trim();
    if (!linha || /^(flowchart|graph|subgraph|end\b|classDef|class\s|style\s|linkStyle|click\s|direction\s)/i.test(linha)) continue;
    const semFormas = linha.replace(forma, (_, id: string, f: string) =>
    {
      for (const [re, tipo] of formas)
      {
        const achou = f.match(re);
        if (achou)
        {
          definidos.set(id, { forma: tipo, texto: textoMermaid(achou[1]!) });
          break;
        }
      }
      return id;
    });
    let resto = semFormas.trim();
    let anterior: string | undefined;
    let rotulo: string | undefined;
    while (resto)
    {
      const id = resto.match(/^([\p{L}\p{N}_]+)(?::::\w+)?/u);
      if (!id) break;
      ver(id[1]!);
      if (anterior) arestas.push({ de: anterior, para: id[1]!, rotulo });
      anterior = id[1]!;
      resto = resto.slice(id[0].length);
      const s = resto.match(seta);
      if (!s) break;
      rotulo = textoMermaid(s[1] ?? s[2] ?? '') || undefined;
      resto = resto.slice(s[0].length);
    }
  }

  const entram = new Set(arestas.map((a) => a.para));
  for (const id of ordem)
  {
    const d = definidos.get(id);
    const t = d?.texto || id;
    let tipo: TipoNo = d && d.forma !== 'redondo' ? d.forma : 'passo';
    if (ehInicio(t) && tipo === 'passo') tipo = 'inicio';
    else if (ehFim(t) && tipo === 'passo') tipo = 'fim';
    else if (d?.forma === 'redondo') tipo = entram.has(id) ? 'fim' : 'inicio';
    ids.set(id, m.no(tipo, t));
  }
  for (const a of arestas) m.ligar(ids.get(a.de)!, ids.get(a.para)!, a.rotulo?.toLowerCase());
  return m.r;
}

export const pareceMermaid = (texto: string) => /^\s*(?:```\w*\s*)?(flowchart|graph)\b/i.test(texto) || /[\p{L}\p{N}_]+\s*(?:\[|\{|\().*?(?:-->|---)/u.test(texto);

// o que vier colado: Mermaid (de uma IA) ou passos em texto
export function lerFluxo(texto: string): { nos: NoFluxo[]; ligacoes: LigacaoFluxo[]; formato: 'mermaid' | 'passos' }
{
  const limpo = texto.replace(/```\w*/g, '').trim();
  const formato = pareceMermaid(limpo) ? 'mermaid' : 'passos';
  const r = formato === 'mermaid' ? fluxoDoMermaid(limpo) : fluxoDosPassos(prepararTextoLivre(limpo));
  return { ...organizar(r.nos, r.ligacoes), formato };
}

// camadas de cima para baixo: cada nó fica abaixo de todos que levam a ele (sem contar as voltas);
// na camada, a ordem segue a média das posições de quem chega, para cruzar menos linhas
export function organizar(nos: NoFluxo[], ligacoes: LigacaoFluxo[]): { nos: NoFluxo[]; ligacoes: LigacaoFluxo[] }
{
  const ativos = nos.filter((n) => n.tipo !== 'nota' || ligacoes.some((l) => l.de === n.id || l.para === n.id));
  const soltos = nos.filter((n) => !ativos.includes(n));
  const saidas = new Map(ativos.map((n) => [n.id, ligacoes.filter((l) => l.de === n.id).map((l) => l.para)]));
  const chegam = new Set(ligacoes.map((l) => l.para));

  // voltas: ligações para um nó que ainda está no caminho da busca
  const voltas = new Set<string>();
  const estado = new Map<string, 'aberto' | 'feito'>();
  const visitar = (id: string) =>
  {
    estado.set(id, 'aberto');
    for (const l of ligacoes.filter((x) => x.de === id))
    {
      const e = estado.get(l.para);
      if (e === 'aberto') voltas.add(l.id);
      else if (!e && saidas.has(l.para)) visitar(l.para);
    }
    estado.set(id, 'feito');
  };
  const raizes = [...ativos.filter((n) => n.tipo === 'inicio'), ...ativos.filter((n) => n.tipo !== 'inicio' && !chegam.has(n.id)), ...ativos];
  for (const n of raizes) if (!estado.has(n.id)) visitar(n.id);

  const frente = ligacoes.filter((l) => !voltas.has(l.id) && saidas.has(l.de) && saidas.has(l.para) && l.de !== l.para);
  const camada = new Map(ativos.map((n) => [n.id, 0]));
  // caminho mais longo; o número de nós limita as voltas do laço
  for (let i = 0; i < ativos.length; i++)
  {
    let mudou = false;
    for (const l of frente)
    {
      const c = camada.get(l.de)! + 1;
      if (c > camada.get(l.para)!)
      {
        camada.set(l.para, c);
        mudou = true;
      }
    }
    if (!mudou) break;
  }
  // o fim fica sempre na última camada
  const ultima = Math.max(0, ...camada.values());
  for (const n of ativos) if (n.tipo === 'fim' && !saidas.get(n.id)!.length) camada.set(n.id, ultima);

  const camadas: string[][] = [];
  for (const n of ativos) (camadas[camada.get(n.id)!] ??= []).push(n.id);
  const posicao = new Map<string, number>();
  const marcar = () => camadas.forEach((c) => c?.forEach((id, i) => posicao.set(id, i - (c.length - 1) / 2)));
  marcar();
  for (let volta = 0; volta < 3; volta++)
  {
    for (const c of camadas)
    {
      if (!c) continue;
      const media = (id: string) =>
      {
        const de = frente.filter((l) => l.para === id).map((l) => posicao.get(l.de)!);
        return de.length ? de.reduce((a, b) => a + b, 0) / de.length : posicao.get(id)!;
      };
      c.sort((a, b) => media(a) - media(b));
    }
    marcar();
  }

  const porId = new Map(ativos.map((n) => [n.id, n]));
  const ESPACO_X = 240;
  const ESPACO_Y = 50;
  const novos = new Map<string, NoFluxo>();
  let y = 0;
  let maxX = 0;
  for (const c of camadas)
  {
    if (!c) continue;
    const alturas = c.map((id) => tamanhoDoNo(porId.get(id)!.tipo).altura);
    const alta = Math.max(...alturas);
    c.forEach((id, i) =>
    {
      const n = porId.get(id)!;
      const t = tamanhoDoNo(n.tipo);
      const centro = (i - (c.length - 1) / 2) * ESPACO_X;
      maxX = Math.max(maxX, centro + t.largura / 2);
      novos.set(id, { ...n, x: Math.round(centro - t.largura / 2), y: Math.round(y + (alta - t.altura) / 2) });
    });
    y += alta + ESPACO_Y;
  }
  let yNota = 0;
  for (const n of soltos)
  {
    novos.set(n.id, { ...n, x: Math.round(maxX + 80), y: yNota });
    yNota += tamanhoDoNo('nota').altura + 20;
  }
  // a ligação que sai de uma decisão para um nó ao lado usa a bolinha do lado
  const ligacoesNovas = ligacoes.map((l) =>
  {
    const de = novos.get(l.de);
    const para = novos.get(l.para);
    const centro = (n: NoFluxo) => n.x + tamanhoDoNo(n.tipo).largura / 2;
    const lado = de?.tipo === 'decisao' && para && camada.get(l.para) === camada.get(l.de)! + 1 && centro(para) > centro(de) + 20;
    const { saida: _, ...resto } = l;
    return lado ? { ...resto, saida: 'lado' as const } : resto;
  });
  return { nos: nos.map((n) => novos.get(n.id) ?? n), ligacoes: ligacoesNovas };
}

const aspas = (s: string) => `"${s.replace(/"/g, "'")}"`;

export function paraMermaid(f: Pick<Fluxograma, 'nos' | 'ligacoes'>): string
{
  const forma = (n: NoFluxo) =>
  {
    const t = aspas(n.texto || nomesTipoNo[n.tipo]);
    if (n.tipo === 'inicio' || n.tipo === 'fim') return `([${t}])`;
    if (n.tipo === 'decisao') return `{${t}}`;
    if (n.tipo === 'nota') return `>${t}]`;
    return `[${t}]`;
  };
  return [
    'flowchart TD',
    ...f.nos.map((n) => `  ${n.id}${forma(n)}`),
    ...f.ligacoes.map((l) => `  ${l.de} -->${l.rotulo ? `|${aspas(l.rotulo)}|` : ''} ${l.para}`),
  ].join('\n');
}

// texto para colar num chat de IA gratuito; a resposta (Mermaid) volta pela caixa de colar
export function pedidoDeFluxo(descricao: string): string
{
  return [
    'Monte um fluxograma do processo descrito no fim, no formato Mermaid, para eu colar no sistema OrbisOS.',
    'Responda SOMENTE com o código Mermaid, sem explicação antes ou depois.',
    '',
    '## Regras',
    '- Comece com: flowchart TD',
    '- Um começo: inicio(["Início"]) e um fim: fim(["Fim"])',
    '- Passos em retângulo: p1["Texto curto do passo"]',
    '- Decisões em losango, com pergunta: d1{"Documento completo?"}',
    '- Saídas de decisão com rótulo: d1 -->|sim| p2 e d1 -->|não| p3',
    '- Ligações simples: p1 --> p2',
    '- Observações soltas: n1>"Texto da observação"]',
    '- Textos em português, curtos (até 6 palavras), entre aspas',
    '- Sem subgraph, sem style, sem classDef, sem ícones',
    '',
    '## Exemplo',
    'flowchart TD',
    '  inicio(["Início"]) --> p1["Receber pedido do cliente"]',
    '  p1 --> d1{"Documentos completos?"}',
    '  d1 -->|sim| p2["Agendar implantação"]',
    '  d1 -->|não| p3["Pedir documentos ao responsável"]',
    '  p3 --> d1',
    '  p2 --> fim(["Fim"])',
    '',
    '## O processo',
    descricao.trim() || '(descreva aqui o processo)',
  ].join('\n');
}

// as etapas da lista, em ordem, viram passos ligados do início ao fim
export function fluxoDaLista(lista: Lista, agora = agoraLocal()): Fluxograma
{
  const m = montador();
  let anterior = m.no('inicio', 'Início');
  for (const e of lista.etapas)
  {
    const id = m.no('passo', e.nome);
    m.ligar(anterior, id);
    anterior = id;
  }
  m.ligar(anterior, m.no('fim', 'Fim'));
  if (lista.descricao) m.no('nota', lista.descricao);
  return { ...novoFluxograma(lista.nome, `Etapas da lista "${lista.nome}".`, agora), ...organizar(m.r.nos, m.r.ligacoes) };
}

// fluxo salvo com campos que faltam
export function migrarFluxograma(f: Partial<Fluxograma>): Fluxograma
{
  const agora = agoraLocal();
  return { ...novoFluxograma(f.nome ?? '', '', agora), ...f, nos: f.nos ?? [], ligacoes: f.ligacoes ?? [] } as Fluxograma;
}

// texto corrido ("Primeiro faço X, depois Y. Se Z, então W") vira uma lista de passos, um por linha;
// texto que já está em linhas (2 ou mais) é usado como está
export function prepararTextoLivre(texto: string): string
{
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length >= 2 || /\?\s*(sim|n[aã]o)\s*[:>-]/i.test(texto)) return texto;
  const a = interpretarAnotacao(texto);
  const base = a.etapas.length ? a.etapas.map((e) => e.texto) : texto.split(/(?<=[.!?;])\s+/).map((s) => s.trim().replace(/[.;]$/, '')).filter((s) => s.length > 2);
  const lista = a.resumo && a.etapas.length ? [a.resumo.replace(/[.]$/, ''), ...base] : base;
  return lista
    .map((s) =>
    {
      // "Se faltar documento, pedir ao responsável" vira decisão com ramo "sim"
      const cond = s.match(/^se\s+(.+?),\s*(?:ent[aã]o\s+)?(.+)$/i);
      return cond ? `${cond[1]!.replace(/\?$/, '')}? sim: ${cond[2]}` : s;
    })
    .join('\n');
}

// uma semana de plano vira passos: um por item, na ordem do plano, agrupados por pessoa
export function textoDaSemana(plano: PlanoSemana | undefined, nomePessoa: (id: string) => string): string
{
  if (!plano) return '';
  return plano.pessoas
    .flatMap((pp) => pp.itens.map((i) => `${i.cardCodigo ? `${i.cardCodigo} - ` : ''}${i.descricao} (${nomePessoa(pp.pessoaId).split(' ')[0]}${i.ate ? `, até ${i.ate.split('-').reverse().join('/')}` : ''})`))
    .join('\n');
}