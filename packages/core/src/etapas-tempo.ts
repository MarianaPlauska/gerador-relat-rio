import { percentil } from './fluxo';
import { semAcento } from './leitor/normalizar';
import type { Snapshot } from './tipos';

// quanto cada etapa costuma levar, medido nas etapas feitas dos cards lidos do painel
export interface TempoEtapa
{
  etapa: string;
  chave: string;
  // etapas feitas com duração conhecida
  n: number;
  p50: number;
  p85: number;
  // cards com esta etapa rodando na foto mais recente
  rodandoAgora: number;
  // posição média da etapa dentro dos cards, para montar o fluxo na ordem certa
  ordemMedia: number;
}

export const chaveDoNomeEtapa = (nome: string): string => semAcento(nome).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const arredondar = (n: number) => Math.round(n * 10) / 10;

export function temposPorEtapa(fotos: Snapshot[]): TempoEtapa[]
{
  const ordenadas = [...fotos].sort((a, b) => a.data.localeCompare(b.data));
  // a mesma etapa do mesmo card aparece em várias fotos: vale a leitura mais recente
  const feitas = new Map<string, { chave: string; nome: string; dias: number }>();
  const ordens = new Map<string, number[]>();
  const nomes = new Map<string, string>();
  for (const foto of ordenadas)
  {
    for (const card of foto.cards)
    {
      for (const e of card.etapas ?? [])
      {
        const chave = chaveDoNomeEtapa(e.nome);
        if (!chave) continue;
        if (!nomes.has(chave)) nomes.set(chave, e.nome);
        if (e.situacao === 'concluida' && e.duracaoDias !== undefined) feitas.set(`${card.codigo}|${chave}`, { chave, nome: e.nome, dias: e.duracaoDias });
        const lista = ordens.get(chave) ?? [];
        lista.push(e.ordem);
        ordens.set(chave, lista);
      }
    }
  }
  const rodando = new Map<string, number>();
  for (const card of ordenadas.at(-1)?.cards ?? [])
  {
    for (const e of card.etapas ?? []) if (e.situacao === 'rodando') rodando.set(chaveDoNomeEtapa(e.nome), (rodando.get(chaveDoNomeEtapa(e.nome)) ?? 0) + 1);
  }
  const porChave = new Map<string, number[]>();
  for (const f of feitas.values()) porChave.set(f.chave, [...(porChave.get(f.chave) ?? []), f.dias]);
  return [...porChave.entries()]
    .map(([chave, dias]) =>
    {
      const ord = ordens.get(chave) ?? [0];
      return { etapa: nomes.get(chave) ?? chave, chave, n: dias.length, p50: arredondar(percentil(dias, 0.5)), p85: arredondar(percentil(dias, 0.85)), rodandoAgora: rodando.get(chave) ?? 0, ordemMedia: arredondar(ord.reduce((s, x) => s + x, 0) / ord.length) };
    })
    .sort((a, b) => b.p85 - a.p85);
}

// liga o texto de um passo do fluxograma à etapa medida: igual, ou um contém o outro (com pelo menos 4 letras)
export function tempoDoPasso(tempos: TempoEtapa[], textoDoPasso: string): TempoEtapa | undefined
{
  const chave = chaveDoNomeEtapa(textoDoPasso);
  if (chave.length < 4) return undefined;
  return tempos.find((t) => t.chave === chave) ?? tempos.find((t) => t.chave.length >= 4 && (chave.includes(t.chave) || t.chave.includes(chave)));
}

// o gargalo é a etapa com maior p85 entre as que têm pelo menos 2 medições
export function gargaloDasEtapas(tempos: TempoEtapa[]): TempoEtapa | undefined
{
  return tempos.filter((t) => t.n >= 2).sort((a, b) => b.p85 - a.p85)[0];
}

// texto de passos para montar o fluxograma com as etapas na ordem em que costumam acontecer
export function passosDasEtapas(tempos: TempoEtapa[]): string
{
  return [...tempos].sort((a, b) => a.ordemMedia - b.ordemMedia).map((t) => t.etapa).concat('Fim').join('\n');
}
