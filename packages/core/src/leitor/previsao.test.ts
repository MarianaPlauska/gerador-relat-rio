import { describe, expect, it } from 'vitest';
import type { CardSnapshot, Pessoa, Snapshot } from '../tipos';
import { calcularCalibracaoPessoa, calibrarProbabilidade, normalCdf } from './calibracao';
import { analisarTimeNoProjeto } from './equipe-analise';
import { montarGanttSemana } from './gantt';
import type { ResumoPessoaProjeto, TarefaPessoaSemana } from './equipe-analise';

const mari: Pessoa = { id: 'mariana', nome: 'Mariana Coutinho', capacidadeHorasSemana: 40 };
const rod: Pessoa = { id: 'rodrigo', nome: 'Rodrigo Cinelli', capacidadeHorasSemana: 40 };

const card = (codigo: string, extra: Partial<CardSnapshot> = {}): CardSnapshot => ({ codigo, responsaveis: ['mariana'], responsavelEtapaAtual: 'mariana', origens: ['demandas'], ...extra });
const foto = (data: string, cards: CardSnapshot[]): Snapshot => ({ data, pasta: 'DEV', totais: {}, cards });
const meu = (c: CardSnapshot) => c.responsavelEtapaAtual === 'mariana';

describe('calibração pelo histórico', () =>
{
  it('normalCdf bate com valores conhecidos', () =>
  {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 2);
  });

  it('conta as horas fechadas a cada semana e ignora a primeira (que traz o passado todo)', () =>
  {
    const fotos = [
      foto('2026-11-02', [card('DEV-1', { situacao: 'concluido', tempoTotalMin: 600 }), card('DEV-2'), card('DEV-3')]),
      foto('2026-11-09', [card('DEV-1', { situacao: 'concluido', tempoTotalMin: 600 }), card('DEV-2', { situacao: 'concluido', tempoTotalMin: 360 }), card('DEV-3')]),
      foto('2026-11-16', [card('DEV-2', { situacao: 'concluido', tempoTotalMin: 360 }), card('DEV-3', { statusCard: 'Resolvido', tempoTotalMin: 120 })]),
    ];
    const cal = calcularCalibracaoPessoa(fotos, meu);
    expect(cal.horasPorSemana).toEqual([{ semana: '2026-11-09', horas: 6 }, { semana: '2026-11-16', horas: 2 }]);
    expect(cal.semanasAmostra).toBe(2);
    expect(cal.velocidadeMediaHorasSemana).toBe(4);
    expect(cal.confiancaPct).toBe(50);
    expect(cal.desvioHorasSemana).toBeCloseTo(2.8, 1);
  });

  it('sem histórico a probabilidade fica como a heurística; com histórico baixo, cai', () =>
  {
    const vazio = calcularCalibracaoPessoa([], meu);
    expect(calibrarProbabilidade({ probabilidadeBasePct: 70, cargaHoras: 10, capacidadeHoras: 40, calibracao: vazio }).probabilidadePct).toBe(70);
    const lento = { semanasAmostra: 4, velocidadeMediaHorasSemana: 12, desvioHorasSemana: 2, confiancaPct: 100, usouHistorico: true, horasPorSemana: [] };
    const r = calibrarProbabilidade({ probabilidadeBasePct: 70, cargaHoras: 20, capacidadeHoras: 40, calibracao: lento });
    expect(r.capacidadeCalibradaHoras).toBe(12);
    expect(r.probabilidadePct).toBeLessThan(10);
    expect(r.horasLivresCalibradas).toBe(0);
    const rapido = { ...lento, velocidadeMediaHorasSemana: 38, desvioHorasSemana: 3 };
    expect(calibrarProbabilidade({ probabilidadeBasePct: 70, cargaHoras: 10, capacidadeHoras: 40, calibracao: rapido }).probabilidadePct).toBeGreaterThan(90);
  });

  it('a análise do time usa a velocidade real e expõe a calibração', () =>
  {
    const fotos = [
      foto('2026-11-02', [card('DEV-1', { situacao: 'concluido' }), card('DEV-2', { etapaAtual: 'x' })]),
      foto('2026-11-09', [card('DEV-1', { situacao: 'concluido' }), card('DEV-2', { situacao: 'concluido', tempoTotalMin: 120 }), card('DEV-3', { statusCard: 'Em andamento', situacao: 'em_execucao', prioridadeCard: 'Média' })]),
    ];
    const [r] = analisarTimeNoProjeto({ pessoas: [mari], fotos, planos: [], pasta: 'DEV', semanaInicio: '2026-11-09', semanaFim: '2026-11-13', hoje: '2026-11-10' });
    expect(r!.calibracao.usouHistorico).toBe(true);
    expect(r!.calibracao.semanasAmostra).toBe(1);
    expect(r!.calibracao.velocidadeMediaHorasSemana).toBe(2);
    expect(r!.horasLivresCalibradas).toBeLessThanOrEqual(r!.horasLivresEstimadas);
    expect(r!.probabilidadeBasePct).toBeGreaterThan(0);
  });
});

const tarefa = (codigo: string, horas: number, extra: Partial<TarefaPessoaSemana> = {}): TarefaPessoaSemana => ({ codigo, titulo: codigo, assunto: `Assunto ${codigo}`, horasEstimadas: horas, situacao: 'a_iniciar', ...extra });
const resumo = (pessoa: Pessoa, tarefas: TarefaPessoaSemana[], extra: Partial<ResumoPessoaProjeto> = {}): ResumoPessoaProjeto => ({
  pessoa, total: tarefas.length, noRitmo: 0, emRisco: 0, atrasado: 0, concluidos: 0, tarefas, etapasEmAndamento: [], frentes: [], quandoLivre: '', livreCedo: false, sugestoesAjuda: [],
  rendimentoSemanaPct: 0, rendimentoAcumuladoPct: 0, horasEstipuladasSemana: 0, capacidadeHorasSemana: 40, horasLivresEstimadas: 0, nivelEntregaPct: 0, nivelDemora: 'baixo', motivoDemora: '', horasRodandoMax: 0,
  probabilidadeMaisServicosPct: 0, probabilidadeBasePct: 0, horasLivresCalibradas: 0, calibracao: { semanasAmostra: 0, velocidadeMediaHorasSemana: 0, desvioHorasSemana: 0, confiancaPct: 0, usouHistorico: false, horasPorSemana: [] },
  servicosExtrasSugeridos: 0, acumuladoSemanas: { semanasAtivas: 0, totalDemandas: 0, entregasNoPrazo: 0 }, ...extra,
});

describe('cronograma semanal (Gantt)', () =>
{
  const opc = { semanaInicio: '2026-11-16', hoje: '2026-11-16' };

  it('enfileira por prioridade, em andamento primeiro, em jornadas de 8 h', () =>
  {
    const g = montarGanttSemana([resumo(mari, [
      tarefa('DEV-10', 6, { prioridadeCard: 'Baixa' }),
      tarefa('DEV-11', 10, { prioridadeCard: 'Crítica' }),
      tarefa('DEV-12', 4, { statusCard: 'Em andamento', situacao: 'em_execucao', prioridadeCard: 'Média' }),
      tarefa('DEV-13', 5, { situacao: 'concluido' }),
    ])], opc);
    const linha = g.linhas[0]!;
    expect(g.dias.map((d) => d.iso)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(linha.barras.map((b) => b.codigo)).toEqual(['DEV-12', 'DEV-11', 'DEV-10']);
    expect(linha.barras[0]!.segmentos).toEqual([{ dia: 0, de: 0, ate: 4 }]);
    expect(linha.barras[1]!.segmentos).toEqual([{ dia: 0, de: 4, ate: 8 }, { dia: 1, de: 0, ate: 6 }]);
    expect(linha.barras[1]!.iniciaApos).toBe('DEV-12');
    expect(linha.barras[2]!.segmentos).toEqual([{ dia: 1, de: 6, ate: 8 }, { dia: 2, de: 0, ate: 4 }]);
    expect(linha.livreAPartirDe).toEqual({ dia: 2, hora: 4 });
    expect(linha.horasLivresSemana).toBe(20);
    expect(g.dependencias.filter((d) => d.motivo === 'mesma_pessoa')).toHaveLength(2);
  });

  it('o que não cabe vai para além da semana e marca prazo estourado', () =>
  {
    const g = montarGanttSemana([resumo(mari, [tarefa('DEV-1', 30, { previsao: '2026-11-18' }), tarefa('DEV-2', 20, { vencimento: '2026-11-20' })])], opc);
    const [a, b] = g.linhas[0]!.barras;
    expect(a!.estouraPrazo).toBe(true);
    expect(a!.terminaNoDia).toBe(3);
    expect(b!.horasAlemDaSemana).toBe(10);
    expect(b!.estouraPrazo).toBe(true);
    expect(g.linhas[0]!.horasAlemDaSemana).toBe(10);
    expect(g.linhas[0]!.sobrecarga).toBe(true);
    expect(g.linhas[0]!.livreAPartirDe).toBeUndefined();
  });

  it('no meio da semana a fila começa em hoje e os dias passados ficam vazios', () =>
  {
    const g = montarGanttSemana([resumo(mari, [tarefa('DEV-1', 8)])], { semanaInicio: '2026-11-16', hoje: '2026-11-18' });
    expect(g.dias.map((d) => d.passado)).toEqual([true, true, false, false, false]);
    expect(g.linhas[0]!.barras[0]!.segmentos[0]!.dia).toBe(2);
    expect(g.linhas[0]!.horasLivresSemana).toBe(16);
  });

  it('relacionadas de pessoas diferentes que rodam juntas viram conflito', () =>
  {
    const g = montarGanttSemana([
      resumo(mari, [tarefa('DEV-1', 8, { cardsRelacionados: ['DEV-2'] })]),
      resumo(rod, [tarefa('DEV-2', 8, { cardsRelacionados: ['DEV-1'] })]),
    ], opc);
    const rel = g.dependencias.filter((d) => d.motivo === 'relacionada');
    expect(rel).toHaveLength(1);
    expect(rel[0]!.conflito).toBe(true);
  });

  it('feriado e ausência da pessoa são dias sem expediente: a fila pula esses dias', () =>
  {
    const emFerias: Pessoa = { ...mari, ausencias: [{ de: '2026-11-17', ate: '2026-11-18', motivo: 'férias' }] };
    const g = montarGanttSemana([resumo(emFerias, [tarefa('DEV-1', 12)]), resumo(rod, [tarefa('DEV-2', 12)])], { ...opc, feriados: ['2026-11-20'] });
    expect(g.dias.map((d) => d.feriado)).toEqual([false, false, false, false, true]);
    const [lm, lr] = g.linhas;
    expect(lm!.semExpediente).toEqual([null, 'ausencia', 'ausencia', null, 'feriado']);
    // segunda tem 8 h; terça e quarta ausentes; as 4 h restantes caem na quinta
    expect(lm!.barras[0]!.segmentos).toEqual([{ dia: 0, de: 0, ate: 8 }, { dia: 3, de: 0, ate: 4 }]);
    expect(lm!.livreAPartirDe).toEqual({ dia: 3, hora: 4 });
    // 3 dias de expediente (seg, qui + sem sexta): 16 h menos 12 h
    expect(lm!.horasLivresSemana).toBe(4);
    // quem não está ausente só perde o feriado
    expect(lr!.semExpediente).toEqual([null, null, null, null, 'feriado']);
    expect(lr!.barras[0]!.segmentos).toEqual([{ dia: 0, de: 0, ate: 8 }, { dia: 1, de: 0, ate: 4 }]);
    // segunda a quinta são 32 h de expediente, menos as 12 h da tarefa
    expect(lr!.horasLivresSemana).toBe(20);
  });

  it('semana inteira de ausência manda tudo para depois da semana', () =>
  {
    const g = montarGanttSemana([resumo({ ...mari, ausencias: [{ de: '2026-11-16', ate: '2026-11-20' }] }, [tarefa('DEV-1', 6)])], opc);
    expect(g.linhas[0]!.barras[0]).toMatchObject({ segmentos: [], horasAlemDaSemana: 6 });
    expect(g.linhas[0]!.horasLivresSemana).toBe(0);
    expect(g.linhas[0]!.livreAPartirDe).toBeUndefined();
  });

  it('a ordem escolhida à mão vem antes da automática e o resto segue a regra', () =>
  {
    const tarefas = [
      tarefa('DEV-1', 4, { prioridadeCard: 'Crítica' }),
      tarefa('DEV-2', 4, { prioridadeCard: 'Baixa' }),
      tarefa('DEV-3', 4, { prioridadeCard: 'Média' }),
    ];
    const automatica = montarGanttSemana([resumo(mari, tarefas)], opc).linhas[0]!.barras.map((b) => b.codigo);
    expect(automatica).toEqual(['DEV-1', 'DEV-3', 'DEV-2']);
    const manual = montarGanttSemana([resumo(mari, tarefas)], { ...opc, ordemManual: { [mari.id]: ['DEV-2', 'DEV-3'] } }).linhas[0]!;
    expect(manual.barras.map((b) => b.codigo)).toEqual(['DEV-2', 'DEV-3', 'DEV-1']);
    expect(manual.barras[1]!.iniciaApos).toBe('DEV-2');
  });
});
