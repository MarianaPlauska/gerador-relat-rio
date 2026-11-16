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
});
