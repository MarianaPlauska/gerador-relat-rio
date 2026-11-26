<script lang="ts">
  import { pedidoDeModelo } from '@supervisao/core';
  import { copiar } from '#lib/saidas.ts';

  let { importar, avisar }: { importar: (texto: string) => string[]; avisar: (texto: string) => void } = $props();

  let descricao = $state('');
  let resposta = $state('');
  let erros = $state<string[]>([]);

  async function copiarPedido()
  {
    await copiar(pedidoDeModelo(descricao));
    avisar('Pedido copiado. Cole num chat de IA gratuito e traga a resposta para a caixa abaixo.');
  }

  function trazer()
  {
    erros = importar(resposta);
    if (!erros.length) resposta = '';
  }
</script>

<div class="ia">
  <h2>Criar com uma IA gratuita</h2>
  <p class="dica">Você copia o pedido, cola em qualquer chat gratuito e traz a resposta. Só a estrutura do modelo vai no pedido, nenhum dado do painel.</p>
  <label>1. Descreva o modelo
    <textarea rows="3" bind:value={descricao} placeholder="Ex.: mensal curto para a diretoria, capa curta, prazo e concluídos em gráfico, riscos e próximos passos."></textarea>
  </label>
  <button onclick={copiarPedido}>2. Copiar pedido para a IA</button>
  <label>3. Cole aqui a resposta da IA
    <textarea rows="5" bind:value={resposta} placeholder={'{ "nome": "...", "blocos": [ ... ] }'}></textarea>
  </label>
  <button class="principal" disabled={!resposta.trim()} onclick={trazer}>4. Importar modelo</button>
  {#if erros.length}
    <ul class="erros">{#each erros as e, i (i)}<li>{e}</li>{/each}</ul>
  {/if}
</div>

<style>
  .ia
  {
    display: grid;
    gap: 10px;
  }
  h2
  {
    margin: 0;
    font-size: 1rem;
  }
  label
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.84rem;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .erros
  {
    color: var(--vermelho);
    font-size: 0.84rem;
    padding-left: 18px;
    margin: 0;
  }
</style>
