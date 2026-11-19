<script lang="ts">
  import { idCurto, lerValor, type Planilha } from '@supervisao/core';

  let { planilha = $bindable() }: { planilha: Planilha } = $props();

  const itens = $derived([...new Set(planilha.linhas.map((l) => l.item))]);

  function adicionar()
  {
    planilha.alternativas.push({ id: idCurto(), item: itens[0] ?? '', opcao: '', loja: '', observacao: '' });
  }

  const remover = (id: string) => (planilha.alternativas = planilha.alternativas.filter((a) => a.id !== id));
</script>

<section class="cartao">
  <h2>Alternativas e variação de valor</h2>
  <p class="dica">Compare lojas e modelos e, no futuro, anote novas cotações: copie uma linha e mude a data e o valor.</p>
  <div class="rolagem">
    <table>
      <thead><tr><th>Item</th><th>Opção</th><th>Loja</th><th>Valor</th><th>Data</th><th>Link</th><th>Observação</th><th></th></tr></thead>
      <tbody>
        {#each planilha.alternativas as a (a.id)}
          <tr>
            <td><input list="itens-da-planilha" bind:value={a.item} /></td>
            <td><input class="largo" bind:value={a.opcao} /></td>
            <td><input bind:value={a.loja} /></td>
            <td><input class="valor" inputmode="decimal" value={a.valor ?? ''} onchange={(e) => (a.valor = lerValor(e.currentTarget.value))} /></td>
            <td><input type="date" bind:value={a.data} /></td>
            <td class="link">
              <input placeholder="https://..." value={a.link ?? ''} onchange={(e) => (a.link = e.currentTarget.value.trim() || undefined)} />
              {#if a.link}<a href={a.link} target="_blank" rel="noopener noreferrer">abrir</a>{/if}
            </td>
            <td><input class="largo" bind:value={a.observacao} /></td>
            <td><button class="x" title="Remover" onclick={() => remover(a.id)}>x</button></td>
          </tr>
        {:else}
          <tr><td colspan="8" class="dica">Nenhuma alternativa ainda.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <datalist id="itens-da-planilha">{#each itens as i (i)}<option value={i}></option>{/each}</datalist>
  <button onclick={adicionar}>+ Alternativa</button>
</section>

<style>
  .rolagem
  {
    overflow-x: auto;
    margin-bottom: var(--size-3);
  }
  table input
  {
    padding: 2px var(--size-1);
    font-size: 0.82rem;
    width: 130px;
  }
  .largo
  {
    width: 200px;
  }
  .valor
  {
    width: 90px;
    text-align: right;
  }
  td.link
  {
    white-space: nowrap;
  }
  .x
  {
    border: none;
    background: none;
    color: var(--suave);
    padding: 0 var(--size-2);
  }
  .x:hover
  {
    color: var(--vermelho);
  }
</style>
