const UM_DIA = 86_400_000;

function paraUtc(iso: string): number
{
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a!, m! - 1, d!);
}

function paraIso(ms: number): string
{
  return new Date(ms).toISOString().slice(0, 10);
}

export function ehDiaUtil(iso: string, feriados: string[]): boolean
{
  const diaSemana = new Date(paraUtc(iso)).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.includes(iso.slice(0, 10));
}

// conta dias úteis de inicio (exclusivo) até fim (inclusivo); negativo se fim < inicio
export function diasUteisEntre(inicio: string, fim: string, feriados: string[]): number
{
  const a = paraUtc(inicio);
  const b = paraUtc(fim);
  const sinal = b >= a ? 1 : -1;
  let total = 0;
  for (let t = a + sinal * UM_DIA; sinal > 0 ? t <= b : t >= b; t += sinal * UM_DIA)
  {
    if (ehDiaUtil(paraIso(t), feriados)) total += sinal;
  }
  return total;
}

export function segundaDaSemana(iso: string): string
{
  const t = paraUtc(iso);
  const diaSemana = new Date(t).getUTCDay();
  return paraIso(t - ((diaSemana + 6) % 7) * UM_DIA);
}
