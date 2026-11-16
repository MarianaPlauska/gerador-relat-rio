import type { Anotacao, CardSnapshot, EtapaAnotada, Onda, OrigemLeitura, Pessoa, TotaisPainel } from '../tipos';
import { nomesTotais } from './totais';

// marcadores de lista: "1.", "2)", "-", "*", "•", "etapa 3:", "passo 2 -"
const MARCADOR = /^\s*(?:\d+\s*[.)\-:º°]|[-*•–>]|(?:etapa|passo)\s*\d*\s*[:.)\-]?)\s*/i;
const ROTULO_RESUMO = /^\s*(?:resumo|situa[cç][aã]o|contexto|objetivo)\s*[:\-]\s*/i;
const ROTULO_AUTORA = /^\s*(?:palavras da autora|autora|vis[aã]o geral|coment[aá]rio|observa[cç][aã]o)\s*[:\-]\s*/i;
const ROTULO_ETAPAS = /^\s*(?:etapas|passos|pr[oó]ximos passos|o que ser[aá] feito|a fazer|plano)\s*[:\-]\s*/i;
// conectores que indicam sequência dentro de um texto corrido
const CONECTORES = /\s*(?:;|\b(?:primeiro(?:\s+vamos)?|em seguida|depois(?:\s+disso)?|ap[oó]s isso|logo ap[oó]s|ent[aã]o|por fim|por [uú]ltimo|finalmente|e tamb[eé]m)\b,?)\s*/i;
const CONECTORES_G = new RegExp(CONECTORES.source, 'gi');

const limpar = (s: string) => s.replace(/\s+/g, ' ').replace(/^[,.;:\s]+|[,;:\s]+$/g, '').trim();
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ContextoExplicacao
{
  prefixo?: string | undefined;
  cards?: CardSnapshot[] | undefined;
  totais?: TotaisPainel | undefined;
  ondas?: Onda[] | undefined;
  pessoas?: Pessoa[] | undefined;
}

function codigosDe(texto: string, prefixo?: string): string[]
{
  const re = prefixo ? new RegExp(`\\b${prefixo}-?\\d+\\b`, 'gi') : /\b[A-Z]{2,}-\d+\b/g;
  return [...new Set((texto.match(re) ?? []).map((c) => c.toUpperCase().replace(/^([A-Z]+)(\d)/, '$1-$2')))];
}

// explica o que a etapa significa cruzando com os cards lidos e a intenção do texto
export function descreverEtapa(texto: string, codigos: string[], ctx?: ContextoExplicacao): string
{
  const partes: string[] = [];
  const porCodigo = new Map((ctx?.cards ?? []).map((c) => [c.codigo.toUpperCase(), c]));
  const nomePessoa = (id?: string) => ctx?.pessoas?.find((p) => p.id === id)?.nome ?? id;

  for (const cod of codigos)
  {
    const c = porCodigo.get(cod);
    if (!c) continue;
    const detalhes = [
      c.titulo && `"${c.titulo}"`,
      c.etapaAtual && `etapa ${c.etapaAtual}${c.etapasTotal ? ` (${c.etapasConcluidas ?? 0}/${c.etapasTotal})` : ''}`,
      c.responsavelEtapaAtual && `com ${nomePessoa(c.responsavelEtapaAtual)}`,
      c.ritmoPainel && `ritmo ${c.ritmoPainel.replace('_', ' ')}`,
      c.previsao && `previsão ${c.previsao.split('-').reverse().join('/')}`,
      c.vencimento && `venc. ${c.vencimento.split('-').reverse().join('/')}`,
    ].filter(Boolean);
    if (detalhes.length) partes.push(`${cod}: ${detalhes.join(' · ')}`);
  }

  // se o texto já veio no formato "Título: explicação" ou "Título — explicação", aproveita
  const separador = texto.match(/^([^:—–-]{4,60})\s*[:—–-]\s+(.{8,})$/);
  if (separador) partes.unshift(capitalizar(separador[2]!.trim()));

  if (!partes.length)
  {
    const t = texto.toLowerCase();
    if (/cobrar|alinhar|falar|reuni|cliente|validar/.test(t)) partes.push('Alinhamento e destrave com os envolvidos para liberar o andamento.');
    else if (/prioriz|reprioriz|fila|ordem/.test(t)) partes.push('Organização da fila para atacar primeiro o que tem maior impacto no prazo.');
    else if (/atualizar|data|prazo|previs|cronograma|painel/.test(t)) partes.push('Ajuste de datas e registro no painel para manter a previsão fiel à realidade.');
    else if (/test|homolog|revis|confer|qualidade/.test(t)) partes.push('Verificação de qualidade e validação antes de dar a entrega como concluída.');
    else if (/entreg|public|implant|subir|fechar|conclu/.test(t)) partes.push('Conclusão e entrega oficial da demanda, virando resultado no período.');
    else partes.push('Ação prevista para fazer esta frente avançar na etapa.');
  }

  return partes.join(' | ');
}

function criarEtapa(bruto: string, ctx?: ContextoExplicacao): EtapaAnotada | undefined
{
  const limpo = limpar(bruto).replace(/\s+e$/i, '').replace(/[.!]+$/, '');
  if (limpo.length < 3) return undefined;
  const separador = limpo.match(/^([^:—–-]{4,60})\s*[:—–-]\s+(.{8,})$/);
  const titulo = capitalizar((separador ? separador[1]! : limpo).trim());
  const cards = codigosDe(limpo, ctx?.prefixo);
  const descricao = descreverEtapa(limpo, cards, ctx);
  return { texto: titulo, descricao, feito: false, ...(cards.length ? { cards } : {}) };
}

function frases(texto: string): string[]
{
  return texto.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9])/).map(limpar).filter(Boolean);
}

function quebrarEmSequencia(texto: string): string[]
{
  return texto.split(CONECTORES_G).map(limpar).filter((s) => s.length >= 3);
}

// monta um texto em primeira pessoa ("Palavras da autora") juntando o que a supervisora escreveu e o que o painel mostra
export function gerarPalavrasDaAutora(resumo: string, etapas: EtapaAnotada[], ctx?: ContextoExplicacao): string
{
  const trechos: string[] = [];
  const t = ctx?.totais ?? {};
  const cards = ctx?.cards ?? [];

  if (resumo) trechos.push(resumo.endsWith('.') ? resumo : `${resumo}.`);

  const fatos: string[] = [];
  if (t.dentroDoPrazoPct !== undefined) fatos.push(`${t.dentroDoPrazoPct}% das entregas dentro do prazo${t.metaPct !== undefined ? ` (meta de ${t.metaPct}%)` : ''}`);
  if (t.demandasEmAndamento !== undefined) fatos.push(`${t.demandasEmAndamento} demandas em andamento`);
  const atrasados = cards.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length;
  const emRisco = cards.filter((c) => c.ritmoPainel === 'em_risco').length;
  if (atrasados || emRisco)
  {
    const pedacos = [atrasados && `${atrasados} ${atrasados === 1 ? 'card atrasado' : 'cards atrasados'}`, emRisco && `${emRisco} em risco`].filter(Boolean);
    fatos.push(pedacos.join(' e '));
  }
  else if (cards.length) fatos.push(`${cards.length} ${cards.length === 1 ? 'card lido' : 'cards lidos'} no recorte`);

  if (fatos.length) trechos.push(`No retrato lido do painel, temos ${fatos.join(', ')}.`);

  if (etapas.length)
  {
    const acoes = etapas.slice(0, 4).map((e, i) => `(${i + 1}) ${e.texto.charAt(0).toLowerCase() + e.texto.slice(1)}`).join('; ');
    trechos.push(`Para conduzir esta etapa, organizei o trabalho em ${etapas.length} ${etapas.length === 1 ? 'passo' : 'passos'}: ${acoes}${etapas.length > 4 ? `, entre outros` : ''}.`);
  }

  return trechos.join(' ');
}

// analisa o que saiu de uma captura (imagem ou trecho) e devolve sugestões práticas para a supervisora
export function sugerirDaCaptura(opcoes: { origem: OrigemLeitura; totais: TotaisPainel; cards: CardSnapshot[]; ondas: Onda[] }): { avisos: string[]; sugestoes: string[] }
{
  const { origem, totais, cards, ondas } = opcoes;
  const avisos: string[] = [];
  const sugestoes: string[] = [];

  const comAviso = cards.filter((c) => c.avisosLeitura?.length);
  if (comAviso.length) avisos.push(`${comAviso.length} ${comAviso.length === 1 ? 'card precisa' : 'cards precisam'} de conferência (${comAviso.slice(0, 4).map((c) => c.codigo).join(', ')}).`);
  if (!Object.keys(totais).length && !cards.length && !ondas.length) avisos.push('Nenhum número ou card reconhecido neste print; confira o prefixo ou o tipo de trecho.');

  const atrasados = cards.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado');
  const emRisco = cards.filter((c) => c.ritmoPainel === 'em_risco');
  const semPessoa = cards.filter((c) => !c.responsavelEtapaAtual && !c.responsaveis.length);

  if (atrasados.length) sugestoes.push(`Priorizar ${atrasados.length === 1 ? 'o card atrasado' : `os ${atrasados.length} cards atrasados`} (${atrasados.slice(0, 4).map((c) => c.codigo).join(', ')}) e renegociar previsão.`);
  if (emRisco.length) sugestoes.push(`Acompanhar de perto ${emRisco.slice(0, 4).map((c) => c.codigo).join(', ')} (${emRisco.length} em risco) para não virarem atraso.`);
  if (semPessoa.length && origem !== 'cronograma') sugestoes.push(`Definir responsável para ${semPessoa.slice(0, 3).map((c) => c.codigo).join(', ')}.`);
  if (totais.dentroDoPrazoPct !== undefined && totais.metaPct !== undefined && totais.dentroDoPrazoPct < totais.metaPct)
    sugestoes.push(`${nomesTotais.dentroDoPrazoPct} em ${totais.dentroDoPrazoPct}% (abaixo da meta de ${totais.metaPct}%): focar nas entregas que vencem nos próximos 15 dias.`);
  if (ondas.some((o) => (o.pct ?? 100) < 50))
    sugestoes.push(`Há onda com menos de 50% concluído (${ondas.filter((o) => (o.pct ?? 100) < 50).map((o) => o.nome).join(', ')}): vale revisar escopo e bloqueios.`);
  if (!sugestoes.length && (cards.length || Object.keys(totais).length))
    sugestoes.push('Leitura limpa e sem atrasos críticos apontados; manter o acompanhamento normal da fila.');

  return { avisos, sugestoes };
}

// entende um texto livre como resumo + etapas com descrição + palavras da autora.
// listas (1., -, •) e rótulos ("Resumo:", "Etapas:", "Palavras da autora:") têm prioridade;
// sem eles, a primeira frase vira resumo e o resto é quebrado por conectores (depois, em seguida, ;...)
export function interpretarAnotacao(texto: string, prefixoOuCtx?: string | ContextoExplicacao): Anotacao
{
  const ctx: ContextoExplicacao = typeof prefixoOuCtx === 'string' ? { prefixo: prefixoOuCtx } : (prefixoOuCtx ?? {});
  const linhas = texto.replace(/\r/g, '').split('\n');
  const resumo: string[] = [];
  const autora: string[] = [];
  const brutas: string[] = [];
  let modo: 'livre' | 'resumo' | 'autora' | 'etapas' = 'livre';

  for (const linha of linhas)
  {
    if (!linha.trim()) { if (modo === 'resumo' || modo === 'autora') modo = 'livre'; continue; }
    if (ROTULO_RESUMO.test(linha)) { modo = 'resumo'; const r = linha.replace(ROTULO_RESUMO, ''); if (r.trim()) resumo.push(r); continue; }
    if (ROTULO_AUTORA.test(linha)) { modo = 'autora'; const r = linha.replace(ROTULO_AUTORA, ''); if (r.trim()) autora.push(r); continue; }
    if (ROTULO_ETAPAS.test(linha))
    {
      modo = 'etapas';
      const r = linha.replace(ROTULO_ETAPAS, '');
      if (r.trim()) brutas.push(...r.split(/[;,]/));
      continue;
    }
    if (MARCADOR.test(linha)) { brutas.push(linha.replace(MARCADOR, '')); continue; }
    if (modo === 'etapas') brutas.push(linha);
    else if (modo === 'autora') autora.push(linha);
    else resumo.push(linha);
  }

  let textoResumo = limpar(resumo.join(' '));
  if (!brutas.length && textoResumo)
  {
    const fs = frases(textoResumo);
    if (fs.length > 1)
    {
      textoResumo = fs[0]!;
      for (const f of fs.slice(1)) brutas.push(...quebrarEmSequencia(f));
    }
    else if (CONECTORES.test(textoResumo))
    {
      const partes = quebrarEmSequencia(textoResumo);
      if (partes.length > 1)
      {
        textoResumo = partes[0]!;
        brutas.push(...partes.slice(1));
      }
    }
  }
  else if (brutas.length)
  {
    const expandidas = brutas.flatMap(quebrarEmSequencia);
    brutas.splice(0, brutas.length, ...expandidas);
  }

  const resumoFinal = textoResumo ? capitalizar(textoResumo) : '';
  const etapas = brutas.map((b) => criarEtapa(b, ctx)).filter((e): e is EtapaAnotada => !!e);
  const cards = codigosDe(texto, ctx.prefixo);
  const palavrasDaAutora = limpiarAutora(autora.join(' ')) || gerarPalavrasDaAutora(resumoFinal, etapas, ctx);
  return {
    texto,
    resumo: resumoFinal,
    palavrasDaAutora,
    etapas,
    ...(cards.length ? { cards } : {}),
  };
}

const limpiarAutora = (s: string) => (limpar(s) ? capitalizar(limpar(s)) : '');
