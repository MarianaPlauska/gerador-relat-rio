import { describe, expect, it } from 'vitest';
import { pessoasExemplo } from './exemplo';
import { cardsParados, fimDoMes, gargalosPorEtapa, percentil, projetarMeta, temposDeEntrega, vencendoEm48h } from './fluxo';
import { detectarOrigem, lerCards } from './leitor/cards';
import { ehCsvDeDemandas, lerCsvDemandas } from './leitor/csv';
import type { CardSnapshot } from './tipos';

const opcoes = { prefixo: 'DEV', pessoas: pessoasExemplo };

// mesmo formato do "Exportar CSV" da lista de Demandas; conteúdo de exemplo
const csv = `ID,Time,Abertura,Solicitante,Tipo,Descricao,Status,Prioridade,Responsavel,Conclusao,Horas,Solucao,Satisfacao
DEV-301,DEV,10/11/2026 09:00,,Kitu Sistema,"Exportar relatório

Gerar o arquivo com ""todos"" os campos, inclusive datas.",Em andamento,Alta,Mariana Coutinho,,,,
DEV-302,DEV,01/11/2026 08:00,,Suporte Kitu,Ajustar login,Resolvido,Alta,Rodrigo Cinelli,03/11/2026 08:00,"48,00",,
DEV-303,DEV,20/12/2026 08:00,,Kitu Sistema,"Módulo novo",Planejado,Normal,Sem responsável,,,,
DEV-301,DEV,05/10/2026 15:47,,Kitu Sistema,Card antigo com o mesmo ID,Resolvido,Alta,Mariana Coutinho,08/10/2026 14:13,"70,43",,
DEV-304,DEV,02/11/2026 10:00,,Kitu Sistema,Cancelado por duplicidade,Cancelado,Normal,Sem responsável,03/11/2026 10:00,"0,00",Duplicidade de DEV-302.,
`;

describe('CSV da lista de demandas', () =>
{
  const { cards, repetidos } = lerCsvDemandas(csv, opcoes);
  const card = (codigo: string) => cards.find((c) => c.codigo === codigo)!;

  it('reconhece o arquivo e lê campos com várias linhas e aspas', () =>
  {
    expect(ehCsvDeDemandas(csv)).toBe(true);
    expect(card('DEV-301')).toMatchObject({
      titulo: 'Exportar relatório', abertura: '2026-11-10', statusCard: 'Em andamento', prioridadeCard: 'Alta',
      sistema: 'Kitu Sistema', responsaveis: ['mariana-coutinho'], origens: ['demandas'],
    });
    expect(card('DEV-302')).toMatchObject({ concluidoEm: '2026-11-03', horasAteConcluir: 48, responsaveis: ['rodrigo-cinelli'] });
  });

  it('fica com a linha mais recente de um ID repetido e avisa', () =>
  {
    expect(cards.filter((c) => c.codigo === 'DEV-301')).toHaveLength(1);
    expect(card('DEV-301').statusCard).toBe('Em andamento');
    expect(repetidos).toEqual(['DEV-301']);
  });

  it('"Sem responsável" fica sem pessoa e campo vazio não aparece', () =>
  {
    expect(card('DEV-303').responsaveis).toEqual([]);
    expect('concluidoEm' in card('DEV-303')).toBe(false);
  });
});

// saída real da leitura de imagem do card aberto (prints de 10/11/26)
const cardImagem = `DEV-234 DEV x
TIME ABERTURA
DEV — Desenvolvedores 13/11/2026 11:00
TIPO DE DEMANDA
Suporte Kitu v
O QUE FOI PEDIDO 7 Editar
Baixo - Planejamento da semana v 13/11/2026 23:59
Etapas concluídas 0% - prazo consumido 0% * noritmo
Etapas O de 4 concluídas
H ETAPA RESPONSÁVEL TEMPO
1 - . , não iniciada
Compreensão do problema — ninguém — v Start hSubtareta — Ú
+ o que vai fazer + pessoa
2 - . , não iniciada tart btarefa
Em correção — ninguem — v = bh Su "
+ o que vai fazer + pessoa
3 - - - , não iniciada tart btarefa
Validação — ninguém — v = = "
+ o que vai fazer + pessoa
4 . . , não iniciada ;
Concluir — ninguém — v Concluir card
+ o que vai fazer`;

describe('etapas do card aberto', () =>
{
  it('lê as etapas, a pessoa e a situação', () =>
  {
    expect(detectarOrigem(cardImagem)).toBe('card');
    const [c] = lerCards(cardImagem, opcoes);
    expect(c).toMatchObject({ codigo: 'DEV-234', abertura: '2026-11-13', sistema: 'Suporte Kitu', ritmoPainel: 'no_ritmo', etapasTotal: 4, etapasConcluidas: 0, etapaAtual: 'Compreensão do problema' });
    expect(c!.etapas!.map((e) => e.nome)).toEqual(['Compreensão do problema', 'Em correção', 'Validação', 'Concluir']);
    expect(c!.etapas!.every((e) => e.situacao === 'nao_iniciada' && e.pessoa === undefined)).toBe(true);
  });

  it('lê pessoa e etapa rodando quando aparecem', () =>
  {
    const [c] = lerCards(`DEV-235\nO QUE FOI PEDIDO\n1 , concluída\nLevantamento de requisitos Mariana Coutinho v Start\n2 , rodando há 2 d\nModelagem Rodrigo Cinelli v Concluir\n3 , não iniciada\nFront-end — ninguém — v Start\n+ o que vai fazer`, opcoes);
    expect(c).toMatchObject({ etapasConcluidas: 1, etapaAtual: 'Modelagem', etapaAtualStatus: 'rodando', responsavelEtapaAtual: 'rodrigo-cinelli' });
    expect(c!.etapas![0]).toMatchObject({ pessoa: 'mariana-coutinho', situacao: 'concluida' });
  });
});

const entregue = (codigo: string, prioridade: string, dias: number): CardSnapshot =>
  ({ codigo, prioridadeCard: prioridade, statusCard: 'Resolvido', horasAteConcluir: dias * 24, responsaveis: [], origens: ['demandas'] });

describe('fluxo (fases 6, 7 e 8)', () =>
{
  it('calcula percentis por interpolação', () =>
  {
    expect(percentil([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentil([1, 2, 3, 4, 5], 0.85)).toBeCloseTo(4.4);
  });

  const cards = [
    ...[1, 2, 2, 3, 4].map((d, i) => entregue(`DEV-1${i}`, 'Alta', d)),
    ...[5, 8].map((d, i) => entregue(`DEV-2${i}`, 'Normal', d)),
    { codigo: 'DEV-30', prioridadeCard: 'Alta', statusCard: 'Em andamento', abertura: '2026-11-01', responsaveis: [], origens: ['demandas'] },
    { codigo: 'DEV-31', prioridadeCard: 'Alta', statusCard: 'Novo', abertura: '2026-11-09', responsaveis: [], origens: ['demandas'] },
    { codigo: 'DEV-32', prioridadeCard: 'Normal', statusCard: 'Planejado', abertura: '2026-10-01', responsaveis: [], origens: ['demandas'] },
    { codigo: 'DEV-33', prioridadeCard: 'Normal', statusCard: 'Novo', abertura: '2026-10-20', responsaveis: [], origens: ['demandas'] },
    { codigo: 'DEV-34', statusCard: 'Cancelado', horasAteConcluir: 0, responsaveis: [], origens: ['demandas'] },
  ] as CardSnapshot[];
  const tempos = temposDeEntrega(cards);

  it('tempo de entrega só com o que foi resolvido', () =>
  {
    expect(tempos.porPrioridade['Alta']).toEqual({ n: 5, p50: 2, p85: 3.4 });
    expect(tempos.geral!.n).toBe(7);
  });

  it('parado além do normal: aberto há mais que o p85 da prioridade, ou do geral se ela tem poucas entregas', () =>
  {
    const parados = cardsParados(cards, '2026-11-11', tempos);
    expect(parados.map((p) => p.card.codigo)).toEqual(['DEV-33', 'DEV-30']);
    expect(parados[1]).toMatchObject({ idadeDias: 10, limiteDias: 3.4, base: 'Alta' });
    expect(parados[0]).toMatchObject({ idadeDias: 22, limiteDias: 5.3, base: 'geral' });
  });

  it('gargalo: agrupa pela etapa atual e conta quem está esperando', () =>
  {
    const g = gargalosPorEtapa([
      { codigo: 'A', etapaAtual: 'Validação', etapaAtualStatus: 'parada_na_fila', responsaveis: [], origens: [] },
      { codigo: 'B', etapaAtual: 'validacao', etapaAtualStatus: 'rodando', etapaAtualRodandoHaDias: 4, responsaveis: [], origens: [] },
      { codigo: 'C', etapaAtual: 'Front-end', etapaAtualStatus: 'rodando', responsaveis: [], origens: [] },
    ]);
    expect(g[0]).toMatchObject({ etapa: 'Validação', quantidade: 2, esperando: 1, maiorRodandoDias: 4, codigos: ['A', 'B'] });
  });

  it('projeção da meta pela tendência das últimas semanas', () =>
  {
    const serie = [63, 66, 64, 68, 70].map((valor, i) => ({ semana: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'][i]!, valor }));
    const p = projetarMeta(serie, 85, fimDoMes('2026-11-11'))!;
    expect(fimDoMes('2026-11-11')).toBe('2026-11-30');
    expect(fimDoMes('2026-02-10')).toBe('2026-02-28');
    expect(p).toMatchObject({ atual: 70, meta: 85, ritmoAtual: 1.6, semanasRestantes: 4, projetado: 76.4, veredito: 'nao_bate', ritmoNecessario: 3.8 });
    expect(projetarMeta(serie.slice(0, 2), 85, '2026-11-30')).toBeUndefined();
  });

  it('vence em até 2 dias úteis, sem contar o que já terminou', () =>
  {
    const lista = vencendoEm48h([
      { codigo: 'A', vencimento: '2026-11-13', responsaveis: [], origens: [] },
      { codigo: 'B', previsao: '2026-11-16', responsaveis: [], origens: [] },
      { codigo: 'C', vencimento: '2026-11-12', situacao: 'concluido', responsaveis: [], origens: [] },
      { codigo: 'D', vencimento: '2026-11-10', responsaveis: [], origens: [] },
    ], '2026-11-12', ['2026-11-15']);
    expect(lista.map((v) => [v.card.codigo, v.tipo, v.diasUteis])).toEqual([['A', 'vencimento', 1], ['B', 'previsão', 2]]);
  });
});
