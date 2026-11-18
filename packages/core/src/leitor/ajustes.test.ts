import { describe, expect, it } from 'vitest';
import type { CardSnapshot, EtapaCard, Snapshot } from '../tipos';
import {
  adicionarEtapaAjustada, ajustarCampos, ajustarEtapa, ajustarHoras, aplicarAjustes, aplicarRelacionados, chaveDaEtapa,
  desvincularAjustado, removerEtapaAjustada, vincularAjustado, type Ajustes,
} from './ajustes';
import { calcularRelacoesEImpactoSemana, detalharEstimativa, enriquecerCard } from './etapas-auto';
import { aprenderEstimativas, MINIMO_AMOSTRAS } from './estimativa';

const etapa = (ordem: number, nome: string, extra: Partial<EtapaCard> = {}): EtapaCard => ({ ordem, nome, situacao: 'nao_iniciada', origemEtapa: 'print', ...extra });
const card = (codigo: string, extra: Partial<CardSnapshot> = {}): CardSnapshot => ({ codigo, responsaveis: ['rodrigo'], responsavelEtapaAtual: 'rodrigo', origens: ['demandas'], ...extra });

// o que o recálculo faz: refaz os cards a partir dos prints (objetos novos) e aplica os ajustes por cima
const recalcular = (ajustes: Ajustes, cards: CardSnapshot[]) => aplicarRelacionados(calcularRelacoesEImpactoSemana(aplicarAjustes(cards, ajustes).map((c) => enriquecerCard(c))), ajustes);

const baseDosPrints = (): CardSnapshot[] => [
  card('DEV-1', { prioridadeCard: 'Alta', descricaoCompleta: 'Ajuste no cadastro de funcionários', etapas: [etapa(1, 'Validação dos requisitos'), etapa(2, 'Implementação'), etapa(3, 'Concluir')] }),
  card('DEV-2', { descricaoCompleta: 'Relatório de absenteísmo por setor', etapas: [etapa(1, 'Modelagem')] }),
];

describe('ajustes manuais que sobrevivem ao recálculo', () =>
{
  it('tempo digitado vale e continua valendo quando os prints são lidos de novo', () =>
  {
    const ajustes = ajustarHoras({}, 'DEV-1', 12);
    const depois = recalcular(ajustes, baseDosPrints());
    expect(depois.find((c) => c.codigo === 'DEV-1')).toMatchObject({ horasEstimadas: 12, origemHoras: 'manual' });
    // o outro card segue com a estimativa automática
    expect(depois.find((c) => c.codigo === 'DEV-2')!.origemHoras).toBe('regra');
  });

  it('prioridade, responsável e status corrigidos à mão ficam por cima do que veio do print', () =>
  {
    const ajustes = ajustarCampos({}, 'DEV-1', { prioridadeCard: 'Crítica', criticidade: 3, responsavelEtapaAtual: 'mariana', responsaveis: ['mariana'] });
    const [c1] = recalcular(ajustes, baseDosPrints());
    expect(c1).toMatchObject({ prioridadeCard: 'Crítica', criticidade: 3, responsavelEtapaAtual: 'mariana', responsaveis: ['mariana'] });
  });

  it('etapa marcada à mão continua marcada e o card muda de situação quando todas terminam', () =>
  {
    const base = baseDosPrints();
    const lista = base[0]!.etapas!;
    let ajustes: Ajustes = ajustarEtapa({}, 'DEV-1', chaveDaEtapa(lista[0]!, lista), { situacao: 'concluida' });
    const meio = recalcular(ajustes, baseDosPrints())[0]!;
    expect(meio.etapas!.map((e) => e.situacao)).toEqual(['concluida', 'nao_iniciada', 'nao_iniciada']);
    expect(meio).toMatchObject({ etapasConcluidas: 1, etapasTotal: 3, situacao: 'em_execucao', statusCard: 'Em andamento' });

    ajustes = ajustarEtapa(ajustarEtapa(ajustes, 'DEV-1', chaveDaEtapa(lista[1]!, lista), { situacao: 'concluida' }), 'DEV-1', chaveDaEtapa(lista[2]!, lista), { situacao: 'concluida' });
    expect(recalcular(ajustes, baseDosPrints())[0]).toMatchObject({ etapasConcluidas: 3, situacao: 'concluido', statusCard: 'Resolvido' });
  });

  it('etapa adicionada à mão e etapa removida sobrevivem; remover a adicionada tira de vez', () =>
  {
    const base = baseDosPrints();
    const lista = base[0]!.etapas!;
    let ajustes = adicionarEtapaAjustada({}, 'DEV-1', etapa(4, 'Homologação', { descricao: 'Validar com o cliente' }));
    ajustes = removerEtapaAjustada(ajustes, 'DEV-1', lista[1]!, lista);
    const c = recalcular(ajustes, baseDosPrints())[0]!;
    expect(c.etapas!.map((e) => `${e.ordem}:${e.nome}`)).toEqual(['1:Validação dos requisitos', '2:Concluir', '3:Homologação']);
    expect(c.etapas!.at(-1)).toMatchObject({ origemEtapa: 'manual', descricao: 'Validar com o cliente' });

    const nova = c.etapas!.at(-1)!;
    ajustes = removerEtapaAjustada(ajustes, 'DEV-1', nova, c.etapas!);
    expect(ajustes['DEV-1']!.etapasNovas).toEqual([]);
    expect(recalcular(ajustes, baseDosPrints())[0]!.etapas!.map((e) => e.nome)).toEqual(['Validação dos requisitos', 'Concluir']);
  });

  it('descrição de etapa editada à mão fica', () =>
  {
    const lista = baseDosPrints()[0]!.etapas!;
    const ajustes = ajustarEtapa({}, 'DEV-1', chaveDaEtapa(lista[1]!, lista), { descricao: 'Trocar a regra de matrícula' });
    expect(recalcular(ajustes, baseDosPrints())[0]!.etapas![1]).toMatchObject({ nome: 'Implementação', descricao: 'Trocar a regra de matrícula' });
  });

  it('vínculo ligado à mão fica e vínculo desligado não volta pela relação automática', () =>
  {
    const base = (): CardSnapshot[] => [
      card('DEV-1', { descricaoCompleta: 'Ajuste no cadastro de funcionários da empresa' }),
      card('DEV-2', { descricaoCompleta: 'Ajuste no cadastro de funcionários da empresa também' }),
      card('DEV-3', { responsaveis: ['douglas'], responsavelEtapaAtual: 'douglas', descricaoCompleta: 'Logotipo dos clientes' }),
    ];
    expect(recalcular({}, base()).find((c) => c.codigo === 'DEV-1')!.cardsRelacionados).toContain('DEV-2');

    const desligado = desvincularAjustado({}, 'DEV-1', 'DEV-2');
    expect(recalcular(desligado, base()).find((c) => c.codigo === 'DEV-1')!.cardsRelacionados).not.toContain('DEV-2');

    const ligado = vincularAjustado(desligado, 'DEV-1', 'DEV-3');
    const dev1 = recalcular(ligado, base()).find((c) => c.codigo === 'DEV-1')!;
    expect(dev1.cardsRelacionados).toContain('DEV-3');
    expect(dev1.cardsRelacionados).not.toContain('DEV-2');
    // ligar de novo o que foi desligado desfaz o desligamento
    expect(vincularAjustado(desligado, 'DEV-1', 'DEV-2')['DEV-1']!.relacionadosRemovidos).toEqual([]);
  });

  it('cards sem ajuste passam intactos e etapas repetidas têm chaves diferentes', () =>
  {
    const base = baseDosPrints();
    expect(aplicarAjustes(base, {})).toEqual(base);
    const repetidas = [etapa(1, 'Teste'), etapa(2, 'Teste')];
    expect(chaveDaEtapa(repetidas[0]!, repetidas)).not.toBe(chaveDaEtapa(repetidas[1]!, repetidas));
  });
});

const foto = (data: string, cards: CardSnapshot[]): Snapshot => ({ data, pasta: 'DEV', totais: {}, cards });
const concluida = (codigo: string, minutos: number, extra: Partial<CardSnapshot> = {}): CardSnapshot =>
  card(codigo, { situacao: 'concluido', statusCard: 'Resolvido', sistema: 'Kitu Sistema', prioridadeCard: 'Alta', tempoTotalMin: minutos, ...extra });

describe('estimativa de horas aprendida com o histórico', () =>
{
  const historico = [
    foto('2026-10-05', [concluida('DEV-10', 120), concluida('DEV-11', 180), concluida('DEV-12', 90)]),
    foto('2026-10-12', [concluida('DEV-13', 150), concluida('DEV-14', 120), concluida('DEV-15', 30, { prioridadeCard: 'Baixa' })]),
  ];

  it('usa só demandas concluídas com tempo real e agrupa por tipo e prioridade', () =>
  {
    const modelo = aprenderEstimativas([...historico, foto('2026-10-19', [card('DEV-99', { sistema: 'Kitu Sistema', prioridadeCard: 'Alta' }), concluida('DEV-98', 0)])]);
    expect(modelo.totalAmostras).toBe(6);
    expect(modelo.chaves['kitu sistema|alta']).toEqual({ mediana: 2, amostras: 5 });
    expect(modelo.chaves['kitu sistema|baixa']).toEqual({ mediana: 0.5, amostras: 1 });
    expect(modelo.chaves['|']!.amostras).toBe(6);
  });

  it('mistura a regra fixa com a mediana, mais ou menos conforme o número de amostras', () =>
  {
    const modelo = aprenderEstimativas(historico);
    const aberto = card('DEV-50', { sistema: 'Kitu Sistema', prioridadeCard: 'Alta', statusCard: 'Novo' });
    const semHistorico = detalharEstimativa(aberto);
    expect(semHistorico).toMatchObject({ horas: 5.5, origem: 'regra' });
    const comHistorico = detalharEstimativa(aberto, modelo);
    expect(comHistorico.origem).toBe('historico');
    // 5 amostras: peso 62,5% na mediana de 2 h e o resto na regra de 5,5 h
    expect(comHistorico.horas).toBe(3.5);
    expect(comHistorico.nota).toContain('5 demandas do tipo kitu sistema de prioridade alta');
  });

  it('com poucas amostras no tipo, cai para o nível mais geral; sem o mínimo, fica a regra', () =>
  {
    const modelo = aprenderEstimativas(historico);
    const baixa = detalharEstimativa(card('DEV-51', { sistema: 'Kitu Sistema', prioridadeCard: 'Baixa', statusCard: 'Novo' }), modelo);
    expect(baixa.nota).toContain('do tipo kitu sistema');
    expect(baixa.nota).not.toContain('de prioridade');
    const pouco = aprenderEstimativas([foto('2026-10-05', [concluida('DEV-1', 60), concluida('DEV-2', 60)])]);
    expect(2).toBeLessThan(MINIMO_AMOSTRAS);
    expect(detalharEstimativa(card('DEV-3', { statusCard: 'Novo' }), pouco).origem).toBe('regra');
  });

  it('o tempo digitado nunca é trocado pelo histórico, mas o calculado acompanha o histórico novo', () =>
  {
    const modelo = aprenderEstimativas(historico);
    const manual = enriquecerCard(card('DEV-52', { sistema: 'Kitu Sistema', prioridadeCard: 'Alta', horasEstimadas: 9, origemHoras: 'manual' }), modelo);
    expect(manual).toMatchObject({ horasEstimadas: 9, origemHoras: 'manual' });
    const antigo = enriquecerCard(card('DEV-53', { sistema: 'Kitu Sistema', prioridadeCard: 'Alta', horasEstimadas: 6 }), modelo);
    expect(antigo).toMatchObject({ horasEstimadas: 6 });
    const calculado = enriquecerCard(card('DEV-54', { sistema: 'Kitu Sistema', prioridadeCard: 'Alta', horasEstimadas: 5.5, origemHoras: 'regra' }), modelo);
    expect(calculado).toMatchObject({ horasEstimadas: 3.5, origemHoras: 'historico' });
  });
});
