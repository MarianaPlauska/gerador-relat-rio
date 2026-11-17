import { describe, expect, it } from 'vitest';
import { pessoasExemplo } from '../exemplo';
import { lerCards } from './cards';
import { analisarTimeNoProjeto, calcularPeriodoHistoricoPessoa, pessoasDoProjeto } from './complemento';
import { calcularMetricasAutomaticasDosCards, consolidarArvoreDeCards, correlacionarCapturaComArvore, ordenarCardsResumidos } from './correlacao';

describe('Correlação por Vetores e Árvore entre as 3 Imagens (Lista -> Pedido -> Etapas)', () =>
{
  const print1ListaDemandas = [
    'ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
    'DEV-274 — Kitu Sistema Ajuste no BD: Fazer as seguintes validações: se mesmo Rodrigo Cinelli 0 min Em andamento',
    '18/11/26 cpf, então passar para o próximo campo; Se matrícula...',
    'DEV-047 — Kitu Sistema CNPJ alfanumérico O sistema já está preparado para os Rodrigo Cinelli 0 min Resolvido',
    '18/11/26 CNPJs alfanuméricos (ref.: Receita Federal)',
    'DEV-284 — Kitu Sistema Colocar histórico do que cada usuário fez no sistema (no Douglas 0 min Novo',
    '17/11/26 painel incial do DEV) pelo menos dentro de 15 dias. Cerqueira',
    'DEV-280 — Kitu Sistema Na página de clientes, não está buscando de fato pelo Douglas 0 min Novo',
    '17/11/26 Baixa nome fantasia ou qualquer informação que case na... Cerqueira',
    'DEV-277 — Kitu Sistema FAZER O FLUXO DO AGENDAMENTO SEGUNDO O FLUXO Douglas 0 min Novo',
    '17/11/26 Alta Cerqueira',
    'DEV-279 — Kitu Sistema Fazer comparativo das planilhas de credenciadas Douglas 0 min Novo',
    '17/11/26 Crítica enviadas vs Planilha da nossa própria página. Cerqueira',
  ].join('\n');

  const print2DetalhePedido = [
    'DEV-274 DEV',
    'TIME ABERTURA',
    'DEV — Desenvolvedores 18/11/2026 11:32',
    'Travada: o card já teve alteração. Só o gestor corrige a abertura.',
    'TIPO DE DEMANDA',
    'Kitu Sistema',
    'O QUE FOI PEDIDO Editar',
    'Ajuste no BD:',
    'Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;',
    'Se matrícula igual, então finaliza e não aceita subir essa pessoa;',
    'Se matrícula diferente, então verificar o cargo/função;',
    'Se diferentes, pessoa entra no BD com duas matrículas; Se iguais, cancelar.',
    'Atenção em como exibir isso no cadastro de funcionários.',
  ].join('\n');

  const print3EtapasSemCodigo = [
    'Etapas 0 de 3 concluídas · ocioso entre etapas: 0 min úteis (0%)',
    '# ETAPA RESPONSÁVEL TEMPO',
    '1 Validação dos requisitos Rodrigo Cinelli • rodando há 15,8 h Concluir Subtarefa',
    'desde 16/11/2026 16:25',
    '+ o que vai fazer + pessoa',
    '2 Implementação Rodrigo Cinelli • rodando há 15,8 h Concluir Subtarefa',
    'desde 16/11/2026 16:25',
    '+ o que vai fazer + pessoa',
    '3 Concluir Rodrigo Cinelli não iniciada Concluir card',
    '+ o que vai fazer',
  ].join('\n');

  it('lê a Imagem 1 (lista geral), a Imagem 2 (pedido completo) e a Imagem 3 (etapas sem ID) e monta a árvore unificada', () =>
  {
    // 1. Lê Imagem 1 (Vetor Pai A)
    const cardsImg1 = lerCards(print1ListaDemandas, { prefixo: 'DEV', pessoas: pessoasExemplo });
    expect(cardsImg1.map((c) => c.codigo)).toEqual(['DEV-274', 'DEV-047', 'DEV-284', 'DEV-280', 'DEV-277', 'DEV-279']);
    expect(cardsImg1.find((c) => c.codigo === 'DEV-279')?.prioridadeCard).toBe('Crítica');
    expect(cardsImg1.find((c) => c.codigo === 'DEV-277')?.prioridadeCard).toBe('Alta');
    expect(cardsImg1.find((c) => c.codigo === 'DEV-280')?.prioridadeCard).toBe('Baixa');

    // 2. Lê Imagem 2 (Vetor Filho B1 - O que foi pedido) e correlaciona com a árvore
    const cardsImg2Brutos = lerCards(print2DetalhePedido, { prefixo: 'DEV', pessoas: pessoasExemplo });
    const corr2 = correlacionarCapturaComArvore(cardsImg2Brutos, cardsImg1, [], pessoasExemplo);
    expect(corr2.cardPaiVinculado).toBe('DEV-274');
    expect(corr2.cards[0]!.descricaoCompleta).toContain('pessoa entra no BD com duas matrículas');
    expect(corr2.cards[0]!.aberturaHora).toBe('11:32');

    const arvoreApos2 = consolidarArvoreDeCards([...cardsImg1, ...corr2.cards]);

    // 3. Lê Imagem 3 (Vetor Filho B2 - Etapas sem código DEV-274 no recorte) e correlaciona automaticamente a DEV-274
    const cardsImg3Brutos = lerCards(print3EtapasSemCodigo, { prefixo: 'DEV', pessoas: pessoasExemplo });
    expect(cardsImg3Brutos).toHaveLength(1);
    expect(cardsImg3Brutos[0]!.codigo).toBe('__ORFAO__');
    expect(cardsImg3Brutos[0]!.etapas).toHaveLength(3);
    expect(cardsImg3Brutos[0]!.etapas![0]!.tempoRodandoHoras).toBe(15.8);

    const corr3 = correlacionarCapturaComArvore(
      cardsImg3Brutos,
      arvoreApos2,
      [{ id: 'cap2', nome: 'Print 2', origem: 'card', texto: print2DetalhePedido, totais: [], cards: ['DEV-274'], ondas: 0, avisos: [], sugestoes: [], cardPaiVinculado: 'DEV-274' }],
      pessoasExemplo,
    );
    expect(corr3.cardPaiVinculado).toBe('DEV-274');
    expect(corr3.confiancaVinculoPct).toBeGreaterThanOrEqual(85);

    const arvoreFinal = consolidarArvoreDeCards([...arvoreApos2, ...corr3.cards]);
    const dev274 = arvoreFinal.find((c) => c.codigo === 'DEV-274')!;
    expect(dev274.descricaoCompleta).toContain('Se matrícula diferente, então verificar o cargo/função');
    expect(dev274.etapas).toHaveLength(3);
    expect(dev274.etapas![0]!.nome).toBe('Validação dos requisitos');
    expect(dev274.etapas![1]!.nome).toBe('Implementação');
    expect(dev274.etapas![2]!.nome).toBe('Concluir');
    expect(dev274.fontesCorrelacionadas).toEqual(['lista', 'pedido', 'etapas']);

    // 4. Verifica análise probabilística da equipe (tempo estipulado, demora e probabilidade de mais serviços)
    const analise = analisarTimeNoProjeto({
      pessoas: pessoasExemplo,
      fotos: [{ data: '2026-11-17', pasta: 'DEV', totais: {}, cards: arvoreFinal }],
      planos: [],
      pasta: 'DEV',
      semanaInicio: '2026-11-16',
      semanaFim: '2026-11-20',
      hoje: '2026-11-17',
    });

    const rodrigo = analise.find((a) => a.pessoa.id === 'rodrigo-cinelli')!;
    const douglas = analise.find((a) => a.pessoa.id === 'douglas-cerqueira')!;

    expect(rodrigo.horasRodandoMax).toBe(15.8);
    expect(rodrigo.nivelDemora).toBe('alto');
    expect(rodrigo.tarefas.find((t) => t.codigo === 'DEV-274')?.etapas).toHaveLength(3);
    // Douglas tem 4 demandas novas (incluindo Crítica e Alta), logo tem mais horas estipuladas na fila que Rodrigo
    expect(douglas.horasEstipuladasSemana).toBeGreaterThan(rodrigo.horasEstipuladasSemana);
    expect(rodrigo.probabilidadeMaisServicosPct).toBeGreaterThan(douglas.probabilidadeMaisServicosPct);

    // 5. Verifica geração automática de descrição nas etapas, cálculo automático de métricas e gráfico em linha
    expect(dev274.etapas![0]!.descricao).toBeTruthy();
    const dev284 = arvoreFinal.find((c) => c.codigo === 'DEV-284')!;
    expect(dev284.etapas).toHaveLength(3);
    expect(dev284.etapas![0]!.descricao).toContain('Colocar histórico');
    expect(dev284.impactoSemana).toBeTruthy();

    const metricas = calcularMetricasAutomaticasDosCards(arvoreFinal, {}, pessoasExemplo);
    expect(metricas.totais.itensCronograma).toBe(6);
    expect(metricas.totais.concluidos).toBe(1);
    expect((metricas.totais.ritmoEmRisco ?? 0) + (metricas.totais.ritmoAtrasadas ?? 0)).toBeGreaterThan(0);
    expect(metricas.gargalosDemora.length).toBeGreaterThan(0);
    expect(metricas.pontosDeAtencao.length).toBeGreaterThan(0);
    expect(metricas.serieGraficoLinha).toHaveLength(6);

    // 6. Verifica organizador (maior para menor código, prioridade, nomes parecidos)
    const porCodigoDesc = ordenarCardsResumidos(arvoreFinal, 'card_maior');
    expect(porCodigoDesc[0]!.codigo).toBe('DEV-284');
    expect(porCodigoDesc.at(-1)!.codigo).toBe('DEV-047');

    // 7. Verifica remoção de pessoa mantendo período histórico (Dia X ao Dia Y)
    const periodoRodrigo = calcularPeriodoHistoricoPessoa(
      pessoasExemplo[0]!,
      [
        { data: '2026-11-10', pasta: 'DEV', totais: {}, cards: arvoreFinal },
        { data: '2026-11-17', pasta: 'DEV', totais: {}, cards: arvoreFinal },
      ],
      [],
      '2026-11-17',
    );
    expect(periodoRodrigo).toEqual({ de: '2026-11-10', ate: '2026-11-17' });

    const pessoasComRodrigoRemovido = pessoasExemplo.map((p) =>
      p.id === 'rodrigo-cinelli' ? { ...p, pastasRemovidas: ['DEV'] } : p,
    );
    const ativosDev = pessoasDoProjeto(pessoasComRodrigoRemovido, arvoreFinal, 'DEV');
    expect(ativosDev.some((p) => p.id === 'rodrigo-cinelli')).toBe(false);
  });
});
