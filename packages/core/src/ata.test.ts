import { describe, expect, it } from 'vitest';
import
{
  criarAta,
  exportarCombinadosParaIntegracao,
  gerarProximaAta,
  mensagemTeamsDaAta,
  pedidoDeAtaParaIa,
  proximaPautaSugerida,
  radarDeCombinados,
  resumoAutomaticoDaAta,
  validarAtaImportada,
} from './ata';

describe('ata', () =>
{
  it('gera resumo automático, próxima pauta e radar de combinados', () =>
  {
    const ata = criarAta({
      titulo: 'Reunião semanal de diretoria',
      data: '2026-11-16',
      tipo: 'diretoria',
      participantes: ['Mariana', 'Carlos', 'Ana'],
      decisoes: [{ id: 'd1', texto: 'Aprovar novo fluxo de relatórios' }],
      combinados: [
        { id: 'c1', tarefa: 'Enviar orçamento atualizado', responsavel: 'Carlos', prazo: '2026-11-17', situacao: 'pendente', prioridade: 'alta' },
        { id: 'c2', tarefa: 'Validar cronograma de testes', responsavel: 'Ana', prazo: '2026-11-20', situacao: 'andamento', prioridade: 'media' },
        { id: 'c3', tarefa: 'Publicar ata anterior', responsavel: 'Mariana', prazo: '2026-11-16', situacao: 'concluido', prioridade: 'baixa' },
        { id: 'c4', tarefa: 'Liberar acesso ao servidor', responsavel: 'Carlos', prazo: '2026-11-25', situacao: 'bloqueado', prioridade: 'alta' },
      ],
      pontosAbertos: [{ id: 'p1', texto: 'Definir orçamento de 2027', dono: 'Diretoria' }],
    });

    const resumo = resumoAutomaticoDaAta(ata, '2026-11-19');
    expect(resumo).toContain('Reunião semanal de diretoria');
    expect(resumo).toContain('Principais decisões (1)');
    expect(resumo).toContain('1 com prazo vencido');

    const radar = radarDeCombinados([ata], '2026-11-19');
    expect(radar.atrasados).toHaveLength(1);
    expect(radar.atrasados[0]?.combinado.id).toBe('c1');
    expect(radar.vencendo).toHaveLength(1);
    expect(radar.vencendo[0]?.combinado.id).toBe('c2');
    expect(radar.bloqueados).toHaveLength(1);
    expect(radar.concluidos).toHaveLength(1);
    expect(radar.porResponsavel[0]?.responsavel).toBe('Carlos');
    expect(radar.porResponsavel[0]?.atrasados).toBe(1);

    const pauta = proximaPautaSugerida(ata);
    expect(pauta.some((x) => x.includes('Definir orçamento de 2027'))).toBe(true);
    expect(pauta.some((x) => x.includes('Liberar acesso ao servidor'))).toBe(true);

    const proxima = gerarProximaAta(ata);
    expect(proxima.data).toBe('2026-11-23');
    expect(proxima.participantes).toEqual(['Mariana', 'Carlos', 'Ana']);
    expect(proxima.pauta.length).toBeGreaterThan(0);

    const teams = mensagemTeamsDaAta(ata);
    expect(teams).toContain('**ATA — Reunião semanal de diretoria**');
    expect(teams).toContain('**Decisões tomadas**');
    expect(teams).toContain('**Combinados e encaminhamentos**');

    const eventos = exportarCombinadosParaIntegracao([ata], true);
    expect(eventos).toHaveLength(3);
    expect(eventos[0]?.origem).toBe('orbisos');
  });

  it('valida JSON retornado por IA gratuita e limpa cercas de código', () =>
  {
    const prompt = pedidoDeAtaParaIa('Carlos vai enviar a proposta até sexta.', { titulo: 'Alinhamento', data: '2026-11-19' });
    expect(prompt).toContain('Carlos vai enviar a proposta até sexta.');

    const resposta = '```json\n{"titulo":"Alinhamento","data":"2026-11-19","tipo":"alinhamento","participantes":["Mariana","Carlos"],"decisoes":[{"texto":"Seguir com fornecedor A"}],"combinados":[{"tarefa":"Enviar proposta","responsavel":"Carlos","prazo":"2026-11-20","prioridade":"alta"}]}\n```';
    const r = validarAtaImportada(resposta, 'anotação original');
    expect(r.erros).toHaveLength(0);
    expect(r.ata?.titulo).toBe('Alinhamento');
    expect(r.ata?.combinados).toHaveLength(1);
    expect(r.ata?.resumoExecutivo).toContain('Alinhamento');
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});
