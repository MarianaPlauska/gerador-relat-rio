<script lang="ts">
  import type { ItemResumo } from './tipos.ts';

  let { itens }: { itens: ItemResumo[] } = $props();
</script>

<section class="resumo" aria-label="Resumo da semana">
  {#each itens as i (i.rotulo)}
    <div class="item">
      <span class="etiqueta">{i.rotulo}</span>
      <div class="valor">
        {#if i.ponto}<span class="ponto {i.ponto}" aria-hidden="true"></span>{/if}
        <strong class:num={i.numero} class:semcor={!i.tom} class={i.tom}>{i.valor}</strong>
        {#if i.sub}<span class="sub">{i.sub}</span>{/if}
      </div>
      {#if i.barra !== undefined}<div class="trilho"><div class="enchimento" style:width="{i.barra}%"></div></div>{/if}
      <small>{i.detalhe}</small>
    </div>
  {/each}
</section>

<style>
  .resumo
  {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
  }
  .item
  {
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 14px 18px;
    border-left: 1px solid var(--borda);
    min-width: 0;
  }
  .item:first-child
  {
    border-left: none;
  }
  .valor
  {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  strong
  {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
  }
  strong.num
  {
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
    text-align: left;
  }
  strong.semcor
  {
    color: var(--texto);
  }
  strong.vermelho
  {
    color: var(--vermelho);
  }
  strong.amarelo
  {
    color: var(--amarelo);
  }
  .sub
  {
    color: var(--suave);
    font-size: 0.85rem;
  }
  small
  {
    color: var(--suave);
    font-size: 0.8rem;
  }
  .ponto
  {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--borda-forte);
    align-self: center;
  }
  .ponto.verde
  {
    background: var(--verde);
  }
  .ponto.amarelo
  {
    background: var(--amarelo);
  }
  .ponto.vermelho
  {
    background: var(--vermelho);
  }
  .trilho
  {
    height: 4px;
    background: var(--borda);
    border-radius: 2px;
    overflow: hidden;
  }
  .enchimento
  {
    height: 100%;
    background: var(--azul);
  }
  @media (max-width: 860px)
  {
    .resumo
    {
      grid-template-columns: 1fr 1fr;
    }
    .item:nth-child(3)
    {
      border-left: none;
    }
    .item:nth-child(n + 3)
    {
      border-top: 1px solid var(--borda);
    }
  }
</style>
