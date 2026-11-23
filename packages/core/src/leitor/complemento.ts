import type { CapturaLida, CardSnapshot, Pessoa, RegistroPainel } from '../tipos';
import { aplicarRegrasDescarte } from './descarte';
import { nomesTotais } from './totais';
import { semAcento } from './normalizar';

export * from './equipe-analise';

const nomesOrigem: Record<string, string> = {
  em_execucao: 'quem está cuidando de quê',
  fila: 'fila de demandas a iniciar',
  cronograma: 'cronograma',
  demandas: 'lista de demandas',
  card: 'card aberto (etapas)',
};

const rotulosTotais = Object.values(nomesTotais).map((n) => semAcento(n));
const RE_DATA = /\d{2}\/\d{2}\/\d{2,4}/;

// linhas do texto lido que não viraram card nem total: o "restante" do print para a supervisora revisar
export function linhasNaoReconhecidas(texto: string, prefixo: string, regrasDescarte?: string[], cards?: CardSnapshot[], pessoas?: Pessoa[]): string[]
{
  return todasNaoReconhecidas(texto, prefixo, regrasDescarte, cards, pessoas).slice(0, 15);
}

// quanto do texto o leitor entendeu: linhas com conteúdo que viraram card, total ou caíram numa regra de descarte
export function coberturaDaLeitura(texto: string, prefixo: string, regrasDescarte?: string[], cards?: CardSnapshot[], pessoas?: Pessoa[]): { linhas: number; naoEntendidas: number; pct: number }
{
  const linhas = new Set(texto.split(/\r?\n/).map((l) => semAcento(l.replace(/\s+/g, ' ').trim())).filter((l) => l.length >= 8 && (l.match(/[a-z]/g)?.length ?? 0) >= 5)).size;
  const naoEntendidas = todasNaoReconhecidas(texto, prefixo, regrasDescarte, cards, pessoas).length;
  return { linhas, naoEntendidas, pct: linhas ? Math.round(((linhas - naoEntendidas) / linhas) * 100) : 100 };
}

// metadados das telas do painel: cabeçalhos, status, tempos, atraso, tipo e prioridade
const RE_METADADO = /\b(id|solicitante|tipo|descricao|responsavel|tempo|status|novo|planejado|em andamento|resolvido|cancelado|de atraso|kitu ?sistema|suporte kitu|alta|baixa|media|critica)\b|\d+(?:,\d+)?\s?(?:h|d|min)\b/;
const palavras = (t: string) => semAcento(t).match(/[a-z0-9]{4,}/g) ?? [];

function todasNaoReconhecidas(texto: string, prefixo: string, regrasDescarte?: string[], cards?: CardSnapshot[], pessoas?: Pessoa[]): string[]
{
  // texto dos cards lidos: a segunda linha de uma descrição está no card mesmo sem código na linha
  const doCard = new Set((cards ?? []).flatMap((c) => palavras(`${c.titulo ?? ''} ${c.descricaoCompleta ?? ''} ${c.sistema ?? ''} ${c.statusCard ?? ''}`)));
  const nomes = (pessoas ?? []).map((p) => semAcento(p.nome));
  const entendida = (n: string) =>
  {
    if (nomes.some((nome) => n.includes(nome))) return true;
    const p = palavras(n);
    if (doCard.size && p.length && p.filter((w) => doCard.has(w)).length / p.length >= 0.5) return true;
    return RE_METADADO.test(n) && p.filter((w) => !RE_METADADO.test(w)).length <= 1;
  };
  const limpo = aplicarRegrasDescarte(texto, regrasDescarte);
  const re = new RegExp(`\\b${prefixo} ?-? ?[0-9A-Z]{2,4}\\b`, 'i');
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const bruta of limpo.split(/\r?\n/))
  {
    const linha = bruta.replace(/\s+/g, ' ').trim();
    if (linha.length < 8 || re.test(linha) || RE_DATA.test(linha)) continue;
    const n = semAcento(linha);
    if (rotulosTotais.some((r) => n.includes(r))) continue;
    if (entendida(n)) continue;
    if ((linha.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0) < 5) continue;
    if (vistas.has(n)) continue;
    vistas.add(n);
    saida.push(linha);
  }
  return saida;
}

const campos: [keyof CardSnapshot, string][] = [
  ['etapaAtual', 'etapa'],
  ['responsavelEtapaAtual', 'responsável'],
  ['ritmoPainel', 'ritmo'],
  ['previsao', 'previsão'],
  ['vencimento', 'vencimento'],
  ['situacao', 'situação'],
  ['etapasConcluidas', 'etapas feitas'],
  ['etapasTotal', 'total de etapas'],
];

// o que é novo e o que já tinha aparecido (no mesmo envio ou em registros anteriores), com o que mudou
export function compararComAnteriores(cards: CardSnapshot[], anteriores: CardSnapshot[]): { novos: string[]; repetidos: { codigo: string; mudou: string[] }[] }
{
  const antes = new Map(anteriores.map((c) => [c.codigo, c]));
  const novos: string[] = [];
  const repetidos: { codigo: string; mudou: string[] }[] = [];
  for (const c of cards)
  {
    const a = antes.get(c.codigo);
    if (!a)
    {
      novos.push(c.codigo);
      continue;
    }
    const mudou = campos
      .filter(([k]) => c[k] !== undefined && a[k] !== undefined && c[k] !== a[k])
      .map(([k, nome]) => `${nome}: ${String(a[k])} → ${String(c[k])}`);
    repetidos.push({ codigo: c.codigo, mudou });
  }
  return { novos, repetidos };
}

// junta o que a imagem mostrou e o que a supervisora comentou em um texto só, na ordem dos prints
export function unirCapturas(capturas: CapturaLida[], opcoes: { motivo?: string; observacao?: string } = {}): { resumo: string; texto: string }
{
  const partes: string[] = [];
  if (opcoes.motivo?.trim()) partes.push(`Motivo: ${opcoes.motivo.trim()}.`);
  if (opcoes.observacao?.trim()) partes.push(opcoes.observacao.trim());

  capturas.forEach((c, i) =>
  {
    const o = nomesOrigem[c.origem] ?? c.origem;
    const lido = [
      c.cards.length && `${c.cards.length} ${c.cards.length === 1 ? 'card' : 'cards'} (${c.cards.slice(0, 6).join(', ')}${c.cards.length > 6 ? '...' : ''})`,
      c.totais.length && `${c.totais.length} ${c.totais.length === 1 ? 'indicador' : 'indicadores'}`,
      c.ondas && `${c.ondas} ${c.ondas === 1 ? 'onda' : 'ondas'}`,
    ].filter(Boolean).join(', ');
    const linhas = [`${i + 1}) ${c.nome.split(' · ')[0]} (${o})${lido ? `: ${lido}` : ''}.`];
    if (c.porPessoa?.length)
    {
      linhas.push(`Divisão por pessoa: ${c.porPessoa.map((p) => `${p.pessoa} -> ${p.tarefas.join(', ')}`).join(' | ')}.`);
    }
    if (c.repetidos?.length)
    {
      const mudaram = c.repetidos.filter((r) => r.mudou.length);
      if (mudaram.length) linhas.push(`Mudou desde antes: ${mudaram.slice(0, 5).map((r) => `${r.codigo} (${r.mudou.join('; ')})`).join(' | ')}.`);
      else linhas.push(`Sem mudança desde o último registro: ${c.repetidos.slice(0, 6).map((r) => r.codigo).join(', ')}.`);
    }
    if (c.comentario?.trim()) linhas.push(`Leitura: ${c.comentario.trim()}`);
    partes.push(linhas.join(' '));
  });

  const comentados = capturas.filter((c) => c.comentario?.trim());
  const resumo = [
    opcoes.motivo?.trim(),
    `${capturas.length} ${capturas.length === 1 ? 'print' : 'prints'}`,
    comentados.length ? `${comentados.length} com comentário` : '',
  ].filter(Boolean).join(' · ');
  return { resumo, texto: partes.join('\n\n') };
}

// registros que valem para o relatório: por pasta, por ids escolhidos, por dia ou pelo período
export function filtrarRegistros(registros: RegistroPainel[], opcoes: { pasta?: string | undefined; ids?: string[] | undefined; data?: string | undefined; de?: string | undefined; ate?: string | undefined }): RegistroPainel[]
{
  return registros
    .filter((r) =>
      (!opcoes.pasta || r.pasta === opcoes.pasta) &&
      (!opcoes.ids?.length || opcoes.ids.includes(r.id)) &&
      (!opcoes.data || r.data === opcoes.data) &&
      (opcoes.ids?.length || opcoes.data || ((!opcoes.de || r.data >= opcoes.de) && (!opcoes.ate || r.data <= opcoes.ate))),
    )
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));
}
