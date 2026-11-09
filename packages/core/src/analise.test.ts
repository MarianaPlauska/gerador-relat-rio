import { describe, expect, it } from 'vitest';
import { analisarSemana, compararSemanas, fotoDaSemana, historico, resumoSugerido, type DadosSemana } from './analise';
import { pessoasExemplo } from './exemplo';
import type { CardSnapshot, ItemPlano, Snapshot } from './tipos';

const card = (codigo: string, extra: Partial<CardSnapshot>): CardSnapshot => ({ codigo, responsaveis: [], origens: ['em_execucao'], ...extra });
const item = (id: string, extra: Partial<ItemPlano>): ItemPlano => ({ id, descricao: 'x', tipo: 'planejado', status: 'a_fazer', ...extra });

const fotoAnterior: Snapshot = {
  data: '2026-11-02',
  totais: { dentroDoPrazoPct: 68, metaPct: 85, concluidos: 118, ritmoAtrasadas: 5, ritmoEmRisco: 9 },
  cards: [
    card('DEV-198', { etapasConcluidas: 2, etapasTotal: 15, ritmoPainel: 'no_ritmo', previsao: '2026-11-11' }),
    card('DEV-207', { etapasConcluidas: 5, etapasTotal: 15, ritmoPainel: 'em_risco', previsao: '2026-11-06' }),
    card('DEV-100', { etapasConcluidas: 9, etapasTotal: 10 }),
  ],
};
const fotoAtual: Snapshot = {
  data: '2026-11-09',
  totais: { dentroDoPrazoPct: 70, metaPct: 85, concluidos: 125, ritmoAtrasadas: 3, ritmoEmRisco: 11 },
  cards: [
    card('DEV-198', { etapasConcluidas: 2, etapasTotal: 15, ritmoPainel: 'em_risco', previsao: '2026-11-11', vencimento: '2026-11-12' }),
    card('DEV-207', { etapasConcluidas: 7, etapasTotal: 15, ritmoPainel: 'em_risco', previsao: '2026-11-11' }),
    card('DEV-223', { etapasConcluidas: 0, etapasTotal: 4 }),
  ],
};
const atual: DadosSemana = {
  inicio: '2026-11-09',
  foto: fotoAtual,
  plano: {
    inicio: '2026-11-09',
    pessoas: [{
      pessoaId: 'mariana-coutinho',
      itens: [
        item('1', { cardCodigo: 'DEV-198', ate: '2026-11-13', horasEstimadas: 30, frente: 'Portal', dor: 'Exames' }),
        item('2', { cardCodigo: 'DEV-223', status: 'feito', entregueEm: '2026-11-10', horasEstimadas: 14, frente: 'Portal' }),
        item('3', { status: 'adiado', causa: 'dependencia_externa', frente: 'CIPA' }),
      ],
    }],
  },
};
const anterior: DadosSemana = { inicio: '2026-11-02', foto: fotoAnterior };

describe('fotoDaSemana e historico', () =>
{
  it('pega a foto mais nova da semana', () =>
  {
    const fotos = [fotoAnterior, fotoAtual, { ...fotoAtual, data: '2026-11-12' }];
    expect(fotoDaSemana(fotos, '2026-11-09')?.data).toBe('2026-11-12');
    expect(fotoDaSemana(fotos, '2026-10-26')).toBeUndefined();
  });

  it('monta a série de um indicador', () =>
  {
    expect(historico([fotoAtual, fotoAnterior], 'dentroDoPrazoPct')).toEqual([{ data: '2026-11-02', valor: 68 }, { data: '2026-11-09', valor: 70 }]);
  });
});

describe('compararSemanas', () =>
{
  const comp = compararSemanas(atual, anterior, pessoasExemplo);

  it('separa cards que entraram, saíram e mudaram', () =>
  {
    expect(comp.entraram).toEqual(['DEV-223']);
    expect(comp.sairam).toEqual(['DEV-100']);
    expect(comp.cards.find((c) => c.codigo === 'DEV-207')).toMatchObject({ etapasAntes: 5, etapasDepois: 7, previsaoAntes: '2026-11-06', previsaoDepois: '2026-11-11' });
  });

  it('calcula o plano por pessoa', () =>
  {
    const m = comp.pessoas.find((p) => p.pessoa.id === 'mariana-coutinho')!;
    expect(m.horas).toBe(44);
    expect(m.atual.feitos).toBe(1);
    expect(m.alertas).toBe(2);
  });
});

describe('analisarSemana', () =>
{
  const comp = compararSemanas(atual, anterior, pessoasExemplo);
  const frases = analisarSemana(comp, atual, anterior, [{ id: 'p', semana: '2026-11-02', texto: 'x', cumprida: true }]);
  const textos = frases.map((f) => f.texto);

  it('escreve as comparações com os números do painel', () =>
  {
    expect(textos).toContain('Dentro do prazo em 70% (+2 pp na semana), 15 pp abaixo da meta de 85%.');
    expect(textos).toContain('7 itens concluídos no cronograma desde 02/11 (de 118 para 125).');
    expect(textos).toContain('Demandas atrasadas no ritmo caíram de 5 para 3.');
    expect(textos).toContain('Demandas em risco subiram de 9 para 11.');
  });

  it('aponta plano, sobrecarga, cards parados e mudanças do painel', () =>
  {
    expect(textos).toContain('Plano da semana: 1 de 3 itens feitos (33%).');
    expect(textos).toContain('1 item teve data mudada ou foram adiados; causa mais citada: dependência externa (1).');
    expect(textos).toContain('Mariana Coutinho está com 44h planejadas para 40h de capacidade.');
    expect(textos).toContain('Sem avanço de etapa desde 02/11: DEV-198.');
    expect(textos).toContain('Pioraram de ritmo: DEV-198 (no ritmo para em risco).');
    expect(textos).toContain('O painel mudou a previsão de 1 card: DEV-207 (06/11 para 11/11).');
    expect(textos).toContain('Saíram da execução (concluídos ou pausados): DEV-100.');
    expect(textos).toContain('1 de 1 compromissos da semana anterior cumpridos.');
    expect(textos).toContain('Time atuando em 2 frentes e 1 dor.');
  });

  it('o resumo começa pelo prazo e traz o que pede atenção', () =>
  {
    const r = resumoSugerido(frases);
    expect(r.startsWith('Dentro do prazo em 70%')).toBe(true);
    expect(r).toContain('Demandas em risco subiram de 9 para 11.');
  });
});
