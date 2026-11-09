import type { CardSnapshot, ControleCard } from './tipos';

// meu controle vale até chegar uma foto do painel mais nova que ele
export function aplicarControle(card: CardSnapshot, dataFoto: string, controle?: ControleCard): CardSnapshot
{
  if (!controle || controle.atualizadoEm < dataFoto) return card;
  const { atualizadoEm: _, ...campos } = controle;
  const definidos = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
  return { ...card, ...definidos };
}
