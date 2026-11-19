<script lang="ts">
  import { lerValor, pedidoDePlanilha, validarPlanilha, type Planilha } from '@supervisao/core';
  import { copiar } from '#lib/saidas.ts';

  let { criada }: { criada: (planilha: Planilha, avisos: string[], erros: string[]) => void } = $props();

  let material = $state('');
  let ordem = $state('');
  let orcamento = $state('');
  let moeda = $state(true);
  let comAlternativas = $state(false);
  let resposta = $state('');
  let erros = $state<string[]>([]);
  let copiado = $state(false);

  const valorOrcamento = $derived(lerValor(orcamento));

  async function copiarPedido()
  {
    await copiar(pedidoDePlanilha({ material, ordem, orcamento: valorOrcamento, moeda, comAlternativas }));
    copiado = true;
    setTimeout(() => (copiado = false), 2500);
  }

  function importar()
  {
    const r = validarPlanilha(resposta, material, comAlternativas);
    erros = r.erros;
    if (!r.planilha) return;
    // o orçamento digitado aqui vale mesmo que a IA não o tenha devolvido
    if (valorOrcamento && !r.planilha.orcamento) r.planilha.orcamento = valorOrcamento;
    r.planilha.moeda = moeda;
    criada(r.planilha, r.avisos, r.erros);
    resposta = '';
    material = '';
  }

  async function lerArquivo(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (arquivo) resposta = await arquivo.text();
  }
</script>

<section class="cartao ia">
  <h2>Nova planilha com IA gratuita</h2>
  <p class="dica">O OrbisOS não abre links nem pesquisa preço: quem pesquisa é um chat de IA gratuito com busca. Aqui você monta o pedido, cola a resposta e ele organiza, calcula e guarda. Só o texto que você colar abaixo vai no pedido.</p>

  <ol class="passos">
    <li>
      <b>1. Material</b>
      <textarea rows="7" bind:value={material} placeholder="Cole o seu prompt, as ideias soltas e os links de onde achou cada coisa. Pode estar bagunçado."></textarea>
      <div class="linha">
        <label>Ordem que eu quero <input bind:value={ordem} placeholder="ex.: cozinha, sala, quarto; do mais caro ao mais barato" /></label>
        <label>Orçamento (opcional) <input bind:value={orcamento} inputmode="decimal" placeholder="ex.: 25.000" /></label>
        <label class="marca"><input type="checkbox" bind:checked={moeda} /> valores em reais</label>
        <label class="marca"><input type="checkbox" bind:checked={comAlternativas} /> gerar a aba Alternativas (comparar lojas e opções)</label>
      </div>
    </li>
    <li>
      <b>2. Pedido</b>
      <div class="linha">
        <button class="principal" disabled={!material.trim()} onclick={copiarPedido}>{copiado ? 'Copiado!' : 'Copiar pedido'}</button>
        <span class="dica">Cole no chat de IA gratuito (com busca na internet) e peça para responder só com o JSON.</span>
      </div>
    </li>
    <li>
      <b>3. Resposta</b>
      <textarea rows="7" bind:value={resposta} placeholder="Cole aqui o JSON que a IA devolveu."></textarea>
      <div class="linha">
        <button class="principal" disabled={!resposta.trim()} onclick={importar}>Criar planilha</button>
        <label class="arquivo botao">Abrir arquivo .json<input type="file" accept="application/json,.json,.txt" onchange={lerArquivo} hidden /></label>
      </div>
      {#if erros.length}
        <ul class="erros">{#each erros as e, i (i)}<li>{e}</li>{/each}</ul>
      {/if}
    </li>
  </ol>
</section>

<style>
  .ia
  {
    display: grid;
    gap: var(--size-3);
  }
  .ia h2
  {
    margin: 0;
  }
  .passos
  {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--size-4);
  }
  .passos li
  {
    display: grid;
    gap: var(--size-2);
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .linha
  {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--size-3);
  }
  .linha label
  {
    display: grid;
    gap: var(--size-1);
    flex: 1 1 220px;
  }
  .linha label.marca
  {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--size-2);
  }
  .erros
  {
    margin: 0;
    padding-left: var(--size-5);
    color: var(--vermelho);
    font-size: 0.86rem;
  }
  .arquivo
  {
    cursor: var(--cursor-clique);
  }
</style>
