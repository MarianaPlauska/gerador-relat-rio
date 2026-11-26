import type { CardSnapshot, EtapaCard } from '../tipos';
import { semAcento } from './normalizar';

// Camada de ajustes manuais. O que a pessoa corrige à mão (tempo, prioridade, responsável, etapas, relações)
// fica guardado aqui, separado do que veio dos prints. Sempre que os prints são lidos de novo
// (trocar "Entendi como", escolher o card pai, tirar um print), os cards são refeitos e os ajustes são aplicados por cima.

export interface AjusteEtapa
{
  situacao?: EtapaCard['situacao'];
  descricao?: string;
  removida?: boolean;
}

// campos do card que a pessoa pode corrigir à mão (inclui o código, para consertar leitura errada do print)
export type CamposAjustaveis = Partial<Pick<CardSnapshot,
  'codigo' | 'prioridadeCard' | 'criticidade' | 'statusCard' | 'situacao' | 'responsavelEtapaAtual' | 'responsaveis' |
  'horasEstimadas' | 'origemHoras' | 'notaHoras' | 'descricaoCompleta' | 'titulo' | 'assunto' | 'comentario' | 'porque' | 'previsao' | 'vencimento' |
  'inicio' | 'etapaAtual' | 'ritmoPainel'>>;

export interface AjusteCard
{
  campos?: CamposAjustaveis;
  // card tirado da lista à mão
  removido?: boolean;
  // chave da etapa (ver chaveDaEtapa) -> o que mudou nela
  etapas?: Record<string, AjusteEtapa>;
  etapasNovas?: EtapaCard[];
  relacionadosAdicionados?: string[];
  relacionadosRemovidos?: string[];
}

// Os ajustes são guardados pelo código que veio do print. Se a pessoa corrigiu o código (campos.codigo),
// a tela passa a mostrar o novo; `codigoLido` volta do código mostrado para o do print.
export function codigoLido(ajustes: Ajustes, codigoMostrado: string): string
{
  return Object.entries(ajustes).find(([, a]) => a.campos?.codigo === codigoMostrado)?.[0] ?? codigoMostrado;
}

export type Ajustes = Record<string, AjusteCard>;

// identidade estável da etapa: o nome (sem acento, minúsculo) e, se houver nomes repetidos, a ocorrência
export function chaveDaEtapa(etapa: Pick<EtapaCard, 'nome'>, lista: Pick<EtapaCard, 'nome'>[]): string
{
  const nome = semAcento(etapa.nome).replace(/\s+/g, ' ').trim();
  let ocorrencia = 0;
  for (const outra of lista)
  {
    if (outra === etapa) break;
    if (semAcento(outra.nome).replace(/\s+/g, ' ').trim() === nome) ocorrencia++;
  }
  return ocorrencia ? `${nome}#${ocorrencia + 1}` : nome;
}

const unico = <T>(lista: T[]): T[] => [...new Set(lista)];

function com(ajustes: Ajustes, codigo: string, mudar: (atual: AjusteCard) => AjusteCard): Ajustes
{
  const chave = codigoLido(ajustes, codigo);
  return { ...ajustes, [chave]: mudar(ajustes[chave] ?? {}) };
}

// tirar o card da lista (ele volta se o ajuste for desfeito)
export function removerCardAjustado(ajustes: Ajustes, codigo: string): Ajustes
{
  return com(ajustes, codigo, (a) => ({ ...a, removido: true }));
}

export function ajustarCampos(ajustes: Ajustes, codigo: string, parcial: CamposAjustaveis): Ajustes
{
  return com(ajustes, codigo, (a) => ({ ...a, campos: { ...a.campos, ...parcial } }));
}

// o tempo digitado vale sempre e sai da conta do histórico
export function ajustarHoras(ajustes: Ajustes, codigo: string, horas: number): Ajustes
{
  return ajustarCampos(ajustes, codigo, { horasEstimadas: horas, origemHoras: 'manual', notaHoras: undefined });
}

export function ajustarEtapa(ajustes: Ajustes, codigo: string, chave: string, parcial: AjusteEtapa): Ajustes
{
  return com(ajustes, codigo, (a) => ({ ...a, etapas: { ...a.etapas, [chave]: { ...a.etapas?.[chave], ...parcial } } }));
}

export function adicionarEtapaAjustada(ajustes: Ajustes, codigo: string, etapa: EtapaCard): Ajustes
{
  return com(ajustes, codigo, (a) => ({ ...a, etapasNovas: [...(a.etapasNovas ?? []), { ...etapa, origemEtapa: 'manual' }] }));
}

// etapa adicionada à mão sai de vez; etapa que veio do print é só marcada como removida
export function removerEtapaAjustada(ajustes: Ajustes, codigo: string, etapa: EtapaCard, lista: EtapaCard[]): Ajustes
{
  const chave = chaveDaEtapa(etapa, lista);
  return com(ajustes, codigo, (a) =>
  {
    const novas = a.etapasNovas ?? [];
    const ehNova = novas.some((n) => chaveDaEtapa(n, novas) === chave);
    if (ehNova) return { ...a, etapasNovas: novas.filter((n) => chaveDaEtapa(n, novas) !== chave) };
    return { ...a, etapas: { ...a.etapas, [chave]: { ...a.etapas?.[chave], removida: true } } };
  });
}

export function vincularAjustado(ajustes: Ajustes, codigo: string, outro: string): Ajustes
{
  return com(ajustes, codigo, (a) => ({
    ...a,
    relacionadosAdicionados: unico([...(a.relacionadosAdicionados ?? []), outro]),
    relacionadosRemovidos: (a.relacionadosRemovidos ?? []).filter((x) => x !== outro),
  }));
}

export function desvincularAjustado(ajustes: Ajustes, codigo: string, outro: string): Ajustes
{
  return com(ajustes, codigo, (a) => ({
    ...a,
    relacionadosRemovidos: unico([...(a.relacionadosRemovidos ?? []), outro]),
    relacionadosAdicionados: (a.relacionadosAdicionados ?? []).filter((x) => x !== outro),
  }));
}

export const temAjustes = (ajustes: Ajustes): boolean => Object.keys(ajustes).length > 0;

function aplicarNasEtapas(card: CardSnapshot, ajuste: AjusteCard): CardSnapshot
{
  const etapasBase = card.etapas ?? [];
  const mexidas = Object.keys(ajuste.etapas ?? {}).length > 0;
  if (!mexidas && !ajuste.etapasNovas?.length) return card;

  const aplicadas = etapasBase
    .map((e) => ({ e, patch: ajuste.etapas?.[chaveDaEtapa(e, etapasBase)] }))
    .filter(({ patch }) => !patch?.removida)
    .map(({ e, patch }) => (patch ? { ...e, ...(patch.situacao ? { situacao: patch.situacao } : {}), ...(patch.descricao !== undefined ? { descricao: patch.descricao } : {}), origemEtapa: 'manual' as const } : e));
  const etapas = [...aplicadas, ...(ajuste.etapasNovas ?? [])].map((e, i) => ({ ...e, ordem: i + 1 }));

  const concluidas = etapas.filter((e) => e.situacao === 'concluida').length;
  const todasFeitas = etapas.length > 0 && concluidas === etapas.length;
  const algumaEmCurso = concluidas > 0 || etapas.some((e) => e.situacao === 'rodando');
  const resultado: CardSnapshot = { ...card, etapas, etapasConcluidas: concluidas, etapasTotal: etapas.length };
  if (todasFeitas)
  {
    resultado.situacao = 'concluido';
    resultado.statusCard = 'Resolvido';
  }
  else if (mexidas && algumaEmCurso && card.situacao !== 'concluido')
  {
    resultado.situacao = 'em_execucao';
    resultado.statusCard = 'Em andamento';
  }
  return resultado;
}

// aplica os ajustes (campos e etapas) por cima dos cards lidos; o que a pessoa digitou diretamente em um campo vale mais do que a regra
export function aplicarAjustes(cards: CardSnapshot[], ajustes: Ajustes): CardSnapshot[]
{
  return cards
    .filter((card) => !ajustes[card.codigo]?.removido)
    .map((card) =>
    {
      const ajuste = ajustes[card.codigo];
      if (!ajuste) return card;
      const comEtapas = aplicarNasEtapas(card, ajuste);
      return { ...comEtapas, ...ajuste.campos };
    });
}

// depois de calculadas as relações automáticas entre cards: o que a pessoa ligou ou desligou à mão prevalece
export function aplicarRelacionados(cards: CardSnapshot[], ajustes: Ajustes): CardSnapshot[]
{
  return cards.map((card) =>
  {
    const ajuste = ajustes[codigoLido(ajustes, card.codigo)];
    if (!ajuste?.relacionadosAdicionados?.length && !ajuste?.relacionadosRemovidos?.length) return card;
    const removidos = new Set(ajuste.relacionadosRemovidos ?? []);
    const lista = unico([...(card.cardsRelacionados ?? []), ...(ajuste.relacionadosAdicionados ?? [])]).filter((c) => !removidos.has(c));
    return { ...card, cardsRelacionados: lista };
  });
}
