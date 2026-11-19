<script lang="ts">
  import { ocupacao, totalGeral, type Planilha } from '@supervisao/core';
  import { moeda } from '#lib/formato.ts';

  let { planilhas }: { planilhas: Planilha[] } = $props();
</script>

{#if planilhas.length}
  <h3>Suas planilhas ({planilhas.length})</h3>
  <div class="cartoes">
    {#each planilhas as p (p.id)}
      {@const total = totalGeral(p)}
      {@const uso = ocupacao(p)}
      <a class="cartao item" href="/planilhas?id={p.id}">
        <b>{p.nome}</b>
        <span class="dica">{p.grupos.length} grupos · {p.linhas.length} itens</span>
        <span class="maquina">{moeda(total.ref, p.moeda)}{uso ? ` · ${uso.ref.pct}% do orçamento` : ''}</span>
        {#if uso}<span class="barra"><span class:estoura={uso.ref.estoura} style:width="{Math.min(uso.ref.pct, 100)}%"></span></span>{/if}
      </a>
    {/each}
  </div>
{/if}

<style>
  .cartoes
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--size-4);
  }
  .item
  {
    display: grid;
    gap: var(--size-2);
    margin-top: 0;
    text-decoration: none;
    color: var(--texto);
    transition: border-color 0.2s;
  }
  .item:hover
  {
    border-color: var(--marca);
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
  .barra span.estoura
  {
    background: var(--vermelho);
  }
</style>
