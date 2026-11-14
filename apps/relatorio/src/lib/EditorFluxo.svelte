<script lang="ts">
  import { nomesTipoNo, organizar, paraMermaid, tamanhoDoNo, type Fluxograma, type LigacaoFluxo, type NoFluxo, type TipoNo } from '@supervisao/core';
  import { Background, Controls, MarkerType, MiniMap, Panel, SvelteFlow, useSvelteFlow, type ColorMode, type Connection, type Edge, type Node, type OnConnectEnd } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import { baixarPng, baixarSvg } from './fluxograma.ts';
  import NoDoFluxo from './NoDoFluxo.svelte';

  type Dado = { texto: string; tipo: TipoNo };
  let { fluxo, onmudar }: { fluxo: Fluxograma; onmudar: (nos: NoFluxo[], ligacoes: LigacaoFluxo[]) => void } = $props();

  const nodeTypes = { no: NoDoFluxo };
  const seta = { type: MarkerType.ArrowClosed, width: 16, height: 16 };
  const pecas: TipoNo[] = ['inicio', 'passo', 'decisao', 'fim', 'nota'];
  const textoPadrao: Record<TipoNo, string> = { inicio: 'Início', passo: 'Novo passo', decisao: 'Pergunta?', fim: 'Fim', nota: 'Observação' };

  const paraNo = (n: NoFluxo): Node<Dado> => ({ id: n.id, type: 'no', position: { x: n.x, y: n.y }, data: { texto: n.texto, tipo: n.tipo } });
  // ligação que volta para cima sai e entra pela direita, por fora do desenho
  const paraAresta = (l: LigacaoFluxo, ys: Map<string, number>): Edge =>
  {
    const volta = (ys.get(l.para) ?? 0) < (ys.get(l.de) ?? 0);
    return {
      id: l.id, source: l.de, target: l.para, type: 'smoothstep', markerEnd: seta,
      sourceHandle: volta || l.saida === 'lado' ? 'lado' : 'baixo', targetHandle: volta ? 'direita' : 'cima',
      ...(l.rotulo ? { label: l.rotulo } : {}),
    };
  };
  const alturas = (nos: { id: string; y: number }[]) => new Map(nos.map((n) => [n.id, n.y]));

  // o editor é recriado a cada fluxo aberto; aqui só vale o fluxo inicial
  let nodes = $state.raw<Node<Dado>[]>(untrack(() => fluxo.nos.map(paraNo)));
  let edges = $state.raw<Edge[]>(untrack(() => fluxo.ligacoes.map((l) => paraAresta(l, alturas(fluxo.nos)))));
  let area = $state<HTMLDivElement>();
  let copiado = $state(false);
  const { screenToFlowPosition, fitView, deleteElements } = useSvelteFlow();

  const noSel = $derived(nodes.filter((n) => n.selected));
  const arestaSel = $derived(edges.filter((e) => e.selected));

  const deNos = (): NoFluxo[] => nodes.map((n) => ({ id: n.id, tipo: n.data.tipo, texto: n.data.texto, x: Math.round(n.position.x), y: Math.round(n.position.y) }));
  const deArestas = (): LigacaoFluxo[] => edges.map((e) => ({
    id: e.id, de: e.source, para: e.target,
    ...(typeof e.label === 'string' && e.label ? { rotulo: e.label } : {}),
    ...(e.sourceHandle === 'lado' ? { saida: 'lado' as const } : {}),
  }));
  const atual = (): Fluxograma => ({ ...fluxo, nos: deNos(), ligacoes: deArestas() });

  let espera: ReturnType<typeof setTimeout> | undefined;
  $effect(() =>
  {
    const nos = deNos();
    const ligacoes = deArestas();
    clearTimeout(espera);
    espera = setTimeout(() => onmudar(nos, ligacoes), 300);
  });

  // o tema da tela vale também para os controles do Svelte Flow
  let modo = $state<ColorMode>(document.documentElement.dataset.tema === 'claro' ? 'light' : 'dark');
  $effect(() =>
  {
    const obs = new MutationObserver(() => (modo = document.documentElement.dataset.tema === 'claro' ? 'light' : 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    return () => obs.disconnect();
  });

  let contador = 0;
  const novoId = (p: string) => `${p}${Date.now().toString(36)}${(contador++).toString(36)}`;

  // saída de decisão ganha sim e depois não
  function rotuloAuto(origem: string): string | undefined
  {
    if (nodes.find((n) => n.id === origem)?.data.tipo !== 'decisao') return undefined;
    const usados = edges.filter((e) => e.source === origem).map((e) => e.label);
    return !usados.includes('sim') ? 'sim' : !usados.includes('não') ? 'não' : undefined;
  }

  function aresta(de: string, para: string, saida?: string | null): Edge
  {
    const rotulo = rotuloAuto(de);
    const ys = new Map(nodes.map((n) => [n.id, n.position.y]));
    return paraAresta({ id: novoId('l'), de, para, ...(rotulo ? { rotulo } : {}), ...(saida === 'lado' ? { saida: 'lado' } : {}) }, ys);
  }

  // sem posição: entra abaixo do nó selecionado, já ligado a ele, ou no meio da tela
  function adicionar(tipo: TipoNo, posicao?: { x: number; y: number }, ligarDe?: { no: string; saida?: string | null })
  {
    const t = tamanhoDoNo(tipo);
    let pos = posicao;
    let de = ligarDe;
    const sel = noSel.length === 1 ? noSel[0]! : undefined;
    if (!pos && sel && tipo !== 'nota' && tipo !== 'inicio' && sel.data.tipo !== 'fim' && sel.data.tipo !== 'nota')
    {
      const ts = tamanhoDoNo(sel.data.tipo);
      pos = { x: sel.position.x + ts.largura / 2 - t.largura / 2, y: sel.position.y + ts.altura + 50 };
      de = { no: sel.id };
    }
    if (!pos)
    {
      const r = area!.getBoundingClientRect();
      const c = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 3 });
      pos = { x: c.x - t.largura / 2, y: c.y - t.altura / 2 };
    }
    // não cai em cima de outro nó: anda para a direita até achar lugar
    if (!posicao)
    {
      const p0 = pos;
      const ocupado = (x: number) => nodes.some((n) =>
      {
        const tn = tamanhoDoNo(n.data.tipo);
        return x < n.position.x + tn.largura + 20 && x + t.largura + 20 > n.position.x && p0.y < n.position.y + tn.altura + 20 && p0.y + t.altura + 20 > n.position.y;
      });
      let x = p0.x;
      for (let i = 0; i < 12 && ocupado(x); i++) x += 230;
      pos = { x, y: p0.y };
    }
    const id = novoId('n');
    nodes = [...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...paraNo({ id, tipo, texto: textoPadrao[tipo], x: pos.x, y: pos.y }), selected: true }];
    edges = edges.map((e) => (e.selected ? { ...e, selected: false } : e));
    if (de && tipo !== 'inicio' && tipo !== 'nota') edges = [...edges, aresta(de.no, id, de.saida)];
  }

  function soltar(e: DragEvent)
  {
    e.preventDefault();
    const tipo = e.dataTransfer?.getData('application/orbisos-no') as TipoNo | undefined;
    if (!tipo || !pecas.includes(tipo)) return;
    const t = tamanhoDoNo(tipo);
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    adicionar(tipo, { x: p.x - t.largura / 2, y: p.y - t.altura / 2 });
  }

  const antesDeLigar = (c: Connection): Edge => aresta(c.source, c.target, c.sourceHandle);

  // ligação solta no vazio cria um passo novo ali
  const aoSoltarLigacao: OnConnectEnd = (evento, estado) =>
  {
    if (estado.isValid || estado.toNode || !estado.fromNode || estado.fromHandle?.type !== 'source') return;
    const ponto = 'changedTouches' in evento ? evento.changedTouches[0]! : evento;
    const p = screenToFlowPosition({ x: ponto.clientX, y: ponto.clientY });
    const t = tamanhoDoNo('passo');
    adicionar('passo', { x: p.x - t.largura / 2, y: p.y }, { no: estado.fromNode.id, saida: estado.fromHandle.id });
  };

  function mudarNo(id: string, campos: Partial<Dado>)
  {
    nodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...campos } } : n));
  }

  function mudarRotulo(id: string, rotulo: string)
  {
    edges = edges.map((e) =>
    {
      if (e.id !== id) return e;
      const { label: _, ...resto } = e;
      return rotulo ? { ...resto, label: rotulo } : resto;
    });
  }

  function arrumar()
  {
    const r = organizar(deNos(), deArestas());
    nodes = r.nos.map(paraNo);
    edges = r.ligacoes.map((l) => paraAresta(l, alturas(r.nos)));
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 30);
  }

  async function copiarMermaid()
  {
    await navigator.clipboard.writeText(paraMermaid(atual()));
    copiado = true;
    setTimeout(() => (copiado = false), 1500);
  }
</script>

<div class="editor">
  <aside class="pecas">
    <div class="titulo-pecas">Peças</div>
    {#each pecas as tipo (tipo)}
      <button
        class="peca {tipo}"
        draggable="true"
        ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', tipo)}
        onclick={() => adicionar(tipo)}
        title="Clique para pôr na tela (abaixo do nó selecionado) ou arraste até o lugar"
      >
        <span class="forma"></span>{nomesTipoNo[tipo]}
      </button>
    {/each}
    <div class="lado-info">
      {#if noSel.length === 1}
        {@const n = noSel[0]!}
        <div class="titulo-pecas">Nó selecionado</div>
        <label>Tipo
          <select value={n.data.tipo} onchange={(e) => mudarNo(n.id, { tipo: e.currentTarget.value as TipoNo })}>
            {#each pecas as t (t)}<option value={t}>{nomesTipoNo[t]}</option>{/each}
          </select>
        </label>
        <label>Texto <textarea rows="3" value={n.data.texto} oninput={(e) => mudarNo(n.id, { texto: e.currentTarget.value })}></textarea></label>
        <button class="perigo" onclick={() => deleteElements({ nodes: [{ id: n.id }] })}>Excluir nó</button>
      {:else if arestaSel.length === 1 && noSel.length === 0}
        {@const e = arestaSel[0]!}
        <div class="titulo-pecas">Ligação selecionada</div>
        <label>Rótulo <input value={typeof e.label === 'string' ? e.label : ''} oninput={(ev) => mudarRotulo(e.id, ev.currentTarget.value)} placeholder="ex.: sim" /></label>
        <div class="rapidos">
          <button onclick={() => mudarRotulo(e.id, 'sim')}>sim</button>
          <button onclick={() => mudarRotulo(e.id, 'não')}>não</button>
          <button onclick={() => mudarRotulo(e.id, '')}>sem rótulo</button>
        </div>
        <button class="perigo" onclick={() => deleteElements({ edges: [{ id: e.id }] })}>Excluir ligação</button>
      {:else}
        <p class="dica">Comece pelo <b>Início</b> aqui na barra. Arraste a bolinha embaixo de um nó para ligar ao próximo passo; solte no vazio para criar um passo novo ali.</p>
        <p class="dica">Dois cliques num nó editam o texto. Delete apaga o que estiver selecionado.</p>
      {/if}
    </div>
  </aside>

  <div class="tela" bind:this={area} role="application" ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }} ondrop={soltar}>
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      colorMode={modo}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
      deleteKey={['Backspace', 'Delete']}
      onbeforeconnect={antesDeLigar}
      onconnectend={aoSoltarLigacao}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showLock={false} />
      <MiniMap pannable zoomable width={150} height={100} />
      <Panel position="top-right">
        <div class="acoes">
          <button onclick={arrumar} title="Organiza de cima para baixo">Organizar</button>
          <button onclick={copiarMermaid} title="Texto Mermaid para levar a outra ferramenta">{copiado ? 'Copiado' : 'Copiar Mermaid'}</button>
          <button onclick={() => baixarPng(atual())}>PNG</button>
          <button onclick={() => baixarSvg(atual())}>SVG</button>
        </div>
      </Panel>
    </SvelteFlow>
  </div>
</div>

<style>
  .editor
  {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: var(--size-3);
    height: max(480px, calc(100vh - 260px));
  }
  .pecas
  {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
  }
  .titulo-pecas
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: var(--suave);
    text-transform: lowercase;
    margin-top: 4px;
  }
  .peca
  {
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    cursor: grab;
  }
  .forma
  {
    width: 22px;
    height: 14px;
    border: 1.5px solid var(--borda-forte);
    border-radius: 3px;
    background: var(--superficie);
    flex: none;
  }
  .inicio .forma
  {
    border-radius: 999px;
    border-color: var(--marca);
    background: var(--marca-clara);
  }
  .fim .forma
  {
    border-radius: 999px;
    background: var(--texto);
    border-color: var(--texto);
  }
  .decisao .forma
  {
    width: 14px;
    height: 14px;
    margin: 0 4px;
    transform: rotate(45deg);
    border-color: var(--amarelo);
    background: var(--amarelo-fundo);
  }
  .nota .forma
  {
    border-style: dashed;
  }
  .lado-info
  {
    display: grid;
    gap: 8px;
    margin-top: var(--size-3);
    padding-top: var(--size-3);
    border-top: 1px dashed var(--borda);
  }
  .lado-info label
  {
    display: grid;
    gap: 3px;
    font-size: 0.82rem;
  }
  .lado-info textarea
  {
    resize: vertical;
  }
  .rapidos
  {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .rapidos button
  {
    font-size: 0.78rem;
    padding: 3px 8px;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .dica
  {
    margin: 0;
    font-size: 0.8rem;
  }
  .tela
  {
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    overflow: hidden;
    min-height: 0;
  }
  .acoes
  {
    display: flex;
    gap: 4px;
  }
  .acoes button
  {
    font-size: 0.8rem;
    padding: 4px 10px;
    background: var(--superficie);
  }
  .tela :global(.svelte-flow)
  {
    --xy-background-color: var(--fundo);
    --xy-background-pattern-dots-color: var(--borda-forte);
    --xy-edge-stroke: var(--suave);
    --xy-edge-stroke-selected: var(--marca);
    --xy-edge-stroke-width: 1.5;
    --xy-connectionline-stroke: var(--marca);
    --xy-edge-label-background-color: var(--superficie);
    --xy-edge-label-color: var(--texto);
    --xy-node-background-color: transparent;
    --xy-node-border: none;
    --xy-node-boxshadow-selected: none;
    --xy-node-boxshadow-hover: none;
    --xy-controls-button-background-color: var(--superficie);
    --xy-controls-button-background-color-hover: var(--superficie-2);
    --xy-controls-button-color: var(--texto);
    --xy-controls-button-color-hover: var(--marca);
    --xy-controls-button-border-color: var(--borda);
    --xy-minimap-background-color: var(--superficie);
    --xy-minimap-node-background-color: var(--borda-forte);
    --xy-selection-background-color: var(--marca-clara);
    --xy-selection-border: 1px dashed var(--marca);
  }
  .tela :global(.svelte-flow__controls-button)
  {
    padding: 4px;
    border-radius: 0;
    min-height: 0;
  }
  .tela :global(.svelte-flow__edge-label)
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--borda);
  }
  @media (max-width: 760px)
  {
    .editor
    {
      grid-template-columns: 1fr;
      height: auto;
    }
    .pecas
    {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .lado-info
    {
      width: 100%;
    }
    .tela
    {
      height: 70vh;
    }
  }
</style>
