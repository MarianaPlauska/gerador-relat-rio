<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import
  {
    agoraLocal,
    criarIniciativa,
    criarMatriz,
    dicasQuadrante,
    matrizExemploDiretoria,
    nomesQuadrante,
    nomesSituacaoIniciativa,
    pedidoDePriorizacaoParaIa,
    ranquearIniciativas,
    resumoPriorizacaoTeams,
    validarMatrizImportada,
    type IniciativaPriorizacao,
    type MatrizPriorizacao,
    type QuadrantePriorizacao,
  } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { baixarPdfPriorizacao } from '#lib/pdfExtras.ts';
  import { copiar } from '#lib/saidas.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const abertaId = $derived(page.url.searchParams.get('id'));
  const indice = $derived(dados.matrizes.findIndex((m) => m.id === abertaId));

  let filtroQuadrante = $state<QuadrantePriorizacao | ''>('');
  let selecionadoId = $state<string | null>(null);
  let feedback = $state('');

  // Adição rápida
  let novoTitulo = $state('');
  let novaArea = $state('');
  let novoDono = $state('');
  let novoImpacto = $state(4);
  let novoEsforco = $state(2);

  // Ponte com IA gratuita
  let mostrarIa = $state(false);
  let materialIa = $state('');
  let respostaIa = $state('');
  let errosIa = $state<string[]>([]);

  const matrizesOrdenadas = $derived([...dados.matrizes].sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)));

  function avisar(msg: string)
  {
    feedback = msg;
    setTimeout(() =>
    {
      if (feedback === msg) feedback = '';
    }, 2600);
  }

  function novaMatriz()
  {
    const m = criarMatriz({ nome: 'Prioridades da diretoria' });
    dados.matrizes.push(m);
    goto(`/priorizacao?id=${m.id}`);
  }

  function carregarExemplo()
  {
    const m = matrizExemploDiretoria();
    dados.matrizes.push(m);
    goto(`/priorizacao?id=${m.id}`);
  }

  function excluirMatriz(m: MatrizPriorizacao)
  {
    if (!confirm(`Excluir a matriz "${m.nome}"?`)) return;
    dados.matrizes = dados.matrizes.filter((x) => x.id !== m.id);
    goto('/priorizacao');
  }

  function adicionarItem(m: MatrizPriorizacao)
  {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    const item = criarIniciativa({
      titulo,
      area: novaArea.trim() || undefined,
      dono: novoDono.trim() || undefined,
      impacto: novoImpacto,
      esforco: novoEsforco,
    });
    m.itens.push(item);
    m.atualizadaEm = agoraLocal();
    selecionadoId = item.id;
    novoTitulo = '';
    novaArea = '';
    novoDono = '';
  }

  function removerItem(m: MatrizPriorizacao, id: string)
  {
    m.itens = m.itens.filter((i) => i.id !== id);
    m.atualizadaEm = agoraLocal();
    if (selecionadoId === id) selecionadoId = null;
  }

  async function copiarTeams(m: MatrizPriorizacao)
  {
    await copiar(resumoPriorizacaoTeams(m));
    avisar('Ranking copiado para o Teams!');
  }

  async function copiarPromptIa()
  {
    await copiar(pedidoDePriorizacaoParaIa(materialIa, 'impacto_esforco'));
    avisar('Prompt copiado! Cole na sua IA gratuita e traga o JSON de volta.');
  }

  function importarMatrizIa()
  {
    const r = validarMatrizImportada(respostaIa);
    errosIa = r.erros;
    if (!r.matriz) return;
    dados.matrizes.push(r.matriz);
    materialIa = '';
    respostaIa = '';
    mostrarIa = false;
    goto(`/priorizacao?id=${r.matriz.id}`);
  }

  // Coordenadas no gráfico SVG 520x320 (eixo X = esforço 1..5, eixo Y = impacto 5..1)
  function coordX(esforco: number, idx: number): number
  {
    const base = 55 + ((esforco - 1) / 4) * 420;
    const jitter = ((idx % 3) - 1) * 9;
    return Math.min(485, Math.max(45, base + jitter));
  }

  function coordY(impacto: number, idx: number): number
  {
    const base = 270 - ((impacto - 1) / 4) * 230;
    const jitter = (((idx + 1) % 3) - 1) * 8;
    return Math.min(280, Math.max(30, base + jitter));
  }

  const corQuadrante: Record<QuadrantePriorizacao, string> = {
    ganho_rapido: 'var(--verde)',
    projeto_estrategico: 'var(--azul)',
    preenchimento: 'var(--amarelo)',
    evitar: 'var(--vermelho)',
  };

  function atualizarItem(m: MatrizPriorizacao, item: IniciativaPriorizacao)
  {
    item.impacto = Math.min(5, Math.max(1, Number(item.impacto) || 1));
    item.esforco = Math.min(5, Math.max(1, Number(item.esforco) || 1));
    item.urgencia = Math.min(5, Math.max(1, Number(item.urgencia) || 1));
    item.alcance = Math.min(10, Math.max(1, Number(item.alcance) || 1));
    m.atualizadaEm = agoraLocal();
  }
</script>

<main>
  {#if feedback}
    <div class="toast" role="status">{feedback}</div>
  {/if}

  {#if indice >= 0}
    {@const m = dados.matrizes[indice]!}
    {@const resumo = ranquearIniciativas(m)}
    {@const listaFiltrada = filtroQuadrante ? resumo.ranqueadas.filter((r) => r.quadrante === filtroQuadrante) : resumo.ranqueadas}

    <header>
      <div class="cabecalho-esq">
        <span class="prompt">&gt; <a href="/priorizacao">priorização</a></span>
        <h1>{m.nome}<span class="cursor">_</span></h1>
      </div>
      <div class="acoes-topo">
        <button class="principal" onclick={() => copiarTeams(m)}>Copiar pro Teams</button>
        <button onclick={() => baixarPdfPriorizacao($state.snapshot(m) as MatrizPriorizacao)}>Baixar PDF</button>
        <button class="perigo" onclick={() => excluirMatriz(m)}>Excluir</button>
      </div>
    </header>

    <section class="cartao topo-matriz">
      <div class="grade-topo">
        <label>
          <span>Nome da matriz</span>
          <input bind:value={m.nome} oninput={() => (m.atualizadaEm = agoraLocal())} />
        </label>
        <label>
          <span>Método de pontuação</span>
          <select bind:value={m.modo} onchange={() => (m.atualizadaEm = agoraLocal())}>
            <option value="impacto_esforco">Impacto × Esforço (rápido)</option>
            <option value="rice">RICE (Alcance × Impacto × Confiança ÷ Esforço)</option>
          </select>
        </label>
      </div>
      <p class="leitura-executiva"><b>Leitura executiva:</b> {resumo.recomendacao}</p>
    </section>

    <div class="quadrantes-resumo">
      {#each (['ganho_rapido', 'projeto_estrategico', 'preenchimento', 'evitar'] as const) as q (q)}
        <button class="box-q {q}" class:ativo={filtroQuadrante === q} onclick={() => (filtroQuadrante = filtroQuadrante === q ? '' : q)}>
          <span class="q-nome">{nomesQuadrante[q]}</span>
          <strong>{resumo.contagem[q]}</strong>
          <small>{dicasQuadrante[q]}</small>
        </button>
      {/each}
    </div>

    <section class="cartao">
      <h2>Mapa visual (Impacto × Esforço)</h2>
      <div class="mapa-wrap">
        <svg viewBox="0 0 540 310" class="mapa-svg" role="img" aria-label="Quadrante Impacto versus Esforço">
          <!-- 4 quadrantes -->
          <rect x="40" y="20" width="225" height="130" class="zona ganho" />
          <rect x="265" y="20" width="245" height="130" class="zona estrategico" />
          <rect x="40" y="150" width="225" height="130" class="zona preenchimento" />
          <rect x="265" y="150" width="245" height="130" class="zona evitar" />

          <!-- eixos centrais -->
          <line x1="265" y1="20" x2="265" y2="280" stroke="var(--borda-forte)" stroke-dasharray="4 4" />
          <line x1="40" y1="150" x2="510" y2="150" stroke="var(--borda-forte)" stroke-dasharray="4 4" />

          <!-- rótulos dos quadrantes -->
          <text x="50" y="38" class="rotulo-q" fill="var(--verde)">GANHOS RÁPIDOS</text>
          <text x="275" y="38" class="rotulo-q" fill="var(--azul)">PROJETOS ESTRATÉGICOS</text>
          <text x="50" y="270" class="rotulo-q" fill="var(--amarelo)">SE SOBRAR TEMPO</text>
          <text x="275" y="270" class="rotulo-q" fill="var(--vermelho)">NÃO FAZER AGORA</text>

          <!-- eixos -->
          <text x="275" y="302" text-anchor="middle" class="eixo">ESFORÇO (1 = baixo · 5 = alto) →</text>
          <text x="16" y="150" text-anchor="middle" transform="rotate(-90 16 150)" class="eixo">IMPACTO (1 = baixo · 5 = alto) →</text>

          <!-- pontos -->
          {#each resumo.ranqueadas as r, idx (r.item.id)}
            {@const cx = coordX(r.item.esforco, idx)}
            {@const cy = coordY(r.item.impacto, idx)}
            {@const ativo = selecionadoId === r.item.id}
            <g
              class="ponto"
              class:descartado={r.item.situacao === 'descartado'}
              onclick={() => (selecionadoId = ativo ? null : r.item.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') selecionadoId = ativo ? null : r.item.id; }}
            >
              <circle {cx} {cy} r={ativo ? 13 : 10} fill={corQuadrante[r.quadrante]} opacity={r.item.situacao === 'descartado' ? 0.35 : 0.9} stroke="var(--fundo)" stroke-width="2" />
              <text x={cx} y={cy + 4} text-anchor="middle" class="num-ponto">{r.posicao}</text>
              <title>#{r.posicao} {r.item.titulo} — Nota {r.pontuacao} (Impacto {r.item.impacto}, Esforço {r.item.esforco})</title>
            </g>
          {/each}
        </svg>

        {#if selecionadoId}
          {@const achado = resumo.ranqueadas.find((x) => x.item.id === selecionadoId)}
          {#if achado}
            <div class="detalhe-ponto">
              <div class="detalhe-topo">
                <strong>#{achado.posicao} {achado.item.titulo}</strong>
                <span class="nota-badge">Nota {achado.pontuacao}</span>
              </div>
              <p class="dica">{nomesQuadrante[achado.quadrante]} · Impacto {achado.item.impacto}/5 · Esforço {achado.item.esforco}/5 · Urgência {achado.item.urgencia}/5</p>
              <textarea rows="2" bind:value={achado.item.notas} oninput={() => (m.atualizadaEm = agoraLocal())} placeholder="Justificativa ou observação para a reunião..."></textarea>
            </div>
          {/if}
        {/if}
      </div>
    </section>

    <section class="cartao">
      <h2>Iniciativas e ranking</h2>
      <form class="form-novo" onsubmit={(e) => { e.preventDefault(); adicionarItem(m); }}>
        <input class="crescer" bind:value={novoTitulo} placeholder="Nova iniciativa ou demanda..." />
        <input bind:value={novaArea} placeholder="Área" />
        <input bind:value={novoDono} placeholder="Dono" />
        <label class="mini">Imp <input type="number" min="1" max="5" bind:value={novoImpacto} /></label>
        <label class="mini">Esf <input type="number" min="1" max="5" bind:value={novoEsforco} /></label>
        <button class="principal" type="submit">Adicionar</button>
      </form>

      {#if listaFiltrada.length}
        <div class="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Iniciativa</th>
                <th>Dono</th>
                <th>Impacto (1-5)</th>
                <th>Esforço (1-5)</th>
                {#if m.modo === 'rice'}
                  <th>Alcance (1-10)</th>
                  <th>Confiança</th>
                {:else}
                  <th>Urgência (1-5)</th>
                {/if}
                <th>Quadrante</th>
                <th>Nota</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each listaFiltrada as r (r.item.id)}
                <tr class:selecionada={selecionadoId === r.item.id} class:descartado={r.item.situacao === 'descartado'} onclick={() => (selecionadoId = r.item.id)}>
                  <td><strong>{r.posicao}</strong></td>
                  <td><input class="celula titulo" bind:value={r.item.titulo} oninput={() => atualizarItem(m, r.item)} /></td>
                  <td><input class="celula curto" bind:value={r.item.dono} oninput={() => atualizarItem(m, r.item)} placeholder="—" /></td>
                  <td><input class="num" type="number" min="1" max="5" bind:value={r.item.impacto} onchange={() => atualizarItem(m, r.item)} /></td>
                  <td><input class="num" type="number" min="1" max="5" bind:value={r.item.esforco} onchange={() => atualizarItem(m, r.item)} /></td>
                  {#if m.modo === 'rice'}
                    <td><input class="num" type="number" min="1" max="10" bind:value={r.item.alcance} onchange={() => atualizarItem(m, r.item)} /></td>
                    <td>
                      <select class="celula curto" bind:value={r.item.confianca} onchange={() => atualizarItem(m, r.item)}>
                        <option value={1}>100%</option>
                        <option value={0.8}>80%</option>
                        <option value={0.5}>50%</option>
                      </select>
                    </td>
                  {:else}
                    <td><input class="num" type="number" min="1" max="5" bind:value={r.item.urgencia} onchange={() => atualizarItem(m, r.item)} /></td>
                  {/if}
                  <td><span class="selo-q {r.quadrante}">{nomesQuadrante[r.quadrante]}</span></td>
                  <td><strong class="nota-col">{r.pontuacao}</strong></td>
                  <td>
                    <select class="celula curto" bind:value={r.item.situacao} onchange={() => atualizarItem(m, r.item)}>
                      {#each Object.entries(nomesSituacaoIniciativa) as [k, v] (k)}
                        <option value={k}>{v}</option>
                      {/each}
                    </select>
                  </td>
                  <td><button class="perigo-leve" onclick={(e) => { e.stopPropagation(); removerItem(m, r.item.id); }}>×</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="dica">Nenhuma iniciativa neste filtro.</p>
      {/if}
    </section>
  {:else}
    <header>
      <div class="cabecalho-esq">
        <span class="prompt">&gt; priorização</span>
        <h1>Matriz de Priorização<span class="cursor">_</span></h1>
      </div>
      <div class="acoes-topo">
        <button class="principal" onclick={novaMatriz}>+ Nova matriz</button>
        <button onclick={() => (mostrarIa = !mostrarIa)}>{mostrarIa ? 'Fechar IA gratuita' : 'Pontuar lista com IA'}</button>
        <button onclick={carregarExemplo}>Carregar exemplo</button>
      </div>
    </header>
    <p class="dica">Compare demandas por <b>Impacto × Esforço</b> ou <b>RICE</b>, visualize o quadrante de ganhos rápidos e leve o ranking pronto para a reunião de diretoria.</p>

    {#if mostrarIa}
      <section class="cartao ia-bloco">
        <h2>Montar matriz com IA gratuita</h2>
        <p class="dica">Cole uma lista solta de pedidos e demandas. A IA gratuita sugere as notas iniciais de Impacto, Esforço e Urgência para você ajustar no quadrante.</p>
        <textarea rows="5" bind:value={materialIa} placeholder="1. Cole aqui a lista de pedidos, ideias ou projetos..."></textarea>
        <div class="linha-acoes">
          <button class="principal" disabled={!materialIa.trim()} onclick={copiarPromptIa}>Copiar prompt para IA gratuita</button>
        </div>
        <textarea rows="5" bind:value={respostaIa} placeholder="2. Cole aqui o JSON retornado pela IA..."></textarea>
        <div class="linha-acoes">
          <button class="principal" disabled={!respostaIa.trim()} onclick={importarMatrizIa}>Criar matriz</button>
        </div>
        {#if errosIa.length}
          <ul class="erros">{#each errosIa as e, i (i)}<li>{e}</li>{/each}</ul>
        {/if}
      </section>
    {/if}

    <section class="cartao">
      <h2>Matrizes salvas</h2>
      {#if matrizesOrdenadas.length}
        <div class="grade-matrizes">
          {#each matrizesOrdenadas as m (m.id)}
            {@const r = ranquearIniciativas(m)}
            <a class="card-matriz" href={`/priorizacao?id=${m.id}`}>
              <div class="card-topo">
                <span class="tag-modo">{m.modo === 'rice' ? 'RICE' : 'Impacto × Esforço'}</span>
                <span>{m.itens.length} item(ns)</span>
              </div>
              <h3>{m.nome}</h3>
              <p class="dica">{r.recomendacao}</p>
            </a>
          {/each}
        </div>
      {:else}
        <p class="dica">Nenhuma matriz criada ainda. Clique em <b>+ Nova matriz</b> ou <b>Carregar exemplo</b> para ver o quadrante em ação.</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .cabecalho-esq
  {
    margin-right: auto;
  }
  .acoes-topo
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
  }
  .toast
  {
    position: fixed;
    right: var(--size-5);
    bottom: var(--size-5);
    z-index: 50;
    background: var(--superficie);
    border: 1px solid var(--marca);
    box-shadow: var(--brilho);
    padding: var(--size-2) var(--size-4);
    border-radius: var(--raio);
    font-family: var(--fonte-maquina);
    font-size: 0.88rem;
  }
  .grade-topo
  {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--size-3);
  }
  .grade-topo label
  {
    display: grid;
    gap: var(--size-1);
    font-size: 0.84rem;
    color: var(--suave);
  }
  .leitura-executiva
  {
    margin: var(--size-3) 0 0;
    padding: var(--size-2) var(--size-3);
    background: var(--marca-clara);
    border-left: 3px solid var(--marca);
    border-radius: var(--raio-pequeno);
    font-size: 0.92rem;
  }
  .quadrantes-resumo
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: var(--size-3);
    margin: var(--size-4) 0;
  }
  .box-q
  {
    text-align: left;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: var(--size-3);
    display: grid;
    gap: 2px;
  }
  .box-q.ativo
  {
    box-shadow: var(--brilho);
    border-color: var(--marca);
  }
  .box-q.ganho_rapido .q-nome { color: var(--verde); }
  .box-q.projeto_estrategico .q-nome { color: var(--azul); }
  .box-q.preenchimento .q-nome { color: var(--amarelo); }
  .box-q.evitar .q-nome { color: var(--vermelho); }
  .box-q strong
  {
    font-family: var(--fonte-pixel);
    font-size: 1.7rem;
    line-height: 1.1;
  }
  .box-q small
  {
    color: var(--suave);
    font-family: var(--fonte-texto);
    font-size: 0.78rem;
  }
  .mapa-wrap
  {
    display: grid;
    gap: var(--size-3);
  }
  .mapa-svg
  {
    width: 100%;
    max-width: 720px;
    height: auto;
    margin: 0 auto;
    display: block;
  }
  .zona
  {
    stroke: var(--borda);
    stroke-width: 1;
  }
  .zona.ganho { fill: var(--verde-fundo); }
  .zona.estrategico { fill: var(--azul-fundo); }
  .zona.preenchimento { fill: var(--amarelo-fundo); }
  .zona.evitar { fill: var(--vermelho-fundo); }
  .rotulo-q
  {
    font-family: var(--fonte-maquina);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .eixo
  {
    fill: var(--suave);
    font-family: var(--fonte-maquina);
    font-size: 10px;
  }
  .ponto
  {
    cursor: var(--cursor-clique);
  }
  .num-ponto
  {
    fill: var(--sobre-marca);
    font-family: var(--fonte-maquina);
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
  }
  .detalhe-ponto
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio);
    padding: var(--size-3);
    display: grid;
    gap: var(--size-2);
  }
  .detalhe-topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .nota-badge
  {
    font-family: var(--fonte-maquina);
    color: var(--marca);
    font-weight: 700;
  }
  .form-novo
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-2);
    margin-bottom: var(--size-3);
  }
  .crescer
  {
    flex: 1 1 220px;
  }
  .mini
  {
    display: inline-flex;
    align-items: center;
    gap: var(--size-1);
    font-size: 0.82rem;
    color: var(--suave);
  }
  .mini input, .num
  {
    width: 60px;
  }
  .tabela-wrap
  {
    overflow-x: auto;
  }
  table
  {
    width: 100%;
    border-collapse: collapse;
  }
  th, td
  {
    text-align: left;
    padding: var(--size-2);
    border-bottom: 1px solid var(--borda);
  }
  th
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: var(--suave);
    text-transform: uppercase;
  }
  tr.selecionada
  {
    background: var(--marca-clara);
  }
  tr.descartado
  {
    opacity: 0.55;
  }
  .celula.titulo
  {
    min-width: 200px;
    width: 100%;
  }
  .celula.curto
  {
    width: 110px;
  }
  .selo-q
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .selo-q.ganho_rapido { color: var(--verde); background: var(--verde-fundo); }
  .selo-q.projeto_estrategico { color: var(--azul); background: var(--azul-fundo); }
  .selo-q.preenchimento { color: var(--amarelo); background: var(--amarelo-fundo); }
  .selo-q.evitar { color: var(--vermelho); background: var(--vermelho-fundo); }
  .nota-col
  {
    font-family: var(--fonte-maquina);
    color: var(--marca);
  }
  .grade-matrizes
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--size-3);
  }
  .card-matriz
  {
    text-decoration: none;
    color: var(--texto);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: var(--size-4);
    display: grid;
    gap: var(--size-2);
  }
  .card-matriz:hover
  {
    border-color: var(--marca);
  }
  .card-topo
  {
    display: flex;
    justify-content: space-between;
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: var(--suave);
  }
  .tag-modo
  {
    color: var(--marca);
  }
  .card-matriz h3
  {
    margin: 0;
    color: var(--texto);
  }
  .ia-bloco
  {
    display: grid;
    gap: var(--size-3);
  }
  .linha-acoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .perigo, .perigo-leve
  {
    color: var(--vermelho);
  }
  .perigo-leve
  {
    border: none;
    background: transparent;
    padding: 2px 6px;
  }
  .erros
  {
    color: var(--vermelho);
    margin: 0;
    padding-left: var(--size-5);
  }
  @media (max-width: 720px)
  {
    .grade-topo
    {
      grid-template-columns: 1fr;
    }
  }
</style>
