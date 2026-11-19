import { agoraLocal, idCurto } from '../checklist';
import { detalharEstimativa } from '../leitor/etapas-auto';
import type { ModeloEstimativa } from '../leitor/estimativa';
import type { CardSnapshot, Pessoa } from '../tipos';
import type { LinhaPlanilha, Planilha, PrioridadeLinha } from './tipos';

const fechado = (c: CardSnapshot) => /resolvid|cancelad|conclu/i.test(c.statusCard ?? '');

function prioridadeDoCard(c: CardSnapshot): PrioridadeLinha
{
  const p = (c.prioridadeCard ?? '').toLowerCase();
  if (/cr[ií]tica|alta/.test(p) || c.criticidade === 3) return 'essencial';
  if (/baixa/.test(p) || c.criticidade === 1) return 'desejavel';
  return 'importante';
}

// orçamento de horas da semana: cada pessoa é um grupo, o orçamento dela é a capacidade semanal
// e cada demanda aberta entra com as horas estimadas (as manuais contam como verificadas)
export function planilhaDeHoras(cards: CardSnapshot[], pessoas: Pessoa[], nome: string, modelo?: ModeloEstimativa): Planilha
{
  const agora = agoraLocal();
  const nomeDe = (id?: string) => pessoas.find((p) => p.id === id)?.nome ?? id ?? 'Sem responsável';
  const linhas: LinhaPlanilha[] = cards
    .filter((c) => !fechado(c))
    // sem horas no card, vale a mesma estimativa do Diário do painel (manual, regra do nível ou histórico)
    .map((c) => ({ c, est: c.horasEstimadas !== undefined ? { horas: c.horasEstimadas, origem: c.origemHoras } : detalharEstimativa(c, modelo) }))
    .map(({ c, est }) => ({
      id: idCurto(),
      grupo: nomeDe(c.responsavelEtapaAtual ?? c.responsaveis[0]),
      item: c.codigo,
      detalhe: c.titulo ?? '',
      qtd: 1,
      loja: c.etapaAtual ?? '',
      ref: est.horas,
      situacao: est.origem === 'manual' ? 'verificado' : 'estimativa',
      prioridade: prioridadeDoCard(c),
      incluir: true,
      observacao: est.origem === 'historico' ? 'horas aprendidas do histórico' : est.origem === 'regra' ? 'horas pela regra do nível' : '',
    }));
  const grupos = [...new Set([...pessoas.map((p) => p.nome).filter((n) => linhas.some((l) => l.grupo === n)), ...linhas.map((l) => l.grupo)])];
  const orcamentoPorGrupo = Object.fromEntries(pessoas.filter((p) => grupos.includes(p.nome)).map((p) => [p.nome, p.capacidadeHorasSemana]));
  const orcamento = Object.values(orcamentoPorGrupo).reduce((s, v) => s + v, 0);
  return {
    id: idCurto(),
    nome,
    objetivo: 'Horas estimadas das demandas abertas contra a capacidade semanal de cada pessoa.',
    criadoEm: agora,
    atualizadoEm: agora,
    moeda: false,
    unidade: 'h',
    comAlternativas: false,
    orcamento: orcamento > 0 ? orcamento : undefined,
    orcamentoPorGrupo,
    grupos,
    linhas,
    alternativas: [],
    notas: {
      comoLer: ['Cada grupo é uma pessoa; o orçamento dela é a capacidade semanal em horas.', 'Horas em amarelo são estimadas (regra do nível ou histórico); confirme no card.'],
      premissas: ['Entram só as demandas abertas na foto do painel usada.'],
      atencao: [],
    },
  };
}
