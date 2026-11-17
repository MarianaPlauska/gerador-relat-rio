import type { CardSnapshot } from '../tipos';
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
  const atePonto = primeiraLinha.split(/(?<=[.!?;])\s+/)[0] ?? primeiraLinha;
  const limpo = atePonto.replace(/\.{2,}$/, '').trim();
  return limpo.length > 78 ? `${limpo.slice(0, 75).trim()}...` : limpo;
}
