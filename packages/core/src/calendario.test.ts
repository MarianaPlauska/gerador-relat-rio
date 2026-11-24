import { describe, expect, it } from 'vitest';
import { barrasDaSemana, eventosDoCronograma, eventosNoDia, gradeDoMes, pontosDoDia, type FontesCalendario } from './calendario';
import type { CardSnapshot, Pessoa, PlanoSemana } from './tipos';

const card = (parcial: Partial<CardSnapshot> & Pick<CardSnapshot, 'codigo'>): CardSnapshot => ({
  responsaveis: [],
  origens: ['cronograma'],
  ...parcial,
});

const pessoa = (id: string, nome: string, ausencias?: Pessoa['ausencias']): Pessoa => ({
  id,
  nome,
  capacidadeHorasSemana: 40,
  ausencias,
});

function fontes(parcial: Partial<FontesCalendario> = {}): FontesCalendario
{
  return { fotos: [], planos: [], pessoas: [], atas: [], riscos: [], ...parcial };
}

describe('eventos do cronograma', () =>
{
  it('fica com a última foto de cada pasta e ignora a anterior', () =>
  {
    const eventos = eventosDoCronograma(fontes({
      fotos: [
        { data: '2026-11-10', pasta: 'dev', cards: [card({ codigo: 'DEV-1', vencimento: '2026-11-12', titulo: 'Antigo' })] },
        { data: '2026-11-20', pasta: 'DEV', cards: [card({ codigo: 'DEV-2', vencimento: '2026-11-25', titulo: 'Atual', responsaveis: ['Ana'] })] },
        { data: '2026-11-18', pasta: 'COM', cards: [card({ codigo: 'COM-1', previsao: '2026-11-22', titulo: 'Comercial' })] },
      ],
    }));
    expect(eventos.map((e) => e.id)).toEqual(['COM|COM-1|previsao|2026-11-22', 'DEV|DEV-2|vencimento|2026-11-25']);
    expect(eventos[1]?.detalhe).toBe('DEV · Ana');
    expect(eventos[1]?.href).toBe('/cards?q=DEV-2');
  });

  it('separa previsão do vencimento e marca concluído', () =>
  {
    const eventos = eventosDoCronograma(fontes({
      fotos: [{
        data: '2026-11-20',
        cards: [
          card({ codigo: 'DEV-3', inicio: '2026-11-02', previsao: '2026-11-18', vencimento: '2026-11-20', titulo: 'Dois prazos' }),
          card({ codigo: 'DEV-4', previsao: '2026-11-20', vencimento: '2026-11-20', situacao: 'concluido', titulo: 'Feito' }),
          card({ codigo: 'DEV-5', inicio: '2026-11-21', titulo: 'Só início' }),
          card({ codigo: 'DEV-6', vencimento: '2026-02-31' }),
        ],
        ondas: [{ nome: 'Onda 1', inicio: '2026-11-01', fim: '2026-11-30', itens: 4, concluidos: 1, proximoVencimento: '2026-11-25' }],
      }],
    }));
    const dev3 = eventos.filter((e) => e.id.startsWith('DEV|DEV-3'));
    expect(dev3.map((e) => e.tipo)).toEqual(['previsao', 'vencimento']);
    expect(dev3[0]?.detalhe).toContain('início 02/11');
    expect(eventos.find((e) => e.id.startsWith('DEV|DEV-4'))?.concluido).toBe(true);
    expect(eventos.find((e) => e.tipo === 'inicio')?.titulo).toBe('DEV-5 · Só início');
    expect(eventos.some((e) => e.id.includes('DEV-6'))).toBe(false);
    const onda = eventos.find((e) => e.tipo === 'onda');
    expect(onda).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-30', href: '/painel' });
  });

  it('junta plano, ata, risco e ausência', () =>
  {
    const plano: PlanoSemana = {
      inicio: '2026-11-16',
      pessoas: [{
        pessoaId: 'ana',
        itens: [
          { id: 'i1', descricao: 'Fechar relatório', tipo: 'planejado', status: 'a_fazer', ate: '2026-11-20', frente: 'Gestão' },
          { id: 'i2', descricao: 'Sem data', tipo: 'planejado', status: 'feito' },
        ],
      }],
    };
    const eventos = eventosDoCronograma(fontes({
      planos: [plano],
      pessoas: [pessoa('ana', 'Ana', [{ de: '2026-11-10', ate: '2026-11-12', motivo: 'Férias' }]), pessoa('bruno', 'Bruno', [{ de: '2026-11-12', ate: '2026-11-09' }])],
      atas: [{
        id: 'ata-1',
        titulo: 'Diretoria',
        data: '2026-11-19',
        combinados: [
          { id: 'c1', tarefa: 'Enviar proposta', responsavel: 'Ana', prazo: '2026-11-20', situacao: 'pendente', prioridade: 'alta' },
          { id: 'c2', tarefa: 'Sem prazo', responsavel: 'Ana', situacao: 'andamento', prioridade: 'baixa' },
        ],
      }],
      riscos: [{ id: 'r1', descricao: 'Cliente parado', decisaoNecessaria: 'Escalar', prazoDecisao: '2026-11-21', status: 'aberto' }],
    }));
    expect(eventos.find((e) => e.tipo === 'plano')).toMatchObject({ titulo: 'Fechar relatório', detalhe: 'Ana · Gestão', concluido: false, href: '/semana' });
    expect(eventos.find((e) => e.tipo === 'reuniao')?.href).toBe('/atas?id=ata-1');
    expect(eventos.find((e) => e.tipo === 'combinado')?.inicio).toBe('2026-11-20');
    expect(eventos.some((e) => e.titulo === 'Sem prazo')).toBe(false);
    expect(eventos.find((e) => e.tipo === 'risco')).toMatchObject({ titulo: 'Escalar', concluido: false });
    expect(eventos.find((e) => e.tipo === 'ausencia')).toMatchObject({ inicio: '2026-11-10', fim: '2026-11-12', detalhe: 'Ana' });
    expect(eventos.filter((e) => e.pessoa === 'Bruno')).toEqual([]);
  });
});

describe('grade e barras', () =>
{
  it('monta novembro de 2026 de segunda a domingo', () =>
  {
    const grade = gradeDoMes('2026-11');
    expect(grade.inicio).toBe('2026-11-01');
    expect(grade.fim).toBe('2026-11-30');
    expect(grade.semanas).toHaveLength(6);
    expect(grade.semanas[0]?.[0]).toBe('2026-10-26');
    expect(grade.semanas[5]?.[0]).toBe('2026-11-30');
    expect(() => gradeDoMes('2026-13')).toThrow('mês inválido');
  });

  it('recorta a barra na semana e empilha o que cruza', () =>
  {
    const eventos = eventosDoCronograma(fontes({
      pessoas: [
        pessoa('ana', 'Ana', [{ de: '2026-11-08', ate: '2026-11-11', motivo: 'Férias' }]),
        pessoa('bia', 'Bia', [{ de: '2026-11-10', ate: '2026-11-12', motivo: 'Atestado' }]),
      ],
    }));
    const semana = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
    const barras = barrasDaSemana(eventos, semana);
    expect(barras.map((b) => ({ titulo: b.evento.titulo, coluna: b.coluna, span: b.span, faixa: b.faixa, continuaAntes: b.continuaAntes, continuaDepois: b.continuaDepois }))).toEqual([
      { titulo: 'Férias', coluna: 1, span: 3, faixa: 0, continuaAntes: true, continuaDepois: false },
      { titulo: 'Atestado', coluna: 2, span: 3, faixa: 1, continuaAntes: false, continuaDepois: false },
    ]);
    expect(pontosDoDia(eventos, '2026-11-10')).toEqual([]);
    expect(eventosNoDia(eventos, '2026-11-10').map((e) => e.titulo)).toEqual(['Férias', 'Atestado']);
  });
});
