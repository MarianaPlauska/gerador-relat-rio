import { agoraLocal, idCurto } from '../checklist';
import type { Alternativa, LinhaPlanilha, Planilha, PrioridadeLinha, SituacaoLinha } from './tipos';

export interface ResultadoPlanilha
{
  planilha?: Planilha;
  erros: string[];
  avisos: string[];
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const texto = (x: unknown): string => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');

// "R$ 1.234,56", "1234.56", "1.234", "2,5" e números puros; negativo e lixo viram vazio
export function lerValor(x: unknown): number | undefined
{
  if (typeof x === 'number') return Number.isFinite(x) && x >= 0 ? x : undefined;
  if (typeof x !== 'string') return undefined;
  let s = x.replace(/R\$|\s/gi, '');
  if (!/^\d[\d.,]*$/.test(s)) return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function lerData(x: unknown): string | undefined
{
  const s = texto(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

const semBarraFinal = (u: string) => u.replace(/\/+$/, '');

// só http ou https; com o material colado, avisa se o link não estava nele (a IA pode inventar link)
function lerLink(x: unknown, onde: string, material: string, avisos: string[]): string | undefined
{
  const s = texto(x);
  if (!s) return undefined;
  if (!/^https?:\/\/\S+$/i.test(s))
  {
    avisos.push(`${onde}: link inválido, ele precisa começar com http ou https (removido).`);
    return undefined;
  }
  if (material.trim() && !material.includes(semBarraFinal(s))) avisos.push(`${onde}: este link não aparece no material que você colou, confira se abre: ${s}`);
  return s;
}

function lerLinha(b: unknown, n: number, material: string, erros: string[], avisos: string[]): LinhaPlanilha | undefined
{
  const onde = `Linha ${n}`;
  if (!ehObjeto(b))
  {
    erros.push(`${onde}: não é um objeto (descartada).`);
    return undefined;
  }
  const item = texto(b.item) || texto(b.nome);
  if (!item)
  {
    erros.push(`${onde}: sem "item" (descartada).`);
    return undefined;
  }
  const qtd = lerValor(b.qtd);
  const prioridade: PrioridadeLinha = /essen/i.test(texto(b.prioridade)) ? 'essencial' : /desej|opcion/i.test(texto(b.prioridade)) ? 'desejavel' : 'importante';
  const situacao: SituacaoLinha = /verific|confirm/i.test(texto(b.situacao)) ? 'verificado' : 'estimativa';
  return {
    id: idCurto(),
    grupo: texto(b.grupo) || 'Geral',
    item,
    detalhe: texto(b.detalhe) || texto(b.produto),
    qtd: qtd && qtd > 0 ? qtd : 1,
    loja: texto(b.loja),
    min: lerValor(b.min),
    ref: lerValor(b.ref),
    max: lerValor(b.max),
    situacao,
    prioridade,
    incluir: !(b.incluir === false || /^n(ã|a)o$/i.test(texto(b.incluir))),
    link: lerLink(b.link, onde, material, avisos),
    observacao: texto(b.observacao),
  };
}

function lerAlternativa(b: unknown, n: number, material: string, erros: string[], avisos: string[]): Alternativa | undefined
{
  const onde = `Alternativa ${n}`;
  if (!ehObjeto(b) || !texto(b.item) || !texto(b.opcao))
  {
    erros.push(`${onde}: precisa de "item" e "opcao" (descartada).`);
    return undefined;
  }
  return { id: idCurto(), item: texto(b.item), opcao: texto(b.opcao), loja: texto(b.loja), valor: lerValor(b.valor), data: lerData(b.data), link: lerLink(b.link, onde, material, avisos), observacao: texto(b.observacao) };
}

const lista = (x: unknown): string[] => (Array.isArray(x) ? x.map(texto).filter(Boolean) : []);

// lê a resposta da IA colada pela usuária; o que não reconhece vira erro e fica de fora
export function validarPlanilha(textoColado: string, material = '', comAlternativas = false): ResultadoPlanilha
{
  const erros: string[] = [];
  const avisos: string[] = [];
  const bruto = textoColado.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let o: unknown;
  try
  {
    o = JSON.parse(bruto);
  }
  catch
  {
    return { erros: ['O texto colado não é um JSON válido. Peça para a IA responder só com o JSON, sem texto antes ou depois.'], avisos };
  }
  if (!ehObjeto(o)) return { erros: ['O JSON precisa ser um objeto com "nome" e "linhas".'], avisos };
  if (!Array.isArray(o.linhas)) return { erros: ['Falta a lista "linhas".'], avisos };

  const linhas = o.linhas.map((b, i) => lerLinha(b, i + 1, material, erros, avisos)).filter((l): l is LinhaPlanilha => l !== undefined);
  if (!linhas.length) return { erros: [...erros, 'Nenhuma linha válida na resposta.'], avisos };
  const brutas = Array.isArray(o.alternativas) ? o.alternativas : [];
  if (!comAlternativas && brutas.length) avisos.push(`A resposta trouxe ${brutas.length} alternativas, mas a aba Alternativas não foi pedida (descartadas). Ative-a nas Notas da planilha se quiser.`);
  const alternativas = (comAlternativas ? brutas : []).map((b, i) => lerAlternativa(b, i + 1, material, erros, avisos)).filter((a): a is Alternativa => a !== undefined);

  // ordem dos grupos: a lista "grupos" da IA, depois os que só aparecem nas linhas, pela primeira aparição
  const grupos = [...new Set([...lista(o.grupos), ...linhas.map((l) => l.grupo)])];
  const orcamento = lerValor(o.orcamento);
  const notas = ehObjeto(o.notas) ? o.notas : {};
  const agora = agoraLocal();
  return {
    planilha: {
      id: idCurto(),
      nome: texto(o.nome) || 'Planilha sem nome',
      objetivo: texto(o.objetivo),
      criadoEm: agora,
      atualizadoEm: agora,
      moeda: o.moeda !== false,
      comAlternativas,
      orcamento: orcamento && orcamento > 0 ? orcamento : undefined,
      grupos,
      linhas,
      alternativas,
      notas: { comoLer: lista(notas.comoLer), premissas: lista(notas.premissas), atencao: lista(notas.atencao) },
    },
    erros,
    avisos,
  };
}
