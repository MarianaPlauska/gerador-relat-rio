import { diasUteisEntre, somarDias } from './datas';
import type { Frase } from './analise';
import { vencendoEm48h } from './fluxo';
import { avisosDeFase, type Lista } from './checklist';
import type { Alerta, KpisSemana } from './plano';
import type { CorSemaforo, Pessoa, PlanoSemana, Promessa, Risco, Snapshot, TotaisPainel } from './tipos';

const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type Destino = 'painel' | 'semana' | 'cards' | 'relatorio' | 'listas';

export interface AcaoHoje
{
  nivel: 'alto' | 'medio' | 'ok';
  texto: string;
  destino?: Destino;
}

export interface EntradaHoje
{
  hoje: string;
  inicio: string;
  fotos: Snapshot[];
  plano?: PlanoSemana;
  alertas: Alerta[];
  riscos: Risco[];
  promessasDaSemana: Promessa[];
  promessasAnteriores: Promessa[];
  feriados?: string[];
  listas?: Lista[];
}

// o que a supervisora precisa fazer agora, por regras simples
export function acoesDeHoje(e: EntradaHoje): AcaoHoje[]
{
  const feriados = e.feriados ?? [];
  const sexta = somarDias(e.inicio, 4);
  const acoes: AcaoHoje[] = [];
  const ultima = [...e.fotos].filter((f) => f.data <= e.hoje).sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  const fotoDaSemana = e.fotos.some((f) => f.data >= e.inicio && f.data <= sexta);
  const semanaCorrente = e.hoje >= e.inicio && e.hoje <= somarDias(e.inicio, 6);

  if (!fotoDaSemana)
  {
    acoes.push({ nivel: 'alto', texto: 'Ainda não há foto do painel nesta semana.', destino: 'painel' });
  }
  else if (semanaCorrente && ultima && diasUteisEntre(ultima.data, e.hoje, feriados) >= 2)
  {
    acoes.push({ nivel: 'medio', texto: `A última foto do painel é de ${dataCurta(ultima.data)} (${diasUteisEntre(ultima.data, e.hoje, feriados)} dias úteis atrás).`, destino: 'painel' });
  }

  // fase 8: o que vence até 2 dias úteis à frente, pela última foto do painel
  const vencendo = ultima ? vencendoEm48h(ultima.cards, e.hoje, feriados) : [];
  if (vencendo.length)
  {
    const lista = vencendo.slice(0, 4).map((v) => `${v.card.codigo} (${dataCurta(v.data)})`).join(', ');
    acoes.push({ nivel: 'alto', texto: `${plural(vencendo.length, 'card vence', 'cards vencem')} em até 2 dias úteis: ${lista}${vencendo.length > 4 ? ' e mais ' + (vencendo.length - 4) : ''}.`, destino: 'cards' });
  }

  // fase de lista de checagem na data (ou perto dela) com empresas pendentes
  for (const a of avisosDeFase(e.listas ?? [], e.hoje, feriados))
  {
    acoes.push({ nivel: a.nivel, texto: `${a.lista}, ${a.fase}: ${plural(a.pendentes, 'item pendente', 'itens pendentes')} ${a.nivel === 'alto' ? `e a data era ${dataCurta(a.data)}` : `para ${dataCurta(a.data)}`}.`, destino: 'listas' });
  }

  if (!e.plano)
  {
    acoes.push({ nivel: 'alto', texto: 'O plano da semana ainda não começou.', destino: 'semana' });
  }
  else if (!e.plano.confirmadoEm)
  {
    acoes.push({ nivel: 'medio', texto: 'O plano da semana está começado, mas não foi confirmado.', destino: 'semana' });
  }

  const altos = e.alertas.filter((a) => a.nivel === 'alto').length;
  const medios = e.alertas.length - altos;
  if (altos) acoes.push({ nivel: 'alto', texto: `${plural(altos, 'item do plano passa', 'itens do plano passam')} do vencimento, da previsão vencida ou do ritmo do painel.`, destino: 'semana' });
  if (medios) acoes.push({ nivel: 'medio', texto: `${plural(medios, 'ponto do plano pede', 'pontos do plano pedem')} atenção (previsão, capacidade ou card fora da foto).`, destino: 'semana' });

  if (e.plano && !e.plano.fechadoEm && e.hoje >= sexta)
  {
    acoes.push({ nivel: 'alto', texto: e.hoje === sexta ? 'É sexta: falta fechar a semana.' : 'A semana terminou e ainda não foi fechada.', destino: 'semana' });
  }

  for (const r of e.riscos.filter((x) => x.status === 'aberto' && x.decisaoNecessaria && x.prazoDecisao))
  {
    if (r.prazoDecisao! < e.hoje)
    {
      acoes.push({ nivel: 'alto', texto: `Decisão vencida em ${dataCurta(r.prazoDecisao)}: ${r.decisaoNecessaria}`, destino: 'semana' });
    }
    else if (diasUteisEntre(e.hoje, r.prazoDecisao!, feriados) <= 2)
    {
      acoes.push({ nivel: 'medio', texto: `Decisão até ${dataCurta(r.prazoDecisao)}: ${r.decisaoNecessaria}`, destino: 'semana' });
    }
  }

  const anterioresSemSituacao = e.promessasAnteriores.filter((p) => p.cumprida === undefined).length;
  if (anterioresSemSituacao)
  {
    acoes.push({ nivel: 'medio', texto: `Marque se ${plural(anterioresSemSituacao, 'compromisso', 'compromissos')} da semana passada ${anterioresSemSituacao === 1 ? 'foi cumprido' : 'foram cumpridos'}.`, destino: 'semana' });
  }
  if (e.hoje >= sexta)
  {
    const abertas = e.promessasDaSemana.filter((p) => p.cumprida === undefined).length;
    if (abertas) acoes.push({ nivel: 'medio', texto: `${plural(abertas, 'compromisso', 'compromissos')} com a gestão desta semana sem situação.`, destino: 'semana' });
  }

  const ordem = { alto: 0, medio: 1, ok: 2 };
  acoes.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  return acoes.length ? acoes : [{ nivel: 'ok', texto: 'Tudo em dia por aqui.' }];
}

export interface Evento
{
  data: string;
  tipo: 'foto' | 'etapa' | 'previsao' | 'ritmo' | 'entrou' | 'saiu' | 'plano' | 'entrega' | 'risco';
  texto: string;
}

const nomeRitmo = { no_ritmo: 'no ritmo', em_risco: 'em risco', atrasado: 'atrasado' } as const;

// o que aconteceu na semana: fotos, movimento dos cards entre fotos, plano, entregas e riscos
export function linhaDoTempo(fotos: Snapshot[], plano: PlanoSemana | undefined, riscos: Risco[], pessoas: Pessoa[], inicio: string): Evento[]
{
  const fim = somarDias(inicio, 6);
  const naSemana = (d?: string) => !!d && d >= inicio && d <= fim;
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome.split(' ')[0] ?? id;
  const eventos: Evento[] = [];
  const ordenadas = [...fotos].sort((a, b) => a.data.localeCompare(b.data));
  const emExecucao = (f: Snapshot) => new Map(f.cards.filter((c) => c.origens.includes('em_execucao')).map((c) => [c.codigo, c]));

  ordenadas.forEach((foto, i) =>
  {
    if (!naSemana(foto.data)) return;
    eventos.push({ data: foto.data, tipo: 'foto', texto: `Foto do painel colada: ${plural(foto.cards.length, 'card', 'cards')} e ${plural(Object.keys(foto.totais).length, 'número', 'números')}.` });
    const anterior = ordenadas[i - 1];
    if (!anterior || !anterior.cards.length || !foto.cards.length) return;
    const antes = new Map(anterior.cards.map((c) => [c.codigo, c]));
    for (const c of foto.cards)
    {
      const a = antes.get(c.codigo);
      if (!a) continue;
      if (a.etapasConcluidas !== undefined && c.etapasConcluidas !== undefined && c.etapasConcluidas > a.etapasConcluidas)
      {
        eventos.push({ data: foto.data, tipo: 'etapa', texto: `${c.codigo} avançou de ${a.etapasConcluidas} para ${c.etapasConcluidas}${c.etapasTotal ? ` de ${c.etapasTotal}` : ''} etapas.` });
      }
      if (a.previsao && c.previsao && a.previsao !== c.previsao)
      {
        eventos.push({ data: foto.data, tipo: 'previsao', texto: `O painel mudou a previsão de ${c.codigo}: ${dataCurta(a.previsao)} para ${dataCurta(c.previsao)}.` });
      }
      if (a.ritmoPainel && c.ritmoPainel && a.ritmoPainel !== c.ritmoPainel)
      {
        eventos.push({ data: foto.data, tipo: 'ritmo', texto: `${c.codigo} passou de ${nomeRitmo[a.ritmoPainel]} para ${nomeRitmo[c.ritmoPainel]}.` });
      }
    }
    const execAntes = emExecucao(anterior);
    const execAgora = emExecucao(foto);
    const entraram = [...execAgora.keys()].filter((k) => !execAntes.has(k));
    const sairam = [...execAntes.keys()].filter((k) => !execAgora.has(k));
    if (entraram.length) eventos.push({ data: foto.data, tipo: 'entrou', texto: `Entraram em execução: ${entraram.join(', ')}.` });
    if (sairam.length) eventos.push({ data: foto.data, tipo: 'saiu', texto: `Saíram da execução: ${sairam.join(', ')}.` });
  });

  if (plano)
  {
    if (naSemana(plano.confirmadoEm)) eventos.push({ data: plano.confirmadoEm!, tipo: 'plano', texto: 'Plano da semana confirmado.' });
    if (naSemana(plano.fechadoEm)) eventos.push({ data: plano.fechadoEm!, tipo: 'plano', texto: 'Semana fechada.' });
    for (const pp of plano.pessoas)
    {
      for (const i of pp.itens.filter((x) => x.status === 'feito' && naSemana(x.entregueEm)))
      {
        eventos.push({ data: i.entregueEm!, tipo: 'entrega', texto: `${nome(pp.pessoaId)} entregou ${i.cardCodigo ? `${i.cardCodigo}: ` : ''}${i.descricao}.` });
      }
    }
  }
  for (const r of riscos.filter((x) => naSemana(x.sinalizadoEm)))
  {
    eventos.push({ data: r.sinalizadoEm, tipo: 'risco', texto: `Risco sinalizado: ${r.descricao}` });
  }

  const ordemTipo: Evento['tipo'][] = ['plano', 'foto', 'entrega', 'etapa', 'entrou', 'saiu', 'previsao', 'ritmo', 'risco'];
  return eventos.sort((a, b) => b.data.localeCompare(a.data) || ordemTipo.indexOf(a.tipo) - ordemTipo.indexOf(b.tipo));
}

export interface EntradaTeams
{
  inicio: string;
  totais: TotaisPainel;
  totaisAnteriores?: TotaisPainel;
  meta?: number;
  semaforo?: CorSemaforo;
  kpis?: KpisSemana;
  frases: Frase[];
  alertas: Alerta[];
  riscos: Risco[];
  decisoes?: string;
}

const rotuloSemaforo: Record<CorSemaforo, string> = { verde: '[VERDE]', amarelo: '[AMARELO]', vermelho: '[VERMELHO]' };

// mensagem curta para o Teams, em texto simples
export function mensagemTeams(e: EntradaTeams): string
{
  const linhas: string[] = [];
  const t = e.totais;
  const prazo = t.dentroDoPrazoPct !== undefined
    ? ` - dentro do prazo ${t.dentroDoPrazoPct}%${e.meta !== undefined ? ` (meta ${e.meta}%, ${t.dentroDoPrazoPct - e.meta >= 0 ? '+' : ''}${t.dentroDoPrazoPct - e.meta} pp)` : ''}`
    : '';
  linhas.push(`${e.semaforo ? `${rotuloSemaforo[e.semaforo]} ` : ''}Semana ${dataCurta(e.inicio)} a ${dataCurta(somarDias(e.inicio, 4))}${prazo}`);

  const fatos: string[] = [];
  const ta = e.totaisAnteriores;
  if (t.concluidos !== undefined)
  {
    const d = ta?.concluidos !== undefined ? t.concluidos - ta.concluidos : undefined;
    fatos.push(`Concluídos no cronograma: ${t.concluidos}${t.itensCronograma ? ` de ${t.itensCronograma}` : ''}${d !== undefined ? ` (${d >= 0 ? '+' : ''}${d} na semana)` : ''}`);
  }
  if (e.kpis?.planejados) fatos.push(`Plano da semana: ${e.kpis.feitos} de ${e.kpis.planejados} itens feitos (${e.kpis.pctFeitos}%)`);
  if (t.ritmoAtrasadas !== undefined || t.ritmoEmRisco !== undefined) fatos.push(`Ritmo: ${t.ritmoAtrasadas ?? 0} atrasadas e ${t.ritmoEmRisco ?? 0} em risco`);
  for (const f of e.frases.filter((x) => x.tom === 'atencao' && !x.texto.startsWith('Dentro do prazo')))
  {
    if (fatos.length >= 3) break;
    fatos.push(f.texto.replace(/\.$/, ''));
  }
  linhas.push(...fatos.slice(0, 3).map((f) => `- ${f}`));

  const alto = e.alertas.find((a) => a.nivel === 'alto');
  if (alto) linhas.push(`Atenção: ${alto.texto}`);

  for (const r of e.riscos.filter((x) => x.status === 'aberto').slice(0, 2))
  {
    linhas.push(`Risco: ${r.descricao}. Plano B: ${r.planoB}`);
  }

  const escritas = (e.decisoes ?? '').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  const jaEscrita = (d: string) => escritas.some((l) => l.toLowerCase().includes(d.toLowerCase()));
  const decisoes = [
    ...escritas,
    ...e.riscos.filter((x) => x.status === 'aberto' && x.decisaoNecessaria && !jaEscrita(x.decisaoNecessaria)).map((x) => `${x.decisaoNecessaria}${x.prazoDecisao ? ` (até ${dataCurta(x.prazoDecisao)})` : ''}`),
  ];
  for (const d of [...new Set(decisoes)].slice(0, 2)) linhas.push(`Preciso de decisão: ${d}`);

  linhas.push('Detalhes no relatório anexo.');
  return linhas.join('\n');
}
