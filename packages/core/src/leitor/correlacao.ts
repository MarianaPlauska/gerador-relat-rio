import type { CapturaLida, CardSnapshot, Pessoa } from '../tipos';
import { juntarCard } from './cards';
import { semAcento } from './normalizar';

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem',
  'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'as', 'os', 'que', 'se', 'entao', 'como', 'mais',
  'menos', 'muito', 'ja', 'esta', 'estao', 'ser', 'foi', 'sao', 'ter', 'tem', 'ou', 'e', 'o', 'a',
  'ali', 'isso', 'essa', 'esse', 'pelo', 'pela', 'dentro', 'quando', 'onde',
]);

// Transforma um texto em vetor esparso de termos e radicais (resistente a truncamento e pequenos ruídos de OCR)
export function vetorizarTexto(texto: string): Map<string, number>
{
  const limpo = semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const vetor = new Map<string, number>();
  if (!limpo) return vetor;

  for (const palavra of limpo.split(' '))
  {
    if (palavra.length < 2 || STOPWORDS.has(palavra)) continue;
    vetor.set(palavra, (vetor.get(palavra) ?? 0) + 1);
    // radical de 5 letras para casar variações ("validacao" / "validacoes", "credenciada" / "credenciadas")
    if (palavra.length >= 5)
    {
      const rad = `#${palavra.slice(0, 5)}`;
      vetor.set(rad, (vetor.get(rad) ?? 0) + 0.6);
    }
  }
  return vetor;
}

// Similaridade de cosseno entre dois vetores de texto (0 a 1)
export function similaridadeCosseno(textoA: string, textoB: string): number
{
  const va = vetorizarTexto(textoA);
  const vb = vetorizarTexto(textoB);
  if (!va.size || !vb.size) return 0;

  let prod = 0;
  let normA = 0;
  let normB = 0;

  for (const [k, v] of va)
  {
    normA += v * v;
    const b = vb.get(k);
    if (b !== undefined) prod += v * b;
  }
  for (const v of vb.values()) normB += v * v;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? prod / denom : 0;
}

// Combina similaridade de cosseno com verificação de prefixo truncado (ex.: Imagem 1 com "..." vs Imagem 2 completa)
export function similaridadeTextos(curtoOuTruncado: string, longoOuCompleto: string): number
{
  const a = semAcento(curtoOuTruncado).toLowerCase().replace(/\.{2,}$/, '').replace(/\s+/g, ' ').trim();
  const b = semAcento(longoOuCompleto).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!a || !b) return 0;

  // Se o início do texto completo contém o texto truncado da tabela
  const prefixo = a.slice(0, Math.min(a.length, 45));
  if (prefixo.length >= 15 && b.includes(prefixo))
  {
    return 0.95;
  }
  return similaridadeCosseno(a, b);
}

// Extrai um resumo curto do assunto principal da tarefa sem reticências desnecessárias
export function extrairAssunto(card: Pick<CardSnapshot, 'titulo' | 'descricaoCompleta' | 'sistema'>): string
{
  const base = (card.descricaoCompleta || card.titulo || '').trim();
  if (!base) return card.sistema || 'Demanda do painel';

  const primeiraLinha = base.split(/\r?\n/)[0]!.trim();
  // Se começa com "Assunto: detalhe", destaca o assunto e o complemento principal
  const atePonto = primeiraLinha.split(/(?<=[.!?;])\s+/)[0] ?? primeiraLinha;
  const limpo = atePonto.replace(/\.{2,}$/, '').trim();
  return limpo.length > 78 ? `${limpo.slice(0, 75).trim()}...` : limpo;
}

// Estima o tempo em horas de uma demanda com base em prioridade, regras do pedido e etapas (quando não definido manualmente)
export function estimarHorasCard(card: CardSnapshot): number
{
  if (card.horasEstimadas !== undefined && card.horasEstimadas > 0) return card.horasEstimadas;
  if (card.situacao === 'concluido' || semAcento(card.statusCard ?? '').toLowerCase() === 'resolvido')
  {
    return 0;
  }

  // Base pela criticidade / prioridade
  let base = 4;
  const prio = semAcento(card.prioridadeCard ?? '').toLowerCase();
  if (card.criticidade === 3 || prio === 'critica' || prio === 'urgente') base = 7.5;
  else if (card.criticidade === 2 || prio === 'alta') base = 5.5;
  else if (prio === 'baixa') base = 2.5;

  // Bônus por regras condicionais ("se ... então ...") presentes na descrição completa da Imagem 2
  const textoRegras = card.descricaoCompleta || card.titulo || '';
  const condicoes = textoRegras.match(/\bse\s+[a-zà-ÿ0-9\s/]+,\s*ent[aã]o\b/gi)?.length ?? 0;
  base += Math.min(3.5, condicoes * 0.8);

  // Ajuste pelas etapas da Imagem 3
  if (card.etapas && card.etapas.length > 0)
  {
    const restantes = card.etapas.filter((e) => e.situacao !== 'concluida').length;
    const total = card.etapas.length;
    if (total > 0)
    {
      const proporcaoRestante = restantes / total;
      base = Math.max(1.5, base * proporcaoRestante);
    }
  }
  else if (card.etapasTotal && card.etapasConcluidas !== undefined && card.etapasTotal > 0)
  {
    const restantes = Math.max(0, card.etapasTotal - card.etapasConcluidas);
    base = Math.max(1.5, base * (restantes / card.etapasTotal));
  }

  return Math.round(base * 2) / 2;
}

export function enriquecerCard(card: CardSnapshot): CardSnapshot
{
  const assunto = card.assunto ?? extrairAssunto(card);
  const horasEstimadas = card.horasEstimadas ?? estimarHorasCard(card);
  return {
    ...card,
    assunto,
    horasEstimadas,
  };
}

export interface ResultadoCorrelacao
{
  cards: CardSnapshot[];
  cardPaiVinculado?: string | undefined;
  confiancaVinculoPct?: number | undefined;
  motivoVinculo?: string | undefined;
}

function normalizarPessoaId(idOuNome: string | undefined, pessoas: Pessoa[]): string | undefined
{
  if (!idOuNome) return undefined;
  const p = pessoas.find((x) => x.id === idOuNome || semAcento(x.nome).toLowerCase() === semAcento(idOuNome).toLowerCase());
  return p ? p.id : semAcento(idOuNome).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Correlaciona os cards de um print recém-enviado (ex.: Imagem 2 ou Imagem 3) com a árvore de cards existentes (ex.: Imagem 1)
export function correlacionarCapturaComArvore(
  cardsDaCaptura: CardSnapshot[],
  cardsExistentes: CardSnapshot[],
  capturasAnteriores: CapturaLida[],
  pessoas: Pessoa[],
  cardPaiForcado?: string,
): ResultadoCorrelacao
{
  if (!cardsDaCaptura.length || !cardsExistentes.length)
  {
    return { cards: cardsDaCaptura.map(enriquecerCard) };
  }

  let cardPaiVinculado: string | undefined;
  let confiancaVinculoPct: number | undefined;
  let motivoVinculo: string | undefined;

  const resultado: CardSnapshot[] = [];

  for (const card of cardsDaCaptura)
  {
    // Se o usuário escolheu manualmente o card pai para este print
    if (cardPaiForcado && (card.codigo === '__ORFAO__' || cardsDaCaptura.length === 1))
    {
      const paiManual = cardsExistentes.find((c) => c.codigo === cardPaiForcado);
      if (paiManual)
      {
        cardPaiVinculado = paiManual.codigo;
        confiancaVinculoPct = 100;
        motivoVinculo = `Vinculado a ${paiManual.codigo}`;
        resultado.push(enriquecerCard({ ...card, codigo: paiManual.codigo }));
        continue;
      }
    }

    // Caso 1: O print já traz o código explícito (ex.: DEV-274 na Imagem 2) e ele existe na lista pai (Imagem 1)
    if (card.codigo !== '__ORFAO__')
    {
      const paiDireto = cardsExistentes.find((c) => c.codigo === card.codigo);
      if (paiDireto && cardsDaCaptura.length === 1)
      {
        cardPaiVinculado = paiDireto.codigo;
        confiancaVinculoPct = 99;
        const partes = [
          card.descricaoCompleta ? 'descrição completa do pedido' : '',
          card.etapas?.length ? `${card.etapas.length} etapas` : '',
        ].filter(Boolean).join(' e ');
        motivoVinculo = `Código ${paiDireto.codigo} identificado (${partes || 'detalhes mesclados'})`;
      }
      resultado.push(enriquecerCard(card));
      continue;
    }

    // Caso 2: Print órfão (ex.: Imagem 3 de Etapas sem o código DEV-274 no recorte, ou recorte só do texto do pedido)
    const respOrfao = normalizarPessoaId(card.responsavelEtapaAtual ?? card.responsaveis[0], pessoas);
    const temEtapaRodando = card.etapas?.some((e) => e.situacao === 'rodando') ?? false;
    const textoOrfao = card.descricaoCompleta || card.titulo || '';

    // Verifica qual foi o último card único aberto nas capturas anteriores (contexto sequencial da árvore)
    const ultimaCapturaCard = [...capturasAnteriores].reverse().find((cap) => cap.cards.length === 1 || cap.cardPaiVinculado);
    const codigoUltimoCardSequencia = ultimaCapturaCard?.cardPaiVinculado ?? ultimaCapturaCard?.cards[0];

    let melhorPai: CardSnapshot | undefined;
    let melhorScore = -999;
    let motivosMelhor: string[] = [];

    for (const candidato of cardsExistentes)
    {
      if (candidato.codigo === '__ORFAO__') continue;
      let score = 0;
      const motivos: string[] = [];

      // 1) Similaridade vetorial de texto (se o órfão tiver texto de pedido)
      if (textoOrfao && (candidato.titulo || candidato.descricaoCompleta))
      {
        const sim = similaridadeTextos(candidato.titulo ?? '', textoOrfao);
        if (sim >= 0.35)
        {
          score += sim * 75;
          motivos.push(`similaridade de texto (${Math.round(sim * 100)}%)`);
        }
      }

      // 2) Sequência imediata na árvore de upload (Vetor A -> Vetor B1 -> Vetor B2)
      if (codigoUltimoCardSequencia && candidato.codigo === codigoUltimoCardSequencia)
      {
        score += 42;
        motivos.push(`sequência direta de ${candidato.codigo}`);
      }

      // 3) Compatibilidade de responsável
      const respCand = normalizarPessoaId(candidato.responsavelEtapaAtual ?? candidato.responsaveis[0], pessoas);
      if (respOrfao && respCand)
      {
        if (respOrfao === respCand)
        {
          score += 36;
          const nomeP = pessoas.find((p) => p.id === respCand)?.nome ?? respCand;
          motivos.push(`mesmo responsável (${nomeP})`);
        }
        else
        {
          score -= 45;
        }
      }

      // 4) Consistência de status (Etapas rodando -> Card "Em andamento", nunca "Resolvido")
      const statusCandNorm = semAcento(candidato.statusCard ?? '').toLowerCase();
      if (temEtapaRodando)
      {
        if (statusCandNorm === 'em andamento' || candidato.situacao === 'em_execucao')
        {
          score += 28;
          motivos.push('status Em andamento compatível com etapas rodando');
        }
        else if (statusCandNorm === 'resolvido' || candidato.situacao === 'concluido')
        {
          score -= 60;
        }
      }

      if (score > melhorScore)
      {
        melhorScore = score;
        melhorPai = candidato;
        motivosMelhor = motivos;
      }
    }

    if (melhorPai && melhorScore >= 25)
    {
      cardPaiVinculado = melhorPai.codigo;
      confiancaVinculoPct = Math.min(98, Math.max(62, Math.round(melhorScore)));
      motivoVinculo = `Correlacionado a ${melhorPai.codigo}: ${motivosMelhor.join(', ')}`;
      resultado.push(enriquecerCard({ ...card, codigo: melhorPai.codigo }));
    }
    else
    {
      resultado.push(enriquecerCard(card));
    }
  }

  return {
    cards: resultado,
    ...(cardPaiVinculado ? { cardPaiVinculado } : {}),
    ...(confiancaVinculoPct !== undefined ? { confiancaVinculoPct } : {}),
    ...(motivoVinculo ? { motivoVinculo } : {}),
  };
}

// Consolida uma lista de cards mesclando pais e filhos pelo código e enriquecendo assunto e horas estimadas
export function consolidarArvoreDeCards(cards: CardSnapshot[]): CardSnapshot[]
{
  const mapa = new Map<string, CardSnapshot>();
  for (const c of cards)
  {
    if (c.codigo === '__ORFAO__') continue;
    const existente = mapa.get(c.codigo);
    const unido = existente ? juntarCard(existente, c) : c;
    mapa.set(c.codigo, enriquecerCard(unido));
  }
  return [...mapa.values()];
}
