import { modelosProntos, nomesSecoes, nomesTotais, type Bloco, type Modelo } from '@supervisao/core';
import type { Dados, NotasRelatorio } from './armazenamento.ts';
import type { Periodo } from './semana.ts';

export const todosModelos = (dados: Dados): Modelo[] => [...modelosProntos, ...dados.modelos];
export const acharModelo = (dados: Dados, id: string): Modelo => todosModelos(dados).find((m) => m.id === id) ?? modelosProntos[0]!;
export const ehPronto = (id: string) => modelosProntos.some((m) => m.id === id);
export const novoId = () => `m${Date.now().toString(36)}`;
export const chaveDoRelatorio = (p: Periodo) => (p.livre ? `${p.inicio}_${p.fim}` : p.inicio);

// blocos mexidos neste relatório; senão os do modelo (o semanal respeita as seções desmarcadas antes dos modelos)
export function blocosDoRelatorio(modelo: Modelo, notas: NotasRelatorio): Bloco[]
{
  const proprios = notas.blocos?.[modelo.id];
  if (proprios) return proprios;
  const ocultas = notas.secoesOcultas ?? [];
  if (modelo.id === 'semanal' && ocultas.length) return modelo.blocos.filter((b) => b.tipo !== 'secao' || !ocultas.includes(b.secao));
  return modelo.blocos;
}

export function rotuloBloco(b: Bloco): string
{
  switch (b.tipo)
  {
    case 'secao': return nomesSecoes[b.secao];
    case 'texto': return `Texto: ${b.titulo || 'sem título'}`;
    case 'grafico': return `Gráfico: ${nomesTotais[b.indicador]}`;
    case 'tabela': return `Tabela: ${b.indicadores.length} ${b.indicadores.length === 1 ? 'indicador' : 'indicadores'}`;
    case 'quebra': return 'Quebra de página';
  }
}

export function baixarModelo(modelo: Modelo): void
{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(modelo, null, 2)], { type: 'application/json' }));
  a.download = `modelo-${modelo.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
