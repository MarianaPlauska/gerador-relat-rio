<script lang="ts">
  import {
    definicoesPadrao,
    diasUteisEntre,
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

  const ctx = $derived(contextoDaSemana(dados, semana));
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const kp = $derived(ctx.comp.planoAtual);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || 'Mariana').split(' ')[0]);

  const ultimaFoto = $derived([...dados.fotos].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);

  const semaforo = $derived(semaforoDoRelatorio(ctx, {}));
  const nomesSemaforo: Record<string, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };

  const cardsFoto = $derived(ultimaFoto?.cards ?? []);
  const baseCards = $derived(cardsFoto.filter((c) => c.origens.includes('em_execucao')).length ? cardsFoto.filter((c) => c.origens.includes('em_execucao')) : cardsFoto);

  const atencao = $derived(
    baseCards
      .filter((c) => c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || c.situacao === 'atrasado')
      .sort((a, b) => Number(b.ritmoPainel === 'atrasado' || b.situacao === 'atrasado') - Number(a.ritmoPainel === 'atrasado' || a.situacao === 'atrasado'))
      .slice(0, 5),
  );

  const vencimentos = $derived(
    cardsFoto
      .filter((c) => c.vencimento && c.vencimento >= dia && c.vencimento <= somarDias(dia, 15))
      .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
      .slice(0, 4),
  );

  const pessoasPainel = $derived(dados.pessoas.map((p) =>
  {
    const meus = baseCards.filter((c) => c.responsavelEtapaAtual === p.id);
    return {
      pessoa: p,
      total: meus.length,
      noRitmo: meus.filter((c) => c.ritmoPainel === 'no_ritmo').length,
      emRisco: meus.filter((c) => c.ritmoPainel === 'em_risco').length,
      atrasado: meus.filter((c) => c.ritmoPainel === 'atrasado').length,
    };
  }));

  const ultimoRegistro = $derived([...dados.registros].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))[0]);

  function abrirUmAUm(pessoaId: string)
  {
    const chave = chaveDoRelatorio(periodoDaSemana(semana));
    const atuais = dados.relatorios[chave] ?? {};
    dados.relatorios[chave] = { ...atuais, blocos: { ...atuais.blocos, umaum: [{ tipo: 'pessoa', pessoaId }] } };
    dados.ultimoModelo = 'umaum';
    salvar($state.snapshot(dados));
    goto(`/relatorio?semana=${semana}`);
  }
</script>

<main class="dashboard-executivo">
  <!-- CABEÇALHO RESUMIDO COM MASCOTE TECH E SAUDAÇÃO -->
  <header class="topo-dashboard">
    <div class="boas-vindas">
      <CobrinhaMascote />
      <div class="titulos">
        <span class="prompt">&gt; {saudacao.toLowerCase()}, {primeiroNome.toLowerCase()}</span>
        <h1>Visão Executiva<span class="cursor">_</span></h1>
      </div>
    </div>

    <div class="seletor-semana-caixa">
      <label for="seletor-semana" class="etiqueta-semana">Semana ativa</label>
      <select id="seletor-semana" bind:value={semana} aria-label="Semana">
        {#each semanasDisponiveis(dados) as s (s)}
          <option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>
        {/each}
      </select>
    </div>
  </header>

  <!-- AVISO DE ATUALIZAÇÃO DO PAINEL -->
  {#if !ultimaFoto}
    <div class="aviso-banner">
      <span>Nenhum print ou leitura do painel salva ainda.</span>
      <a href="/painel" class="btn-acao-banner">Colar painel no diário &rarr;</a>
    </div>
  {:else if diasDesdeFoto >= 2}
    <div class="aviso-banner suave">
      <span>Última leitura do painel feita em {dataCurta(ultimaFoto.data)} (há {diasDesdeFoto} dias úteis).</span>
      <a href="/painel" class="btn-acao-banner">Atualizar agora &rarr;</a>
    </div>
  {/if}

  <!-- 4 INDICADORES CHAVE (KPIS RESUMIDOS) -->
  <section class="grade-kpis">
    <!-- 1. SEMÁFORO GERAL -->
    <div class="card-kpi {semaforo ?? 'neutro'}">
      <span class="kpi-rotulo">Saúde da semana</span>
      <div class="kpi-valor-grupo">
        <span class="kpi-icone-status">
          {#if semaforo === 'verde'}🟢{:else if semaforo === 'amarelo'}🟡{:else if semaforo === 'vermelho'}🔴{:else}⚪{/if}
        </span>
        <strong class="kpi-valor-texto">{semaforo ? nomesSemaforo[semaforo] : 'Sem leitura'}</strong>
      </div>
      <span class="kpi-detalhe">
        {#if t.dentroDoPrazoPct !== undefined}
          {t.dentroDoPrazoPct}% dentro do prazo {ctx.meta ? `· meta ${ctx.meta}%` : ''}
        {:else}
          Cole um print para avaliar
        {/if}
      </span>
    </div>

    <!-- 2. ENTREGAS DO PLANO -->
    <div class="card-kpi">
      <span class="kpi-rotulo">Plano da semana</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero">{kp ? `${kp.feitos}/${kp.planejados}` : '0/0'}</strong>
        <span class="kpi-valor-sub">entregas</span>
      </div>
      <div class="kpi-progresso-linha">
        <div class="kpi-barra"><div class="kpi-barra-preenchimento" style:width="{kp?.pctFeitos ?? 0}%"></div></div>
        <span class="kpi-detalhe">{kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% concluído` : 'Sem plano ativo'}</span>
      </div>
    </div>

    <!-- 3. DEMANDAS EM ALERTA -->
    <div class="card-kpi" class:alerta={atencao.length > 0}>
      <span class="kpi-rotulo">Atenção imediata</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero" class:destaque-vermelho={atencao.length > 0}>{atencao.length}</strong>
        <span class="kpi-valor-sub">{atencao.length === 1 ? 'demanda' : 'demandas'}</span>
      </div>
      <span class="kpi-detalhe">
        {#if atencao.length === 0}
          ✓ Nenhuma demanda atrasada
        {:else}
          {atencao.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length} atrasadas · {atencao.filter((c) => c.ritmoPainel === 'em_risco').length} em risco
        {/if}
      </span>
    </div>

    <!-- 4. REGISTROS DO DIÁRIO -->
    <div class="card-kpi">
      <span class="kpi-rotulo">Diário do painel</span>
      <div class="kpi-valor-grupo">
        <strong class="kpi-valor-numero">{dados.registros.length}</strong>
        <span class="kpi-valor-sub">registros</span>
      </div>
      <span class="kpi-detalhe">
        {#if ultimoRegistro}
          Último em {dataCurta(ultimoRegistro.data)} · {ultimoRegistro.pasta || 'DEV'}
        {:else}
          Nenhum registro arquivado
        {/if}
      </span>
    </div>
  </section>

  <!-- 4 ATALHOS RÁPIDOS EM DESTAQUE -->
  <section class="grade-atalhos">
    <a href="/painel" class="card-atalho">
      <div class="atalho-icone">📸</div>
      <div class="atalho-info">
        <strong>Novo registro</strong>
        <span>Cole prints e comente</span>
      </div>
    </a>

    <a href="/relatorio" class="card-atalho">
      <div class="atalho-icone">📊</div>
      <div class="atalho-info">
        <strong>Gerar relatório</strong>
        <span>PDF executivo ou link</span>
      </div>
    </a>

    <a href="/fluxos" class="card-atalho">
      <div class="atalho-icone">⑂</div>
      <div class="atalho-info">
        <strong>Fluxos de processo</strong>
        <span>Editor e modo percorrer</span>
      </div>
    </a>

    <a href="/semana" class="card-atalho">
      <div class="atalho-icone">📅</div>
      <div class="atalho-info">
        <strong>Plano da semana</strong>
        <span>Metas, time e alertas</span>
      </div>
    </a>
  </section>

  <!-- VISÃO RESUMIDA DA SEMANA: 2 COLUNAS OBJETIVAS -->
  <div class="grade-dupla">
    <!-- COLUNA 1: DEMANDAS QUE EXIGEM ATENÇÃO -->
    <section class="cartao painel-secao">
      <div class="secao-cabecalho">
        <h2>Demandas prioritárias</h2>
        <a href="/cards" class="link-subtil">ver todos os cards &rarr;</a>
      </div>

      {#if atencao.length === 0}
        <div class="estado-limpo">
          <span class="icone-ok">✨</span>
          <p><b>Tudo sob controle!</b></p>
          <span class="dica">Nenhuma demanda atrasada ou em risco registrada nesta leitura.</span>
        </div>
      {:else}
        <div class="lista-demandas">
          {#each atencao as c (c.codigo)}
            <div class="item-demanda" class:urgente={c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado'}>
              <div class="demanda-topo">
                <span class="demanda-codigo">{c.codigo}</span>
                <span class="demanda-etapa">{c.etapaAtual || 'Em andamento'}</span>
                {#if c.ritmoPainel === 'atrasado'}
                  <span class="tag-ritmo atrasado">Atrasado</span>
                {:else if c.ritmoPainel === 'em_risco'}
                  <span class="tag-ritmo risco">Em risco</span>
                {/if}
              </div>
              <strong class="demanda-titulo">{c.titulo || 'Demanda sem título'}</strong>
              <div class="demanda-meta">
                <span>Resp.: {c.responsavelEtapaAtual || 'Não atribuído'}</span>
                {#if c.previsao}
                  <span>Prev.: {dataMedia(c.previsao)}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if vencimentos.length > 0}
        <div class="bloco-vencimentos">
          <span class="vencimentos-rotulo">⏰ Vencendo nos próximos 15 dias:</span>
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

    <!-- COLUNA 2: RITMO DO TIME -->
    <section class="cartao painel-secao">
      <div class="secao-cabecalho">
        <h2>Carga e ritmo do time</h2>
        <a href="/semana" class="link-subtil">ajustar equipe &rarr;</a>
      </div>

      <div class="lista-time">
        {#each pessoasPainel as p (p.pessoa.id)}
          <div class="item-pessoa">
            <div class="pessoa-linha-topo">
              <strong>{p.pessoa.nome}</strong>
              <div class="pessoa-acoes">
                <span class="pessoa-contagem">{p.total} {p.total === 1 ? 'demanda' : 'demandas'}</span>
                <button class="btn-1a1" onclick={() => abrirUmAUm(p.pessoa.id)} title="Abrir pauta de 1:1">1:1</button>
              </div>
            </div>

            <!-- BARRA DE RITMO (Verde / Amarelo / Vermelho) -->
            <div class="barra-ritmo-pilha" title="{p.noRitmo} no ritmo · {p.emRisco} em risco · {p.atrasado} atrasadas">
              <span class="ritmo-verde" style:flex={p.noRitmo}></span>
              <span class="ritmo-amarelo" style:flex={p.emRisco}></span>
              <span class="ritmo-vermelho" style:flex={p.atrasado}></span>
              {#if p.total === 0}
                <span class="ritmo-vazio"></span>
              {/if}
            </div>

            <div class="pessoa-rodape">
              <small class="ritmo-texto">
                {#if p.total === 0}
                  Sem demandas em andamento
                {:else}
                  <span class="txt-verde">{p.noRitmo} ok</span> ·
                  <span class="txt-amarelo">{p.emRisco} risco</span> ·
                  <span class="txt-vermelho">{p.atrasado} atraso</span>
                {/if}
              </small>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <!-- ÚLTIMO REGISTRO DO DIÁRIO (CARD COMPACTO) -->
  {#if ultimoRegistro}
    <section class="cartao registro-compacto">
      <div class="registro-conteudo">
        <span class="registro-etiqueta">📸 Último registro no diário:</span>
        <p class="registro-motivo">
          <b>[{ultimoRegistro.pasta || 'DEV'}] {dataMedia(ultimoRegistro.data)}:</b>
          {ultimoRegistro.motivo || ultimoRegistro.resumo || 'Registro de acompanhamento com imagens e comentários.'}
        </p>
      </div>
      <div class="registro-botoes">
        <a href="/painel" class="btn-secundario">Abrir Diário</a>
        <a href="/relatorio" class="btn-secundario destaque">Puxar no Relatório</a>
      </div>
    </section>
  {/if}
</main>

<style>
  .dashboard-executivo
  {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 24px;
  }

  /* TOPO DO DASHBOARD */
  .topo-dashboard
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding-bottom: 12px;
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
  .seletor-semana-caixa
  {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }
  .etiqueta-semana
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--suave);
    text-transform: uppercase;
  }
  .seletor-semana-caixa select
  {
    font-size: 0.86rem;
    padding: 6px 12px;
    background: var(--superficie);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    cursor: pointer;
  }

  /* AVISO */
  .aviso-banner
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
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
    font-size: 0.82rem;
    font-weight: 600;
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
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.12s, border-color 0.12s;
  }
  .card-kpi:hover
  {
    border-color: var(--borda-forte);
  }
  .kpi-rotulo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.74rem;
    color: var(--suave);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .kpi-valor-grupo
  {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .kpi-icone-status
  {
    font-size: 1rem;
    line-height: 1;
  }
  .kpi-valor-texto
  {
    font-size: 1.25rem;
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
    height: 5px;
    background: var(--superficie-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .kpi-barra-preenchimento
  {
    height: 100%;
    background: var(--marca);
    border-radius: 999px;
    transition: width 0.3s;
  }
  .destaque-vermelho
  {
    color: var(--vermelho) !important;
  }
  .card-kpi.alerta
  {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.03);
  }

  /* 4 ATALHOS RÁPIDOS */
  .grade-atalhos
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .card-atalho
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--texto);
    transition: transform 0.15s, border-color 0.15s, background 0.15s;
  }
  .card-atalho:hover
  {
    transform: translateY(-2px);
    border-color: var(--marca);
    background: var(--superficie);
  }
  .atalho-icone
  {
    font-size: 1.5rem;
    line-height: 1;
    flex: none;
  }
  .atalho-info
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .atalho-info strong
  {
    font-size: 0.9rem;
    color: var(--texto);
  }
  .atalho-info span
  {
    font-size: 0.76rem;
    color: var(--suave);
  }

  /* GRADE DUPLA */
  .grade-dupla
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }
  .painel-secao
  {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
  }
  .secao-cabecalho
  {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--borda);
    padding-bottom: 8px;
  }
  .secao-cabecalho h2
  {
    margin: 0;
    font-size: 1.05rem;
  }
  .link-subtil
  {
    font-size: 0.78rem;
    color: var(--marca);
    text-decoration: none;
  }
  .link-subtil:hover
  {
    text-decoration: underline;
  }

  /* ESTADO LIMPO */
  .estado-limpo
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 12px;
    gap: 6px;
  }
  .icone-ok
  {
    font-size: 1.8rem;
  }
  .estado-limpo p
  {
    margin: 0;
    font-size: 0.92rem;
    color: var(--texto);
  }

  /* LISTA DE DEMANDAS */
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
    border-left: 3px solid var(--suave);
    border-radius: var(--raio-pequeno);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .item-demanda.urgente
  {
    border-left-color: var(--vermelho);
    background: rgba(239, 68, 68, 0.04);
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
  .demanda-etapa
  {
    color: var(--suave);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag-ritmo
  {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 999px;
  }
  .tag-ritmo.atrasado
  {
    background: rgba(239, 68, 68, 0.15);
    color: var(--vermelho);
  }
  .tag-ritmo.risco
  {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
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
    justify-content: space-between;
    font-size: 0.74rem;
    color: var(--suave);
  }

  /* VENCIMENTOS */
  .bloco-vencimentos
  {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px dashed var(--borda);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .vencimentos-rotulo
  {
    font-size: 0.76rem;
    color: var(--suave);
    font-weight: 500;
  }
  .vencimentos-chips
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-vencimento
  {
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

  /* LISTA TIME */
  .lista-time
  {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item-pessoa
  {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    padding: 8px 10px;
  }
  .pessoa-linha-topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pessoa-linha-topo strong
  {
    font-size: 0.86rem;
  }
  .pessoa-acoes
  {
    display: flex;
    align-items: center;
    gap: 6px;
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
    cursor: pointer;
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
    background: var(--superficie);
  }
  .ritmo-verde { background: #10b981; }
  .ritmo-amarelo { background: #f59e0b; }
  .ritmo-vermelho { background: #ef4444; }
  .ritmo-vazio { flex: 1; background: var(--borda); }

  .pessoa-rodape
  {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
  }
  .ritmo-texto .txt-verde { color: #10b981; font-weight: 500; }
  .ritmo-texto .txt-amarelo { color: #f59e0b; font-weight: 500; }
  .ritmo-texto .txt-vermelho { color: #ef4444; font-weight: 500; }

  /* REGISTRO COMPACTO */
  .registro-compacto
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-left: 3px solid var(--marca);
  }
  .registro-conteudo
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 250px;
  }
  .registro-etiqueta
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--suave);
    text-transform: uppercase;
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
    gap: 6px;
  }
  .btn-secundario
  {
    font-size: 0.8rem;
    padding: 5px 10px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-secundario:hover
  {
    border-color: var(--borda-forte);
  }
  .btn-secundario.destaque
  {
    background: var(--marca-clara);
    border-color: var(--marca);
    color: var(--marca);
  }
</style>
