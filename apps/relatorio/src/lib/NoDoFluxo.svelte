<script lang="ts">
  import { tamanhoDoNo, type TempoEtapa, type TipoNo } from '@supervisao/core';
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { tick } from 'svelte';

  let { id, data, selected }: NodeProps & { data: { texto: string; tipo: TipoNo; detalhes?: string; ativoNoPercurso?: boolean; tempo?: TempoEtapa; gargalo?: boolean } } = $props();
  const dias = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
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

<div
  class="no {data.tipo}"
  class:selecionado={selected}
  class:percorrendo={data.ativoNoPercurso}
  class:gargalo={data.gargalo}
  style:width="{t.largura}px"
  style:height="{t.altura}px"
  ondblclick={editar}
  role="button"
  tabindex="-1"
  title="{data.texto}{data.detalhes ? `\n\nDetalhes:\n${data.detalhes}` : ''}\n(Clique para abrir propriedades no painel)"
>
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
    {#if data.tempo}
      <span class="tempo" title="Medido em {data.tempo.n} etapas feitas nos cards do painel: metade levou até {dias(data.tempo.p50)} d e 85% até {dias(data.tempo.p85)} d.{data.tempo.rodandoAgora ? ` ${data.tempo.rodandoAgora} rodando agora.` : ''}{data.gargalo ? ' É a etapa mais demorada (gargalo).' : ''}">p50 {dias(data.tempo.p50)} d · p85 {dias(data.tempo.p85)} d{data.tempo.rodandoAgora ? ` · ${data.tempo.rodandoAgora} agora` : ''}</span>
    {/if}
    {#if data.detalhes}
      <span class="tem-detalhes" title="Contém anotações / detalhes">✦</span>
    {/if}
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
    font-size: 0.82rem;
    line-height: 1.25;
    color: var(--texto);
    background: var(--superficie);
    border: 1.5px solid var(--borda-forte);
    border-radius: 12px;
    transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
    user-select: none;
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
    font-weight: 500;
  }
  .tempo
  {
    position: absolute;
    left: 50%;
    bottom: -11px;
    transform: translateX(-50%);
    white-space: nowrap;
    font-family: var(--fonte-maquina);
    font-size: 0.66rem;
    padding: 1px 7px;
    border: 1px solid var(--borda-forte);
    background: var(--superficie-2);
    color: var(--suave);
    border-radius: 3px;
  }
  .gargalo
  {
    border-color: var(--vermelho);
    box-shadow: 0 0 0 3px var(--vermelho-fundo);
  }
  .gargalo .tempo
  {
    border-color: var(--vermelho);
    color: var(--vermelho);
  }
  .tem-detalhes
  {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 0.65rem;
    color: var(--marca);
    opacity: 0.8;
  }
  .inicio, .fim
  {
    border-radius: 999px;
    font-family: var(--fonte-maquina);
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .inicio
  {
    background: rgba(16, 185, 129, 0.12);
    border-color: #10b981;
    color: #34d399;
  }
  .fim
  {
    background: var(--superficie-2);
    border-color: var(--borda-forte);
    color: var(--suave);
  }
  .passo
  {
    border: 1.5px solid #38bdf8;
    background: rgba(56, 189, 248, 0.06);
  }
  .decisao
  {
    background: none;
    border: none;
    padding: 10px 34px;
    color: #fef3c7;
    font-weight: 600;
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
    fill: #2f2518;
    stroke: #f59e0b;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .nota
  {
    background: var(--superficie-2);
    border-style: dashed;
    font-style: italic;
    color: var(--suave);
    border-radius: 6px;
  }
  .selecionado
  {
    border-color: var(--marca);
    box-shadow: 0 0 0 3px var(--marca-clara), 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10;
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
  .percorrendo
  {
    border-color: #10b981 !important;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.6) !important;
    animation: pulso 1.5s infinite;
    z-index: 20;
  }
  .decisao.percorrendo .losango polygon
  {
    stroke: #10b981 !important;
    stroke-width: 3 !important;
  }
  @keyframes pulso
  {
    0% { transform: scale(1); }
    50% { transform: scale(1.04); }
    100% { transform: scale(1); }
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
    background: var(--fundo);
    color: var(--texto);
    border: 1px solid var(--marca);
    border-radius: 6px;
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
