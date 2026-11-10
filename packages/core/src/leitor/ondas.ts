import type { Onda } from '../tipos';
import { lerDatas } from './cards';
import { semAcento } from './normalizar';

const RE_DATA = /\d{2}\/\d{2}\/\d{2,4}/g;
// a imagem lê 0 como "o", "[o]" ou "(e)"
const RE_ZERO = /^[[(]?[oOe0][\])]?$/;
const situacoes = ['Em curso', 'Não iniciada', 'Concluída', 'Encerrada'];

// "Resumo por onda": Prioridade N, início, fim, itens, concluídos, % concluído, próximo vencimento, situação
export function lerOndas(texto: string): Onda[]
{
  const porNome = new Map<string, Onda>();
  for (const linha of texto.split(/\r?\n/))
  {
    const nome = linha.match(/prioridade\s*(\d+)/i);
    if (!nome) continue;
    const resto = linha.slice(nome.index! + nome[0].length);
    const posicoes = [...resto.matchAll(RE_DATA)];
    if (posicoes.length < 2) continue;
    const { datas } = lerDatas(resto);
    const fimDoFim = posicoes[1]!.index! + posicoes[1]![0].length;
    const entre = resto.slice(fimDoFim, posicoes[2]?.index ?? resto.length).split(/\s+/).filter(Boolean);
    const numero = (t?: string) => (t === undefined ? undefined : /^\d+$/.test(t) ? Number(t) : RE_ZERO.test(t) ? 0 : undefined);
    const pct = entre.find((t) => t.endsWith('%'));
    const depois = semAcento(posicoes[2] ? resto.slice(posicoes[2].index!) : '');
    porNome.set(`Prioridade ${nome[1]}`, {
      nome: `Prioridade ${nome[1]}`,
      inicio: datas[0],
      fim: datas[1],
      itens: numero(entre[0]),
      concluidos: numero(entre[1]),
      pct: pct === undefined ? undefined : numero(pct.slice(0, -1)),
      proximoVencimento: datas[2],
      situacao: situacoes.find((s) => depois.includes(semAcento(s))),
    });
  }
  return [...porNome.values()];
}
