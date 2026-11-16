<script lang="ts">
  import { agoraLocal, fluxoDaLista, idCurto, lerFluxo, novoFluxograma, pedidoDeFluxo, prepararTextoLivre, textoDaSemana, type Fluxograma, type LigacaoFluxo, type NoFluxo } from '@supervisao/core';
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

  // um registro do diário vira fluxo: motivo e comentários viram os passos
  function doRegistro(id: string)
  {
    const r = dados.registros.find((x) => x.id === id);
    if (!r) return;
    const comentarios = r.capturas.map((c) => c.comentario?.trim()).filter((c): c is string => !!c);
    const base = comentarios.length ? comentarios.join('\n') : r.texto;
    montarDe(prepararTextoLivre(base), r.motivo || `Registro de ${dataMedia(r.data)}`);
  }

  // as tarefas do plano da semana viram passos, uma por linha
  function daSemana(inicio: string)
  {
    const plano = dados.planos.find((p) => p.inicio === inicio);
    const nomePessoa = (id: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id;
    montarDe(textoDaSemana(plano, nomePessoa), `Plano da semana de ${dataMedia(inicio)}`);
  }

  function montarDe(conteudo: string, titulo: string)
  {
    const r = lerFluxo(conteudo);
    if (!r.nos.some((n) => n.tipo !== 'inicio' && n.tipo !== 'fim'))
    {
      aviso = 'Não encontrei passos para montar o fluxo.';
      return;
    }
    aviso = '';
    guardar({ ...novoFluxograma(titulo.slice(0, 60)), nos: r.nos, ligacoes: r.ligacoes });
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
      <textarea bind:value={texto} rows="8" placeholder={'Descreva do seu jeito. Pode ser texto corrido ("Primeiro recebo o pedido, depois confiro os CNPJs. Se faltar documento, peço ao responsável.") ou um passo por linha:\nReceber pedido do cliente\nConferir CNPJs\nSe faltar documento? sim: Pedir ao responsável / não: Agendar implantação\nFim'}></textarea>
      <p class="dica">
        Texto corrido, lista, resposta de outra IA ou Mermaid: tudo vira fluxo. Decisões: "Pergunta? sim: passo / não: passo". Para voltar a um passo: "não: voltar para conferir dados".
        Também dá para partir de um registro do diário, de uma semana ou de uma lista de checagem (ao lado do botão Montar fluxo).
      </p>
      {#if aviso}<p class="aviso">{aviso}</p>{/if}
      <div class="botoes">
        <button class="principal" onclick={montar}>Montar fluxo</button>
        <button onclick={copiarPedido}>{pedidoCopiado ? 'Pedido copiado' : 'Copiar pedido para IA'}</button>
        <span class="separa">ou</span>
        <button onclick={() => guardar(novoFluxograma(nome || 'Fluxo em branco'))}>Fluxo em branco</button>
        {#if dados.registros.length}
          <select value="" onchange={(e) => { const id = e.currentTarget.value; e.currentTarget.value = ''; if (id) doRegistro(id); }}>
            <option value="">A partir de um registro do diário...</option>
            {#each [...dados.registros].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30) as r (r.id)}<option value={r.id}>{dataMedia(r.data)} · {r.pasta}{r.motivo ? ` · ${r.motivo.slice(0, 40)}` : ''}</option>{/each}
          </select>
        {/if}
        {#if dados.planos.length}
          <select value="" onchange={(e) => { const id = e.currentTarget.value; e.currentTarget.value = ''; if (id) daSemana(id); }}>
            <option value="">A partir de uma semana...</option>
            {#each [...dados.planos].sort((a, b) => b.inicio.localeCompare(a.inicio)) as p (p.inicio)}<option value={p.inicio}>Semana de {dataMedia(p.inicio)}</option>{/each}
          </select>
        {/if}
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
