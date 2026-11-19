import { semAcento } from './normalizar';

// remove marcadores e espaços extras para guardar a regra de descarte limpa
export function normalizarRegraDescarte(regra: string): string
{
  return regra
    .replace(/^[\s·•]+|[\s·•]+$/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function escaparRegex(texto: string): string
{
  return texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// extrai frases/palavras de descarte vindas de texto digitado ou colado de print
export function extrairRegrasDeTexto(textoBruto: string, prefixo = 'DEV'): string[]
{
  if (!textoBruto) return [];
  const reCard = new RegExp(`^${escaparRegex(prefixo)}\\s*-?\\s*[0-9A-Z]{2,4}$`, 'i');
  const vistas = new Set<string>();
  const regras: string[] = [];

  for (const parte of textoBruto.split(/\r?\n|;/))
  {
    const limpa = normalizarRegraDescarte(parte);
    if (limpa.length < 2) continue;
    // ignora linhas só com símbolos/números/datas para não criar regra destrutiva
    if (!/[A-Za-zÀ-ÿ]/.test(limpa)) continue;
    if (/^[\d\s/.,:+-]+$/.test(limpa)) continue;
    if (reCard.test(limpa)) continue;

    const chave = semAcento(limpa);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    regras.push(limpa);
  }
  return regras;
}

export function adicionarRegrasDescarte(atuais: string[] | undefined, novas: string[]): string[]
{
  const vistas = new Set<string>();
  const resultado: string[] = [];

  for (const item of [...(atuais ?? []), ...novas])
  {
    const limpa = normalizarRegraDescarte(item);
    if (limpa.length < 2 || !/[A-Za-zÀ-ÿ]/.test(limpa)) continue;
    const chave = semAcento(limpa);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    resultado.push(limpa);
  }
  return resultado;
}

export function removerRegraDescarte(atuais: string[] | undefined, regra: string): string[]
{
  const alvo = semAcento(normalizarRegraDescarte(regra));
  return (atuais ?? []).filter((r) => semAcento(normalizarRegraDescarte(r)) !== alvo);
}

const VARIANTES_ACENTO: Record<string, string> = {
  a: '[aáàâãä]',
  e: '[eéèêë]',
  i: '[iíìîï]',
  o: '[oóòôõö]',
  u: '[uúùûü]',
  c: '[cç]',
};

// monta regex insensível a acento/maiúsculas, tolerante a variação de separadores (› / > / -)
// e protegida contra corte no meio de palavras
function construirRegexRegra(regra: string): RegExp | undefined
{
  const limpa = normalizarRegraDescarte(regra);
  if (limpa.length < 2 || !/[A-Za-zÀ-ÿ]/.test(limpa)) return undefined;

  const base = limpa.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let padrao = '';
  let i = 0;

  while (i < base.length)
  {
    const resto = base.slice(i);
    const mSep = resto.match(/^(?:[ \t]|[·•›>—–-])+/);
    if (mSep)
    {
      padrao += '(?:[ \\t]|[·•›>—–-])+';
      i += mSep[0].length;
      continue;
    }
    const ch = base[i]!;
    const lower = ch.toLowerCase();
    padrao += VARIANTES_ACENTO[lower] ?? escaparRegex(ch);
    i += 1;
  }

  if (/^[A-Za-z0-9]/.test(base)) padrao = `(?<![A-Za-zÀ-ÿ0-9])${padrao}`;
  if (/[A-Za-z0-9]$/.test(base)) padrao = `${padrao}(?![A-Za-zÀ-ÿ0-9])`;

  return new RegExp(padrao, 'gi');
}

function limparTrechoAlterado(trecho: string): string
{
  return trecho
    .replace(/ {2,}/g, ' ')
    .replace(/\s+[·•]+\s+/g, ' ')
    .replace(/^[ \t]*[·•›>—–\-:;]+\s*/g, '')
    .replace(/\s*[·•›>—–\-:;]+[ \t]*$/g, '')
    .trim();
}

// aplica as regras de descarte em um texto transcrito; preserva linhas intocadas e tabulações (\t)
export function aplicarRegrasDescarte(texto: string, regras?: string[]): string
{
  if (!texto || !regras?.length) return texto;

  const ordenadas = [...regras]
    .map(normalizarRegraDescarte)
    .filter((r) => r.length >= 2)
    .sort((a, b) => b.length - a.length);

  const regexes = ordenadas
    .map(construirRegexRegra)
    .filter((r): r is RegExp => !!r);

  if (!regexes.length) return texto;

  const saida: string[] = [];
  for (const linhaOriginal of texto.split(/\r?\n/))
  {
    if (!linhaOriginal.trim())
    {
      saida.push('');
      continue;
    }

    let atual = linhaOriginal;
    let alterada = false;

    for (const re of regexes)
    {
      re.lastIndex = 0;
      if (re.test(atual))
      {
        alterada = true;
        re.lastIndex = 0;
        atual = atual.replace(re, ' ');
      }
    }

    if (!alterada)
    {
      saida.push(linhaOriginal);
      continue;
    }

    if (atual.includes('\t'))
    {
      const celulas = atual.split('\t').map(limparTrechoAlterado);
      if (celulas.some(Boolean)) saida.push(celulas.join('\t'));
    }
    else
    {
      const limpa = limparTrechoAlterado(atual);
      if (limpa) saida.push(limpa);
    }
  }

  return saida.join('\n');
}
