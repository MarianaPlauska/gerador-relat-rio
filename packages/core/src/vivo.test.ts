import { describe, expect, it } from 'vitest';
import { alternarItem, camposParaRelatorio, diasSemRegistro, itemFeito, novoVivo, progressoVivo, registrar, registrouHoje, textoDoCampo } from './vivo';

const novo = () => novoVivo('Semana 46', 'semanal', '2026-11-09', '2026-11-13', false, '2026-11-09T08:00');

describe('relatório vivo', () =>
{
  it('começa com o checklist padrão e nenhuma entrada', () =>
  {
    const v = novo();
    expect(v.itens.length).toBeGreaterThan(3);
    expect(v.entradas).toEqual([]);
    expect(progressoVivo(v, '2026-11-09')).toMatchObject({ feitos: 0, pct: 0 });
  });

  it('item diário zera no dia seguinte; o avulso fica feito', () =>
  {
    const v = novo();
    const diario = v.itens.find((i) => i.diario)!;
    const avulso = v.itens.find((i) => !i.diario)!;
    alternarItem(diario, '2026-11-09');
    alternarItem(avulso, '2026-11-09');
    expect(itemFeito(diario, '2026-11-09')).toBe(true);
    expect(itemFeito(diario, '2026-11-10')).toBe(false);
    expect(itemFeito(avulso, '2026-11-10')).toBe(true);
    alternarItem(avulso, '2026-11-10');
    expect(itemFeito(avulso, '2026-11-10')).toBe(false);
  });

  it('as entradas viram o texto do campo, em ordem de data, com data na frente', () =>
  {
    const v = novo();
    registrar(v, 'destaques', 'DEV-218 fechado', '2026-11-10T10:00');
    registrar(v, 'destaques', 'Agendamento sem erro de CPF\nem produção', '2026-11-09T15:00');
    registrar(v, 'decisoes', '   ', '2026-11-09T16:00');
    expect(textoDoCampo(v, 'destaques')).toBe('- 09/11: Agendamento sem erro de CPF em produção\n- 10/11: DEV-218 fechado');
    expect(camposParaRelatorio(v)).toEqual({ destaques: textoDoCampo(v, 'destaques') });
  });

  it('conta os dias úteis sem registro e sabe se já registrou hoje', () =>
  {
    const v = novo();
    expect(diasSemRegistro(v, '2026-11-09')).toBe(0);
    expect(diasSemRegistro(v, '2026-11-12')).toBe(3);
    registrar(v, 'resumo', 'Semana começou', '2026-11-12T09:00');
    expect(diasSemRegistro(v, '2026-11-12')).toBe(0);
    expect(registrouHoje(v, '2026-11-12')).toBe(true);
    expect(registrouHoje(v, '2026-11-13')).toBe(false);
  });
});
