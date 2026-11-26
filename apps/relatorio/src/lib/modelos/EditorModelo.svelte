<script lang="ts">
  import type { Bloco, Fluxograma, Lista, Modelo, Pessoa } from '@supervisao/core';
  import ListaDeBlocos from '#lib/ListaDeBlocos.svelte';
  import { rotuloBloco } from '#lib/modelos.ts';

  let { modelo, listas, fluxos, pessoas, mudar, fechar }: {
    modelo: Modelo;
    listas: Lista[];
    fluxos: Fluxograma[];
    pessoas: Pessoa[];
    mudar: <K extends keyof Modelo>(campo: K, valor: Modelo[K]) => void;
    fechar: () => void;
  } = $props();

  let aba = $state<'blocos' | 'capa'>('blocos');
</script>

<div class="editor">
  <div class="topo">
    <input class="nome" value={modelo.nome} oninput={(e) => mudar('nome', e.currentTarget.value)} aria-label="Nome do modelo" />
    <button class="link" onclick={fechar}>fechar</button>
  </div>

  <div class="abas" role="tablist">
    <button role="tab" aria-selected={aba === 'blocos'} class:ativa={aba === 'blocos'} onclick={() => (aba = 'blocos')}>Blocos ({modelo.blocos.length})</button>
    <button role="tab" aria-selected={aba === 'capa'} class:ativa={aba === 'capa'} onclick={() => (aba = 'capa')}>Capa e período</button>
  </div>

  {#if aba === 'blocos'}
    <p class="dica resumo">{modelo.blocos.map(rotuloBloco).join(' › ') || 'Sem blocos ainda.'}</p>
    <ListaDeBlocos {listas} {fluxos} {pessoas} blocos={modelo.blocos} onmudar={(novos: Bloco[]) => mudar('blocos', novos)} />
  {:else}
    <div class="campos">
      <label class="largo">Para que serve <input value={modelo.descricao} oninput={(e) => mudar('descricao', e.currentTarget.value)} /></label>
      <label>Título da capa <input value={modelo.titulo} oninput={(e) => mudar('titulo', e.currentTarget.value)} /></label>
      <label>Sigla do número
        <input value={modelo.sigla} maxlength="4" oninput={(e) => mudar('sigla', e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '') || 'RM')} />
      </label>
      <label>Período
        <select value={modelo.periodo} onchange={(e) => mudar('periodo', e.currentTarget.value as Modelo['periodo'])}>
          <option value="semana">Uma semana</option>
          <option value="livre">Do dia X ao dia Y</option>
        </select>
      </label>
      <label>Capa
        <select value={modelo.capa} onchange={(e) => mudar('capa', e.currentTarget.value as Modelo['capa'])}>
          <option value="completa">Página inteira</option>
          <option value="curta">Faixa no topo</option>
        </select>
      </label>
      <label class="marca"><input type="checkbox" checked={modelo.sumario} onchange={(e) => mudar('sumario', e.currentTarget.checked)} /> com sumário</label>
    </div>
  {/if}
</div>

<style>
  .editor
  {
    display: grid;
    gap: 10px;
  }
  .topo
  {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .nome
  {
    flex: 1;
    font-weight: 700;
    font-size: 1rem;
  }
  .abas
  {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--borda);
  }
  .abas button
  {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: 6px 10px;
    font-size: 0.84rem;
    color: var(--suave);
  }
  .abas button.ativa
  {
    color: var(--texto);
    border-bottom-color: var(--marca);
    font-weight: 600;
  }
  .resumo
  {
    margin: 0;
    font-size: 0.8rem;
  }
  .campos
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }
  .campos label
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.84rem;
  }
  .campos .largo
  {
    grid-column: 1 / -1;
  }
  .campos .marca
  {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.82rem;
  }
</style>
