import type { CardSnapshot, Snapshot, TotaisPainel } from '../tipos';
import { juntarCard } from './cards';

// cada colagem soma na foto do dia: totais sobrescrevem, cards são atualizados pelo código
export function mesclarNaFoto(foto: Snapshot, totais: TotaisPainel, cards: CardSnapshot[]): Snapshot
{
  const definidos = Object.fromEntries(Object.entries(totais).filter(([, v]) => v !== undefined));
  const porCodigo = new Map(foto.cards.map((c) => [c.codigo, c]));
  for (const c of cards)
  {
    const anterior = porCodigo.get(c.codigo);
    porCodigo.set(c.codigo, anterior ? juntarCard(anterior, c) : c);
  }
  return { ...foto, totais: { ...foto.totais, ...definidos }, cards: [...porCodigo.values()] };
}
