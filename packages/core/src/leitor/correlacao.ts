import type { CapturaLida, CardSnapshot, Pessoa } from '../tipos';
import { juntarCard } from './cards';
import { calcularRelacoesEImpactoSemana, enriquecerCard } from './etapas-auto';
import { semAcento } from './normalizar';
import { similaridadeTextos } from './vetor';

export * from './vetor';
export * from './etapas-auto';
export * from './metricas-auto';

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
  capturasPrevias: CapturaLida[],
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

    const respOrfao = normalizarPessoaId(card.responsavelEtapaAtual ?? card.responsaveis[0], pessoas);
    const temEtapaRodando = card.etapas?.some((e) => e.situacao === 'rodando') ?? false;
    const textoOrfao = card.descricaoCompleta || card.titulo || '';

    const ultimaCapturaCard = [...capturasAnterioresComCard(capturasPrevias)].reverse()[0];
    const codigoUltimoCardSequencia = ultimaCapturaCard?.cardPaiVinculado ?? ultimaCapturaCard?.cards[0];

    let melhorPai: CardSnapshot | undefined;
    let melhorScore = -999;
    let motivosMelhor: string[] = [];

    for (const candidato of cardsExistentes)
    {
      if (candidato.codigo === '__ORFAO__') continue;
      let score = 0;
      const motivos: string[] = [];

      if (textoOrfao && (candidato.titulo || candidato.descricaoCompleta))
      {
        const sim = similaridadeTextos(candidato.titulo ?? '', textoOrfao);
        if (sim >= 0.35)
        {
          score += sim * 75;
          motivos.push(`similaridade de texto (${Math.round(sim * 100)}%)`);
        }
      }

      if (codigoUltimoCardSequencia && candidato.codigo === codigoUltimoCardSequencia)
      {
        score += 42;
        motivos.push(`sequência direta de ${candidato.codigo}`);
      }

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

function capturasAnterioresComCard(capturas: CapturaLida[]): CapturaLida[]
{
  return capturas.filter((cap) => cap.cards.length === 1 || !!cap.cardPaiVinculado);
}

// Consolida uma lista de cards mesclando pais e filhos pelo código e enriquecendo assunto, etapas, relações e horas estimadas
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
  return calcularRelacoesEImpactoSemana([...mapa.values()]);
}
