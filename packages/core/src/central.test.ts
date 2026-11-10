import { describe, expect, it } from 'vitest';
import { acoesDeHoje, linhaDoTempo, mensagemTeams } from './central';
import { compararSemanas } from './analise';
import { dicionarioPadrao, lerDicionario, montarPacote } from './pacote';
import type { CardSnapshot, PlanoSemana, Risco, Snapshot } from './tipos';

const card = (codigo: string, extra: Partial<CardSnapshot> = {}): CardSnapshot => ({ codigo, responsaveis: [], origens: ['em_execucao'], ...extra });
const foto = (data: string, cards: CardSnapshot[] = [], totais = {}): Snapshot => ({ data, totais, cards });
const pessoas = [{ id: 'ana', nome: 'Ana Souza', capacidadeHorasSemana: 40 }];
const base = { alertas: [], riscos: [], promessasDaSemana: [], promessasAnteriores: [] };

describe('acoesDeHoje', () =>
{
  it('pede foto e plano quando a semana está vazia', () =>
  {
    const acoes = acoesDeHoje({ ...base, hoje: '2026-11-10', inicio: '2026-11-09', fotos: [] });
    expect(acoes.map((a) => a.destino)).toEqual(['painel', 'semana']);
    expect(acoes.every((a) => a.nivel === 'alto')).toBe(true);
  });

  it('avisa foto velha, plano sem confirmar e fechamento na sexta', () =>
  {
    const plano: PlanoSemana = { inicio: '2026-11-09', pessoas: [] };
    const acoes = acoesDeHoje({ ...base, hoje: '2026-11-13', inicio: '2026-11-09', fotos: [foto('2026-11-09')], plano });
    expect(acoes.map((a) => a.texto)).toEqual([
      'É sexta: falta fechar a semana.',
      'A última foto do painel é de 09/11 (4 dias úteis atrás).',
      'O plano da semana está começado, mas não foi confirmado.',
    ]);
  });

  it('cobra decisão vencida e compromissos sem situação', () =>
  {
    const risco = { id: 'r', descricao: 'x', origem: 'manual', probabilidade: 'alta', impacto: 'alto', gatilho: '', planoB: '', decisaoNecessaria: 'Aceitar entrega parcial', prazoDecisao: '2026-11-09', sinalizadoEm: '2026-11-09', status: 'aberto' } satisfies Risco;
    const plano: PlanoSemana = { inicio: '2026-11-09', confirmadoEm: '2026-11-09', pessoas: [] };
    const acoes = acoesDeHoje({
      ...base, hoje: '2026-11-10', inicio: '2026-11-09', fotos: [foto('2026-11-10')], plano, riscos: [risco],
      promessasAnteriores: [{ id: 'p', semana: '2026-11-02', texto: 'a' }],
    });
    expect(acoes.map((a) => a.texto)).toEqual([
      'Decisão vencida em 09/11: Aceitar entrega parcial',
      'Marque se 1 compromisso da semana passada foi cumprido.',
    ]);
  });

  it('diz que está tudo em dia', () =>
  {
    const plano: PlanoSemana = { inicio: '2026-11-09', confirmadoEm: '2026-11-09', pessoas: [] };
    expect(acoesDeHoje({ ...base, hoje: '2026-11-10', inicio: '2026-11-09', fotos: [foto('2026-11-10')], plano })).toEqual([{ nivel: 'ok', texto: 'Tudo em dia por aqui.' }]);
  });
});

describe('linhaDoTempo', () =>
{
  it('mostra o movimento dos cards entre fotos e as entregas da semana', () =>
  {
    const fotos = [
      foto('2026-11-06', [card('DEV-1', { etapasConcluidas: 2, etapasTotal: 5, previsao: '2026-11-10', ritmoPainel: 'no_ritmo' }), card('DEV-2')]),
      foto('2026-11-11', [card('DEV-1', { etapasConcluidas: 3, etapasTotal: 5, previsao: '2026-11-12', ritmoPainel: 'em_risco' }), card('DEV-3')]),
    ];
    const plano: PlanoSemana = {
      inicio: '2026-11-09', confirmadoEm: '2026-11-09',
      pessoas: [{ pessoaId: 'ana', itens: [{ id: '1', cardCodigo: 'DEV-1', descricao: 'Testes', tipo: 'planejado', status: 'feito', entregueEm: '2026-11-10' }] }],
    };
    expect(linhaDoTempo(fotos, plano, [], pessoas, '2026-11-09').map((e) => `${e.data} ${e.texto}`)).toEqual([
      '2026-11-11 Foto do painel colada: 2 cards e 0 números.',
      '2026-11-11 DEV-1 avançou de 2 para 3 de 5 etapas.',
      '2026-11-11 Entraram em execução: DEV-3.',
      '2026-11-11 Saíram da execução: DEV-2.',
      '2026-11-11 O painel mudou a previsão de DEV-1: 10/11 para 12/11.',
      '2026-11-11 DEV-1 passou de no ritmo para em risco.',
      '2026-11-10 Ana entregou DEV-1: Testes.',
      '2026-11-09 Plano da semana confirmado.',
    ]);
  });
});

describe('mensagemTeams', () =>
{
  it('monta a mensagem curta com semáforo, fatos, risco e decisão', () =>
  {
    const risco = { id: 'r', descricao: 'DEV-198 pode passar do vencimento', origem: 'manual', probabilidade: 'alta', impacto: 'alto', gatilho: '', planoB: 'Entrega parcial', decisaoNecessaria: 'Aceitar entrega parcial', prazoDecisao: '2026-11-12', sinalizadoEm: '2026-11-09', status: 'aberto' } satisfies Risco;
    const texto = mensagemTeams({
      inicio: '2026-11-09',
      totais: { dentroDoPrazoPct: 70, concluidos: 125, itensCronograma: 212, ritmoAtrasadas: 3, ritmoEmRisco: 11 },
      totaisAnteriores: { concluidos: 118 },
      meta: 85,
      semaforo: 'vermelho',
      kpis: { planejados: 7, feitos: 3, pctFeitos: 43, naoPlanejadosFeitos: 1, alterados: 3, feitosComLimite: 4, dentroDoCronograma: 3, pctDentroDoCronograma: 75 },
      frases: [],
      alertas: [{ nivel: 'alto', texto: 'DEV-198: entrega passa do vencimento', pessoaId: 'ana' }],
      riscos: [risco],
    });
    expect(texto).toBe([
      '[VERMELHO] Semana 09/11 a 13/11 - dentro do prazo 70% (meta 85%, -15 pp)',
      '- Concluídos no cronograma: 125 de 212 (+7 na semana)',
      '- Plano da semana: 3 de 7 itens feitos (43%)',
      '- Ritmo: 3 atrasadas e 11 em risco',
      'Atenção: DEV-198: entrega passa do vencimento',
      'Risco: DEV-198 pode passar do vencimento. Plano B: Entrega parcial',
      'Preciso de decisão: Aceitar entrega parcial (até 12/11)',
      'Detalhes no relatório anexo.',
    ].join('\n'));
  });
});

describe('pacote para IA', () =>
{
  it('lê o dicionário linha a linha', () =>
  {
    expect(lerDicionario('Previsão: data estimada\nlinha solta\nRitmo: no ritmo: ok')).toEqual([['Previsão', 'Data estimada'], ['Ritmo', 'No ritmo: ok']]);
    expect(lerDicionario(dicionarioPadrao).length).toBeGreaterThan(15);
  });

  it('traz regras, dicionário, números e plano', () =>
  {
    const atual = { inicio: '2026-11-09', foto: foto('2026-11-09', [], { dentroDoPrazoPct: 70 }), plano: { inicio: '2026-11-09', pessoas: [{ pessoaId: 'ana', itens: [{ id: '1', descricao: 'Testes', tipo: 'planejado' as const, status: 'feito' as const, horasEstimadas: 8 }] }] } };
    const anterior = { inicio: '2026-11-02', foto: foto('2026-11-02', [], { dentroDoPrazoPct: 68 }) };
    const texto = montarPacote({
      area: 'Desenvolvimento', prefixo: 'DEV', inicio: '2026-11-09', dicionario: 'Previsão: data estimada',
      comp: compararSemanas(atual, anterior, pessoas), fotos: [anterior.foto, atual.foto], plano: atual.plano, pessoas,
      alertas: [], riscos: [], promessasAnteriores: [], promessasDaSemana: [], frases: [], notas: {},
    });
    expect(texto).toContain('Use somente os números deste pacote');
    expect(texto).toContain('- **Previsão**: Data estimada');
    expect(texto).toContain('| Dentro do prazo (%) | 68% | 70% | +2 pp |');
    expect(texto).toContain('| Dentro do prazo (%) | 2 | 69 | 69 | 1,4 | 68 | 70 | +2 | 70 |');
    expect(texto).toContain('- [feito] sem card Testes');
  });
});

describe('mensagemTeams sem repetir decisão', () =>
{
  it('não repete a decisão do risco quando ela já está nas notas', () =>
  {
    const risco = { id: 'r', descricao: 'x', origem: 'manual', probabilidade: 'alta', impacto: 'alto', gatilho: '', planoB: 'y', decisaoNecessaria: 'Aceitar entrega parcial', sinalizadoEm: '2026-11-09', status: 'aberto' } satisfies Risco;
    const texto = mensagemTeams({ inicio: '2026-11-09', totais: {}, frases: [], alertas: [], riscos: [risco], decisoes: '- Aceitar entrega parcial do DEV-198 até 10/11.' });
    expect(texto.split('\n').filter((l) => l.startsWith('Preciso de decisão'))).toEqual(['Preciso de decisão: Aceitar entrega parcial do DEV-198 até 10/11.']);
  });
});
