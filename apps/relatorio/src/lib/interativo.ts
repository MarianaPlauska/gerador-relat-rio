import
{
  agoraLocal, filtrarRegistros, itensDaFase, nomesSecoes, nomesTotais, progressoDosItens, segundaDaSemana, serieSemanal, situacaoDaFase,
  type Bloco, type CorSemaforo, type ItemInterativo, type Modelo, type RelatorioInterativo, type SecaoInterativa, type TotaisPainel,
} from '@supervisao/core';
import type { Dados, NotasRelatorio } from './armazenamento.ts';
import { imagensQueCabem } from './imagens.ts';
import { dataCurta, dataMedia, semaforoDoRelatorio, type Contexto } from './semana.ts';

const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };
const nomesSituacaoFase = { concluida: 'concluída', em_execucao: 'em execução', prevista: 'prevista', atrasada: 'atrasada' } as const;

const num = (n: number | undefined, sufixo = '') => (n === undefined ? '-' : `${n.toLocaleString('pt-BR')}${sufixo}`);
function sinal(d: number | undefined, sufixo = ''): string
{
  if (d === undefined) return '-';
  if (d === 0) return '=';
  return `${d > 0 ? '+' : ''}${(Math.round(d * 10) / 10).toLocaleString('pt-BR')}${sufixo}`;
}
const linhasDoTexto = (t?: string) => (t ?? '').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);

export interface EntradaInterativo
{
  dados: Dados;
  ctx: Contexto;
  notas: NotasRelatorio;
  resumo: string;
  modelo: Modelo;
  blocos: Bloco[];
}

// as seções do relatório que viram página na web; as outras ficam só no PDF e são listadas em "ignoradas"
const suportadas = new Set(['resumo', 'comparativo', 'atencao', 'riscos', 'compromissos', 'notas']);

export function montarInterativo({ dados, ctx, notas, resumo, modelo, blocos }: EntradaInterativo): { relatorio: RelatorioInterativo; ignoradas: string[] }
{
  const { atual, comp, livre } = ctx;
  const t: TotaisPainel = atual.foto?.totais ?? {};
  const cards = atual.foto?.cards ?? [];
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '';
  const semaforo = semaforoDoRelatorio(ctx, notas);
  const porChave = new Map(comp.totais.map((l) => [l.chave, l]));
  const fotosAte = dados.fotos.filter((f) => f.data <= ctx.fim);
  const serie = (chave: keyof TotaisPainel) =>
  {
    const s = serieSemanal(fotosAte, chave, segundaDaSemana(ctx.fim)).filter((x) => !livre || x.semana >= segundaDaSemana(atual.inicio));
    return livre ? s : s.slice(-10);
  };
  const frasesOcultas = new Set(notas.frasesOcultas ?? []);
  const secoes: SecaoInterativa[] = [];
  const ignoradas: string[] = [];
  const periodo = `${dataMedia(atual.inicio)} a ${dataMedia(ctx.fim)}`;
  let orcamentoImagens = 600_000;

  function tabelaDe(id: string, titulo: string, chaves: (keyof TotaisPainel)[])
  {
    const linhas = chaves.flatMap((chave) =>
    {
      const l = porChave.get(chave);
      if (!l || l.atual === undefined) return [];
      const pct = chave.endsWith('Pct');
      return [{ celulas: [nomesTotais[chave], num(l.anterior, pct ? '%' : ''), num(l.atual, pct ? '%' : ''), sinal(l.diferenca, pct ? ' pp' : '')] }];
    });
    if (linhas.length) secoes.push({ id, tipo: 'tabela', titulo, colunas: ['Indicador', livre ? 'Início' : 'Semana anterior', livre ? 'Fim' : 'Esta semana', 'Variação'], linhas });
  }

  const desenhar: Record<string, () => void> = {
    resumo: () =>
    {
      const paragrafos = [
        semaforo ? `Situação ${livre ? 'do período' : 'da semana'}: ${nomesSemaforo[semaforo]}${ctx.meta !== undefined && t.dentroDoPrazoPct !== undefined ? ` (${t.dentroDoPrazoPct}% dentro do prazo para uma meta de ${ctx.meta}%)` : ''}.` : '',
        resumo.trim(),
      ].filter(Boolean);
      if (paragrafos.length) secoes.push({ id: 'resumo', tipo: 'texto', titulo: nomesSecoes.resumo, paragrafos });
      const principais = [...ctx.frases.filter((f) => !frasesOcultas.has(f.texto))].sort((a, b) => Number(b.tom === 'atencao') - Number(a.tom === 'atencao')).filter((f) => f.tom !== 'neutro').slice(0, 5);
      if (principais.length) secoes.push({ id: 'constatacoes', tipo: 'itens', titulo: 'Principais constatações', itens: principais.map((f, i) => ({ id: `c${i}`, texto: f.texto, nivel: f.tom === 'atencao' ? 'alto' : 'baixo' })) });
    },
    comparativo: () => tabelaDe('comparativo', `Indicadores do painel: ${livre ? 'início x fim' : 'semana anterior x esta semana'}`, ['dentroDoPrazoPct', 'concluidos', 'concluidosPct', 'demandasEmAndamento', 'ritmoNoRitmo', 'ritmoEmRisco', 'ritmoAtrasadas', 'vencem15Dias', 'eficiencia']),
    atencao: () =>
    {
      const itens: ItemInterativo[] = ctx.alertas.map((a, i) => ({ id: `a${i}`, texto: a.texto, nivel: a.nivel === 'alto' ? 'alto' : 'medio' }));
      const emRisco = cards.filter((c) => c.origens.includes('em_execucao') && (c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || (c.previsao ?? '9999') < atual.inicio));
      for (const c of emRisco) itens.push({ id: `d-${c.codigo}`, texto: `${c.codigo}: ${c.titulo}`, detalhe: [c.etapaAtual, nomePessoa(c.responsavelEtapaAtual), c.previsao && `previsão ${dataMedia(c.previsao)}`].filter(Boolean).join(' - '), nivel: c.ritmoPainel === 'atrasado' ? 'alto' : 'medio' });
      if (itens.length) secoes.push({ id: 'atencao', tipo: 'itens', titulo: nomesSecoes.atencao, intro: 'Marque o que você já viu e escreva se algo precisa de resposta.', itens });
    },
    riscos: () =>
    {
      const riscos = dados.riscos.filter((r) => r.status === 'aberto' || (r.sinalizadoEm >= atual.inicio && r.sinalizadoEm <= ctx.fim));
      if (!riscos.length) return;
      secoes.push({
        id: 'riscos', tipo: 'itens', titulo: nomesSecoes.riscos,
        itens: riscos.map((r) => ({
          id: `r-${r.id}`, texto: r.descricao, nivel: r.impacto === 'alto' || r.probabilidade === 'alta' ? 'alto' : 'medio',
          detalhe: [`probabilidade ${r.probabilidade}, impacto ${r.impacto}`, r.planoB && `plano B: ${r.planoB}`, r.decisaoNecessaria && `decisão necessária: ${r.decisaoNecessaria}${r.prazoDecisao ? ` até ${dataMedia(r.prazoDecisao)}` : ''}`].filter(Boolean).join('. '),
        })),
      });
    },
    compromissos: () =>
    {
      if (!ctx.promessas.length) return;
      secoes.push({
        id: 'compromissos', tipo: 'itens', titulo: nomesSecoes.compromissos,
        itens: ctx.promessas.map((x) => ({
          id: `p-${x.id}`, texto: x.texto, nivel: x.cumprida === false ? 'alto' : 'baixo',
          detalhe: `${dataCurta(x.semana)} - ${x.cumprida === true ? 'cumprido' : x.cumprida === false ? `não cumprido${x.justificativa ? `: ${x.justificativa}` : ''}` : 'em aberto'}`,
        })),
      });
    },
    notas: () =>
    {
      const destaques = linhasDoTexto(notas.destaques);
      const decisoes = linhasDoTexto(notas.decisoes);
      const proximos = linhasDoTexto(notas.proximosPassos);
      if (destaques.length) secoes.push({ id: 'destaques', tipo: 'itens', titulo: `Destaques ${livre ? 'do período' : 'da semana'}`, itens: destaques.map((x, i) => ({ id: `h${i}`, texto: x })) });
      if (decisoes.length) secoes.push({ id: 'decisoes', tipo: 'itens', titulo: 'Decisões e apoio necessários da gestão', intro: 'Aqui sua resposta é a mais importante: marque Concordo ou escreva o que precisa mudar.', itens: decisoes.map((x, i) => ({ id: `x${i}`, texto: x, nivel: 'alto' })) });
      if (proximos.length) secoes.push({ id: 'proximos', tipo: 'itens', titulo: 'Próximos passos', itens: proximos.map((x, i) => ({ id: `n${i}`, texto: x })) });
    },
  };

  blocos.forEach((b, posicao) =>
  {
    if (b.tipo === 'secao')
    {
      if (suportadas.has(b.secao)) desenhar[b.secao]!();
      else ignoradas.push(nomesSecoes[b.secao]);
    }
    else if (b.tipo === 'texto')
    {
      secoes.push({ id: `texto-${posicao}`, tipo: 'texto', titulo: b.titulo || 'Observações', paragrafos: linhasDoTexto(b.texto) });
    }
    else if (b.tipo === 'grafico')
    {
      const pontos = serie(b.indicador).map((x) => ({ rotulo: dataCurta(x.semana), valor: x.valor }));
      if (pontos.length >= 2) secoes.push({ id: `grafico-${posicao}`, tipo: 'grafico', titulo: b.titulo || nomesTotais[b.indicador], pontos, ...(b.comMeta && ctx.meta !== undefined ? { meta: ctx.meta } : {}), ...(b.indicador.endsWith('Pct') ? { sufixo: '%' } : {}) });
    }
    else if (b.tipo === 'tabela')
    {
      tabelaDe(`tabela-${posicao}`, b.titulo || 'Indicadores', b.indicadores);
    }
    else if (b.tipo === 'lista')
    {
      for (const l of dados.listas.filter((x) => !b.listaId || x.id === b.listaId))
      {
        const pr = progressoDosItens(l, l.itens);
        const linhas = [...l.fases.map((f) => ({ fase: f, itens: itensDaFase(l, f.id) })), { fase: undefined, itens: itensDaFase(l, undefined) }]
          .filter((g) => g.fase || g.itens.length)
          .map(({ fase, itens }) =>
          {
            const pf = progressoDosItens(l, itens);
            return { celulas: [fase?.nome ?? 'Sem fase', fase ? nomesSituacaoFase[situacaoDaFase(l, fase, ctx.fim)] : '-', `${pf.concluidos}/${pf.total}`, `${pf.pct}%`] };
          });
        secoes.push({ id: `lista-${l.id}`, tipo: 'tabela', titulo: `${l.nome}: ${pr.concluidos} de ${pr.total} itens concluídos (${pr.pct}%)`, colunas: ['Fase', 'Situação', 'Itens', '%'], linhas });
      }
    }
    else if (b.tipo === 'pessoa')
    {
      for (const x of ctx.comp.pessoas.filter((q) => (b.pessoaId ? q.pessoa.id === b.pessoaId : q.atual.planejados > 0)))
      {
        const itens = ctx.atual.plano?.pessoas.find((q) => q.pessoaId === x.pessoa.id)?.itens ?? [];
        if (!itens.length) continue;
        secoes.push({
          id: `pessoa-${x.pessoa.id}`, tipo: 'itens', titulo: `1:1 - ${x.pessoa.nome}: ${x.atual.feitos} de ${x.atual.planejados} itens feitos`,
          itens: itens.map((i) => ({ id: `i-${i.id}`, texto: `${i.cardCodigo ?? 'sem card'} - ${i.descricao}`, detalhe: `até ${dataCurta(i.ate)} - ${i.status.replace('_', ' ')}${i.objetivo ? `. Para quê: ${i.objetivo}` : ''}` })),
        });
      }
    }
    else if (b.tipo === 'fluxograma')
    {
      for (const f of dados.fluxos.filter((x) => !b.fluxoId || x.id === b.fluxoId))
        if (f.nos.length) secoes.push({ id: `fluxo-${f.id}`, tipo: 'fluxo', titulo: b.titulo && dados.fluxos.length === 1 ? b.titulo : f.nome, nos: f.nos, ligacoes: f.ligacoes });
    }
    else if (b.tipo === 'anotacao')
    {
      for (const r of filtrarRegistros(dados.registros, { pasta: b.pasta, ids: b.registroIds, data: b.data, de: atual.inicio, ate: ctx.fim }))
      {
        const candidatas = b.comImagens !== false ? r.capturas.filter((c) => c.imagemDataUrl).slice(0, 4).map((c) => ({ nome: c.nome.split(' · ')[0] ?? c.nome, dataUrl: c.imagemDataUrl! })) : [];
        // o link publicado é um documento só (limite de 1 MB): as imagens dividem um orçamento para o relatório todo
        const imagens = imagensQueCabem(candidatas, orcamentoImagens);
        orcamentoImagens -= imagens.reduce((acc, i) => acc + i.dataUrl.length, 0);
        secoes.push({
          id: `registro-${r.id}`,
          tipo: 'texto',
          titulo: b.titulo ? `${b.titulo} (${dataMedia(r.data)})` : `${dataMedia(r.data)} · ${r.pasta}${r.motivo ? ` · ${r.motivo}` : ''}`,
          paragrafos: r.texto.split('\n\n').filter(Boolean),
          ...(imagens.length ? { imagens } : {}),
        });
      }
    }
  });

  return {
    relatorio: {
      titulo: modelo.titulo,
      subtitulo: dados.identificacao.area,
      periodo: `${livre ? 'Período' : 'Semana'} de ${periodo}`,
      ...(semaforo ? { situacao: nomesSemaforo[semaforo] } : {}),
      ...(dados.identificacao.elaboradoPor ? { autor: dados.identificacao.elaboradoPor } : {}),
      geradoEm: agoraLocal(),
      secoes,
    },
    ignoradas: [...new Set(ignoradas)],
  };
}
