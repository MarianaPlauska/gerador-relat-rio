<script lang="ts">
  import { detectarLacunas, nomesTipoNo, organizar, paraMermaid, tamanhoDoNo, type Fluxograma, type LigacaoFluxo, type NoFluxo, type TipoNo } from '@supervisao/core';
  import { Background, Controls, MarkerType, MiniMap, Panel, SvelteFlow, useSvelteFlow, type ColorMode, type Connection, type Edge, type Node, type OnConnectEnd } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import { baixarPng, baixarSvg } from './fluxograma.ts';
  import NoDoFluxo from './NoDoFluxo.svelte';

  type Dado = { texto: string; tipo: TipoNo; detalhes?: string; ativoNoPercurso?: boolean };
  let { fluxo, onmudar }: { fluxo: Fluxograma; onmudar: (nos: NoFluxo[], ligacoes: LigacaoFluxo[]) => void } = $props();

  const nodeTypes = { no: NoDoFluxo };
  const seta = { type: MarkerType.ArrowClosed, width: 16, height: 16 };
  const pecas: TipoNo[] = ['inicio', 'passo', 'decisao', 'fim', 'nota'];
  const textoPadrao: Record<TipoNo, string> = { inicio: 'Início', passo: 'Novo passo', decisao: 'Pergunta?', fim: 'Fim', nota: 'Observação' };

  const paraNo = (n: NoFluxo): Node<Dado> => ({
    id: n.id,
    type: 'no',
    position: { x: n.x, y: n.y },
    data: { texto: n.texto, tipo: n.tipo, ...(n.detalhes ? { detalhes: n.detalhes } : {}) }
  });

  const paraAresta = (l: LigacaoFluxo, ys: Map<string, number>): Edge =>
  {
    const volta = (ys.get(l.para) ?? 0) < (ys.get(l.de) ?? 0);
    return {
      id: l.id,
      source: l.de,
      target: l.para,
      type: 'smoothstep',
      markerEnd: seta,
      sourceHandle: volta || l.saida === 'lado' ? 'lado' : 'baixo',
      targetHandle: volta ? 'direita' : 'cima',
      ...(l.rotulo ? { label: l.rotulo } : {}),
    };
  };
  const alturas = (nos: { id: string; y: number }[]) => new Map(nos.map((n) => [n.id, n.y]));

  let nodes = $state.raw<Node<Dado>[]>(untrack(() => fluxo.nos.map(paraNo)));
  let edges = $state.raw<Edge[]>(untrack(() => fluxo.ligacoes.map((l) => paraAresta(l, alturas(fluxo.nos)))));
  let area = $state<HTMLDivElement>();
  let copiado = $state(false);
  let mostrarCodigo = $state(false);

  const { screenToFlowPosition, fitView, deleteElements } = useSvelteFlow();

  const noSel = $derived(nodes.filter((n) => n.selected));
  const arestaSel = $derived(edges.filter((e) => e.selected));

  const deNos = (): NoFluxo[] => nodes.map((n) => ({
    id: n.id,
    tipo: n.data.tipo,
    texto: n.data.texto,
    ...(n.data.detalhes ? { detalhes: n.data.detalhes } : {}),
    x: Math.round(n.position.x),
    y: Math.round(n.position.y)
  }));

  const deArestas = (): LigacaoFluxo[] => edges.map((e) => ({
    id: e.id,
    de: e.source,
    para: e.target,
    ...(typeof e.label === 'string' && e.label ? { rotulo: e.label } : {}),
    ...(e.sourceHandle === 'lado' ? { saida: 'lado' as const } : {}),
  }));

  const atual = (): Fluxograma => ({ ...fluxo, nos: deNos(), ligacoes: deArestas() });
  const lacunas = $derived(detectarLacunas(atual()));

  let espera: ReturnType<typeof setTimeout> | undefined;
  $effect(() =>
  {
    const nos = deNos();
    const ligacoes = deArestas();
    clearTimeout(espera);
    espera = setTimeout(() => onmudar(nos, ligacoes), 300);
  });

  let modo = $state<ColorMode>(document.documentElement.dataset.tema === 'claro' ? 'light' : 'dark');
  $effect(() =>
  {
    const obs = new MutationObserver(() => (modo = document.documentElement.dataset.tema === 'claro' ? 'light' : 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    return () => obs.disconnect();
  });

  let contador = 0;
  const novoId = (p: string) => `${p}${Date.now().toString(36)}${(contador++).toString(36)}`;

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
    return paraAresta({ id: novoId('l'), de, para, ...(rotulo ? { rotulo } : {}) }, ys);
  }

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

  function selecionarNo(id: string)
  {
    nodes = nodes.map((n) => ({ ...n, selected: n.id === id }));
    edges = edges.map((e) => ({ ...e, selected: false }));
  }

  function ramificar(origemId: string)
  {
    const origem = nodes.find((n) => n.id === origemId);
    if (!origem) return;
    const pos = { x: origem.position.x + 220, y: origem.position.y + 90 };
    const novoPassoId = novoId('n');
    nodes = [
      ...nodes.map((n) => ({ ...n, selected: false })),
      { ...paraNo({ id: novoPassoId, tipo: 'passo', texto: 'Nova etapa', x: pos.x, y: pos.y }), selected: true }
    ];
    edges = [...edges, aresta(origemId, novoPassoId, origem.data.tipo === 'decisao' ? 'lado' : null)];
  }

  function mudarDestino(arestaId: string, novoTarget: string)
  {
    edges = edges.map((e) => (e.id === arestaId ? { ...e, target: novoTarget } : e));
  }

  function excluirAresta(arestaId: string)
  {
    edges = edges.filter((e) => e.id !== arestaId);
  }

  // --- MODO PERCORRER (Simulador / Guia passo a passo) ---
  let percorrendo = $state(false);
  let noAtualId = $state<string | null>(null);
  let historicoPercurso = $state<string[]>([]);

  const noAtual = $derived(nodes.find((n) => n.id === noAtualId));
  const saidasDoAtual = $derived(edges.filter((e) => e.source === noAtualId));

  function iniciarPercurso(deNoId?: string)
  {
    const inicio = deNoId || nodes.find((n) => n.data.tipo === 'inicio')?.id || nodes[0]?.id;
    if (!inicio) return;
    percorrendo = true;
    noAtualId = inicio;
    historicoPercurso = [];
    atualizarFocoPercurso(inicio);
  }

  function avancarPercurso(destinoId: string)
  {
    if (!noAtualId) return;
    historicoPercurso = [...historicoPercurso, noAtualId];
    noAtualId = destinoId;
    atualizarFocoPercurso(destinoId);
  }

  function voltarPercurso()
  {
    if (!historicoPercurso.length) return;
    const anterior = historicoPercurso[historicoPercurso.length - 1]!;
    historicoPercurso = historicoPercurso.slice(0, -1);
    noAtualId = anterior;
    atualizarFocoPercurso(anterior);
  }

  function fecharPercurso()
  {
    percorrendo = false;
    noAtualId = null;
    nodes = nodes.map((n) => ({ ...n, data: { ...n.data, ativoNoPercurso: false } }));
  }

  function atualizarFocoPercurso(id: string)
  {
    nodes = nodes.map((n) => ({
      ...n,
      data: { ...n.data, ativoNoPercurso: n.id === id },
    }));
    fitView({
      nodes: [{ id }],
      duration: 350,
      padding: 0.6,
    });
  }
</script>

<div class="editor-conteiner">
  <!-- BARRA DE TOPO DO EDITOR (Estilo Veredo) -->
  <header class="barra-superior">
    <div class="esquerda">
      <span class="badge-status">Modo Diagrama</span>
      {#if lacunas.length > 0}
        <button class="badge-lacuna alerta" onclick={() => selecionarNo(lacunas[0]!.noId)} title="Clique para ir até o passo incompleto">
          ⚠️ {lacunas.length} {lacunas.length === 1 ? 'lacuna' : 'lacunas'}
        </button>
      {:else}
        <span class="badge-lacuna sucesso">✓ 0 lacunas</span>
      {/if}
    </div>

    <div class="direita">
      <button class="botao-topo" onclick={arrumar} title="Reorganiza os nós de cima para baixo">Organizar</button>
      <button class="botao-topo" onclick={() => (mostrarCodigo = !mostrarCodigo)} title="Ver código Mermaid"><span class="simbolo">&lt;&gt;</span> Código</button>
      <button class="botao-topo" onclick={() => baixarPng(atual())} title="Exportar imagem PNG">PNG</button>
      <button class="botao-topo" onclick={() => baixarSvg(atual())} title="Exportar vetor SVG">SVG</button>
      <button class="botao-percorrer" onclick={() => iniciarPercurso()} title="Navegar passo a passo pelo processo">
        ▶ Percorrer
      </button>
    </div>
  </header>

  <!-- PAINEL DE CÓDIGO MERMAID MODAL/GAVETA -->
  {#if mostrarCodigo}
    <div class="gaveta-codigo">
      <div class="gaveta-topo">
        <strong>Código Mermaid</strong>
        <div class="gaveta-botoes">
          <button onclick={copiarMermaid}>{copiado ? 'Copiado!' : 'Copiar código'}</button>
          <button onclick={() => (mostrarCodigo = false)}>Fechar</button>
        </div>
      </div>
      <pre class="codigo-pre">{paraMermaid(atual())}</pre>
    </div>
  {/if}

  <!-- CORPO PRINCIPAL: FERRAMENTAS + CANVAS + PAINEL LATERAL -->
  <div class="corpo-fluxo">
    <!-- BARRA LATERAL ESQUERDA (Paleta de Formas) -->
    <aside class="barra-ferramentas">
      <div class="grupo-ferramentas">
        <button
          class="item-ferramenta inicio"
          title="Início (clique ou arraste)"
          draggable="true"
          ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', 'inicio')}
          onclick={() => adicionar('inicio')}
        >
          <span class="icone-forma forma-inicio">▷</span>
          <small>Início</small>
        </button>

        <button
          class="item-ferramenta passo"
          title="Ação / Passo (clique ou arraste)"
          draggable="true"
          ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', 'passo')}
          onclick={() => adicionar('passo')}
        >
          <span class="icone-forma forma-passo">▢</span>
          <small>Ação</small>
        </button>

        <button
          class="item-ferramenta decisao"
          title="Decisão / Pergunta (clique ou arraste)"
          draggable="true"
          ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', 'decisao')}
          onclick={() => adicionar('decisao')}
        >
          <span class="icone-forma forma-decisao">◇</span>
          <small>Decisão</small>
        </button>

        <button
          class="item-ferramenta fim"
          title="Fim (clique ou arraste)"
          draggable="true"
          ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', 'fim')}
          onclick={() => adicionar('fim')}
        >
          <span class="icone-forma forma-fim">⚐</span>
          <small>Fim</small>
        </button>

        <button
          class="item-ferramenta nota"
          title="Anotação solta"
          draggable="true"
          ondragstart={(e) => e.dataTransfer?.setData('application/orbisos-no', 'nota')}
          onclick={() => adicionar('nota')}
        >
          <span class="icone-forma forma-nota">📝</span>
          <small>Nota</small>
        </button>
      </div>
    </aside>

    <!-- ÁREA CENTRAL DO DIAGRAMA -->
    <div class="area-canvas" bind:this={area} role="application" ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }} ondrop={soltar}>
      <SvelteFlow
        bind:nodes
        bind:edges
        {nodeTypes}
        colorMode={modo}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.2 }}
        deleteKey={['Backspace', 'Delete']}
        onbeforeconnect={antesDeLigar}
        onconnectend={aoSoltarLigacao}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1.5} />
        <Controls showLock={false} position="bottom-left" />
        <MiniMap pannable zoomable width={140} height={90} position="bottom-right" />
      </SvelteFlow>

      <!-- OVERLAY DE NAVEGAÇÃO "MODO PERCORRER" -->
      {#if percorrendo && noAtual}
        {@const n = noAtual}
        <div class="player-percorrer">
          <div class="player-cabecalho">
            <span class="player-tipo {n.data.tipo}">{nomesTipoNo[n.data.tipo]}</span>
            <span class="player-passos-info">Etapa {historicoPercurso.length + 1}</span>
            <button class="player-fechar" onclick={fecharPercurso} title="Encerrar percurso">✕</button>
          </div>

          <h3 class="player-titulo">{n.data.texto}</h3>

          {#if n.data.detalhes}
            <div class="player-detalhes">
              <span class="player-detalhes-rotulo">Orientações desta etapa:</span>
              <p>{n.data.detalhes}</p>
            </div>
          {/if}

          <div class="player-acoes">
            {#if historicoPercurso.length > 0}
              <button class="player-btn-voltar" onclick={voltarPercurso}>← Voltar</button>
            {/if}

            {#if saidasDoAtual.length === 0}
              {#if n.data.tipo === 'fim'}
                <button class="player-btn-concluir" onclick={fecharPercurso}>✓ Processo Concluído</button>
              {:else}
                <span class="player-sem-saida">⚠️ Fim do caminho (sem próximo passo conectado)</span>
              {/if}
            {:else}
              <div class="player-opcoes">
                {#each saidasDoAtual as s (s.id)}
                  {@const destino = nodes.find((x) => x.id === s.target)}
                  <button class="player-btn-opcao" onclick={() => avancarPercurso(s.target)}>
                    {#if s.label}
                      <strong>{s.label}:</strong>
                    {/if}
                    {destino ? destino.data.texto : 'Próximo passo'} &rarr;
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- PAINEL LATERAL DIREITO DE DETALHES (Veredo Inspector) -->
    <aside class="painel-inspector">
      {#if noSel.length === 1}
        {@const n = noSel[0]!}
        {@const saidas = edges.filter((e) => e.source === n.id)}
        <div class="inspector-cabecalho">
          <div class="inspector-titulo-grupo">
            <h3 class="inspector-titulo">{nomesTipoNo[n.data.tipo]}</h3>
            <span class="inspector-id">{n.id}</span>
          </div>
          <button class="inspector-fechar" onclick={() => (nodes = nodes.map((x) => ({ ...x, selected: false })))} title="Fechar painel">✕</button>
        </div>

        <!-- SELETOR DE TIPO (4 botões em grade) -->
        <div class="seletor-tipos">
          <button class="tipo-btn" class:ativo={n.data.tipo === 'inicio'} onclick={() => mudarNo(n.id, { tipo: 'inicio' })}>
            ▷ Início
          </button>
          <button class="tipo-btn" class:ativo={n.data.tipo === 'passo'} onclick={() => mudarNo(n.id, { tipo: 'passo' })}>
            ▢ Ação
          </button>
          <button class="tipo-btn" class:ativo={n.data.tipo === 'decisao'} onclick={() => mudarNo(n.id, { tipo: 'decisao' })}>
            ◇ Decisão
          </button>
          <button class="tipo-btn" class:ativo={n.data.tipo === 'fim'} onclick={() => mudarNo(n.id, { tipo: 'fim' })}>
            ⚐ Fim
          </button>
        </div>

        <!-- TEXTO DO NÓ -->
        <div class="campo-grupo">
          <label class="campo-rotulo" for="texto-no">TEXTO DO NÓ</label>
          <input
            id="texto-no"
            class="campo-input"
            value={n.data.texto}
            oninput={(e) => mudarNo(n.id, { texto: e.currentTarget.value })}
            placeholder="Nome da etapa ou pergunta..."
          />
        </div>

        <!-- DETALHES (APARECEM AO PERCORRER) -->
        <div class="campo-grupo">
          <label class="campo-rotulo" for="detalhes-no">DETALHES (APARECEM AO PERCORRER)</label>
          <textarea
            id="detalhes-no"
            class="campo-textarea"
            rows="4"
            value={n.data.detalhes ?? ''}
            oninput={(e) => mudarNo(n.id, { detalhes: e.currentTarget.value })}
            placeholder="Descreva instruções, regras ou informações essenciais desta etapa..."
          ></textarea>
        </div>

        <!-- PRÓXIMO PASSO -->
        <div class="campo-grupo">
          <div class="proximo-topo">
            <span class="campo-rotulo">PRÓXIMO PASSO</span>
          </div>

          {#if saidas.length === 0}
            <p class="dica-vazio">Nenhum próximo passo conectado. Clique em <b>Ramificar</b> ou arraste a bolinha do nó.</p>
          {:else}
            <div class="lista-conexoes">
              {#each saidas as s (s.id)}
                <div class="item-conexao">
                  <div class="conexao-rotulo-linha">
                    <span class="ponto-conexao">•</span>
                    {#if n.data.tipo === 'decisao'}
                      <input
                        class="conexao-rotulo-input"
                        value={typeof s.label === 'string' ? s.label : ''}
                        oninput={(e) => mudarRotulo(s.id, e.currentTarget.value)}
                        placeholder="Rótulo (ex.: sim, não)"
                      />
                    {:else}
                      <span class="conexao-texto-segue">Segue para:</span>
                    {/if}
                    <button class="conexao-btn-remover" onclick={() => excluirAresta(s.id)} title="Remover ligação">🗑</button>
                  </div>

                  <select class="conexao-select" value={s.target} onchange={(e) => mudarDestino(s.id, e.currentTarget.value)}>
                    {#each nodes.filter((x) => x.id !== n.id) as destino (destino.id)}
                      <option value={destino.id}>
                        {nomesTipoNo[destino.data.tipo]}: {destino.data.texto}
                      </option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          {/if}

          <button class="btn-ramificar" onclick={() => ramificar(n.id)}>
            <span class="simbolo">⑂</span> Ramificar
          </button>
        </div>

        <!-- AÇÕES DO RODAPÉ -->
        <div class="inspector-rodape">
          <button class="btn-percorrer-daqui" onclick={() => iniciarPercurso(n.id)}>
            ▶ Percorrer daqui
          </button>
          <button class="btn-excluir-passo" onclick={() => deleteElements({ nodes: [{ id: n.id }] })}>
            🗑 Excluir passo
          </button>
        </div>
      {:else if arestaSel.length === 1 && noSel.length === 0}
        {@const e = arestaSel[0]!}
        <div class="inspector-cabecalho">
          <div class="inspector-titulo-grupo">
            <h3 class="inspector-titulo">Ligação</h3>
            <span class="inspector-id">{e.id}</span>
          </div>
          <button class="inspector-fechar" onclick={() => (edges = edges.map((x) => ({ ...x, selected: false })))}>✕</button>
        </div>

        <div class="campo-grupo">
          <label class="campo-rotulo" for="rotulo-aresta">RÓTULO DA LIGAÇÃO</label>
          <input
            id="rotulo-aresta"
            class="campo-input"
            value={typeof e.label === 'string' ? e.label : ''}
            oninput={(ev) => mudarRotulo(e.id, ev.currentTarget.value)}
            placeholder="ex.: sim, não, pendente"
          />
          <div class="atalhos-rotulo">
            <button onclick={() => mudarRotulo(e.id, 'sim')}>sim</button>
            <button onclick={() => mudarRotulo(e.id, 'não')}>não</button>
            <button onclick={() => mudarRotulo(e.id, '')}>sem rótulo</button>
          </div>
        </div>

        <div class="inspector-rodape">
          <button class="btn-excluir-passo" onclick={() => deleteElements({ edges: [{ id: e.id }] })}>
            🗑 Excluir ligação
          </button>
        </div>
      {:else}
        <div class="inspector-placeholder">
          <div class="placeholder-icone">🔍</div>
          <h4>Inspeção de Passo</h4>
          <p>Clique em qualquer etapa do fluxo para editar o tipo, o texto, as orientações de percurso e os destinos.</p>

          <div class="resumo-fluxo">
            <div class="resumo-linha">
              <span>Total de etapas:</span>
              <strong>{nodes.length}</strong>
            </div>
            <div class="resumo-linha">
              <span>Conexões ativas:</span>
              <strong>{edges.length}</strong>
            </div>
            <div class="resumo-linha">
              <span>Status de integridade:</span>
              <strong class:erro={lacunas.length > 0} class:sucesso={lacunas.length === 0}>
                {lacunas.length === 0 ? '✓ Sem lacunas' : `⚠️ ${lacunas.length} lacunas`}
              </strong>
            </div>
          </div>

          {#if lacunas.length > 0}
            <div class="lacunas-lista">
              <strong>Lacunas a resolver:</strong>
              <ul>
                {#each lacunas as l (l.noId)}
                  <li>
                    <button class="lacuna-link" onclick={() => selecionarNo(l.noId)}>
                      {l.texto || l.noId}: {l.motivo}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .editor-conteiner
  {
    display: flex;
    flex-direction: column;
    height: max(520px, calc(100vh - 210px));
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    overflow: hidden;
  }
  .barra-superior
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: var(--superficie-2);
    border-bottom: 1px solid var(--borda);
  }
  .esquerda, .direita
  {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge-status
  {
    font-family: var(--fonte-maquina);
    font-size: 0.76rem;
    color: var(--suave);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-lacuna
  {
    font-size: 0.78rem;
    padding: 3px 10px;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .badge-lacuna.alerta
  {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }
  .badge-lacuna.sucesso
  {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .botao-topo
  {
    font-size: 0.8rem;
    padding: 4px 10px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    cursor: pointer;
  }
  .botao-topo:hover
  {
    border-color: var(--borda-forte);
  }
  .botao-percorrer
  {
    font-size: 0.82rem;
    font-weight: 600;
    padding: 5px 14px;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: var(--raio-pequeno);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
    transition: transform 0.1s, background 0.15s;
  }
  .botao-percorrer:hover
  {
    background: #059669;
    transform: translateY(-1px);
  }
  .gaveta-codigo
  {
    background: var(--fundo);
    border-bottom: 1px solid var(--borda);
    padding: 12px 16px;
    max-height: 220px;
    overflow-y: auto;
  }
  .gaveta-topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
  }
  .gaveta-botoes
  {
    display: flex;
    gap: 6px;
  }
  .codigo-pre
  {
    margin: 0;
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    white-space: pre-wrap;
    color: var(--suave);
  }
  .corpo-fluxo
  {
    display: grid;
    grid-template-columns: 52px 1fr 320px;
    flex: 1;
    min-height: 0;
  }
  .barra-ferramentas
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    background: var(--superficie-2);
    border-right: 1px solid var(--borda);
  }
  .grupo-ferramentas
  {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  .item-ferramenta
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 2px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--raio-pequeno);
    color: var(--suave);
    cursor: grab;
    transition: all 0.15s;
  }
  .item-ferramenta:hover
  {
    background: var(--superficie);
    border-color: var(--borda);
    color: var(--texto);
  }
  .item-ferramenta small
  {
    font-size: 0.65rem;
  }
  .icone-forma
  {
    font-size: 1.1rem;
    line-height: 1;
  }
  .forma-inicio { color: #34d399; }
  .forma-passo { color: #38bdf8; }
  .forma-decisao { color: #f59e0b; }
  .forma-fim { color: #94a3b8; }
  .forma-nota { color: #fbbf24; }

  .area-canvas
  {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .area-canvas :global(.svelte-flow)
  {
    --xy-background-color: var(--fundo);
    --xy-background-pattern-dots-color: rgba(255, 255, 255, 0.08);
    --xy-edge-stroke: var(--suave);
    --xy-edge-stroke-selected: var(--marca);
    --xy-edge-stroke-width: 1.7;
    --xy-connectionline-stroke: var(--marca);
    --xy-edge-label-background-color: var(--superficie-2);
    --xy-edge-label-color: var(--texto);
    --xy-node-background-color: transparent;
    --xy-node-border: none;
    --xy-node-boxshadow-selected: none;
    --xy-node-boxshadow-hover: none;
    --xy-controls-button-background-color: var(--superficie);
    --xy-controls-button-color: var(--texto);
    --xy-controls-button-border-color: var(--borda);
    --xy-minimap-background-color: var(--superficie);
    --xy-minimap-node-background-color: var(--borda-forte);
  }
  .area-canvas :global(.svelte-flow__edge-label)
  {
    font-family: var(--fonte-maquina);
    font-size: 0.74rem;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid var(--borda-forte);
    font-weight: 500;
  }

  /* MODAL / CARD FLUTUANTE DO MODO PERCORRER */
  .player-percorrer
  {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: min(92%, 520px);
    background: var(--superficie);
    border: 2px solid #10b981;
    border-radius: var(--raio);
    padding: 16px 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.2);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .player-cabecalho
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .player-tipo
  {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .player-tipo.inicio { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .player-tipo.passo { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
  .player-tipo.decisao { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
  .player-tipo.fim { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
  .player-passos-info
  {
    font-size: 0.78rem;
    color: var(--suave);
  }
  .player-fechar
  {
    background: none;
    border: none;
    color: var(--suave);
    font-size: 1rem;
    cursor: pointer;
  }
  .player-titulo
  {
    margin: 0;
    font-size: 1.15rem;
    color: var(--texto);
    font-weight: 600;
  }
  .player-detalhes
  {
    background: var(--fundo);
    border-left: 3px solid #10b981;
    padding: 8px 12px;
    border-radius: 4px;
  }
  .player-detalhes-rotulo
  {
    display: block;
    font-size: 0.72rem;
    color: var(--suave);
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .player-detalhes p
  {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.35;
    color: var(--texto);
  }
  .player-acoes
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .player-opcoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: auto;
  }
  .player-btn-opcao
  {
    font-size: 0.82rem;
    padding: 6px 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: var(--raio-pequeno);
    cursor: pointer;
    font-weight: 500;
  }
  .player-btn-opcao:hover
  {
    background: #059669;
  }
  .player-btn-voltar
  {
    font-size: 0.8rem;
    padding: 5px 10px;
    background: transparent;
    border: 1px solid var(--borda);
    color: var(--suave);
    border-radius: var(--raio-pequeno);
    cursor: pointer;
  }
  .player-btn-concluir
  {
    font-size: 0.85rem;
    padding: 6px 14px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: var(--raio-pequeno);
    font-weight: 600;
    cursor: pointer;
  }
  .player-sem-saida
  {
    font-size: 0.8rem;
    color: #f59e0b;
  }

  /* PAINEL LATERAL DIREITO (INSPECTOR ESTILO VEREDO) */
  .painel-inspector
  {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    background: var(--superficie);
    border-left: 1px solid var(--borda);
    overflow-y: auto;
    gap: 14px;
  }
  .inspector-cabecalho
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--borda);
    padding-bottom: 8px;
  }
  .inspector-titulo-grupo
  {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .inspector-titulo
  {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--texto);
  }
  .inspector-id
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--suave);
  }
  .inspector-fechar
  {
    background: none;
    border: none;
    color: var(--suave);
    font-size: 1.1rem;
    cursor: pointer;
    line-height: 1;
  }
  .seletor-tipos
  {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    background: var(--superficie-2);
    padding: 3px;
    border-radius: var(--raio-pequeno);
  }
  .tipo-btn
  {
    font-size: 0.74rem;
    padding: 6px 2px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--suave);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    font-weight: 500;
  }
  .tipo-btn.ativo
  {
    background: var(--superficie);
    color: var(--texto);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    font-weight: 600;
  }
  .campo-grupo
  {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .campo-rotulo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--suave);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .campo-input, .campo-textarea
  {
    width: 100%;
    padding: 7px 10px;
    background: var(--fundo);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    font-size: 0.85rem;
    box-sizing: border-box;
  }
  .campo-input:focus, .campo-textarea:focus
  {
    border-color: var(--marca);
    outline: none;
  }
  .campo-textarea
  {
    resize: vertical;
    line-height: 1.35;
  }
  .proximo-topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lista-conexoes
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item-conexao
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .conexao-rotulo-linha
  {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ponto-conexao
  {
    color: #10b981;
    font-size: 1.1rem;
    line-height: 1;
  }
  .conexao-texto-segue
  {
    font-size: 0.76rem;
    color: var(--suave);
    flex: 1;
  }
  .conexao-rotulo-input
  {
    flex: 1;
    font-size: 0.78rem;
    padding: 3px 6px;
    background: var(--fundo);
    border: 1px solid var(--borda);
    border-radius: 4px;
    color: var(--texto);
  }
  .conexao-btn-remover
  {
    background: none;
    border: none;
    color: var(--suave);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .conexao-btn-remover:hover
  {
    color: var(--vermelho);
  }
  .conexao-select
  {
    width: 100%;
    font-size: 0.8rem;
    padding: 5px 8px;
    background: var(--fundo);
    border: 1px solid var(--borda);
    border-radius: 4px;
    color: var(--texto);
  }
  .btn-ramificar
  {
    margin-top: 4px;
    width: 100%;
    font-size: 0.8rem;
    padding: 6px 12px;
    background: transparent;
    border: 1px dashed var(--borda-forte);
    border-radius: var(--raio-pequeno);
    color: var(--suave);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .btn-ramificar:hover
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  .inspector-rodape
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--borda);
  }
  .btn-percorrer-daqui
  {
    width: 100%;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 8px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    cursor: pointer;
  }
  .btn-percorrer-daqui:hover
  {
    background: var(--superficie);
    border-color: #10b981;
    color: #10b981;
  }
  .btn-excluir-passo
  {
    width: 100%;
    font-size: 0.8rem;
    padding: 6px;
    background: transparent;
    border: none;
    color: var(--vermelho);
    cursor: pointer;
    text-align: center;
  }
  .btn-excluir-passo:hover
  {
    text-decoration: underline;
  }
  .atalhos-rotulo
  {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .atalhos-rotulo button
  {
    font-size: 0.74rem;
    padding: 2px 8px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: 4px;
    color: var(--texto);
    cursor: pointer;
  }
  .dica-vazio
  {
    margin: 4px 0;
    font-size: 0.76rem;
    color: var(--suave);
    line-height: 1.3;
  }

  /* PLACEHOLDER QUANDO NADA ESTÁ SELECIONADO */
  .inspector-placeholder
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding-top: 20px;
    color: var(--suave);
  }
  .placeholder-icone
  {
    font-size: 1.8rem;
    opacity: 0.6;
  }
  .inspector-placeholder h4
  {
    margin: 0;
    color: var(--texto);
    font-size: 0.95rem;
  }
  .inspector-placeholder p
  {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.35;
  }
  .resumo-fluxo
  {
    width: 100%;
    background: var(--superficie-2);
    border-radius: var(--raio-pequeno);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
    text-align: left;
    font-size: 0.78rem;
  }
  .resumo-linha
  {
    display: flex;
    justify-content: space-between;
  }
  .resumo-linha .sucesso { color: #10b981; }
  .resumo-linha .erro { color: #f59e0b; }
  .lacunas-lista
  {
    width: 100%;
    margin-top: 8px;
    text-align: left;
    font-size: 0.76rem;
  }
  .lacunas-lista ul
  {
    margin: 4px 0;
    padding-left: 16px;
  }
  .lacuna-link
  {
    background: none;
    border: none;
    color: #f59e0b;
    padding: 2px 0;
    cursor: pointer;
    text-align: left;
    text-decoration: underline;
    font-size: inherit;
  }

  @media (max-width: 900px)
  {
    .corpo-fluxo
    {
      grid-template-columns: 46px 1fr 260px;
    }
  }
  @media (max-width: 720px)
  {
    .corpo-fluxo
    {
      grid-template-columns: 1fr;
      grid-template-rows: auto 500px auto;
    }
    .barra-ferramentas
    {
      flex-direction: row;
      border-right: none;
      border-bottom: 1px solid var(--borda);
    }
    .grupo-ferramentas
    {
      flex-direction: row;
      justify-content: space-around;
    }
    .painel-inspector
    {
      border-left: none;
      border-top: 1px solid var(--borda);
      max-height: 350px;
    }
  }
</style>
