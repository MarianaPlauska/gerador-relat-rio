<script lang="ts">
  import {
    analisarTimeNoProjeto,
    definicoesPadrao,
    diasUteisEntre,
    idCurto,
    segundaDaSemana,
    somarDias,
    type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import CobrinhaMascote from '#lib/CobrinhaMascote.svelte';
  import { chaveDoRelatorio } from '#lib/modelos.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, periodoDaSemana, semaforoDoRelatorio, semanasDisponiveis } from '#lib/semana.ts';
  import { lerSessao } from '#lib/sessao.ts';

  const dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const dia = hoje();
  let semana = $state(segundaDaSemana(dia));
  let projetoAtual = $state(dados.registros.at(-1)?.pasta ?? dados.prefixo ?? 'DEV');
  let novoProjeto = $state('');
  let novaPessoa = $state('');
  let pessoaExpandida = $state<string | null>(null);

  const projetos = $derived(
    [...new Set([
      dados.prefixo || 'DEV',
      ...dados.registros.map((r) => r.pasta),
      ...dados.fotos.map((f) => f.pasta).filter((p): p is string => !!p),
      ...dados.pessoas.flatMap((p) => p.pastas ?? []),
      projetoAtual,
    ])].filter(Boolean),
  );

  const fotosDoProjeto = $derived(
    dados.fotos.filter((f) => (f.pasta ?? dados.prefixo ?? 'DEV').toUpperCase() === projetoAtual.toUpperCase()),
  );

  const dadosProjeto = $derived<Dados>({
    ...dados,
    fotos: fotosDoProjeto,
  });

  const ctx = $derived(contextoDaSemana(dadosProjeto, semana));
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const kp = $derived(ctx.comp.planoAtual);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || 'Mariana').split(' ')[0]);

  const ultimaFoto = $derived([...fotosDoProjeto].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);

  const semaforo = $derived(semaforoDoRelatorio(ctx, {}));
  const nomesSemaforo: Record<string, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };

  const cardsFoto = $derived(ultimaFoto?.cards ?? []);
  const baseCards = $derived(
    cardsFoto.filter((c) => c.origens.includes('em_execucao')).length
      ? cardsFoto.filter((c) => c.origens.includes('em_execucao'))
      : cardsFoto,
  );

  // Tarefas da semana sem exibir o nome de cada pessoa (foco na tarefa)
  const tarefasDaSemana = $derived(
    [...baseCards]
      .sort((a, b) =>
      {
        const peso = (r?: string, s?: string) => (r === 'atrasado' || s === 'atrasado' ? 2 : r === 'em_risco' ? 1 : 0);
        return peso(b.ritmoPainel, b.situacao) - peso(a.ritmoPainel, a.situacao);
      })
      .slice(0, 8),
  );

  const atencaoCount = $derived(
    baseCards.filter((c) => c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || c.situacao === 'atrasado').length,
  );

  const vencimentos = $derived(
    cardsFoto
      .filter((c) => c.vencimento && c.vencimento >= dia && c.vencimento <= somarDias(dia, 15))
      .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
      .slice(0, 4),
  );

  // Análise completa por pessoa no projeto selecionado (com expansão, disponibilidade, sugestões e rendimento semanal + acumulado)
  const pessoasProjeto = $derived(
    analisarTimeNoProjeto({
      pessoas: dados.pessoas,
      fotos: dados.fotos,
      planos: dados.planos,
      pasta: projetoAtual,
      semanaInicio: semana,
      semanaFim: somarDias(semana, 6),
      hoje: dia,
    }),
  );

  const registrosProjeto = $derived(
    [...dados.registros]
      .filter((r) => (r.pasta || 'DEV').toUpperCase() === projetoAtual.toUpperCase())
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)),
  );
  const ultimoRegistro = $derived(registrosProjeto[0]);

  function criarProjeto()
  {
    const p = novoProjeto.trim().toUpperCase();
    if (!p) return;
    projetoAtual = p;
    novoProjeto = '';
  }

  function adicionarPessoaAoProjeto()
  {
    const nome = novaPessoa.trim();
    if (!nome) return;
    const id = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || idCurto();
    const existente = dados.pessoas.find((p) => p.id === id || p.nome.toLowerCase() === nome.toLowerCase());
    if (existente)
    {
      const atuais = existente.pastas ?? ['DEV'];
      if (!atuais.includes(projetoAtual)) existente.pastas = [...atuais, projetoAtual];
    }
    else
    {
      dados.pessoas = [...dados.pessoas, { id, nome, capacidadeHorasSemana: 40, pastas: [projetoAtual] }];
    }
    novaPessoa = '';
    pessoaExpandida = id;
  }

  function alternarPessoa(id: string)
  {
    pessoaExpandida = pessoaExpandida === id ? null : id;
  }

  function abrirUmAUm(pessoaId: string, e: MouseEvent)
  {
    e.stopPropagation();
    const chave = chaveDoRelatorio(periodoDaSemana(semana));
    const atuais = dados.relatorios[chave] ?? {};
    dados.relatorios[chave] = { ...atuais, blocos: { ...atuais.blocos, umaum: [{ tipo: 'pessoa', pessoaId }] } };
    dados.ultimoModelo = 'umaum';
    salvar($state.snapshot(dados));
    goto(`/relatorio?semana=${semana}`);
  }
</script>

<main class="dashboard-executivo">
  <header class="topo-dashboard">
    <div class="boas-vindas">
      <CobrinhaMascote />
      <div class="titulos">
        <span class="prompt">&gt; {saudacao.toLowerCase()}, {primeiroNome.toLowerCase()} · projeto {projetoAtual.toLowerCase()}</span>
        <h1>Visão Executiva<span class="cursor">_</span></h1>
      </div>
    </div>

    <div class="controles-topo">
      <div class="seletor-caixa">
        <label for="seletor-projeto" class="etiqueta">Projeto</label>
        <div class="linha-projeto">
          <select id="seletor-projeto" bind:value={projetoAtual} aria-label="Projeto">
            {#each projetos as proj (proj)}
              <option value={proj}>{proj}</option>
            {/each}
          </select>
          <input
            class="input-novo-projeto"
            bind:value={novoProjeto}
            placeholder="Novo..."
            onkeydown={(e) => e.key === 'Enter' && criarProjeto()}
            aria-label="Nome do novo projeto"
          />
          {#if novoProjeto.trim()}
            <button class="btn-mini" onclick={criarProjeto}>Criar</button>
          {/if}
        </div>
      </div>

      <div class="seletor-caixa">
        <label for="seletor-semana" class="etiqueta">Semana ativa</label>
        <select id="seletor-semana" bind:value={semana} aria-label="Semana">
          {#each semanasDisponiveis(dados) as s (s)}
            <option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>
          {/each}
        </select>
      </div>
    </div>
  </header>

  {#if !ultimaFoto}
    <div class="aviso-banner">
      <span>Nenhuma leitura do painel salva para o projeto <b>{projetoAtual}</b>.</span>
      <a href="/painel" class="btn-acao-banner">Abrir diário do painel &rarr;</a>
    </div>
  {:else if diasDesdeFoto >= 2}
    <div class="aviso-banner suave">
      <span>Última leitura do projeto <b>{projetoAtual}</b> feita em {dataCurta(ultimaFoto.data)} ({diasDesdeFoto} dias úteis).</span>
      <a href="/painel" class="btn-acao-banner">Atualizar leitura &rarr;</a>
    </div>
  {/if}

  <!-- 4 INDICADORES CHAVE (KPIS DO SISTEMA E DA SEMANA) -->
  <section class="grade-kpis">
    <div class="cartao card-kpi {semaforo ?? 'neutro'}">
      <span class="etiqueta">Saúde da semana</span>
      <div class="kpi-valor-grupo">
        <span class="ponto-semaforo {semaforo ?? 'neutro'}" aria-hidden="true"></span>
        <strong class="kpi-valor-texto">{semaforo ? nomesSemaforo[semaforo] : 'Sem leitura'}</strong>
      </div>
      <span class="kpi-detalhe">
        {#if t.dentroDoPrazoPct !== undefined}
          {t.dentroDoPrazoPct}% dentro do prazo {ctx.meta ? `· meta ${ctx.meta}%` : ''}
        {:else}
          Cole um print no diário para medir
        {/if}
      </span>
    </div>

    <div class="cartao card-kpi">
      <span class="etiqueta">Plano da semana</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero num">{kp ? `${kp.feitos}/${kp.planejados}` : '0/0'}</strong>
        <span class="kpi-valor-sub">entregas</span>
      </div>
      <div class="kpi-progresso-linha">
        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{kp?.pctFeitos ?? 0}%"></div></div>
        <span class="kpi-detalhe">{kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% concluído` : 'Sem plano ativo'}</span>
      </div>
    </div>

    <div class="cartao card-kpi" class:alerta={atencaoCount > 0}>
      <span class="etiqueta">Atenção imediata</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero num" class:destaque-vermelho={atencaoCount > 0}>{atencaoCount}</strong>
        <span class="kpi-valor-sub">{atencaoCount === 1 ? 'demanda' : 'demandas'}</span>
      </div>
      <span class="kpi-detalhe">
        {#if atencaoCount === 0}
          Nenhuma demanda atrasada
        {:else}
          {baseCards.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length} atrasadas · {baseCards.filter((c) => c.ritmoPainel === 'em_risco').length} em risco
        {/if}
      </span>
    </div>

    <div class="cartao card-kpi">
      <span class="etiqueta">Diário ({projetoAtual})</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero num">{registrosProjeto.length}</strong>
        <span class="kpi-valor-sub">{registrosProjeto.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <span class="kpi-detalhe">
        {#if ultimoRegistro}
          Último em {dataCurta(ultimoRegistro.data)}
        {:else}
          Nenhum registro arquivado
        {/if}
      </span>
    </div>
  </section>

  <!-- VISÃO RESUMIDA DA SEMANA: TAREFAS (SEM NOMES) E PESSOAS (EXPANSÍVEIS) -->
  <div class="grade-dupla">
    <!-- COLUNA 1: TAREFAS DA SEMANA (SEM NOME DAS PESSOAS, SÓ AS TAREFAS) -->
    <section class="cartao painel-secao">
      <div class="secao-cabecalho">
        <div>
          <span class="etiqueta">Projeto {projetoAtual}</span>
          <h2>Tarefas da semana ({baseCards.length})</h2>
        </div>
        <a href="/cards" class="link-subtil">todos os cards &rarr;</a>
      </div>

      {#if tarefasDaSemana.length === 0}
        <div class="estado-limpo">
          <p><b>Nenhuma tarefa em andamento registrada nesta semana.</b></p>
          <span class="dica">Envie prints no Diário do painel para listar as demandas do projeto {projetoAtual}.</span>
        </div>
      {:else}
        <div class="lista-demandas">
          {#each tarefasDaSemana as c (c.codigo)}
            <div class="item-demanda" class:urgente={c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado' || c.prioridadeCard === 'Crítica'}>
              <div class="demanda-topo">
                <span class="demanda-codigo">{c.codigo}</span>
                {#if c.prioridadeCard}
                  <span class="pilula" class:atrasado={c.prioridadeCard === 'Crítica'} class:em_risco={c.prioridadeCard === 'Alta'}>{c.prioridadeCard}</span>
                {/if}
                {#if c.sistema}
                  <span class="demanda-frente">{c.sistema}</span>
                {/if}
                <span class="demanda-etapa">{c.etapaAtual || c.statusCard || 'Em andamento'}</span>
                {#if c.etapas?.length}
                  <span class="demanda-frente">{c.etapasConcluidas ?? 0}/{c.etapas.length} etapas</span>
                {/if}
                {#if c.horasEstimadas !== undefined && c.horasEstimadas > 0}
                  <span class="demanda-frente">~{c.horasEstimadas}h</span>
                {/if}
                {#if c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado'}
                  <span class="pilula atrasado">atrasado</span>
                {:else if c.ritmoPainel === 'em_risco'}
                  <span class="pilula em_risco">em risco</span>
                {:else if c.ritmoPainel === 'no_ritmo' || c.situacao === 'concluido'}
                  <span class="pilula no_ritmo">{c.situacao === 'concluido' ? 'resolvido' : 'no ritmo'}</span>
                {/if}
              </div>
              <strong class="demanda-titulo">{c.assunto || c.titulo || 'Tarefa sem título descrito'}</strong>
              {#if c.previsao || c.vencimento || c.comentario}
                <div class="demanda-meta">
                  {#if c.previsao}<span>Previsão: {dataMedia(c.previsao)}</span>{/if}
                  {#if c.vencimento}<span>Vencimento: {dataMedia(c.vencimento)}</span>{/if}
                  {#if c.comentario}<span>Nota: {c.comentario}</span>{/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if vencimentos.length > 0}
        <div class="bloco-vencimentos">
          <span class="etiqueta">Vencendo nos próximos 15 dias</span>
          <div class="vencimentos-chips">
            {#each vencimentos as v (v.codigo)}
              <span class="chip-vencimento">
                <b>{v.codigo}</b> · {dataCurta(v.vencimento!)}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- COLUNA 2: PESSOAS DO PROJETO (CLIQUE PARA EXPANDIR DETALHES, DISPONIBILIDADE, SUGESTÕES E RENDIMENTO) -->
    <section class="cartao painel-secao">
      <div class="secao-cabecalho">
        <div>
          <span class="etiqueta">Clique na pessoa para expandir</span>
          <h2>Equipe, entrega e probabilidade ({projetoAtual})</h2>
        </div>
        <a href="/semana" class="link-subtil">plano da semana &rarr;</a>
      </div>

      <div class="lista-time">
        {#each pessoasProjeto as p (p.pessoa.id)}
          {@const expandida = pessoaExpandida === p.pessoa.id}
          <div class="item-pessoa" class:expandida>
            <div
              class="pessoa-cabecalho-clicavel"
              role="button"
              tabindex="0"
              aria-expanded={expandida}
              onclick={() => alternarPessoa(p.pessoa.id)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), alternarPessoa(p.pessoa.id))}
            >
              <div class="pessoa-linha-topo">
                <div class="pessoa-nome-grupo">
                  <span class="seta-expansao" class:aberta={expandida}>&#9656;</span>
                  <strong>{p.pessoa.nome}</strong>
                </div>
                <div class="pessoa-acoes">
                  <span class="badge-acumulado" title="Tempo estipulado na semana / Capacidade semanal">
                    {p.horasEstipuladasSemana}h / {p.capacidadeHorasSemana}h
                  </span>
                  <span class="badge-rendimento" title="Probabilidade de conseguir absorver mais serviços na semana">
                    {p.probabilidadeMaisServicosPct}% prob. +serviços
                  </span>
                  <span class="pessoa-contagem">{p.total} {p.total === 1 ? 'tarefa' : 'tarefas'}</span>
                  <button class="btn-1a1" onclick={(e) => abrirUmAUm(p.pessoa.id, e)} title="Abrir pauta de 1:1">1:1</button>
                </div>
              </div>

              <div class="barra-ritmo-pilha" title="{p.noRitmo} no ritmo · {p.emRisco} em risco · {p.atrasado} atrasadas">
                <span class="ritmo-verde" style:flex={p.noRitmo + p.concluidos}></span>
                <span class="ritmo-amarelo" style:flex={p.emRisco}></span>
                <span class="ritmo-vermelho" style:flex={p.atrasado}></span>
                {#if p.total === 0}
                  <span class="ritmo-vazio"></span>
                {/if}
              </div>

              <div class="pessoa-rodape">
                <small class="ritmo-texto">
                  {#if p.total === 0}
                    Sem demandas ativas · {p.quandoLivre}
                  {:else}
                    <span>Entrega: <b>{p.nivelEntregaPct}%</b></span> ·
                    <span>Demora: <b>{p.nivelDemora}</b></span> ·
                    <span>{p.quandoLivre}</span>
                  {/if}
                </small>
              </div>
            </div>

            {#if expandida}
              <div class="pessoa-detalhes-expandido">
                <!-- 1. ÁRVORE DE TAREFAS, PEDIDO COMPLETO E ETAPAS DA PESSOA -->
                <div class="bloco-detalhe-pessoa">
                  <span class="etiqueta">Árvore de tarefas de {p.pessoa.nome} ({p.tarefas.length})</span>
                  {#if p.tarefas.length === 0}
                    <p class="dica-curta">Nenhuma tarefa atribuída nesta semana.</p>
                  {:else}
                    <div class="arvore-tarefas-home">
                      {#each p.tarefas as tar (tar.codigo)}
                        <div class="no-tarefa-home">
                          <div class="no-tarefa-topo">
                            <span>
                              <b class="maquina">{tar.codigo}</b> {tar.assunto}
                              {#if tar.prioridadeCard}<span class="chip-detalhe">{tar.prioridadeCard}</span>{/if}
                              {#if tar.statusCard}<span class="chip-detalhe">{tar.statusCard}</span>{/if}
                            </span>
                            <span class="meta-inline">~{tar.horasEstimadas}h{tar.previsao ? ` · Prev. ${dataCurta(tar.previsao)}` : ''}</span>
                          </div>
                          {#if tar.descricaoCompleta}
                            <p class="pedido-home"><b>Pedido:</b> {tar.descricaoCompleta}</p>
                          {/if}
                          {#if tar.etapas?.length}
                            <ul class="etapas-home">
                              {#each tar.etapas as et (et.ordem)}
                                <li>
                                  <b>{et.ordem}. {et.nome}</b>
                                  <span class="meta-inline">
                                    ({et.situacao.replace('_', ' ')}{et.tempoRodandoHoras !== undefined ? ` · rodando há ${et.tempoRodandoHoras}h` : ''}{et.desde ? ` desde ${et.desde.slice(0, 10).split('-').reverse().join('/')}` : ''})
                                  </span>
                                </li>
                              {/each}
                            </ul>
                          {:else if tar.etapa}
                            <span class="meta-inline">Etapa atual: <b>{tar.etapa}</b></span>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- 2. ETAPAS E FRENTES ATIVAS -->
                <div class="grade-mini-detalhes">
                  <div>
                    <span class="etiqueta">Etapas em andamento</span>
                    <div class="chips-detalhe">
                      {#each p.etapasEmAndamento as et (et)}
                        <span class="chip-detalhe">{et}</span>
                      {:else}
                        <span class="dica-curta">Nenhuma etapa em execução</span>
                      {/each}
                    </div>
                  </div>
                  <div>
                    <span class="etiqueta">Diagnóstico de demora e ritmo</span>
                    <p class="texto-destaque-detalhe">Nível {p.nivelDemora}: {p.motivoDemora}</p>
                  </div>
                </div>

                <!-- 3. PROBABILIDADE DE MAIS SERVIÇOS E RENDIMENTO SEMANAL + ACUMULADO -->
                <div class="grade-mini-detalhes">
                  <div>
                    <span class="etiqueta">Probabilidade de absorver mais serviços</span>
                    <div class="barras-rendimento">
                      <div class="linha-rend">
                        <span>Probabilidade: <b>{p.probabilidadeMaisServicosPct}%</b> (+{p.servicosExtrasSugeridos} {p.servicosExtrasSugeridos === 1 ? 'serviço' : 'serviços'} / ~{p.horasLivresEstimadas}h livres)</span>
                        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{p.probabilidadeMaisServicosPct}%"></div></div>
                      </div>
                      <div class="linha-rend">
                        <span>Nível de entrega na semana: <b>{p.nivelEntregaPct}%</b></span>
                        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{p.nivelEntregaPct}%"></div></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span class="etiqueta">Rendimento comparativo e acumulado</span>
                    <div class="barras-rendimento">
                      <div class="linha-rend">
                        <span>Participação na semana: <b>{p.rendimentoSemanaPct}%</b> da equipe</span>
                        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{p.rendimentoSemanaPct}%"></div></div>
                      </div>
                      <div class="linha-rend">
                        <span>Acumulado ({p.acumuladoSemanas.semanasAtivas} sem.): <b>{p.rendimentoAcumuladoPct}%</b> ({p.acumuladoSemanas.entregasNoPrazo}/{p.acumuladoSemanas.totalDemandas} no prazo)</span>
                        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{p.rendimentoAcumuladoPct}%"></div></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 4. SUGESTÕES DE APOIO À EQUIPE -->
                <div class="bloco-detalhe-pessoa sugestoes-apoio">
                  <span class="etiqueta">Sugestões para apoiar a equipe</span>
                  <ul class="lista-sugestoes-pessoa">
                    {#each p.sugestoesAjuda as sug, idx (idx)}
                      <li>{sug}</li>
                    {/each}
                  </ul>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- ADICIONAR NOVA PESSOA AO PROJETO ATUAL -->
      <div class="adicionar-pessoa-rodape">
        <input
          bind:value={novaPessoa}
          placeholder="Adicionar colaborador ao projeto {projetoAtual}..."
          onkeydown={(e) => e.key === 'Enter' && adicionarPessoaAoProjeto()}
        />
        <button onclick={adicionarPessoaAoProjeto} disabled={!novaPessoa.trim()}>+ Adicionar</button>
      </div>
    </section>
  </div>

  <!-- ÚLTIMO REGISTRO DO DIÁRIO (CARD COMPACTO) -->
  {#if ultimoRegistro}
    <section class="cartao registro-compacto">
      <div class="registro-conteudo">
        <span class="etiqueta">Último registro no diário ({projetoAtual})</span>
        <p class="registro-motivo">
          <b>{dataMedia(ultimoRegistro.data)}:</b>
          {ultimoRegistro.motivo || ultimoRegistro.resumo || 'Registro de acompanhamento salvo.'}
        </p>
      </div>
      <div class="registro-botoes">
        <a href="/painel" class="botao">Abrir Diário</a>
        <a href="/relatorio" class="botao destaque">Usar no Relatório</a>
      </div>
    </section>
  {/if}
</main>

<style>
  .dashboard-executivo
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    max-width: 1240px;
    margin: 0 auto;
    padding-bottom: var(--size-6);
    background-image: linear-gradient(var(--grade-fundo) 1px, transparent 1px), linear-gradient(90deg, var(--grade-fundo) 1px, transparent 1px);
    background-size: 28px 28px;
    background-position: -1px -1px;
  }

  .topo-dashboard
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-3);
    padding-bottom: var(--size-3);
    border-bottom: 1px solid var(--borda);
  }
  .boas-vindas
  {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .titulos h1
  {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.1;
  }
  .controles-topo
  {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
  }
  .seletor-caixa
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .linha-projeto
  {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .input-novo-projeto
  {
    width: 96px;
    font-size: 0.82rem;
    padding: 5px 8px;
  }
  .btn-mini
  {
    font-size: 0.78rem;
    padding: 5px 10px;
  }

  .aviso-banner
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--amarelo-fundo);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio-pequeno);
    padding: 10px 14px;
    font-size: 0.86rem;
    color: var(--texto);
  }
  .aviso-banner.suave
  {
    background: var(--superficie-2);
    border-color: var(--borda);
    color: var(--suave);
  }
  .btn-acao-banner
  {
    font-family: var(--fonte-maquina);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--marca);
    text-decoration: none;
  }
  .btn-acao-banner:hover
  {
    text-decoration: underline;
  }

  /* 4 KPIS */
  .grade-kpis
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .card-kpi
  {
    margin-top: 0;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .kpi-valor-grupo
  {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ponto-semaforo
  {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--borda-forte);
    flex: none;
  }
  .ponto-semaforo.verde { background: var(--verde); }
  .ponto-semaforo.amarelo { background: var(--amarelo); }
  .ponto-semaforo.vermelho { background: var(--vermelho); }

  .kpi-valor-texto
  {
    font-family: var(--fonte-maquina);
    font-size: 1.2rem;
    color: var(--texto);
  }
  .kpi-valor-numero
  {
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--texto);
  }
  .kpi-valor-sub
  {
    font-size: 0.8rem;
    color: var(--suave);
  }
  .kpi-detalhe
  {
    font-size: 0.78rem;
    color: var(--suave);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi-progresso-linha
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kpi-barra
  {
    height: 6px;
    background: var(--fundo-barra);
    border-radius: 999px;
    overflow: hidden;
  }
  .kpi-barra-preenchimento
  {
    height: 100%;
    background: var(--cor-barra);
    border-radius: 999px;
    transition: width 0.3s var(--curva);
  }
  .destaque-vermelho
  {
    color: var(--vermelho);
  }
  .card-kpi.alerta
  {
    border-color: var(--vermelho);
  }

  /* GRADE DUPLA */
  .grade-dupla
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 16px;
  }
  .painel-secao
  {
    margin-top: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
  }
  .secao-cabecalho
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid var(--borda);
    padding-bottom: 8px;
  }
  .secao-cabecalho h2
  {
    margin: 2px 0 0;
    font-size: 1.05rem;
  }
  .link-subtil
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: var(--marca);
    text-decoration: none;
  }
  .link-subtil:hover
  {
    text-decoration: underline;
  }

  .estado-limpo
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 12px;
    gap: 6px;
  }
  .estado-limpo p
  {
    margin: 0;
    font-size: 0.9rem;
    color: var(--texto);
  }

  /* LISTA DE DEMANDAS (SEM NOMES DE PESSOAS) */
  .lista-demandas
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item-demanda
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-left: 3px solid var(--cor-barra);
    border-radius: var(--raio-pequeno);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .item-demanda.urgente
  {
    border-left-color: var(--vermelho);
    background: var(--vermelho-fundo);
  }
  .demanda-topo
  {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
  }
  .demanda-codigo
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    color: var(--texto);
  }
  .demanda-frente
  {
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    color: var(--suave);
  }
  .demanda-etapa
  {
    color: var(--suave);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .demanda-titulo
  {
    font-size: 0.85rem;
    color: var(--texto);
    line-height: 1.25;
  }
  .demanda-meta
  {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 0.74rem;
    color: var(--suave);
  }

  .bloco-vencimentos
  {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px dashed var(--borda);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .vencimentos-chips
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-vencimento
  {
    font-family: var(--fonte-maquina);
    font-size: 0.74rem;
    padding: 2px 7px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: 4px;
    color: var(--suave);
  }
  .chip-vencimento b
  {
    color: var(--texto);
  }

  /* LISTA TIME EXPANSÍVEL */
  .lista-time
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item-pessoa
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .item-pessoa:hover, .item-pessoa.expandida
  {
    border-color: var(--borda-forte);
  }
  .pessoa-cabecalho-clicavel
  {
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
  }
  .pessoa-linha-topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .pessoa-nome-grupo
  {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .seta-expansao
  {
    font-size: 0.75rem;
    color: var(--marca);
    transition: transform 0.15s;
    display: inline-block;
  }
  .seta-expansao.aberta
  {
    transform: rotate(90deg);
  }
  .pessoa-linha-topo strong
  {
    font-size: 0.88rem;
  }
  .pessoa-acoes
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .badge-rendimento
  {
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--marca-clara);
    color: var(--marca);
    font-weight: 700;
  }
  .badge-acumulado
  {
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    color: var(--suave);
  }
  .pessoa-contagem
  {
    font-family: var(--fonte-maquina);
    font-size: 0.74rem;
    color: var(--suave);
  }
  .btn-1a1
  {
    font-size: 0.72rem;
    padding: 2px 6px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: 3px;
    color: var(--suave);
  }
  .btn-1a1:hover
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  .barra-ritmo-pilha
  {
    display: flex;
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--fundo-barra);
  }
  .ritmo-verde { background: var(--cor-barra); }
  .ritmo-amarelo { background: var(--amarelo); }
  .ritmo-vermelho { background: var(--vermelho); }
  .ritmo-vazio { flex: 1; background: var(--borda); }

  .pessoa-rodape
  {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
  }
  .ritmo-texto b
  {
    color: var(--texto);
  }

  /* PAINEL EXPANDIDO DA PESSOA */
  .pessoa-detalhes-expandido
  {
    padding: 10px 12px 12px;
    background: var(--superficie);
    border-top: 1px solid var(--borda);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.8rem;
  }
  .bloco-detalhe-pessoa
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lista-sugestoes-pessoa
  {
    margin: 2px 0 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    line-height: 1.35;
  }
  .arvore-tarefas-home
  {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 2px;
  }
  .no-tarefa-home
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: 4px;
    padding: 7px 9px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .no-tarefa-topo
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .pedido-home
  {
    margin: 2px 0 0;
    font-size: 0.76rem;
    color: var(--suave);
    line-height: 1.35;
    white-space: pre-line;
    background: var(--superficie);
    padding: 5px 8px;
    border-radius: 3px;
    border-left: 2px solid var(--cor-barra);
  }
  .etapas-home
  {
    margin: 2px 0 0;
    padding-left: 16px;
    font-size: 0.76rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .meta-inline
  {
    color: var(--suave);
    font-size: 0.75rem;
  }
  .grade-mini-detalhes
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .chips-detalhe
  {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }
  .chip-detalhe
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    padding: 2px 6px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: 3px;
    color: var(--texto);
  }
  .texto-destaque-detalhe
  {
    margin: 3px 0 0;
    font-weight: 600;
    color: var(--texto);
    font-size: 0.8rem;
  }
  .barras-rendimento
  {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 3px;
  }
  .linha-rend
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.74rem;
    color: var(--suave);
  }
  .linha-rend b
  {
    color: var(--texto);
  }
  .sugestoes-apoio
  {
    background: var(--superficie-2);
    padding: 8px 10px;
    border-radius: var(--raio-pequeno);
    border-left: 2px solid var(--cor-barra);
  }
  .dica-curta
  {
    margin: 0;
    font-size: 0.75rem;
    color: var(--suave);
  }

  .adicionar-pessoa-rodape
  {
    display: flex;
    gap: 6px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed var(--borda);
  }
  .adicionar-pessoa-rodape input
  {
    flex: 1;
    font-size: 0.8rem;
    padding: 5px 8px;
  }
  .adicionar-pessoa-rodape button
  {
    font-size: 0.78rem;
    padding: 5px 10px;
  }

  /* REGISTRO COMPACTO */
  .registro-compacto
  {
    margin-top: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-left: 3px solid var(--cor-barra);
  }
  .registro-conteudo
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 250px;
  }
  .registro-motivo
  {
    margin: 0;
    font-size: 0.85rem;
    color: var(--texto);
    line-height: 1.35;
  }
  .registro-botoes
  {
    display: flex;
    gap: 8px;
  }
  .botao.destaque
  {
    background: var(--marca-clara);
    border-color: var(--marca);
    color: var(--marca);
    font-weight: 700;
  }
</style>
