import { describe, expect, it } from 'vitest';
import { qualificarPessoa, type ResumoPessoaProjeto, type TarefaPessoaSemana } from './equipe-analise';

const tarefa = (extra: Partial<TarefaPessoaSemana> = {}): TarefaPessoaSemana =>
  ({ codigo: 'DEV-001', titulo: 'x', assunto: 'x', horasEstimadas: 8, ...extra });

const base = (extra: Partial<ResumoPessoaProjeto> = {}): ResumoPessoaProjeto => ({
  pessoa: { id: 'p', nome: 'Pessoa', capacidadeHorasSemana: 40 },
  total: 4, noRitmo: 4, emRisco: 0, atrasado: 0, concluidos: 0,
  tarefas: [tarefa()], etapasEmAndamento: [], frentes: [], quandoLivre: 'sexta', livreCedo: false, sugestoesAjuda: [],
  rendimentoSemanaPct: 100, rendimentoAcumuladoPct: 100,
  horasEstipuladasSemana: 16, capacidadeHorasSemana: 40, horasLivresEstimadas: 24,
  nivelEntregaPct: 100, nivelDemora: 'baixo', motivoDemora: 'Nada parado há muito tempo', horasRodandoMax: 4,
  probabilidadeMaisServicosPct: 70, probabilidadeBasePct: 70, horasLivresCalibradas: 24,
  calibracao: { usouHistorico: false, velocidadeMediaHorasSemana: 0, semanasAmostra: 0, confiancaPct: 0 },
  servicosExtrasSugeridos: 2,
  acumuladoSemanas: { semanasAtivas: 1, totalDemandas: 4, entregasNoPrazo: 4 },
  ...extra,
});

describe('qualificação da pessoa na semana', () =>
{
  it('sobrecarregada quando o que está na mão passa da jornada', () =>
  {
    const q = qualificarPessoa(base({ horasEstipuladasSemana: 48 }), '2026-11-25');
    expect(q.nivel).toBe('sobrecarregada');
    expect(q.motivo).toContain('48h de 40h');
  });

  it('precisa de atenção quando há prazo vencido, mesmo sem atraso no painel', () =>
  {
    const q = qualificarPessoa(base({ tarefas: [tarefa({ previsao: '2026-11-20' })] }), '2026-11-25');
    expect(q.nivel).toBe('atencao');
    expect(q.motivo).toContain('1 com prazo vencido');
  });

  it('não conta como vencida a tarefa já concluída', () =>
  {
    const q = qualificarPessoa(base({ tarefas: [tarefa({ previsao: '2026-11-20', situacao: 'concluido' })] }), '2026-11-25');
    expect(q.nivel).toBe('em_dia');
  });

  it('em dia com entrega alta e nada parado', () =>
  {
    expect(qualificarPessoa(base(), '2026-11-25').rotulo).toBe('Em dia');
  });

  it('no ritmo quando a entrega está baixa mas não há atraso', () =>
  {
    const q = qualificarPessoa(base({ nivelEntregaPct: 50 }), '2026-11-25');
    expect(q.nivel).toBe('no_ritmo');
    expect(q.motivo).toContain('entrega 50%');
  });
});

describe('motivo sem ponto duplicado', () =>
{
  it('junta o motivo do painel com os números em uma frase só', () =>
  {
    const q = qualificarPessoa(base({ estagioCritico: true, motivoEstagioCritico: 'Sobrecarga crítica: etapa rodando há 146h.' }), '2026-11-25');
    expect(q.motivo).toBe('Sobrecarga crítica: etapa rodando há 146h. 4 tarefas, 16h de 40h, entrega 100%.');
  });
});
