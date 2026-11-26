<script lang="ts">
  import type { CardSnapshot } from '@supervisao/core';

  // as linhas do CSV como ficaram depois da leitura: dá para conferir de relance se cada coluna caiu no lugar certo
  let { codigos, cardsLidos, pessoas }: { codigos: string[]; cardsLidos: CardSnapshot[]; pessoas: { id: string; nome: string }[] } = $props();

  const linhas = $derived(codigos.map((c) => cardsLidos.find((x) => x.codigo === c)).filter((c): c is CardSnapshot => !!c));
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? id;
  const data = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '-');
</script>

{#if linhas.length}
  <div class="rolagem">
    <table>
      <thead>
        <tr><th>ID</th><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Abertura</th></tr>
      </thead>
      <tbody>
        {#each linhas as c (c.codigo)}
          <tr>
            <td class="codigo">{c.codigo}</td>
            <td class="tarefa" title={c.titulo}>{c.titulo ?? '-'}</td>
            <td>{c.statusCard ?? '-'}</td>
            <td>{c.prioridadeCard ?? '-'}</td>
            <td>{c.responsaveis.map(nome).join(', ') || 'sem responsável'}</td>
            <td>{data(c.abertura)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .rolagem
  {
    overflow-x: auto;
    max-height: 320px;
    overflow-y: auto;
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
    padding: 5px 8px;
    border-bottom: 1px solid var(--borda);
    white-space: nowrap;
  }
  th
  {
    position: sticky;
    top: 0;
    background: var(--superficie);
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--suave);
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
</style>
