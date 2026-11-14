<script lang="ts">
  import { tamanhoDoNo, type TipoNo } from '@supervisao/core';
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { tick } from 'svelte';

  let { id, data, selected }: NodeProps & { data: { texto: string; tipo: TipoNo } } = $props();
  const { updateNodeData } = useSvelteFlow();
  const t = $derived(tamanhoDoNo(data.tipo));
  let editando = $state(false);
  let rascunho = $state('');
  let caixa = $state<HTMLTextAreaElement>();

  async function editar()
  {
    rascunho = data.texto;
    editando = true;
    await tick();
    caixa?.select();
  }

  function concluir(salvar: boolean)
  {
    if (salvar && rascunho.trim()) updateNodeData(id, { texto: rascunho.trim() });
    editando = false;
  }
</script>

<div class="no {data.tipo}" class:selecionado={selected} style:width="{t.largura}px" style:height="{t.altura}px" ondblclick={editar} role="button" tabindex="-1" title="Dois cliques para editar o texto">
  {#if data.tipo === 'decisao'}
    <svg class="losango" viewBox="0 0 {t.largura} {t.altura}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="{t.largura / 2},1 {t.largura - 1},{t.altura / 2} {t.largura / 2},{t.altura - 1} 1,{t.altura / 2}" />
    </svg>
  {/if}
  {#if data.tipo !== 'inicio' && data.tipo !== 'nota'}
    <Handle type="target" position={Position.Top} id="cima" />
    <Handle type="target" position={Position.Right} id="direita" class="lateral" style="top: 22%" />
  {/if}
  {#if editando}
    <textarea
      class="nodrag"
      bind:this={caixa}
      bind:value={rascunho}
      onblur={() => concluir(true)}
      onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); concluir(true); } else if (e.key === 'Escape') concluir(false); }}
    ></textarea>
  {:else}
    <span class="texto">{data.texto}</span>
  {/if}
  {#if data.tipo !== 'fim' && data.tipo !== 'nota'}
    <Handle type="source" position={Position.Bottom} id="baixo" />
  {/if}
  {#if data.tipo !== 'fim' && data.tipo !== 'nota'}
    <Handle type="source" position={Position.Right} id="lado" class={data.tipo === 'decisao' ? '' : 'lateral'} />
  {/if}
</div>

<style>
  .no
  {
    position: relative;
    display: grid;
    place-items: center;
    padding: 6px 12px;
    box-sizing: border-box;
    text-align: center;
    font-size: 0.8rem;
    line-height: 1.25;
    color: var(--texto);
    background: var(--superficie);
    border: 1.5px solid var(--borda-forte);
    border-radius: 10px;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .texto
  {
    position: relative;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  .inicio, .fim
  {
    border-radius: 999px;
    font-family: var(--fonte-maquina);
    font-weight: 700;
  }
  .inicio
  {
    background: var(--marca-clara);
    border-color: var(--marca);
    color: var(--marca);
  }
  .fim
  {
    background: var(--texto);
    border-color: var(--texto);
    color: var(--fundo);
  }
  .decisao
  {
    background: none;
    border: none;
    padding: 10px 34px;
  }
  .losango
  {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .losango polygon
  {
    fill: var(--amarelo-fundo);
    stroke: var(--amarelo);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .nota
  {
    background: var(--superficie-2);
    border-style: dashed;
    font-style: italic;
    color: var(--suave);
    border-radius: 4px;
  }
  .selecionado
  {
    border-color: var(--marca);
    box-shadow: 0 0 0 3px var(--marca-clara);
  }
  .decisao.selecionado
  {
    box-shadow: none;
  }
  .decisao.selecionado .losango polygon
  {
    stroke: var(--marca);
    stroke-width: 2.5;
  }
  textarea
  {
    position: relative;
    width: 100%;
    height: 100%;
    resize: none;
    font: inherit;
    text-align: center;
    padding: 2px;
  }
  /* bolinhas do lado só aparecem com o mouse em cima ou selecionado */
  .no :global(.lateral)
  {
    opacity: 0;
  }
  .no:hover :global(.lateral), .selecionado :global(.lateral)
  {
    opacity: 1;
  }
  .no :global(.svelte-flow__handle)
  {
    width: 10px;
    height: 10px;
    background: var(--marca);
    border: 2px solid var(--fundo);
  }
</style>
