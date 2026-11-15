import { mensagemTeams, montarPacote } from '@supervisao/core';
import type { Dados, NotasRelatorio } from './armazenamento.ts';
import { semaforoDoRelatorio, type Contexto } from './semana.ts';

export function textoTeams(dados: Dados, ctx: Contexto, notas: NotasRelatorio): string
{
  return mensagemTeams({
    inicio: ctx.atual.inicio,
    totais: ctx.atual.foto?.totais ?? {},
    totaisAnteriores: ctx.anterior?.foto?.totais,
    meta: ctx.meta,
    semaforo: semaforoDoRelatorio(ctx, notas),
    kpis: ctx.comp.planoAtual,
    frases: ctx.frases.filter((f) => !notas.frasesOcultas?.includes(f.texto)),
    alertas: ctx.alertas,
    riscos: dados.riscos,
    decisoes: notas.decisoes,
  });
}

// compacto: só os fatos, sem as instruções nem o dicionário, para o modelo local de IA que tem janela curta
export function textoPacote(dados: Dados, ctx: Contexto, notas: NotasRelatorio, compacto = false): string
{
  const pacote = pacoteCompleto(dados, ctx, notas, compacto);
  return compacto ? pacote.slice(Math.max(pacote.indexOf('# Contexto'), 0)) : pacote;
}

function pacoteCompleto(dados: Dados, ctx: Contexto, notas: NotasRelatorio, compacto: boolean): string
{
  return montarPacote({
    area: dados.identificacao.area,
    prefixo: dados.prefixo,
    elaboradoPor: dados.identificacao.elaboradoPor || undefined,
    destinatario: dados.identificacao.destinatario || undefined,
    inicio: ctx.atual.inicio,
    dicionario: compacto ? '' : dados.dicionario,
    comp: ctx.comp,
    meta: ctx.meta,
    semaforo: semaforoDoRelatorio(ctx, notas),
    fotos: dados.fotos,
    plano: ctx.atual.plano,
    pessoas: dados.pessoas,
    alertas: ctx.alertas,
    riscos: dados.riscos,
    promessasAnteriores: ctx.promessasAnteriores,
    promessasDaSemana: dados.promessas.filter((p) => p.semana === ctx.atual.inicio),
    frases: ctx.frases.filter((f) => !notas.frasesOcultas?.includes(f.texto)),
    notas,
  });
}

export async function copiar(texto: string): Promise<void>
{
  await navigator.clipboard.writeText(texto);
}

export function baixarTexto(texto: string, nome: string): void
{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
