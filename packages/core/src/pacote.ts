import { somarDias } from './datas';
import { resumirSerie, serieSemanal } from './estatistica';
import { nomesTotais } from './leitor/totais';
import type { ComparativoSemanas, Frase } from './analise';
import type { Alerta } from './plano';
import type { CorSemaforo, ItemPlano, Pessoa, PlanoSemana, Promessa, Risco, Snapshot, TotaisPainel } from './tipos';

// texto inicial do dicionário: definições como o painel do gestor mostra nas telas, mais os termos de fluxo do OrbisOS
export const dicionarioPadrao = [
  'Itens no cronograma: itens com onda no cronograma, tudo o que está em aberto e o que foi concluído nos últimos 60 dias.',
  'Onda: janela de prioridade do cronograma (Prioridade 1, 2...), com início, fim, itens, concluídos e próximo vencimento.',
  'Ainda em planejado: itens do cronograma que ainda não começaram.',
  'Em execução (cronograma): itens que começaram e não vencem nos próximos 15 dias.',
  'Vencem em até 15 dias: itens abertos com vencimento nos próximos 15 dias; é a atenção da semana.',
  'Atrasados (vencimento passou): itens ainda abertos cujo vencimento já passou. Não é o mesmo que atrasado no ritmo.',
  'Datas fixadas: previsão ajustada à mão ou card já assumido (marcados com estrela).',
  'Concluídos: itens do cronograma já concluídos, com o percentual do total.',
  'Demandas em andamento: demandas abertas, separadas entre as que têm etapa rodando agora e as paradas entre etapas ou na fila.',
  'Etapas concluídas: etapas fechadas no período, com a variação contra os 30 dias anteriores.',
  'Tempo mediano por etapa: metade das etapas fecha em até esse tempo.',
  'Ritmo x prazo: compara as etapas feitas com o prazo já gasto de cada demanda: no ritmo, em risco ou atrasada.',
  'Ocioso entre etapas: tempo em que a demanda ficou parada entre uma etapa e outra, só em expediente (seg-sex, 8h-18h), sem contar espera de terceiro nem o tempo em que a pessoa rodava outra demanda.',
  'Em aberto agora: demandas abertas, com a idade em faixas (até 1 dia, 1-3, 3-7, 7-15 e mais de 15 dias) e quantas estão fora do prazo.',
  'Dentro do prazo (%): percentual das entregas do período que saíram até o prazo, calculado pelo painel, com a meta e quantos p.p. faltam.',
  'Meta do painel (%): meta de entregas dentro do prazo definida pelo gestor.',
  'Tempo limpo (mediana): tempo de execução das demandas sem espera com cliente nem com times internos; a média acima da mediana indica poucas demandas longas puxando o número.',
  'Previsões desta semana: demandas com previsão nos próximos 5 dias úteis; com previsão vencida são as que já passaram.',
  'Eficiência da área: índice do painel com régua Prazo 40%, Produção (vazão) 35% e Qualidade 25%; abaixo de 85 em algum critério vira ponto a melhorar.',
  'Vazão: percentual do que entrou que foi entregue; abaixo de 100% a fila cresce.',
  'Qualidade: percentual das etapas concluídas sem reabrir.',
  'Nível de dificuldade: o tipo da demanda traz as etapas-modelo e o prazo vem do nível (Baixo: planejamento da semana, prazo na sexta-feira).',
  'Prazo de resposta: prazo definido na triagem do suporte; vale no lugar da régua do nível.',
  'Status do card: Novo, Planejado (com a data em que começa), Em andamento, Aguardando cliente ou outro time, Resolvido ou Cancelado.',
  'Horas (lista de demandas): horas corridas da abertura até a conclusão do card, como o painel registra.',
  'Tempo de entrega p50 e p85: dias da abertura à conclusão em que ficam 50% e 85% das entregas; o p85 é a referência de normal (prática de fluxo Kanban).',
  'Parado além do normal: demanda aberta há mais tempo que o p85 das entregas da mesma prioridade.',
  'Projeção da meta: onde o dentro do prazo chega no fim do mês se a tendência das últimas semanas continuar.',
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
