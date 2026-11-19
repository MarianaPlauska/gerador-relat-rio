<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Planilha } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import AbaAlternativas from '#lib/planilhas/AbaAlternativas.svelte';
  import AbaNotas from '#lib/planilhas/AbaNotas.svelte';
  import CriarComIa from '#lib/planilhas/CriarComIa.svelte';
  import ListaPlanilhas from '#lib/planilhas/ListaPlanilhas.svelte';
  import ResumoOrcamento from '#lib/planilhas/ResumoOrcamento.svelte';
  import TabelaItens from '#lib/planilhas/TabelaItens.svelte';
  import { baixarXlsx } from '#lib/planilhas/xlsx/index.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const abertoId = $derived(page.url.searchParams.get('id'));
  const indice = $derived(dados.planilhas.findIndex((p) => p.id === abertoId));
  type Aba = 'resumo' | 'itens' | 'alternativas' | 'notas';
  let aba = $state<Aba>('resumo');
  const todasAbas: [Aba, string][] = [['resumo', 'Resumo e orçamento'], ['itens', 'Itens'], ['alternativas', 'Alternativas'], ['notas', 'Notas']];
  // Alternativas só aparece quando a planilha pediu
  const abas = $derived(todasAbas.filter(([id]) => id !== 'alternativas' || dados.planilhas[indice]?.comAlternativas));
  const abaAtual = $derived(abas.some(([id]) => id === aba) ? aba : 'resumo');
  let avisos = $state<string[]>([]);
  let baixando = $state(false);
  let erroBaixar = $state('');

  // o documento da nuvem tem limite de 1 MB e divide o espaço com o resto dos dados
  const tamanhoKb = (p: Planilha) => Math.round(JSON.stringify(p).length / 1024);

  function criada(p: Planilha, avisosDaImportacao: string[])
  {
    dados.planilhas.push(p);
    avisos = avisosDaImportacao;
    aba = 'resumo';
    goto(`/planilhas?id=${p.id}`);
  }

  function excluir(p: Planilha)
  {
    if (!confirm(`Excluir a planilha "${p.nome}"?`)) return;
    dados.planilhas = dados.planilhas.filter((x) => x.id !== p.id);
    goto('/planilhas');
  }

  async function baixar(p: Planilha)
  {
    baixando = true;
    erroBaixar = '';
    try
    {
      await baixarXlsx($state.snapshot(p) as Planilha);
    }
    catch (e)
    {
      erroBaixar = e instanceof Error ? e.message : 'Não consegui gerar o .xlsx.';
    }
    baixando = false;
  }
</script>

<main>
  {#if indice >= 0}
    {@const p = dados.planilhas[indice]!}
    <header>
      <div>
        <span class="prompt">&gt; <a href="/planilhas">planilhas</a></span>
        <h1>{p.nome}<span class="cursor">_</span></h1>
      </div>
      <button class="principal" disabled={baixando} onclick={() => baixar(p)}>{baixando ? 'Gerando...' : 'Baixar .xlsx'}</button>
      <button class="perigo" onclick={() => excluir(p)}>Excluir</button>
    </header>
    {#if erroBaixar}<p class="aviso">{erroBaixar}</p>{/if}
    {#if tamanhoKb(p) > 300}<p class="aviso">Esta planilha tem {tamanhoKb(p)} KB. Planilhas muito grandes dividem o espaço da sincronização com o resto dos seus dados.</p>{/if}
    {#if avisos.length}
      <div class="aviso">
        <b>Confira antes de usar ({avisos.length}):</b>
        <ul>{#each avisos as a, i (i)}<li>{a}</li>{/each}</ul>
        <button class="link" onclick={() => (avisos = [])}>dispensar</button>
      </div>
    {/if}

    <nav class="abas-planilha" aria-label="Partes da planilha">
      {#each abas as [id, nome] (id)}
        <button class:ativa={abaAtual === id} onclick={() => (aba = id)}>{nome}</button>
      {/each}
    </nav>

    <div class="conteudo-aba">
      {#if abaAtual === 'resumo'}<ResumoOrcamento bind:planilha={dados.planilhas[indice]!} />
      {:else if abaAtual === 'itens'}<TabelaItens bind:planilha={dados.planilhas[indice]!} />
      {:else if abaAtual === 'alternativas'}<AbaAlternativas bind:planilha={dados.planilhas[indice]!} />
      {:else}<AbaNotas bind:planilha={dados.planilhas[indice]!} />{/if}
    </div>
  {:else}
    <span class="prompt">&gt; planilhas</span>
    <h1>Planilhas<span class="cursor">_</span></h1>
    <p class="dica">Cole um material solto (prompt, ideias, links) e uma IA gratuita organiza em grupos, com o link ao lado, valores, totais e orçamento. Você edita aqui e baixa o .xlsx.</p>
    <CriarComIa {criada} />
    <ListaPlanilhas planilhas={dados.planilhas} />
  {/if}
</main>

<style>
  header > div
  {
    margin-right: auto;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .aviso ul
  {
    margin: var(--size-1) 0;
    padding-left: var(--size-5);
  }
  .link
  {
    border: none;
    background: none;
    color: inherit;
    text-decoration: underline;
    padding: 0;
  }
  .abas-planilha
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-1);
    margin: var(--size-4) 0 var(--size-3);
    border-bottom: 1px solid var(--borda);
  }
  .abas-planilha button
  {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    color: var(--suave);
    margin-bottom: -1px;
  }
  .abas-planilha button.ativa
  {
    color: var(--marca);
    border-bottom-color: var(--marca);
  }
  .conteudo-aba :global(.cartao)
  {
    margin-top: var(--size-4);
  }
</style>
