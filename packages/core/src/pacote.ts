import { somarDias } from './datas';
import { resumirSerie, serieSemanal } from './estatistica';
import { nomesTotais } from './leitor/totais';
import type { ComparativoSemanas, Frase } from './analise';
import type { Alerta } from './plano';
import type { CorSemaforo, ItemPlano, Pessoa, PlanoSemana, Promessa, Risco, Snapshot, TotaisPainel } from './tipos';

// texto inicial do dicionário do painel; a supervisora corrige o que não bater com o painel do gestor
export const dicionarioPadrao = [
  'Itens no cronograma: total de itens no cronograma do painel.',
  'Ainda em planejado: itens do cronograma que ainda não começaram.',
  'Em execução (cronograma): itens do cronograma com trabalho iniciado.',
  'Demandas em andamento: demandas com alguma etapa aberta.',
  'Com etapa rodando: demandas cuja etapa atual está sendo trabalhada agora.',
  'Paradas entre etapas ou na fila: demandas abertas cuja próxima etapa ainda não começou.',
  'Vencimento: data limite do item no cronograma.',
  'Previsão: data em que o painel estima a conclusão do item.',
  'Data fixada: item com data combinada que não pode mudar.',
  'Ritmo: classificação do painel para cada demanda em execução, comparando etapas concluídas com o prazo consumido: no ritmo, em risco ou atrasada.',
  'Atrasados (vencimento passou): itens ainda abertos cujo vencimento já passou. Não é o mesmo que atrasado no ritmo.',
  'Vencem em até 15 dias: itens abertos com vencimento nos próximos 15 dias.',
  'Concluídos: itens do cronograma já concluídos.',
  'Concluídas no período: entregas concluídas na janela de tempo que o painel considera.',
  'Dentro do prazo (%): percentual das entregas concluídas no período que saíram até o vencimento, calculado pelo painel.',
  'Meta do painel (%): meta de entregas dentro do prazo definida pelo gestor.',
  'Com previsão vencida: itens abertos cuja previsão já passou.',
  'Eficiência da área: índice do painel composto por prazo, vazão e qualidade.',
  'Parada há (faixas): há quantos dias as demandas abertas estão sem andar.',
  'Quem está cuidando de quê: lista do painel com cada demanda em execução, a etapa atual e o responsável por ela.',
].join('\n');

// cada linha "Termo: definição" vira um par
export function lerDicionario(texto: string): [string, string][]
{
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes(':'))
    .map((l) =>
    {
      const i = l.indexOf(':');
      const definicao = l.slice(i + 1).trim();
      return [l.slice(0, i).trim(), definicao.charAt(0).toUpperCase() + definicao.slice(1)] as [string, string];
    })
    .filter(([a, b]) => a && b);
}

export interface EntradaPacote
{
  area: string;
  prefixo: string;
  elaboradoPor?: string;
  destinatario?: string;
  inicio: string;
  dicionario: string;
  comp: ComparativoSemanas;
  meta?: number;
  semaforo?: CorSemaforo;
  fotos: Snapshot[];
  plano?: PlanoSemana;
  pessoas: Pessoa[];
  alertas: Alerta[];
  riscos: Risco[];
  promessasAnteriores: Promessa[];
  promessasDaSemana: Promessa[];
  frases: Frase[];
  notas: { destaques?: string; decisoes?: string; proximosPassos?: string };
}

const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
const n = (v?: number, suf = '') => (v === undefined ? '-' : `${String(v).replace('.', ',')}${suf}`);
const nomesStatus: Record<ItemPlano['status'], string> = { a_fazer: 'a fazer', fazendo: 'fazendo', feito: 'feito', bloqueado: 'bloqueado', adiado: 'adiado' };
const nomesCausa: Record<NonNullable<ItemPlano['causa']>, string> = {
  requisito_mudou: 'requisito mudou', dependencia_externa: 'dependência externa', estimativa_errada: 'estimativa errada',
  bloqueio: 'bloqueio', urgencia: 'entrou urgência', outro: 'outro',
};
const indicadoresSerie: (keyof TotaisPainel)[] = [
  'dentroDoPrazoPct', 'concluidos', 'concluidasNoPeriodo', 'demandasEmAndamento', 'ritmoNoRitmo', 'ritmoEmRisco', 'ritmoAtrasadas', 'atrasadosVencimento', 'eficiencia',
];

// texto para colar numa IA: ela só redige, os números já vêm prontos
export function montarPacote(e: EntradaPacote): string
{
  const s: string[] = [];
  const sexta = somarDias(e.inicio, 4);
  const nome = (id: string) => e.pessoas.find((p) => p.id === id)?.nome ?? id;
  const kp = e.comp.planoAtual;
  const kpa = e.comp.planoAnterior;

  s.push(
    '# Pedido',
    '',
    `Redija o relatório semanal de supervisão da área ${e.area} (${e.prefixo}), semana de ${dataCurta(e.inicio)} a ${dataCurta(sexta)}${e.destinatario ? `, para ${e.destinatario}` : ''}.`,
    '',
    'Regras:',
    '- Use somente os números deste pacote. Não recalcule, não arredonde e não estime nada.',
    '- Os números do painel do gestor são a fonte da verdade.',
    '- "Atrasado no ritmo" e "vencimento passou" são coisas diferentes; diga sempre qual.',
    '- Não invente causas. Sem causa registrada, escreva "causa não registrada".',
    '- Separe fato (o que os números mostram) de leitura (o que você interpreta). Marque leituras como "Leitura:".',
    '- Fale de carga, fluxo e processo, não de culpa. Não ranqueie pessoas.',
    '- Frases curtas, sem adjetivos vazios. Notícia ruim primeiro, com causa e plano.',
    '',
    'Entregue, nesta ordem:',
    '1. Resumo executivo em até 4 linhas, com o semáforo.',
    '2. Números que importam, com comparação à semana anterior.',
    '3. Leitura por pessoa (rascunho curto, marcado [PREENCHER]).',
    '4. Planejado x entregue, com o motivo do que não saiu.',
    '5. Riscos e plano B.',
    '6. Decisões que preciso do gestor, cada uma com prazo e consequência de não decidir.',
    '7. Sugestão de até 5 compromissos mensuráveis para a próxima semana (marcados [PREENCHER]).',
    '8. Mensagem para o Teams com 8 a 10 linhas, texto simples, terminando em "Detalhes no relatório anexo."',
    '',
    '# Contexto',
    '',
    `- Área: ${e.area} (${e.prefixo})`,
    `- Semana: ${dataCurta(e.inicio)} a ${dataCurta(sexta)}`,
    ...(e.elaboradoPor ? [`- Supervisora: ${e.elaboradoPor}`] : []),
    ...(e.destinatario ? [`- Leitor: ${e.destinatario}`] : []),
    `- Semáforo calculado: ${e.semaforo ?? 'sem dados'}${e.meta !== undefined ? ` (meta do painel: ${e.meta}%)` : ''}`,
    '',
    '# Dicionário do painel do gestor',
    '',
    ...lerDicionario(e.dicionario).map(([a, b]) => `- **${a}**: ${b}`),
    '',
  );

  const linhasTotais = e.comp.totais.filter((l) => l.atual !== undefined);
  if (linhasTotais.length)
  {
    s.push('# Números do painel', '', '| Indicador | Semana anterior | Esta semana | Variação |', '|---|---|---|---|');
    for (const l of linhasTotais)
    {
      const pct = l.chave.endsWith('Pct') ? '%' : '';
      s.push(`| ${nomesTotais[l.chave]} | ${n(l.anterior, pct)} | ${n(l.atual, pct)} | ${l.diferenca === undefined ? '-' : `${l.diferenca > 0 ? '+' : ''}${l.diferenca}${pct ? ' pp' : ''}`} |`);
    }
    s.push('');
  }

  const series = indicadoresSerie
    .map((chave) => ({ chave, r: resumirSerie(serieSemanal(e.fotos, chave, e.inicio).map((x) => x.valor)) }))
    .filter((x) => x.r && x.r.n >= 2);
  if (series.length)
  {
    s.push('# Série histórica (uma foto por semana)', '', '| Indicador | n | Média | Mediana | Desvio-padrão | Mín | Máx | Tendência por semana | Atual |', '|---|---|---|---|---|---|---|---|---|');
    for (const { chave, r } of series)
    {
      s.push(`| ${nomesTotais[chave]} | ${r!.n} | ${n(r!.media)} | ${n(r!.mediana)} | ${n(r!.desvio)} | ${r!.minimo} | ${r!.maximo} | ${r!.inclinacao > 0 ? '+' : ''}${n(r!.inclinacao)} | ${r!.ultimo} |`);
    }
    s.push('');
  }

  if (kp)
  {
    s.push(
      '# Plano da semana',
      '',
      `- Itens planejados feitos: ${kp.feitos} de ${kp.planejados}${kp.pctFeitos !== undefined ? ` (${kp.pctFeitos}%)` : ''}${kpa?.pctFeitos !== undefined ? `; semana anterior: ${kpa.feitos} de ${kpa.planejados} (${kpa.pctFeitos}%)` : ''}`,
      `- Não planejados feitos: ${kp.naoPlanejadosFeitos}`,
      `- Itens alterados (adiados ou com data mudada): ${kp.alterados}`,
      `- Continuidade no cronograma: ${kp.feitosComLimite ? `${kp.dentroDoCronograma} de ${kp.feitosComLimite} entregas dentro da previsão ou do vencimento do card (${kp.pctDentroDoCronograma}%)` : 'sem entregas ainda'}`,
      `- Plano ${e.plano?.fechadoEm ? `fechado em ${dataCurta(e.plano.fechadoEm)}` : 'ainda não fechado'}`,
      '',
    );
    for (const cp of e.comp.pessoas.filter((x) => x.atual.planejados > 0 || x.horas > 0))
    {
      const pp = e.plano?.pessoas.find((x) => x.pessoaId === cp.pessoa.id);
      s.push(`## ${cp.pessoa.nome}`, '', `- Feitos: ${cp.atual.feitos} de ${cp.atual.planejados}; horas planejadas: ${cp.horas}h de ${cp.pessoa.capacidadeHorasSemana}h; alertas: ${cp.alertas}`);
      if (pp?.dificuldade) s.push(`- Maior dificuldade relatada: ${pp.dificuldade}`);
      for (const i of pp?.itens ?? [])
      {
        const extras = [
          i.tipo === 'nao_planejado' ? 'não planejado' : '',
          i.ate ? `até ${dataCurta(i.ate)}${i.ateOriginal && i.ateOriginal !== i.ate ? `, era ${dataCurta(i.ateOriginal)}` : ''}` : '',
          i.frente ? `frente: ${i.frente}` : '',
          i.objetivo ? `para: ${i.objetivo}` : '',
          i.causa ? `causa: ${nomesCausa[i.causa]}` : '',
          i.motivoNaoFeito ? `motivo: ${i.motivoNaoFeito}` : '',
        ].filter(Boolean).join('; ');
        s.push(`- [${nomesStatus[i.status]}] ${i.cardCodigo ?? 'sem card'} ${i.descricao}${extras ? ` (${extras})` : ''}`);
      }
      s.push('');
    }
  }

  if (e.alertas.length)
  {
    s.push('# Alertas do plano contra o painel', '', ...e.alertas.map((a) => `- [${a.nivel}] ${nome(a.pessoaId)}: ${a.texto}`), '');
  }
  if (e.frases.length)
  {
    s.push('# Constatações do sistema (por regras)', '', ...e.frases.map((f) => `- [${f.tom}] ${f.texto}`), '');
  }
  const riscos = e.riscos.filter((r) => r.status === 'aberto');
  if (riscos.length)
  {
    s.push('# Riscos abertos', '');
    for (const r of riscos)
    {
      s.push(`- ${r.descricao} | probabilidade ${r.probabilidade}, impacto ${r.impacto} | gatilho: ${r.gatilho || '-'} | plano B: ${r.planoB || '-'}${r.decisaoNecessaria ? ` | decisão: ${r.decisaoNecessaria}${r.prazoDecisao ? ` até ${dataCurta(r.prazoDecisao)}` : ''}` : ''} | sinalizado em ${dataCurta(r.sinalizadoEm)}`);
    }
    s.push('');
  }
  const promessas = [...e.promessasAnteriores, ...e.promessasDaSemana];
  if (promessas.length)
  {
    s.push('# Compromissos com o gestor', '');
    for (const p of promessas)
    {
      const situacao = p.cumprida === true ? 'cumprido' : p.cumprida === false ? `não cumprido${p.justificativa ? ` (${p.justificativa})` : ''}` : 'em aberto';
      s.push(`- semana ${dataCurta(p.semana)}: ${p.texto} | ${situacao}`);
    }
    s.push('');
  }
  const notas: [string, string | undefined][] = [['Destaques', e.notas.destaques], ['Decisões que preciso', e.notas.decisoes], ['Próximos passos', e.notas.proximosPassos]];
  if (notas.some(([, v]) => v?.trim()))
  {
    s.push('# Notas da supervisora', '');
    for (const [rotulo, v] of notas.filter(([, x]) => x?.trim())) s.push(`**${rotulo}:**`, v!.trim(), '');
  }
  return s.join('\n').trim() + '\n';
}
