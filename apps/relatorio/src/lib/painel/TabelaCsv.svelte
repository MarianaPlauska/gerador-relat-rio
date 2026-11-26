<script lang="ts">
  import type { CardSnapshot } from '@supervisao/core';
  import type { AcoesCards, AnexosCard } from './acoes';
  import DetalheLinhaCsv from './DetalheLinhaCsv.svelte';

  // as linhas do CSV como ficaram depois da leitura; clicar numa abre por quê, pedido e prints daquela tarefa
  let { codigos, cardsLidos, pessoas, acoes, anexos, aoAbrirCard, aoAbrirLinha }: {
    codigos: string[];
    cardsLidos: CardSnapshot[];
    pessoas: { id: string; nome: string }[];
    acoes?: AcoesCards | undefined;
    anexos?: AnexosCard | undefined;
    aoAbrirCard?: ((codigo: string) => void) | undefined;
    aoAbrirLinha?: (() => void) | undefined;
  } = $props();

  let aberta = $state<string | undefined>();

  const linhas = $derived(codigos.map((c) => cardsLidos.find((x) => x.codigo === c)).filter((c): c is CardSnapshot => !!c));
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? id;
  const data = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '-');
  const podeAbrir = $derived(!!acoes && !!anexos);

  function alternar(codigo: string)
  {
    if (!podeAbrir) return;
    aberta = aberta === codigo ? undefined : codigo;
    aoAbrirLinha?.();
  }
</script>

{#if linhas.length}
  {#if podeAbrir}<p class="dica">Clique no ID (seta) para dizer por quê, continuar a descrição ou colar prints. Clique no nome da tarefa para abrir a inspeção completa dela.</p>{/if}
  <div class="rolagem">
    <table>
      <thead>
        <tr><th>ID</th><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Abertura</th></tr>
      </thead>
      <tbody>
        {#each linhas as c (c.codigo)}
          <tr class:clicavel={podeAbrir} class:aberta={aberta === c.codigo}>
            <td class="codigo">
              <button type="button" disabled={!podeAbrir} aria-expanded={aberta === c.codigo} onclick={() => alternar(c.codigo)}>
                {#if podeAbrir}<span class="seta">{aberta === c.codigo ? '▾' : '▸'}</span>{/if}{c.codigo}
              </button>
            </td>
            <td class="tarefa">
              <button type="button" disabled={!aoAbrirCard} title="Abrir a inspeção desta tarefa" onclick={() => aoAbrirCard?.(c.codigo)}>{c.titulo ?? '-'}</button>
              {#if c.porque}<small>por quê: {c.porque}</small>{/if}
            </td>
            <td>{c.statusCard ?? '-'}</td>
            <td>{c.prioridadeCard ?? '-'}</td>
            <td>{c.responsaveis.map(nome).join(', ') || 'sem responsável'}</td>
            <td>{data(c.abertura)}</td>
          </tr>
          {#if aberta === c.codigo && acoes && anexos}
            <tr class="linha-detalhe">
              <td colspan="6"><DetalheLinhaCsv card={c} {acoes} {anexos} aoAbrirTudo={() => aoAbrirCard?.(c.codigo)} /></td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .dica
  {
    margin: 4px 0;
    font-size: 0.8rem;
  }
  .rolagem
  {
    overflow: auto;
    max-height: 420px;
    border: 1px solid var(--borda);
    border-radius: 6px;
    margin: 6px 0;
  }
  table
  {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th, td
  {
    text-align: left;
    vertical-align: top;
    padding: 5px 8px;
    border-bottom: 1px solid var(--borda);
    white-space: nowrap;
  }
  th
  {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--superficie);
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--suave);
  }
  .clicavel
  {
    cursor: var(--cursor-clique);
  }
  .clicavel:hover, .aberta
  {
    background: var(--marca-clara);
  }
  .tarefa button:not(:disabled):hover
  {
    text-decoration: underline;
    color: var(--marca);
  }
  td button
  {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: inherit;
  }
  .seta
  {
    color: var(--marca);
    margin-right: 4px;
    font-size: 0.75rem;
  }
  .codigo
  {
    font-family: var(--fonte-maquina);
  }
  .tarefa
  {
    white-space: normal;
    min-width: 220px;
  }
  .tarefa small
  {
    display: block;
    color: var(--suave);
  }
  .linha-detalhe td
  {
    padding: 0;
  }
</style>
