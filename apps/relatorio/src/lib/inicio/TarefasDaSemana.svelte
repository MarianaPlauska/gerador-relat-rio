<script lang="ts">
  import type { CardSnapshot } from '@supervisao/core';
  import { dataCurta, dataMedia } from '#lib/semana.ts';

  let { cards, total, projeto, vencimentos }: { cards: CardSnapshot[]; total: number; projeto: string; vencimentos: CardSnapshot[] } = $props();

  const atrasada = (c: CardSnapshot) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado';
</script>

<section class="painel">
  <header>
    <div>
      <span class="etiqueta">Projeto {projeto}</span>
      <h2>Tarefas da semana <span class="contagem">{total}</span></h2>
    </div>
    <nav>
      <a href="/calendario">calendário</a>
      <a href="/cards">todos os cards</a>
    </nav>
  </header>

  {#if cards.length === 0}
    <p class="vazio">Nenhuma tarefa em andamento nesta semana.</p>
  {:else}
    <ul>
      {#each cards as c (c.codigo)}
        <li class:urgente={atrasada(c) || c.prioridadeCard === 'Crítica'}>
          <div class="linha">
            <span class="codigo">{c.codigo}</span>
            {#if c.prioridadeCard}
              <span class="pilula" class:atrasado={c.prioridadeCard === 'Crítica'} class:em_risco={c.prioridadeCard === 'Alta'} class:neutra={c.prioridadeCard !== 'Crítica' && c.prioridadeCard !== 'Alta'}>{c.prioridadeCard}</span>
            {/if}
            {#if atrasada(c)}
              <span class="pilula atrasado">atrasado</span>
            {:else if c.ritmoPainel === 'em_risco'}
              <span class="pilula em_risco">em risco</span>
            {:else if c.ritmoPainel === 'no_ritmo' || c.situacao === 'concluido'}
              <span class="pilula no_ritmo">{c.situacao === 'concluido' ? 'resolvido' : 'no ritmo'}</span>
            {/if}
            <span class="etapa">{c.etapaAtual || c.statusCard || 'Em andamento'}</span>
            <span class="numeros">
              {#if c.etapas?.length}<span>{c.etapasConcluidas ?? 0}/{c.etapas.length} etapas</span>{/if}
              {#if c.horasEstimadas}<span>~{c.horasEstimadas}h</span>{/if}
            </span>
          </div>
          <strong class="titulo">{c.assunto || c.titulo || 'Tarefa sem título descrito'}</strong>
          {#if c.previsao || c.vencimento || c.comentario}
            <div class="meta">
              {#if c.previsao}<span>Previsão <b>{dataMedia(c.previsao)}</b></span>{/if}
              {#if c.vencimento}<span>Vencimento <b>{dataMedia(c.vencimento)}</b></span>{/if}
              {#if c.comentario}<span>{c.comentario}</span>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if vencimentos.length}
    <footer>
      <span class="etiqueta">Vencem em até 15 dias</span>
      {#each vencimentos as v (v.codigo)}
        <span class="venc"><b>{v.codigo}</b> {dataCurta(v.vencimento!)}</span>
      {/each}
    </footer>
  {/if}
</section>

<style>
  .painel
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px 18px;
    min-width: 0;
  }
  header
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }
  h2
  {
    margin: 0;
    font-size: 1.05rem;
  }
  .contagem
  {
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
    color: var(--suave);
    font-weight: 400;
    margin-left: 4px;
  }
  nav
  {
    display: flex;
    gap: 14px;
    font-size: 0.84rem;
  }
  nav a
  {
    color: var(--suave);
    text-decoration: none;
  }
  nav a:hover
  {
    color: var(--texto);
    text-decoration: underline;
  }
  .vazio
  {
    margin: 12px 0 4px;
    color: var(--suave);
    font-size: 0.9rem;
  }
  ul
  {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li
  {
    display: grid;
    gap: 3px;
    padding: 10px 0 10px 12px;
    border-top: 1px solid var(--borda);
    border-left: 2px solid transparent;
  }
  li.urgente
  {
    border-left-color: var(--vermelho);
  }
  .linha
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    font-size: 0.82rem;
  }
  .codigo
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 0.86rem;
  }
  .pilula.neutra
  {
    background: var(--superficie-2);
    color: var(--suave);
  }
  .etapa
  {
    color: var(--suave);
  }
  .numeros
  {
    margin-left: auto;
    display: flex;
    gap: 10px;
    color: var(--suave);
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
  }
  .titulo
  {
    font-weight: 500;
    font-size: 0.92rem;
    overflow-wrap: anywhere;
  }
  .meta
  {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    color: var(--suave);
    font-size: 0.8rem;
  }
  .meta b
  {
    font-weight: 500;
    color: var(--texto);
    font-variant-numeric: tabular-nums;
  }
  footer
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--borda);
    font-size: 0.82rem;
  }
  .venc b
  {
    font-family: var(--fonte-maquina);
  }
</style>
