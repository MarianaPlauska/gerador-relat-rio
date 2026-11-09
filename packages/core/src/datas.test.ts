import { describe, expect, it } from 'vitest';
import { diasUteisEntre, ehDiaUtil, segundaDaSemana } from './datas';

const feriados = ['2026-11-20'];

describe('dias úteis', () =>
{
  it('ignora fim de semana', () =>
  {
    expect(ehDiaUtil('2026-11-14', [])).toBe(false);
    expect(ehDiaUtil('2026-11-15', [])).toBe(false);
    expect(ehDiaUtil('2026-11-16', [])).toBe(true);
  });

  it('ignora feriado', () =>
  {
    expect(ehDiaUtil('2026-11-20', feriados)).toBe(false);
  });

  it('conta de segunda a segunda seguinte', () =>
  {
    expect(diasUteisEntre('2026-11-09', '2026-11-16', [])).toBe(5);
    expect(diasUteisEntre('2026-11-16', '2026-11-23', feriados)).toBe(4);
  });

  it('mesmo dia é zero e ordem invertida é negativa', () =>
  {
    expect(diasUteisEntre('2026-11-09', '2026-11-09', [])).toBe(0);
    expect(diasUteisEntre('2026-11-16', '2026-11-09', [])).toBe(-5);
  });

  it('aceita data com hora', () =>
  {
    expect(diasUteisEntre('2026-11-09T18:00:00', '2026-11-10', [])).toBe(1);
  });
});

describe('segunda da semana', () =>
{
  it('volta para a segunda', () =>
  {
    expect(segundaDaSemana('2026-11-08')).toBe('2026-11-02');
    expect(segundaDaSemana('2026-11-09')).toBe('2026-11-09');
    expect(segundaDaSemana('2026-11-13')).toBe('2026-11-09');
  });
});
