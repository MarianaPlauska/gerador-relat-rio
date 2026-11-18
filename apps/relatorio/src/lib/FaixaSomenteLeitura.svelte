<script lang="ts">
  import { somenteLeitura } from '#lib/nuvem.svelte.ts';
</script>

<!-- aparece em todas as telas quando a pessoa só pode ler o espaço aberto -->
{#if somenteLeitura()}
  <div class="faixa-leitura" role="status">
    <b>Somente leitura</b>
    <span>Você está vendo o espaço de outra pessoa como leitor e não pode alterar nada. O que você mexer na tela não é salvo.</span>
  </div>
{/if}

<style>
  .faixa-leitura { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; padding: 8px 14px; background: var(--superficie-2); border-bottom: 2px solid var(--amarelo); font-size: 0.85rem; text-align: center; }
</style>
