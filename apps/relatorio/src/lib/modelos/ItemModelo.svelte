<script lang="ts">
  import type { Modelo } from '@supervisao/core';
  import { baixarModelo } from '#lib/modelos.ts';

  let { modelo, pronto = false, ativo = false, aoEditar, aoDuplicar, aoExcluir }: {
    modelo: Modelo;
    pronto?: boolean;
    ativo?: boolean;
    aoEditar?: () => void;
    aoDuplicar: () => void;
    aoExcluir?: () => void;
  } = $props();
</script>

<li class="item" class:ativo>
  <div class="linha">
    <b title={modelo.descricao}>{modelo.nome}</b>
    <span class="etiquetas">
      <i>{modelo.periodo === 'livre' ? 'período livre' : 'semana'}</i>
      <i>{modelo.blocos.length} blocos</i>
    </span>
  </div>
  <div class="acoes">
    {#if pronto}
      <button onclick={aoDuplicar}>Usar como base</button>
    {:else}
      <button class:principal={ativo} onclick={aoEditar}>{ativo ? 'Fechar' : 'Editar'}</button>
      <button onclick={aoDuplicar}>Duplicar</button>
    {/if}
    <button class="link" onclick={() => baixarModelo(modelo)}>exportar</button>
    {#if aoExcluir}<button class="link perigo" onclick={aoExcluir}>excluir</button>{/if}
  </div>
  {#if ativo && modelo.descricao}<p class="descricao">{modelo.descricao}</p>{/if}
</li>

<style>
  .item
  {
    display: grid;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--borda);
  }
  .item:last-child
  {
    border-bottom: none;
  }
  .item.ativo
  {
    background: var(--marca-clara);
    box-shadow: inset 3px 0 0 var(--marca);
  }
  .linha
  {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .etiquetas
  {
    display: flex;
    gap: 4px;
  }
  .etiquetas i
  {
    font-style: normal;
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: 4px;
    padding: 0 6px;
  }
  .acoes
  {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .acoes button:not(.link)
  {
    font-size: 0.78rem;
    padding: 3px 10px;
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.8rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .descricao
  {
    margin: 0;
    font-size: 0.82rem;
    color: var(--suave);
  }
</style>
