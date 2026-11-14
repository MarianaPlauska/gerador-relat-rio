<script lang="ts">
  import { agoraLocal, fluxoDaLista, idCurto, lerFluxo, novoFluxograma, pedidoDeFluxo, type Fluxograma, type LigacaoFluxo, type NoFluxo } from '@supervisao/core';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import EditorFluxo from '#lib/EditorFluxo.svelte';
  import { svgDoFluxo } from '#lib/fluxograma.ts';
  import { copiar } from '#lib/saidas.ts';
  import { dataMedia } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const abertoId = $derived(page.url.searchParams.get('id'));
  const aberto = $derived(dados.fluxos.find((f) => f.id === abertoId));

  let nome = $state('');
  let texto = $state('');
  let aviso = $state('');
  let pedidoCopiado = $state(false);

  const ordenados = $derived([...dados.fluxos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)));

  function abrir(f: Fluxograma)
  {
    goto(`/fluxos?id=${f.id}`);
  }

  function guardar(f: Fluxograma)
  {
    dados.fluxos = [f, ...dados.fluxos];
    abrir(f);
  }

  function montar()
  {
    if (!texto.trim())
    {
      aviso = 'Escreva os passos, um por linha, ou cole a resposta de outra IA.';
      return;
    }
    const r = lerFluxo(texto);
    if (!r.nos.some((n) => n.tipo !== 'inicio' && n.tipo !== 'fim'))
    {
      aviso = 'Não encontrei passos no texto.';
      return;
    }
    const primeiro = r.nos.find((n) => n.tipo === 'passo' || n.tipo === 'decisao')!.texto;
    const f = { ...novoFluxograma(nome || primeiro.slice(0, 50)), nos: r.nos, ligacoes: r.ligacoes };
    aviso = '';
    nome = '';
    texto = '';
    guardar(f);
  }

  async function copiarPedido()
  {
    await copiar(pedidoDeFluxo(texto));
    pedidoCopiado = true;
    setTimeout(() => (pedidoCopiado = false), 2000);
  }

  function daLista(id: string)
  {
    const l = dados.listas.find((x) => x.id === id);
    if (l) guardar(fluxoDaLista(l));
  }

  function duplicar(f: Fluxograma)
  {
    const agora = agoraLocal();
    dados.fluxos = [{ ...$state.snapshot(f), id: idCurto(), nome: `${f.nome} (cópia)`, criadoEm: agora, atualizadoEm: agora }, ...dados.fluxos];
  }

  function excluir(f: Fluxograma)
  {
    if (!confirm(`Excluir o fluxo "${f.nome}"?`)) return;
    dados.fluxos = dados.fluxos.filter((x) => x.id !== f.id);
  }

  function mudar(id: string, campos: Partial<Fluxograma>)
  {
    dados.fluxos = dados.fluxos.map((f) => (f.id === id ? { ...f, ...campos, atualizadoEm: agoraLocal() } : f));
  }

  // o editor avisa a cada mudança; só grava quando o desenho mudou de fato
  function aoMudarDesenho(id: string, nos: NoFluxo[], ligacoes: LigacaoFluxo[])
  {
    const f = dados.fluxos.find((x) => x.id === id);
    if (!f || JSON.stringify([f.nos, f.ligacoes]) === JSON.stringify([nos, ligacoes])) return;
    mudar(id, { nos, ligacoes });
  }

  const passos = (f: Fluxograma) => f.nos.filter((n) => n.tipo === 'passo' || n.tipo === 'decisao').length;
</script>

<main class:largo={!!aberto}>
  <span class="prompt">&gt; fluxos</span>
  {#if aberto}
    {@const f = aberto}
    <div class="topo-editor">
      <button onclick={() => goto('/fluxos')}>&larr; Meus fluxos</button>
      <input class="nome" value={f.nome} oninput={(e) => mudar(f.id, { nome: e.currentTarget.value })} aria-label="Nome do fluxo" />
      <input class="descricao" value={f.descricao} oninput={(e) => mudar(f.id, { descricao: e.currentTarget.value })} placeholder="Descrição (vai no PDF)" aria-label="Descrição do fluxo" />
    </div>
    {#key f.id}
      <SvelteFlowProvider>
        <EditorFluxo fluxo={f} onmudar={(nos, ligacoes) => aoMudarDesenho(f.id, nos, ligacoes)} />
      </SvelteFlowProvider>
    {/key}
  {:else}
    <h1>Fluxos de processo<span class="cursor">_</span></h1>

    {#if abertoId}
      <p class="dica">Esse fluxo não existe mais neste navegador.</p>
    {/if}

    <section class="cartao novo">
      <h2>O que vamos mapear hoje?</h2>
      <input bind:value={nome} placeholder="Nome do fluxo (opcional)" />
      <textarea bind:value={texto} rows="8" placeholder={'Descrição do processo, um passo por linha:\nReceber pedido do cliente\nConferir CNPJs\nSe faltar documento? sim: Pedir ao responsável / não: Agendar implantação\nTreinar equipe\nFim'}></textarea>
      <p class="dica">
        Ou cole um texto gerado em outra IA. Escreva o processo do seu jeito, clique em <b>Copiar pedido para IA</b>, cole num chat gratuito
        e traga a resposta para esta mesma caixa. Decisões: "Pergunta? sim: passo / não: passo". Para voltar a um passo: "não: voltar para conferir dados".
      </p>
      {#if aviso}<p class="aviso">{aviso}</p>{/if}
      <div class="botoes">
        <button class="principal" onclick={montar}>Montar fluxo</button>
        <button onclick={copiarPedido}>{pedidoCopiado ? 'Pedido copiado' : 'Copiar pedido para IA'}</button>
        <span class="separa">ou</span>
        <button onclick={() => guardar(novoFluxograma(nome || 'Fluxo em branco'))}>Fluxo em branco</button>
        {#if dados.listas.length}
          <select value="" onchange={(e) => { const id = e.currentTarget.value; e.currentTarget.value = ''; if (id) daLista(id); }}>
            <option value="">A partir de uma lista...</option>
            {#each dados.listas as l (l.id)}<option value={l.id}>{l.nome} ({l.etapas.length} etapas)</option>{/each}
          </select>
        {/if}
      </div>
    </section>

    <h2>Meus fluxos</h2>
    {#if !ordenados.length}
      <p class="dica">Nenhum fluxo ainda. Monte o primeiro acima.</p>
    {:else}
      <div class="grade">
        {#each ordenados as f (f.id)}
          <article class="cartao fluxo">
            <button class="miniatura" onclick={() => abrir(f)} aria-label="Abrir {f.nome}">
              {#if f.nos.length}
                {@html svgDoFluxo(f).svg}
              {:else}
                <span class="dica">em branco</span>
              {/if}
            </button>
            <div class="info">
              <strong>{f.nome}</strong>
              <small>{passos(f)} {passos(f) === 1 ? 'passo' : 'passos'} - atualizado em {dataMedia(f.atualizadoEm)}</small>
            </div>
            <div class="botoes">
              <button class="principal" onclick={() => abrir(f)}>Abrir</button>
              <button onclick={() => duplicar(f)}>Duplicar</button>
              <button class="perigo" onclick={() => excluir(f)}>Excluir</button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</main>

<style>
  main.largo
  {
    max-width: none;
  }
  .topo-editor
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
    margin: var(--size-2) 0 var(--size-3);
  }
  .topo-editor .nome
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.05rem;
    min-width: 220px;
  }
  .topo-editor .descricao
  {
    flex: 1;
    min-width: 200px;
  }
  .novo
  {
    display: grid;
    gap: var(--size-2);
  }
  .novo h2
  {
    margin: 0;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
    font-family: var(--fonte-maquina);
    font-size: 0.86rem;
  }
  .botoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
  }
  .separa
  {
    color: var(--suave);
    font-size: 0.85rem;
  }
  .aviso
  {
    margin: 0;
    color: var(--vermelho);
    font-size: 0.88rem;
  }
  h2
  {
    margin-top: var(--size-6);
  }
  .fluxo .botoes button
  {
    font-size: 0.8rem;
    padding: 5px 10px;
  }
  .grade
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--size-3);
  }
  .fluxo
  {
    display: grid;
    gap: var(--size-2);
  }
  .miniatura
  {
    height: 150px;
    padding: 8px;
    display: grid;
    place-items: center;
    background: #ffffff;
    border-radius: var(--raio-pequeno);
    overflow: hidden;
  }
  .miniatura :global(svg)
  {
    max-width: 100%;
    max-height: 134px;
    height: auto;
  }
  .info
  {
    display: grid;
    gap: 2px;
  }
  .info small
  {
    color: var(--suave);
  }
  .perigo
  {
    color: var(--vermelho);
  }
</style>
