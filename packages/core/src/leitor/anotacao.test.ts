import { describe, expect, it } from 'vitest';
import { interpretarAnotacao, sugerirDaCaptura } from './anotacao';

describe('interpretarAnotacao', () =>
{
  it('lista numerada vira etapas com descritivo e palavras da autora', () =>
  {
    const a = interpretarAnotacao('Fila parada na homologação.\n1. Cobrar Douglas no PRJ-12\n2) Revisar prazos\n- Atualizar painel');
    expect(a.resumo).toBe('Fila parada na homologação.');
    expect(a.etapas.map((e) => e.texto)).toEqual(['Cobrar Douglas no PRJ-12', 'Revisar prazos', 'Atualizar painel']);
    expect(a.etapas[0]!.cards).toEqual(['PRJ-12']);
    expect(a.etapas[0]!.descricao).toBeTruthy();
    expect(a.palavrasDaAutora).toContain('Fila parada na homologação.');
  });

  it('rótulos Resumo, Palavras da autora e Etapas', () =>
  {
    const a = interpretarAnotacao('Resumo: semana de ajustes\nPalavras da autora: Foco total nas entregas críticas.\nEtapas: validar dados; publicar relatório');
    expect(a.resumo).toBe('Semana de ajustes');
    expect(a.palavrasDaAutora).toBe('Foco total nas entregas críticas.');
    expect(a.etapas.map((e) => e.texto)).toEqual(['Validar dados', 'Publicar relatório']);
  });

  it('texto corrido é quebrado pelos conectores e cruza com os cards do painel', () =>
  {
    const a = interpretarAnotacao(
      'Três cards atrasados no Rodrigo. Primeiro vamos repriorizar a fila no DEV-10, depois falar com o cliente e por fim atualizar as datas.',
      {
        prefixo: 'DEV',
        cards: [{ codigo: 'DEV-10', titulo: 'Ajuste de login', etapaAtual: 'Homologação', responsaveis: ['rodrigo'], origens: ['em_execucao'] }],
      },
    );
    expect(a.resumo).toBe('Três cards atrasados no Rodrigo.');
    expect(a.etapas.map((e) => e.texto)).toEqual(['Repriorizar a fila no DEV-10', 'Falar com o cliente', 'Atualizar as datas']);
    expect(a.etapas[0]!.descricao).toContain('DEV-10: "Ajuste de login"');
  });

  it('sugerirDaCaptura aponta atrasos e avisos de leitura', () =>
  {
    const r = sugerirDaCaptura({
      origem: 'em_execucao',
      totais: { dentroDoPrazoPct: 60, metaPct: 80 },
      cards: [{ codigo: 'DEV-01', responsaveis: [], origens: ['em_execucao'], ritmoPainel: 'atrasado', avisosLeitura: ['código corrigido, confira'] }],
      ondas: [],
    });
    expect(r.avisos.length).toBeGreaterThan(0);
    expect(r.sugestoes.some((s) => s.includes('DEV-01'))).toBe(true);
  });

  it('agrupa tarefas por pessoa sem repetir nome e calcula rendimento semanal e acumulado por projeto', async () =>
  {
    const { agruparPorPessoa, analisarTimeNoProjeto, pessoasDoProjeto } = await import('./complemento');
    const pessoas = [
      { id: 'mariana-coutinho', nome: 'Mariana Coutinho', capacidadeHorasSemana: 40, pastas: ['DEV'] },
      { id: 'rodrigo-cinelli', nome: 'Rodrigo Cinelli', capacidadeHorasSemana: 40, pastas: ['DEV'] },
      { id: 'ana-silva', nome: 'Ana Silva', capacidadeHorasSemana: 40, pastas: ['COMERCIAL'] },
    ];
    const cardsDev = [
      { codigo: 'DEV-10', titulo: 'Tela de login', etapaAtual: 'Homologação', sistema: 'Kitu Sistema', responsavelEtapaAtual: 'mariana-coutinho', responsaveis: ['mariana-coutinho'], ritmoPainel: 'no_ritmo' as const, previsao: '2026-11-17', origens: ['em_execucao'] },
      { codigo: 'DEV-11', titulo: 'Ajuste de API', etapaAtual: 'Testes', sistema: 'SST-Web', responsavelEtapaAtual: 'mariana-coutinho', responsaveis: ['mariana-coutinho'], ritmoPainel: 'no_ritmo' as const, previsao: '2026-11-18', origens: ['em_execucao'] },
      { codigo: 'DEV-12', titulo: 'Migração banco', etapaAtual: 'Desenvolvimento', sistema: 'Kitu Sistema', responsavelEtapaAtual: 'rodrigo-cinelli', responsaveis: ['rodrigo-cinelli'], ritmoPainel: 'atrasado' as const, previsao: '2026-11-20', origens: ['em_execucao'] },
    ];

    const agrupado = agruparPorPessoa(cardsDev, pessoas);
    expect(agrupado).toHaveLength(2);
    expect(agrupado[0]!.pessoa).toBe('Mariana Coutinho');
    expect(agrupado[0]!.tarefas).toHaveLength(2);

    // Projeto COMERCIAL só traz Ana Silva + quem aparecer nos cards de COMERCIAL
    const eqComercial = pessoasDoProjeto(pessoas, [{ codigo: 'COM-01', responsavelEtapaAtual: 'Carlos Souza', responsaveis: ['Carlos Souza'], origens: ['em_execucao'] }], 'COMERCIAL');
    expect(eqComercial.map((p) => p.nome)).toEqual(['Ana Silva', 'Carlos Souza']);

    const analise = analisarTimeNoProjeto({
      pessoas,
      fotos: [
        { data: '2026-11-09', pasta: 'DEV', totais: {}, cards: [{ codigo: 'DEV-01', responsavelEtapaAtual: 'mariana-coutinho', responsaveis: ['mariana-coutinho'], ritmoPainel: 'no_ritmo', origens: ['em_execucao'] }] },
        { data: '2026-11-16', pasta: 'DEV', totais: {}, cards: cardsDev },
      ],
      planos: [],
      pasta: 'DEV',
      semanaInicio: '2026-11-16',
      semanaFim: '2026-11-20',
      hoje: '2026-11-16',
    });

    const mariana = analise.find((a) => a.pessoa.id === 'mariana-coutinho')!;
    expect(mariana.etapasEmAndamento).toEqual(['Homologação', 'Testes']);
    expect(mariana.frentes).toEqual(['Kitu Sistema', 'SST-Web']);
    expect(mariana.livreCedo).toBe(true);
    expect(mariana.sugestoesAjuda.some((s) => s.includes('Rodrigo Cinelli'))).toBe(true);
    expect(mariana.rendimentoSemanaPct).toBeGreaterThan(50);
    expect(mariana.acumuladoSemanas.semanasAtivas).toBe(2);
  });
});
