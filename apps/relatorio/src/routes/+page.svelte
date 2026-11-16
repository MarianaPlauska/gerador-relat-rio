<script lang="ts">
  import
  {
    acoesDeHoje, alternarItem, definicoesPadrao, diasUteisEntre, historico, itemFeito, linhaDoTempo, progressoDaLista, progressoVivo, registrouHoje, resumoDoFluxo,
    segundaDaSemana, serieSemanal, somarDias, textoProjecao,
    type Destino, type Evento, type TotaisPainel,
  } from '@supervisao/core';
  import { Tabs } from 'bits-ui';
  import { goto } from '$app/navigation';
  import { carregar, salvar, type Dados, type NotasRelatorio } from '#lib/armazenamento.ts';
  import { svgLinha, svgSparkline } from '#lib/graficos.ts';
  import { chaveDoRelatorio } from '#lib/modelos.ts';
  import { nuvem, sairDaNuvem } from '#lib/nuvem.svelte.ts';
  import { baixarTexto, copiar, textoPacote, textoTeams } from '#lib/saidas.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, periodoDaSemana, semaforoDoRelatorio, semanasDisponiveis } from '#lib/semana.ts';
  import { lerSessao } from '#lib/sessao.ts';

  const dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));
  const dia = hoje();
  let semana = $state(segundaDaSemana(dia));
  let copiado = $state('');
  let abaSemana = $state('percebido');
  let abaLateral = $state('listas');

  const vivosAbertos = $derived(dados.vivos.filter((v) => !v.encerradoEm));
  const vivoDaSemana = $derived(vivosAbertos.find((v) => !v.livre && v.inicio === semana));

  const ctx = $derived(contextoDaSemana(dados, semana));
  const notas = $derived<NotasRelatorio>(dados.relatorios[semana] ?? {});
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const ta = $derived<TotaisPainel>(ctx.anterior?.foto?.totais ?? {});
  const kp = $derived(ctx.comp.planoAtual);
  const fotosAteSemana = $derived(dados.fotos.filter((f) => f.data <= ctx.fim));
  const serie = (chave: keyof TotaisPainel) => historico(fotosAteSemana, chave).slice(-8);
  const promessasDaSemana = $derived(dados.promessas.filter((p) => p.semana === semana));
  const emAberto = $derived(promessasDaSemana.filter((p) => p.cumprida === undefined));

  const acoes = $derived(acoesDeHoje({
    hoje: dia,
    inicio: semana,
    fotos: dados.fotos,
    plano: ctx.atual.plano,
    alertas: ctx.alertas,
    riscos: dados.riscos,
    promessasDaSemana,
    promessasAnteriores: ctx.promessasAnteriores,
    listas: dados.listas,
  }));
  const fluxo = $derived(resumoDoFluxo(ctx.atual.foto?.cards ?? [], ctx.atual.foto?.data ?? dia, serieSemanal(fotosAteSemana, 'dentroDoPrazoPct', semana), ctx.meta));
  const nomePessoa = (id: string) => dados.pessoas.find((p) => p.id === id)?.nome.split(' ')[0] ?? id;
  const eventos = $derived(linhaDoTempo(dados.fotos, ctx.atual.plano, dados.riscos, dados.pessoas, semana));
  const eventosPorDia = $derived(Object.entries(eventos.reduce<Record<string, Evento[]>>((m, e) => ((m[e.data] ??= []).push(e), m), {})));

  const rotas: Record<Destino, string> = { painel: '/painel', semana: '/semana', cards: '/cards', relatorio: '/relatorio', listas: '/listas' };
  const iconeEvento: Record<Evento['tipo'], string> = {
    foto: '[foto]', etapa: '[etapa]', previsao: '[previsão]', ritmo: '[ritmo]', entrou: '[entrou]', saiu: '[saiu]', plano: '[plano]', entrega: '[entrega]', risco: '[risco]',
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || '').split(' ')[0]);

  const ultimaFoto = $derived([...dados.fotos].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);
  // atenção primeiro: com a lista recolhida, o que importa aparece
  const ordemTom = { atencao: 0, positivo: 1, neutro: 2 };
  const frasesOrdenadas = $derived([...ctx.frases].sort((a, b) => ordemTom[a.tom] - ordemTom[b.tom]));
  let todasFrases = $state(false);

  // rotina do ciclo: sexta fecha a semana; nos últimos dias úteis do mês, o relatório do período
  const ultimoDiaDoMes = `${dia.slice(0, 8)}${String(new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
  const ehSexta = new Date(`${dia}T12:00:00`).getDay() === 5;
  const fimDeMes = diasUteisEntre(dia, ultimoDiaDoMes, definicoesPadrao.feriados) <= 2;

  function variacao(chave: keyof TotaisPainel, sufixo = ''): string
  {
    const a = ta[chave];
    const b = t[chave];
    if (a === undefined || b === undefined) return '';
    const d = b - a;
    return `${d > 0 ? '+' : ''}${d}${sufixo} na semana`;
  }

  async function copiarSaida(nome: string, texto: string)
  {
    await copiar(texto);
    copiado = nome;
    setTimeout(() => (copiado = ''), 2000);
  }

  // 1:1 de uma pessoa: o relatório da semana abre com o modelo 1:1 só com ela
  function abrirUmAUm(pessoaId: string)
  {
    const chave = chaveDoRelatorio(periodoDaSemana(semana));
    const atuais = dados.relatorios[chave] ?? {};
    dados.relatorios[chave] = { ...atuais, blocos: { ...atuais.blocos, umaum: [{ tipo: 'pessoa', pessoaId }] } };
    dados.ultimoModelo = 'umaum';
    salvar($state.snapshot(dados));
    goto(`/relatorio?semana=${semana}`);
  }
  const nomesSemaforo: Record<string, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };
  const semaforo = $derived(semaforoDoRelatorio(ctx, {}));
  const cardsFoto = $derived(ultimaFoto?.cards ?? []);
  const base = $derived(cardsFoto.filter((c) => c.origens.includes('em_execucao')).length ? cardsFoto.filter((c) => c.origens.includes('em_execucao')) : cardsFoto);
  const pessoasPainel = $derived(dados.pessoas.map((p) =>
  {
    const meus = base.filter((c) => c.responsavelEtapaAtual === p.id);
    return { pessoa: p, total: meus.length, noRitmo: meus.filter((c) => c.ritmoPainel === 'no_ritmo').length, emRisco: meus.filter((c) => c.ritmoPainel === 'em_risco').length, atrasado: meus.filter((c) => c.ritmoPainel === 'atrasado').length };
  }));
  const atencao = $derived(
    base
      .filter((c) => c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || c.situacao === 'atrasado')
      .sort((a, b) => Number(b.ritmoPainel === 'atrasado' || b.situacao === 'atrasado') - Number(a.ritmoPainel === 'atrasado' || a.situacao === 'atrasado'))
      .slice(0, 6),
  );
  const vencimentos = $derived(
    cardsFoto
      .filter((c) => c.vencimento && c.vencimento >= dia && c.vencimento <= somarDias(dia, 15))
      .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
      .slice(0, 6),
  );
  const registrosRecentes = $derived([...dados.registros].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)).slice(0, 3));

</script>

<main>
  <header>
    <div>
      <span class="prompt">&gt; {saudacao.toLowerCase()}{primeiroNome ? `, ${primeiroNome.toLowerCase()}` : ''}</span>
      <h1>Início<span class="cursor">_</span></h1>
    </div>
    <select bind:value={semana} aria-label="Semana">
      {#each semanasDisponiveis(dados) as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
    </select>
  </header>

  {#if !ultimaFoto}
    <p class="aviso">Nenhuma foto do painel ainda. <a href="/painel">Colar o painel</a> para começar.</p>
  {:else if diasDesdeFoto >= 2}
    <p class="aviso">A última foto do painel é de {dataCurta(ultimaFoto.data)}, há {diasDesdeFoto} dias úteis. <a href="/painel">Colar o painel</a></p>
  {/if}

  {#if ultimaFoto}
    <section class="situacao {semaforo ?? 'sem'}">
      <div class="sit-status">
        <span class="sit-rotulo">como estamos hoje</span>
        <b class="sit-valor">{semaforo ? nomesSemaforo[semaforo] : 'Sem leitura'}</b>
        <span class="sit-detalhe">
          {#if t.dentroDoPrazoPct !== undefined}{t.dentroDoPrazoPct}% dentro do prazo{ctx.meta !== undefined ? ` · meta ${ctx.meta}%` : ''}{:else}cole um painel para medir o prazo{/if}
        </span>
      </div>
      <div class="sit-itens">
        <div><b>{base.length}</b><span>demandas em acompanhamento</span></div>
        <div class:vermelho={atencao.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length > 0}><b>{atencao.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length}</b><span>atrasadas</span></div>
        <div class:amarelo={atencao.filter((c) => c.ritmoPainel === 'em_risco').length > 0}><b>{atencao.filter((c) => c.ritmoPainel === 'em_risco').length}</b><span>em risco</span></div>
        <div><b>{vencimentos.length}</b><span>vencem em 15 dias</span></div>
      </div>
      <span class="sit-data">painel de {dataMedia(ultimaFoto.data)}</span>
    </section>
  {/if}

  <section class="kpis">
    <div class="kpi">
      <span class="etiqueta">dentro do prazo</span>
      <span class="valor">{t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}%` : '-'}</span>
      <span class="detalhe">
        {#if ctx.meta !== undefined && t.dentroDoPrazoPct !== undefined}
          meta {ctx.meta}% · <b class:abaixo={t.dentroDoPrazoPct < ctx.meta}>{t.dentroDoPrazoPct - ctx.meta >= 0 ? '+' : ''}{t.dentroDoPrazoPct - ctx.meta} pp</b>
        {/if}
        {variacao('dentroDoPrazoPct', ' pp')}
      </span>
      {@html svgSparkline(serie('dentroDoPrazoPct').map((p) => p.valor))}
    </div>
    <div class="kpi">
      <span class="etiqueta">concluídos</span>
      <span class="valor">{t.concluidos ?? '-'}</span>
      <span class="detalhe">{t.itensCronograma !== undefined ? `de ${t.itensCronograma} itens` : ''} {variacao('concluidos')}</span>
      {@html svgSparkline(serie('concluidos').map((p) => p.valor))}
    </div>
    <div class="kpi">
      <span class="etiqueta">plano da semana</span>
      <span class="valor">{kp ? `${kp.feitos}/${kp.planejados}` : '-'}</span>
      <span class="detalhe">{kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% feito` : 'sem plano ainda'}{ctx.comp.planoAnterior?.pctFeitos !== undefined ? ` · anterior ${ctx.comp.planoAnterior.pctFeitos}%` : ''}</span>
      <span class="barra"><span style:width="{kp?.pctFeitos ?? 0}%"></span></span>
    </div>
    <a class="kpi" href="/semana" class:alerta={ctx.alertas.length > 0}>
      <span class="etiqueta">alertas</span>
      <span class="valor">{ctx.alertas.length}</span>
      <span class="detalhe">{ctx.alertas.length ? 'itens que passam do que o painel espera' : 'nada passa do painel'}</span>
    </a>
  </section>

  <section class="atalhos">
    <a href="/painel"><b>＋ Novo registro</b><span>cole prints e comente</span></a>
    <a href="/relatorio"><b>Gerar relatório</b><span>PDF ou link</span></a>
    <a href="/fluxos"><b>Novo fluxo</b><span>de texto, semana ou registro</span></a>
    <a href="/semana"><b>Plano da semana</b><span>entregas e alertas</span></a>
  </section>
  
  <div class="grade controle">
    <section class="cartao">
      <h2>Precisa de atenção</h2>
      {#each atencao as c (c.codigo)}
        <p class="linha-fluxo">
          <b class="maquina">{c.codigo}</b> {c.titulo ?? ''}
          <span class="dica">{[c.etapaAtual, c.responsavelEtapaAtual && nomePessoa(c.responsavelEtapaAtual), c.ritmoPainel && c.ritmoPainel.replace('_', ' '), c.previsao && `previsão ${dataMedia(c.previsao)}`].filter(Boolean).join(' · ')}</span>
        </p>
      {:else}
        <p class="dica">{ultimaFoto ? 'Nenhuma demanda atrasada ou em risco na última leitura.' : 'Sem leitura do painel ainda.'}</p>
      {/each}
      {#if vencimentos.length}
        <h3 class="sub-h">Vencendo nos próximos 15 dias</h3>
        {#each vencimentos as c (c.codigo)}
          <p class="linha-fluxo"><b class="maquina">{c.codigo}</b> {c.titulo ?? ''} <span class="dica">vence {dataMedia(c.vencimento)}</span></p>
        {/each}
      {/if}
    </section>
  
    <section class="cartao">
      <h2>Demandas por pessoa</h2>
      {#each pessoasPainel as x (x.pessoa.id)}
        <div class="pessoa">
          <div class="linha"><b>{x.pessoa.nome}</b><span class="dica maquina">{x.total} {x.total === 1 ? 'demanda' : 'demandas'}</span></div>
          <span class="pilha" title="no ritmo / em risco / atrasadas">
            <span class="p-ok" style:flex={x.noRitmo}></span><span class="p-risco" style:flex={x.emRisco}></span><span class="p-atraso" style:flex={x.atrasado}></span>
            {#if !x.total}<span class="p-vazio"></span>{/if}
          </span>
          <span class="dica maquina">{x.noRitmo} no ritmo · {x.emRisco} em risco · {x.atrasado} atrasadas</span>
        </div>
      {/each}
    </section>
  </div>
  
  <section class="cartao diario-recente">
    <div class="linha"><h2>Últimos registros do diário</h2><a class="link-secao" href="/painel">abrir diário</a></div>
    {#each registrosRecentes as r (r.id)}
      <p class="linha-fluxo"><b>{dataCurta(r.data)} · {r.pasta}</b> {r.motivo || r.resumo || 'Sem motivo'} <span class="dica">{r.capturas.length} prints · {r.cards.length} cards</span></p>
    {:else}
      <p class="dica">Nada guardado ainda. Cole um print no diário e comente: ele fica aqui para virar relatório quando você quiser.</p>
    {/each}
  </section>

  <div class="grade">
    <section class="cartao">
      <h2>Hoje</h2>
      {#if ehSexta}
        <p class="rotina">Sexta: <a href="/semana">fechar a semana</a>{#if vivoDaSemana}, depois <a href="/vivos?id={vivoDaSemana.id}">abrir o checklist diário</a>{/if}.</p>
      {/if}
      {#if fimDeMes}
        <p class="rotina">Fim do mês: <a href="/mes">gerar o relatório do período</a>.</p>
      {/if}
      {#each vivosAbertos as v (v.id)}
        {@const pr = progressoVivo(v, dia)}
        <div class="vivo">
          <div class="linha"><a href="/vivos?id={v.id}"><b>{v.nome}</b></a><span class="dica maquina">{pr.feitos}/{pr.total}</span></div>
          {#each v.itens.filter((i) => i.diario) as item (item.id)}
            <label class="item-vivo"><input type="checkbox" checked={itemFeito(item, dia)} onchange={() => alternarItem(item, dia)} /> <span class:feito={itemFeito(item, dia)}>{item.texto}</span></label>
          {/each}
          {#if !registrouHoje(v, dia)}<a class="registrar" href="/vivos?id={v.id}">registrar o dia</a>{/if}
        </div>
      {/each}
      <ul class="acoes">
        {#each acoes.slice(0, 5) as a, i (i)}
          <li class={a.nivel}>
            <i></i>
            <span>{a.texto}</span>
            {#if a.destino}<a href={rotas[a.destino]}>abrir</a>{/if}
          </li>
        {/each}
      </ul>
      {#if !vivosAbertos.length}<a class="link-secao" href="/vivos">criar um checklist diário para preencher todo dia</a>{/if}
    </section>

    <section class="cartao">
      <h2>Time</h2>
      {#each ctx.comp.pessoas as p (p.pessoa.id)}
        <div class="pessoa">
          <div class="linha">
            <b>{p.pessoa.nome}</b>
            <span class="direita">
              {#if p.alertas}<span class="pilula vermelho">{p.alertas}</span>{/if}
              <button class="link" onclick={() => abrirUmAUm(p.pessoa.id)}>1:1</button>
            </span>
          </div>
          <span class="barra clara"><span style:width="{p.atual.pctFeitos ?? 0}%"></span></span>
          <span class="dica maquina">
            {p.atual.feitos}/{p.atual.planejados} feitos · <span class:estourou={p.horas > p.pessoa.capacidadeHorasSemana}>{p.horas}h de {p.pessoa.capacidadeHorasSemana}h</span>
          </span>
        </div>
      {/each}
    </section>
  </div>

  <details class="mais">
    <summary>Análise completa: evolução, fluxo, linha do tempo e saídas</summary>
    <div class="grade">
      <div class="coluna">
        {#if serie('dentroDoPrazoPct').length >= 2}
          <section class="cartao">
            <h2>Evolução do prazo</h2>
            <div class="grafico">{@html svgLinha(serie('dentroDoPrazoPct').map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { meta: ctx.meta, sufixo: '%', largura: 760 })}</div>
          </section>
        {/if}

        <section class="cartao">
          <h2>Fluxo</h2>
          <div class="projecao">
            {#if fluxo.projecao}
              <p class="veredito {fluxo.projecao.veredito}">meta de prazo no fim do mês: {fluxo.projecao.veredito === 'bate' ? 'deve bater' : fluxo.projecao.veredito === 'perto' ? 'perto da meta' : 'não deve bater'} ({fluxo.projecao.projetado.toLocaleString('pt-BR')}% para {fluxo.projecao.meta}%)</p>
              <p class="dica">{textoProjecao(fluxo.projecao)}</p>
            {:else}
              <p class="dica">A projeção da meta precisa de 3 semanas com "dentro do prazo" e a meta do painel.</p>
            {/if}
          </div>
          <div class="colunas-fluxo">
            <div>
              <h3>Parados além do normal ({fluxo.parados.length})</h3>
              {#each fluxo.parados.slice(0, 5) as x (x.card.codigo)}
                <p class="linha-fluxo"><b class="maquina">{x.card.codigo}</b> {x.card.titulo} <span class="dica">{x.idadeDias.toLocaleString('pt-BR')} d aberto, normal até {x.limiteDias.toLocaleString('pt-BR')} d ({x.base}){x.card.responsaveis.length ? ` - ${x.card.responsaveis.map(nomePessoa).join(', ')}` : ''}</span></p>
              {:else}
                <p class="dica">{fluxo.tempos.geral ? 'Nenhuma demanda aberta além do normal.' : 'Importe o CSV da lista de Demandas no Diário do painel para medir o normal.'}</p>
              {/each}
            </div>
            <div>
              <h3>Onde as demandas se acumulam</h3>
              {#each fluxo.gargalos.slice(0, 5) as g (g.etapa)}
                <p class="linha-fluxo"><b>{g.etapa}</b> <span class="dica">{g.quantidade} {g.quantidade === 1 ? 'demanda' : 'demandas'}{g.esperando ? `, ${g.esperando} esperando começar` : ''}{g.maiorRodandoDias !== undefined ? `, maior tempo rodando ${g.maiorRodandoDias.toLocaleString('pt-BR')} d` : ''}</span></p>
              {:else}
                <p class="dica">Cole o "Quem está cuidando de quê" ou um card aberto para ver as etapas.</p>
              {/each}
            </div>
          </div>
        </section>

        <section class="cartao">
          <h2>Esta semana</h2>
          <Tabs.Root bind:value={abaSemana}>
            <Tabs.List class="abas">
              <Tabs.Trigger value="percebido" class="aba">O que o sistema percebeu ({ctx.frases.length})</Tabs.Trigger>
              <Tabs.Trigger value="tempo" class="aba">Linha do tempo</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="percebido">
              {#if ctx.frases.length}
                <ul class="frases">
                  {#each todasFrases ? frasesOrdenadas : frasesOrdenadas.slice(0, 6) as f, i (i)}<li class={f.tom}><i></i>{f.texto}</li>{/each}
                </ul>
                {#if frasesOrdenadas.length > 6}
                  <button class="link" onclick={() => (todasFrases = !todasFrases)}>{todasFrases ? 'mostrar menos' : `ver todas (${frasesOrdenadas.length})`}</button>
                {/if}
              {:else}
                <p class="dica">Cole o painel e monte o plano para o sistema comparar com a semana anterior.</p>
              {/if}
            </Tabs.Content>
            <Tabs.Content value="tempo">
              {#each eventosPorDia as [data, lista] (data)}
                <div class="dia-tempo">
                  <span class="data maquina">{dataMedia(data)}</span>
                  <ul>
                    {#each lista as e, i (i)}<li class={e.tipo}><span class="tipo maquina">{iconeEvento[e.tipo]}</span> {e.texto}</li>{/each}
                  </ul>
                </div>
              {:else}
                <p class="dica">Nada registrado nesta semana ainda.</p>
              {/each}
            </Tabs.Content>
          </Tabs.Root>
        </section>
      </div>

      <aside class="coluna">
        <section class="cartao saidas">
          <h2>Saídas</h2>
          <a class="saida principal" href="/relatorio"><b>Gerar PDF</b><span>semanal, executivo, período ou seus modelos</span></a>
          <button class="saida" onclick={() => copiarSaida('teams', textoTeams(dados, ctx, notas))}>
            <b>{copiado === 'teams' ? 'Copiado!' : 'Mensagem do Teams'}</b><span>8 a 10 linhas, pronta para colar</span>
          </button>
          <button class="saida" onclick={() => copiarSaida('pacote', textoPacote(dados, ctx, notas))}>
            <b>{copiado === 'pacote' ? 'Copiado!' : 'Pacote para IA'}</b><span>números conferidos + dicionário; a IA só escreve</span>
          </button>
          <button class="link" onclick={() => baixarTexto(textoPacote(dados, ctx, notas), `pacote-ia-${dados.prefixo}-${semana}.md`)}>baixar pacote .md</button>
        </section>

        <section class="cartao">
          <h2>Em andamento</h2>
          <Tabs.Root bind:value={abaLateral}>
            <Tabs.List class="abas">
              <Tabs.Trigger value="listas" class="aba">Listas</Tabs.Trigger>
              <Tabs.Trigger value="compromissos" class="aba">Compromissos{emAberto.length ? ` (${emAberto.length})` : ''}</Tabs.Trigger>
              <Tabs.Trigger value="conta" class="aba">Conta</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="listas">
              {#each dados.listas as l (l.id)}
                {@const pr = progressoDaLista(l)}
                <div class="lista-resumo">
                  <div class="linha"><b>{l.nome}</b><span class="maquina dica">{pr.concluidos}/{pr.total}</span></div>
                  <span class="barra clara"><span style:width="{pr.pct}%"></span></span>
                </div>
              {:else}
                <p class="dica">Checklists suas, como o teste de agendamentos por empresa.</p>
              {/each}
              <a class="link-secao" href="/listas">{dados.listas.length ? 'abrir listas' : 'criar uma lista'}</a>
            </Tabs.Content>
            <Tabs.Content value="compromissos">
              {#each emAberto as p (p.id)}
                <p class="compromisso">{p.texto}</p>
              {:else}
                <p class="dica">{promessasDaSemana.length ? 'Todos os compromissos da semana têm situação.' : 'Nenhum compromisso registrado nesta semana.'}</p>
              {/each}
              <a class="link-secao" href="/semana">ver na semana</a>
            </Tabs.Content>
            <Tabs.Content value="conta">
              {#if nuvem.estado === 'desligada'}
                <p class="dica">Nuvem desligada: os dados ficam só neste navegador.</p>
              {:else if nuvem.estado === 'sem_login'}
                <p class="dica">Entre na sua conta para guardar tudo na nuvem e abrir em outro computador.</p>
                <a class="botao" href="/entrar">Entrar ou criar conta</a>
              {:else}
                <p class="estado {nuvem.estado}">
                  {nuvem.estado === 'sincronizando' ? 'sincronizando...' : nuvem.estado === 'erro' ? 'erro ao sincronizar' : 'tudo guardado na nuvem'}
                </p>
                <p class="dica">{nuvem.email} - <a href="/perfil">perfil</a>{nuvem.ultimoEnvio ? ` - último envio ${nuvem.ultimoEnvio.slice(11, 16)}` : ''}</p>
                {#if nuvem.erro}<p class="dica erro">{nuvem.erro}</p>{/if}
                <button class="link" onclick={() => sairDaNuvem()}>sair da nuvem</button>
              {/if}
            </Tabs.Content>
          </Tabs.Root>
        </section>
      </aside>
    </div>
  </details>
</main>

<style>
  /* fundo de grade discreto, como papel quadriculado de terminal */
  main
  {
    background-image: linear-gradient(var(--grade-fundo) 1px, transparent 1px), linear-gradient(90deg, var(--grade-fundo) 1px, transparent 1px);
    background-size: 28px 28px;
    background-position: -1px -1px;
  }
  header > div
  {
    margin-right: auto;
  }
  .aviso
  {
    margin: 0 0 var(--size-4);
  }
  .aviso a
  {
    color: inherit;
    font-weight: 700;
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--size-4);
  }
  .kpi
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-1);
    background: var(--superficie);
    color: var(--texto);
    border: 1px solid var(--borda);
    border-top: 2px solid var(--marca);
    border-radius: var(--raio);
    padding: var(--size-4);
    text-decoration: none;
    min-height: 140px;
    transition: border-color 0.2s;
  }
  a.kpi:hover
  {
    border-color: var(--marca);
  }
  .kpi .valor
  {
    font-family: var(--fonte-maquina);
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1;
  }
  .kpi .detalhe
  {
    font-size: 0.82rem;
    color: var(--suave);
    flex: 1;
  }
  .kpi .detalhe b
  {
    color: var(--verde);
  }
  .kpi .detalhe b.abaixo
  {
    color: var(--amarelo);
  }
  .kpi.alerta
  {
    border-top-color: var(--amarelo);
  }
  .kpi.alerta .valor
  {
    color: var(--amarelo);
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--borda);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
  }
  .grade
  {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: var(--size-4);
    align-items: start;
    margin-top: var(--size-4);
  }
  .coluna
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    min-width: 0;
  }
  .grade > .cartao, .coluna .cartao
  {
    margin-top: 0;
    transition: border-color 0.2s;
  }
  .grade > .cartao:hover, .coluna .cartao:hover
  {
    border-color: color-mix(in srgb, var(--marca) 40%, var(--borda));
  }
  /* títulos dos quadros como comentário de código */
  .grade .cartao > h2::before
  {
    content: '// ';
    color: var(--marca);
  }
  .rotina
  {
    margin: 0 0 var(--size-3);
    padding: var(--size-2) var(--size-3);
    border-radius: var(--raio-pequeno);
    background: var(--marca-clara);
    font-size: 0.9rem;
  }
  .vivo
  {
    display: grid;
    gap: var(--size-2);
    padding: var(--size-3) 0;
    border-bottom: 1px dashed var(--borda);
  }
  .vivo a
  {
    color: var(--texto);
    text-decoration: none;
  }
  .vivo .registrar
  {
    color: var(--marca);
    text-decoration: underline;
    font-size: 0.84rem;
  }
  .item-vivo
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
    color: var(--texto);
    font-size: 0.9rem;
  }
  .feito
  {
    color: var(--suave);
    text-decoration: line-through;
  }
  .acoes, .frases
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .acoes li, .frases li
  {
    display: flex;
    align-items: baseline;
    gap: var(--size-2);
    padding: var(--size-2) 0;
    border-bottom: 1px dashed var(--borda);
    background: none;
    color: var(--texto);
  }
  .acoes li:last-child, .frases li:last-child
  {
    border-bottom: none;
  }
  .frases li
  {
    font-size: 0.92rem;
  }
  .acoes i, .frases i
  {
    flex: 0 0 9px;
    height: 9px;
    background: var(--marca);
    border-radius: 2px;
  }
  .frases i
  {
    border-radius: 50%;
    background: var(--borda-forte);
  }
  .acoes .alto i
  {
    background: var(--vermelho);
  }
  .acoes .medio i
  {
    background: var(--amarelo);
  }
  .frases .positivo i
  {
    background: var(--verde);
  }
  .frases .atencao i
  {
    background: var(--amarelo);
  }
  .acoes span
  {
    flex: 1;
  }
  .acoes a
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .pessoa
  {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: var(--size-3) 0;
    border-bottom: 1px dashed var(--borda);
  }
  .pessoa:last-child
  {
    border-bottom: none;
  }
  .linha
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-2);
  }
  .direita
  {
    display: flex;
    align-items: center;
    gap: var(--size-3);
  }
  .estourou
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  .mais
  {
    margin-top: var(--size-5);
  }
  .mais > summary
  {
    padding: var(--size-3) var(--size-4);
    border: 1px dashed var(--borda-forte);
    border-radius: var(--raio);
    color: var(--suave);
    font-family: var(--fonte-maquina);
    font-size: 0.88rem;
    list-style: none;
  }
  .mais > summary::before
  {
    content: '+ ';
    color: var(--marca);
  }
  .mais[open] > summary::before
  {
    content: '- ';
  }
  .mais > summary:hover
  {
    color: var(--texto);
    border-color: var(--marca);
  }
  .projecao
  {
    padding: var(--size-3);
    border-radius: var(--raio-pequeno);
    background: var(--fundo);
    margin-bottom: var(--size-4);
  }
  .projecao p
  {
    margin: 0;
  }
  .projecao .dica
  {
    margin-top: var(--size-1);
  }
  .veredito
  {
    font-weight: 700;
  }
  .veredito.bate
  {
    color: var(--verde);
  }
  .veredito.perto
  {
    color: var(--amarelo);
  }
  .veredito.nao_bate
  {
    color: var(--vermelho);
  }
  .colunas-fluxo
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-5);
  }
  .colunas-fluxo h3
  {
    font-size: 0.85rem;
    margin: 0 0 var(--size-2);
  }
  .linha-fluxo
  {
    font-size: 0.86rem;
    margin: 0 0 var(--size-2);
  }
  .linha-fluxo .dica
  {
    display: block;
    font-size: 0.78rem;
  }
  .grafico
  {
    overflow-x: auto;
  }
  .grafico :global(svg)
  {
    max-width: 100%;
    height: auto;
  }
  /* abas do Bits UI */
  :global(.abas)
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-1);
    margin-bottom: var(--size-3);
    border-bottom: 1px solid var(--borda);
  }
  :global(.aba)
  {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: var(--size-1) var(--size-3);
    font-size: 0.82rem;
    color: var(--suave);
    margin-bottom: -1px;
  }
  :global(.aba:hover:not(:disabled))
  {
    color: var(--texto);
    border-color: transparent transparent var(--borda-forte);
  }
  :global(.aba[data-state='active'])
  {
    color: var(--marca);
    border-bottom-color: var(--marca);
  }
  .dia-tempo
  {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--size-2);
    padding: var(--size-2) 0;
    border-bottom: 1px dashed var(--borda);
  }
  .dia-tempo .data
  {
    font-weight: 700;
    color: var(--marca);
  }
  .dia-tempo ul
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .dia-tempo li
  {
    padding: 2px 0;
    font-size: 0.88rem;
    background: none;
    color: var(--texto);
  }
  .dia-tempo .tipo
  {
    color: var(--suave);
    font-size: 0.75rem;
  }
  .dia-tempo .risco .tipo, .dia-tempo .previsao .tipo, .dia-tempo .ritmo .tipo
  {
    color: var(--amarelo);
  }
  .dia-tempo .entrega .tipo, .dia-tempo .etapa .tipo
  {
    color: var(--verde);
  }
  .saidas
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-2);
  }
  .saida
  {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: var(--size-3);
    border-radius: var(--raio-pequeno);
    border: 1px solid var(--borda);
    background: var(--superficie-2);
    color: var(--texto);
    text-decoration: none;
    font-family: inherit;
  }
  .saida b
  {
    font-family: var(--fonte-maquina);
  }
  .saida span
  {
    font-size: 0.8rem;
    color: var(--suave);
  }
  .saida:hover
  {
    border-color: var(--marca);
    background: var(--marca-clara);
  }
  .saida.principal
  {
    background: var(--marca);
    border-color: var(--marca);
    color: var(--sobre-marca);
  }
  .saida.principal span
  {
    color: var(--sobre-marca);
  }
  .saida.principal:hover
  {
    filter: brightness(1.1);
  }
  .lista-resumo
  {
    display: grid;
    gap: 6px;
    margin-bottom: var(--size-3);
  }
  .estado
  {
    font-weight: 600;
    margin: 0;
  }
  .estado.ok
  {
    color: var(--verde);
  }
  .dica.erro
  {
    color: var(--vermelho);
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.82rem;
    justify-self: start;
  }
  .compromisso
  {
    margin: 0;
    padding: 6px 0;
    border-bottom: 1px dashed var(--borda);
    font-size: 0.9rem;
  }
  .link-secao
  {
    display: inline-block;
    margin-top: var(--size-2);
    font-size: 0.85rem;
  }
  @media (max-width: 900px)
  {
    .kpis
    {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .grade, .colunas-fluxo
    {
      grid-template-columns: 1fr;
    }
  }
  .situacao { display: grid; grid-template-columns: auto 1fr auto; gap: var(--size-5); align-items: center; padding: var(--size-4) var(--size-5); margin-bottom: var(--size-4); border-radius: var(--raio); border: 1px solid var(--borda); border-left: 6px solid var(--borda-forte); background: var(--superficie); }
  .situacao.verde { border-left-color: var(--verde); background: linear-gradient(90deg, var(--verde-fundo), var(--superficie) 60%); }
  .situacao.amarelo { border-left-color: var(--amarelo); background: linear-gradient(90deg, var(--amarelo-fundo), var(--superficie) 60%); }
  .situacao.vermelho { border-left-color: var(--vermelho); background: linear-gradient(90deg, var(--vermelho-fundo), var(--superficie) 60%); }
  .sit-status { display: flex; flex-direction: column; gap: 2px; }
  .sit-rotulo { font-family: var(--fonte-maquina); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--suave); }
  .sit-valor { font-family: var(--fonte-maquina); font-size: 1.8rem; line-height: 1.1; }
  .sit-detalhe { font-size: 0.86rem; color: var(--suave); }
  .sit-itens { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--size-3); }
  .sit-itens div { display: flex; flex-direction: column; padding-left: var(--size-3); border-left: 1px dashed var(--borda-forte); }
  .sit-itens b { font-family: var(--fonte-maquina); font-size: 1.6rem; }
  .sit-itens span { font-size: 0.78rem; color: var(--suave); }
  .sit-itens .vermelho b { color: var(--vermelho); }
  .sit-itens .amarelo b { color: var(--amarelo); }
  .sit-data { font-family: var(--fonte-maquina); font-size: 0.78rem; color: var(--suave); }
  .atalhos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--size-3); margin-bottom: var(--size-4); }
  .atalhos a { display: flex; flex-direction: column; gap: 2px; padding: var(--size-3) var(--size-4); border: 1px solid var(--borda); border-radius: var(--raio); background: var(--superficie); color: var(--texto); text-decoration: none; transition: border-color 0.2s, transform 0.2s; }
  .atalhos a:hover { border-color: var(--marca); transform: translateY(-2px); }
  .atalhos b { font-family: var(--fonte-maquina); }
  .atalhos span { font-size: 0.78rem; color: var(--suave); }
  .controle { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); margin-bottom: var(--size-4); }
  .sub-h { font-size: 0.85rem; margin: var(--size-4) 0 var(--size-2); }
  .pilha { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--borda); }
  .p-ok { background: var(--verde); }
  .p-risco { background: var(--amarelo); }
  .p-atraso { background: var(--vermelho); }
  .p-vazio { flex: 1; background: var(--borda); }
  .diario-recente { margin-bottom: var(--size-4); }
  @media (max-width: 900px) { .situacao, .controle { grid-template-columns: 1fr; } .sit-itens, .atalhos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
