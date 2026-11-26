<script lang="ts">
  import { modelosProntos, validarModelo, type Modelo } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import CriarComIa from '#lib/modelos/CriarComIa.svelte';
  import EditorModelo from '#lib/modelos/EditorModelo.svelte';
  import ItemModelo from '#lib/modelos/ItemModelo.svelte';
  import { ehPronto, novoId } from '#lib/modelos.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  let editando = $state<string | undefined>();
  let aviso = $state('');

  const atual = $derived(dados.modelos.find((m) => m.id === editando));

  function avisar(texto: string)
  {
    aviso = texto;
    setTimeout(() => (aviso = ''), 2500);
  }

  function guardar(m: Modelo)
  {
    // id repetido vira cópia, para não sobrescrever um modelo pronto ou outro meu
    const novo = ehPronto(m.id) || dados.modelos.some((x) => x.id === m.id) ? { ...m, id: novoId() } : m;
    dados.modelos.push(novo);
    editando = novo.id;
  }

  const duplicar = (m: Modelo) => guardar({ ...($state.snapshot(m) as Modelo), id: novoId(), nome: `${m.nome} (cópia)` });

  function excluir(m: Modelo)
  {
    if (!confirm(`Excluir o modelo "${m.nome}"? Os relatórios já baixados não mudam.`)) return;
    dados.modelos = dados.modelos.filter((x) => x.id !== m.id);
    if (dados.ultimoModelo === m.id) dados.ultimoModelo = 'semanal';
    if (editando === m.id) editando = undefined;
  }

  function mudar<K extends keyof Modelo>(campo: K, valor: Modelo[K])
  {
    const i = dados.modelos.findIndex((m) => m.id === editando);
    if (i >= 0) dados.modelos[i] = { ...dados.modelos[i]!, [campo]: valor };
  }

  // devolve o que não foi reconhecido, para a tela mostrar
  function importar(texto: string): string[]
  {
    const r = validarModelo(texto);
    if (!r.modelo) return r.erros;
    guardar(r.modelo);
    avisar(r.erros.length ? 'Modelo importado; o que não foi reconhecido ficou de fora.' : 'Modelo importado.');
    return r.erros;
  }

  async function lerArquivo(e: Event & { currentTarget: HTMLInputElement })
  {
    const alvo = e.currentTarget;
    const arquivo = alvo.files?.[0];
    alvo.value = '';
    if (arquivo) importar(await arquivo.text());
  }
</script>

<main>
  <span class="prompt">&gt; modelos</span>
  <h1>Modelos de relatório<span class="cursor">_</span></h1>
  <p class="dica">Um modelo é a lista de blocos do PDF, em ordem. Você escolhe qual usar na tela <a href="/relatorio">Relatório</a>.</p>
  {#if aviso}<p class="ok">{aviso}</p>{/if}

  <div class="colunas">
    <div class="lista-modelos">
      <section class="cartao grupo">
        <h2>Meus modelos <small>({dados.modelos.length})</small></h2>
        {#if dados.modelos.length}
          <ul>
            {#each dados.modelos as m (m.id)}
              <ItemModelo modelo={m} ativo={editando === m.id} aoEditar={() => (editando = editando === m.id ? undefined : m.id)} aoDuplicar={() => duplicar(m)} aoExcluir={() => excluir(m)} />
            {/each}
          </ul>
        {:else}
          <p class="dica vazio">Nenhum ainda. Use um pronto como base, ou crie com a IA ao lado.</p>
        {/if}
        <label class="arquivo">Importar modelo (.json) <input type="file" accept=".json,application/json" onchange={lerArquivo} /></label>
      </section>

      <section class="cartao grupo">
        <h2>Prontos <small>({modelosProntos.length})</small></h2>
        <ul>
          {#each modelosProntos as m (m.id)}
            <ItemModelo modelo={m} pronto aoDuplicar={() => duplicar(m)} />
          {/each}
        </ul>
      </section>
    </div>

    <aside class="cartao painel">
      {#if atual}
        <EditorModelo modelo={atual} listas={dados.listas} fluxos={dados.fluxos} pessoas={dados.pessoas} {mudar} fechar={() => (editando = undefined)} />
      {:else}
        <CriarComIa {importar} {avisar} />
      {/if}
    </aside>
  </div>
</main>

<style>
  .dica a
  {
    color: var(--marca);
  }
  .ok
  {
    background: var(--verde-fundo);
    border-radius: var(--raio);
    padding: 8px 12px;
  }
  .colunas
  {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) minmax(380px, 1.3fr);
    gap: 20px;
    align-items: start;
  }
  .lista-modelos
  {
    display: grid;
    gap: 14px;
  }
  .grupo
  {
    padding: 0;
    overflow: hidden;
  }
  .grupo h2
  {
    margin: 0;
    padding: 10px 12px;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--borda);
  }
  .grupo h2 small
  {
    color: var(--suave);
    font-weight: 400;
  }
  ul
  {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .vazio
  {
    padding: 10px 12px;
    margin: 0;
  }
  .arquivo
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.82rem;
    padding: 10px 12px;
    border-top: 1px dashed var(--borda);
  }
  /* o painel fica parado na tela enquanto a lista rola, com rolagem própria */
  .painel
  {
    position: sticky;
    top: 14px;
    max-height: calc(100vh - 28px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  @media (max-width: 900px)
  {
    .colunas
    {
      grid-template-columns: 1fr;
    }
    .painel
    {
      position: static;
      max-height: none;
    }
  }
</style>
