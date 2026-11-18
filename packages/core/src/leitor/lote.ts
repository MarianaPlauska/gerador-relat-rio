import type { CardSnapshot, EtapaCard, OrigemLeitura, Pessoa } from '../tipos';
import { AVISO_CONTINUACAO, juntarCard } from './cards';
import { enriquecerCard } from './etapas-auto';
import type { ModeloEstimativa } from './estimativa';
import { semAcento } from './normalizar';
import { similaridadeCosseno, similaridadeTextos } from './vetor';

// Correlação de vários prints de uma vez, sem depender da ordem de envio.
// Cada print vira "âncoras" (cards com código) e "fragmentos órfãos" (etapas ou texto do pedido sem código).
// Os fragmentos procuram o card certo entre todas as âncoras do lote, inclusive encadeando um no outro
// (o fragmento que continua o texto ou as etapas de outro fragmento já ligado a um card).

export const CODIGO_ORFAO = '__ORFAO__';
const LIMIAR_VINCULO = 25;

export interface EntradaLote
{
  id: string;
  origem: OrigemLeitura;
  cards: CardSnapshot[];
  cardPaiForcado?: string | undefined;
}

export interface SaidaCapturaLote
{
  cards: CardSnapshot[];
  cardPaiVinculado?: string | undefined;
  confiancaVinculoPct?: number | undefined;
  motivoVinculo?: string | undefined;
  // fragmentos deste print que ainda não acharam o card deles
  pendentes: number;
}

export interface ResultadoLote
{
  porCaptura: Map<string, SaidaCapturaLote>;
  // ids na ordem em que convém mesclar: listas antes, cards abertos (detalhe) por último
  ordemProcessamento: string[];
}

interface Fragmento
{
  capturaId: string;
  indice: number;
  upload: number;
  card: CardSnapshot;
}

interface Perfil
{
  codigo: string;
  base: CardSnapshot;
  texto: string;
  etapas: EtapaCard[];
  responsavel?: string | undefined;
  fragmentos: Fragmento[];
  // posições de envio dos prints que já falam deste card
  uploads: number[];
}

interface Vinculo
{
  codigo: string;
  confianca: number;
  motivos: string[];
}

const semReticencias = (t: string): string => t.replace(/\.{2,}\s*$/, '').trimEnd();

// texto sem acento, minúsculo, espaços e quebras de linha como um espaço só e sem reticências no fim;
// `idx[j]` diz em que posição do original está o caractere j do normalizado (para cortar o original depois)
interface Normal
{
  n: string;
  idx: number[];
}

function normalizar(texto: string): Normal
{
  const origem = semReticencias(texto);
  let n = '';
  const idx: number[] = [];
  let espaco = false;
  for (let i = 0; i < origem.length; i++)
  {
    const ch = origem[i]!;
    if (/\s/.test(ch))
    {
      if (n && !espaco)
      {
        n += ' ';
        idx.push(i);
        espaco = true;
      }
      continue;
    }
    espaco = false;
    const base = semAcento(ch).toLowerCase();
    n += base;
    for (let b = 0; b < base.length; b++) idx.push(i);
  }
  return { n: n.trimEnd(), idx };
}

const limpo = (t: string): string => normalizar(t).n;

function sobreposicao(x: Normal, y: Normal): number
{
  const max = Math.min(x.n.length, y.n.length, 400);
  for (let k = max; k >= 15; k--)
  {
    if (x.n.slice(x.n.length - k) === y.n.slice(0, k)) return k;
  }
  return 0;
}

function normalizarPessoa(idOuNome: string | undefined, pessoas: Pessoa[]): string | undefined
{
  if (!idOuNome) return undefined;
  const p = pessoas.find((x) => x.id === idOuNome || semAcento(x.nome).toLowerCase() === semAcento(idOuNome).toLowerCase());
  return p ? p.id : semAcento(idOuNome).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// maior trecho final de `a` que também é o começo de `b` (a continuação de um print no outro)
export function sobreposicaoTexto(a: string, b: string): number
{
  return sobreposicao(normalizar(a), normalizar(b));
}

// junta pedaços do pedido do card na ordem em que se continuam, sem repetir o que já está no texto
export function costurarTextos(textos: string[]): string
{
  const restantes = textos.map((t) => t.trim()).filter(Boolean);
  if (!restantes.length) return '';
  let atual = restantes.shift()!;
  while (restantes.length)
  {
    const na = normalizar(atual);
    let melhor = 0;
    let melhorK = -1;
    let depois = true;
    for (const [i, t] of restantes.entries())
    {
      const nt = normalizar(t);
      const kDepois = sobreposicao(na, nt);
      const kAntes = sobreposicao(nt, na);
      if (kDepois >= kAntes && kDepois > melhorK)
      {
        melhor = i;
        melhorK = kDepois;
        depois = true;
      }
      else if (kAntes > kDepois && kAntes > melhorK)
      {
        melhor = i;
        melhorK = kAntes;
        depois = false;
      }
    }
    const t = restantes.splice(melhor, 1)[0]!;
    const nt = normalizar(t);
    if (na.n.includes(nt.n)) continue;
    if (nt.n.includes(na.n))
    {
      atual = t;
      continue;
    }
    const k = Math.max(0, melhorK);
    if (depois) atual = k > 0 ? semReticencias(atual) + t.slice((nt.idx[k - 1] ?? -1) + 1) : `${semReticencias(atual)}\n${t}`;
    else atual = k > 0 ? semReticencias(t) + atual.slice((na.idx[k - 1] ?? -1) + 1) : `${semReticencias(t)}\n${atual}`;
  }
  return atual;
}

// une as etapas de vários prints do mesmo card pela ordem; em caso de repetição fica a que traz mais informação
export function unirEtapas(listas: EtapaCard[][]): EtapaCard[]
{
  const mapa = new Map<number, EtapaCard>();
  const informacao = (e: EtapaCard): number =>
    (e.descricao ? 1 : 0) + (e.pessoa ? 1 : 0) + (e.tempoRodandoHoras !== undefined ? 1 : 0) + (e.desde ? 1 : 0) + (e.origemEtapa === 'manual' ? 3 : 0);
  for (const lista of listas)
  {
    for (const e of lista)
    {
      const atual = mapa.get(e.ordem);
      if (!atual) mapa.set(e.ordem, e);
      else if (informacao(e) > informacao(atual)) mapa.set(e.ordem, { ...atual, ...e });
    }
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem);
}

const textoDe = (c: CardSnapshot): string => c.descricaoCompleta || c.titulo || '';

function novoPerfil(card: CardSnapshot, upload: number, pessoas: Pessoa[]): Perfil
{
  return {
    codigo: card.codigo,
    base: card,
    texto: textoDe(card),
    etapas: card.etapas ?? [],
    responsavel: normalizarPessoa(card.responsavelEtapaAtual ?? card.responsaveis[0], pessoas),
    fragmentos: [],
    uploads: upload >= 0 ? [upload] : [],
  };
}

function incluirAncora(perfil: Perfil, card: CardSnapshot, upload: number, pessoas: Pessoa[]): Perfil
{
  const base = juntarCard(perfil.base, card);
  return {
    ...perfil,
    base,
    texto: costurarTextos([perfil.texto, textoDe(card)]),
    etapas: unirEtapas([perfil.etapas, card.etapas ?? []]),
    responsavel: perfil.responsavel ?? normalizarPessoa(base.responsavelEtapaAtual ?? base.responsaveis[0], pessoas),
    uploads: [...perfil.uploads, upload],
  };
}

function incluirFragmento(perfil: Perfil, frag: Fragmento, pessoas: Pessoa[]): void
{
  perfil.fragmentos.push(frag);
  perfil.uploads.push(frag.upload);
  perfil.texto = costurarTextos([textoDe(perfil.base), ...perfil.fragmentos.map((f) => textoDe(f.card))]);
  perfil.etapas = unirEtapas([perfil.base.etapas ?? [], ...perfil.fragmentos.map((f) => f.card.etapas ?? [])]);
  perfil.responsavel ??= normalizarPessoa(frag.card.responsavelEtapaAtual ?? frag.card.responsaveis[0] ?? frag.card.etapas?.find((e) => e.pessoa)?.pessoa, pessoas);
}

function pontuarFragmento(frag: Fragmento, perfil: Perfil, pessoas: Pessoa[]): Vinculo
{
  const card = frag.card;
  let score = 0;
  const motivos: string[] = [];
  const textoFrag = textoDe(card);

  if (textoFrag && perfil.texto)
  {
    const sim = Math.max(
      similaridadeTextos(perfil.base.titulo ?? '', textoFrag),
      similaridadeTextos(perfil.texto, textoFrag),
      similaridadeCosseno(perfil.texto, textoFrag),
    );
    if (sim >= 0.3)
    {
      score += sim * 75;
      motivos.push(`texto semelhante (${Math.round(sim * 100)}%)`);
    }
    if (Math.max(sobreposicaoTexto(perfil.texto, textoFrag), sobreposicaoTexto(textoFrag, perfil.texto)) >= 15)
    {
      score += 55;
      motivos.push('o texto continua de um print no outro');
    }
  }

  const etapasFrag = card.etapas ?? [];
  if (etapasFrag.length && perfil.etapas.length)
  {
    const mesmaOrdem = etapasFrag.filter((e) => perfil.etapas.some((p) => p.ordem === e.ordem));
    const nomesIguais = mesmaOrdem.filter((e) => perfil.etapas.some((p) => p.ordem === e.ordem && limpo(p.nome) === limpo(e.nome)));
    if (mesmaOrdem.length && nomesIguais.length === mesmaOrdem.length)
    {
      score += 30;
      motivos.push('as mesmas etapas já lidas');
    }
    else if (mesmaOrdem.length)
    {
      score -= 60;
    }
    const minFrag = Math.min(...etapasFrag.map((e) => e.ordem));
    const maxFrag = Math.max(...etapasFrag.map((e) => e.ordem));
    const minPerfil = Math.min(...perfil.etapas.map((e) => e.ordem));
    const maxPerfil = Math.max(...perfil.etapas.map((e) => e.ordem));
    if (minFrag === maxPerfil + 1 || maxFrag + 1 === minPerfil)
    {
      score += 45;
      motivos.push('as etapas seguem a numeração');
    }
  }
  else if (etapasFrag.length && perfil.texto)
  {
    const sim = similaridadeCosseno(etapasFrag.map((e) => e.nome).join(' '), perfil.texto);
    if (sim > 0.05)
    {
      score += Math.min(20, sim * 80);
      motivos.push('as etapas falam do mesmo assunto do pedido');
    }
  }

  const respFrag = normalizarPessoa(card.responsavelEtapaAtual ?? card.responsaveis[0] ?? etapasFrag.find((e) => e.pessoa)?.pessoa, pessoas);
  if (respFrag && perfil.responsavel)
  {
    if (respFrag === perfil.responsavel)
    {
      score += 36;
      motivos.push(`mesmo responsável (${pessoas.find((p) => p.id === respFrag)?.nome ?? respFrag})`);
    }
    else
    {
      score -= 45;
    }
  }

  if (etapasFrag.some((e) => e.situacao === 'rodando'))
  {
    const statusPai = semAcento(perfil.base.statusCard ?? '').toLowerCase();
    if (statusPai === 'em andamento' || perfil.base.situacao === 'em_execucao')
    {
      score += 28;
      motivos.push('Em andamento combina com etapa rodando');
    }
    else if (statusPai === 'resolvido' || perfil.base.situacao === 'concluido')
    {
      score -= 60;
    }
  }

  if (perfil.uploads.some((u) => Math.abs(u - frag.upload) === 1))
  {
    score += 12;
    motivos.push('enviados em sequência');
  }
  return { codigo: perfil.codigo, confianca: score, motivos };
}

const prioridadeOrigem = (origem: OrigemLeitura): number => (origem === 'card' ? 2 : origem === 'demandas' || origem === 'cronograma' ? 0 : 1);

export function correlacionarLote(entradas: EntradaLote[], existentes: CardSnapshot[], pessoas: Pessoa[], modelo?: ModeloEstimativa): ResultadoLote
{
  // 1) âncoras: tudo que já traz código, do que já existia e do lote inteiro
  const perfis = new Map<string, Perfil>();
  for (const c of existentes)
  {
    if (c.codigo !== CODIGO_ORFAO) perfis.set(c.codigo, novoPerfil(c, -1, pessoas));
  }
  const fragmentos: Fragmento[] = [];
  entradas.forEach((entrada, upload) =>
  {
    entrada.cards.forEach((card, indice) =>
    {
      if (card.codigo === CODIGO_ORFAO)
      {
        fragmentos.push({ capturaId: entrada.id, indice, upload, card });
        return;
      }
      const atual = perfis.get(card.codigo);
      perfis.set(card.codigo, atual ? incluirAncora(atual, card, upload, pessoas) : novoPerfil(card, upload, pessoas));
    });
  });

  // 2) o card pai escolhido na tela vale antes de qualquer cálculo
  const vinculos = new Map<Fragmento, Vinculo>();
  let pendentes: Fragmento[] = [];
  const forcadoDe = new Map(entradas.map((e) => [e.id, e.cardPaiForcado]));
  for (const f of fragmentos)
  {
    const pai = perfis.get(forcadoDe.get(f.capturaId) ?? '');
    if (pai)
    {
      vinculos.set(f, { codigo: pai.codigo, confianca: 100, motivos: [`Vinculado a ${pai.codigo}`] });
      incluirFragmento(pai, f, pessoas);
    }
    else pendentes.push(f);
  }

  // 3) cada rodada liga o par mais forte e atualiza o perfil do card, para o próximo fragmento poder encadear nele
  while (pendentes.length)
  {
    let melhor: { frag: Fragmento; vinculo: Vinculo; segundo: number } | undefined;
    for (const f of pendentes)
    {
      const pontos = [...perfis.values()].map((perfil) => pontuarFragmento(f, perfil, pessoas)).sort((a, b) => b.confianca - a.confianca);
      const topo = pontos[0];
      if (topo && topo.confianca >= LIMIAR_VINCULO && (!melhor || topo.confianca > melhor.vinculo.confianca))
      {
        melhor = { frag: f, vinculo: topo, segundo: pontos[1]?.confianca ?? -999 };
      }
    }
    if (!melhor) break;
    const ambiguo = melhor.vinculo.confianca - melhor.segundo < 6;
    vinculos.set(melhor.frag, {
      ...melhor.vinculo,
      confianca: ambiguo ? melhor.vinculo.confianca - 10 : melhor.vinculo.confianca,
      motivos: ambiguo ? [...melhor.vinculo.motivos, 'há outro card parecido, confira'] : melhor.vinculo.motivos,
    });
    incluirFragmento(perfis.get(melhor.vinculo.codigo)!, melhor.frag, pessoas);
    pendentes = pendentes.filter((f) => f !== melhor.frag);
  }

  // 4) saída por print: o fragmento ligado vira o card pai, já com o texto e as etapas costurados
  const porCaptura = new Map<string, SaidaCapturaLote>();
  for (const entrada of entradas)
  {
    const cards: CardSnapshot[] = [];
    let melhorVinculo: Vinculo | undefined;
    let pendentesDoPrint = 0;
    for (const [indice, card] of entrada.cards.entries())
    {
      if (card.codigo !== CODIGO_ORFAO)
      {
        // o card com código também leva o que os fragmentos trouxeram, senão a ordem de mesclagem mudaria o resultado
        const perfil = perfis.get(card.codigo);
        const completo = perfil && perfil.fragmentos.length
          ? {
            ...(perfil.texto.length > textoDe(card).length ? { descricaoCompleta: perfil.texto } : {}),
            ...(perfil.etapas.length ? { etapas: perfil.etapas } : {}),
          }
          : {};
        cards.push(enriquecerCard({ ...card, ...completo }, modelo));
        continue;
      }
      const frag = fragmentos.find((f) => f.capturaId === entrada.id && f.indice === indice)!;
      const v = vinculos.get(frag);
      if (!v)
      {
        pendentesDoPrint++;
        continue;
      }
      const perfil = perfis.get(v.codigo)!;
      const comTexto = perfil.texto.length > textoDe(card).length ? { descricaoCompleta: perfil.texto } : {};
      const comEtapas = perfil.fragmentos.some((f) => f.card.etapas?.length) ? { etapas: perfil.etapas } : {};
      // o aviso de "continuação sem código" deixa de valer depois do vínculo; se ficasse, o resultado dependeria de qual print é mesclado por último.
      // O mesmo vale para o título: o do fragmento é só a primeira linha do pedaço de texto e não pode trocar o título do card
      const { titulo: _tituloDoFragmento, ...semTitulo } = card;
      const avisos = (card.avisosLeitura ?? []).filter((a) => a !== AVISO_CONTINUACAO);
      cards.push(enriquecerCard({ ...semTitulo, ...comTexto, ...comEtapas, avisosLeitura: avisos, codigo: v.codigo }, modelo));
      if (!melhorVinculo || v.confianca > melhorVinculo.confianca) melhorVinculo = v;
    }
    porCaptura.set(entrada.id, {
      cards,
      pendentes: pendentesDoPrint,
      ...(melhorVinculo ? {
        cardPaiVinculado: melhorVinculo.codigo,
        confiancaVinculoPct: Math.min(100, Math.max(40, Math.round(melhorVinculo.confianca))),
        motivoVinculo: melhorVinculo.confianca >= 100 ? melhorVinculo.motivos[0]! : `Correlacionado a ${melhorVinculo.codigo}: ${melhorVinculo.motivos.join(', ')}`,
      } : {}),
    });
  }

  const ordemProcessamento = entradas
    .map((e, i) => ({ id: e.id, i, p: prioridadeOrigem(e.origem) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.id);
  return { porCaptura, ordemProcessamento };
}
