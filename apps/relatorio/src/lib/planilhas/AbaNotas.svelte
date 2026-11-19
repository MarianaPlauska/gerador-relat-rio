<script lang="ts">
  import type { NotasPlanilha, Planilha } from '@supervisao/core';

  let { planilha = $bindable() }: { planilha: Planilha } = $props();

  const campos: [keyof NotasPlanilha, string, string][] = [
    ['comoLer', 'Como ler', 'O que significam os valores e os status.'],
    ['premissas', 'Premissas', 'O que foi assumido para chegar nos números.'],
    ['atencao', 'Pontos de atenção', 'O que conferir antes de decidir.'],
  ];

  const texto = (k: keyof NotasPlanilha) => planilha.notas[k].join('\n');
  const guardar = (k: keyof NotasPlanilha, t: string) =>
  {
    planilha.notas[k] = t.split('\n').map((l) => l.trim()).filter(Boolean);
  };
</script>

<section class="cartao">
  <h2>Notas da planilha</h2>
  <p class="dica">Uma frase por linha. Vão para o Resumo do .xlsx.</p>
  <label class="campo">Nome <input bind:value={planilha.nome} /></label>
  <label class="marca"><input type="checkbox" bind:checked={planilha.comAlternativas} /> Mostrar e exportar a aba Alternativas (comparar lojas e opções)</label>
  <label class="campo">Objetivo <input bind:value={planilha.objetivo} placeholder="Para que serve esta planilha" /></label>
  {#each campos as [chave, nome, dica] (chave)}
    <label class="campo">{nome}
      <textarea rows="4" value={texto(chave)} placeholder={dica} onchange={(e) => guardar(chave, e.currentTarget.value)}></textarea>
    </label>
  {/each}
</section>

<style>
  .marca
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
    margin-top: var(--size-3);
  }
  .campo
  {
    display: grid;
    gap: var(--size-1);
    margin-top: var(--size-3);
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
</style>
