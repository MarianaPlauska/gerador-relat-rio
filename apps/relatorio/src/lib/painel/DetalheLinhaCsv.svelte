<script lang="ts">
  import type { CardSnapshot } from '@supervisao/core';
  import type { AcoesCards, AnexosCard } from './acoes';

  // o que abre ao clicar numa linha da planilha: por quê, o pedido e os prints desta tarefa
  let { card, acoes, anexos, aoAbrirTudo }: { card: CardSnapshot; acoes: AcoesCards; anexos: AnexosCard; aoAbrirTudo: () => void } = $props();

  const prints = $derived(anexos.listar(card.codigo));
  const lendo = $derived(anexos.progresso());
</script>

<div class="detalhe">
  <label>Por quê
    <textarea rows="2" value={card.porque ?? ''} oninput={(e) => acoes.atualizarCampo(card.codigo, { porque: e.currentTarget.value || undefined })}
      placeholder="Por que esta tarefa está na semana: prioridade, prazo, pedido do cliente, risco..."></textarea>
  </label>
  <label>O que foi pedido
    <textarea rows="3" value={card.descricaoCompleta ?? card.titulo ?? ''} oninput={(e) => acoes.atualizarCampo(card.codigo, { descricaoCompleta: e.currentTarget.value })}
      placeholder="Continue a descrição da tarefa..."></textarea>
  </label>
  <div class="prints">
    <span class="rotulo">Prints desta tarefa</span>
    <textarea class="zona" rows="1" value="" aria-label={`Colar print do ${card.codigo}`}
      placeholder="Cole aqui um print desta tarefa (Ctrl+V) ou arraste a imagem"
      onpaste={(e) => { e.preventDefault(); anexos.colar(card.codigo, e); }}
      ondragover={(e) => e.preventDefault()}
      ondrop={(e) => { e.preventDefault(); anexos.soltar(card.codigo, e); }}></textarea>
    {#if lendo !== null}<span class="pilula">lendo... {Math.round(lendo * 100)}%</span>{/if}
    {#if prints.length}
      <ul>
        {#each prints as p (p.id)}
          <li>
            {#if p.imagemDataUrl}<img src={p.imagemDataUrl} alt={p.nome} />{/if}
            <span>{p.trouxe ? `preencheu: ${p.trouxe}` : 'nada lido neste print'}</span>
            <button type="button" class="link perigo" onclick={() => anexos.remover(p.id)}>remover</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <button type="button" class="link" onclick={aoAbrirTudo}>abrir a tarefa inteira (etapas, horas, relacionadas)</button>
</div>

<style>
  .detalhe
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    padding: 10px 12px;
    background: var(--superficie);
    border-left: 3px solid var(--marca);
    white-space: normal;
  }
  label, .prints
  {
    display: grid;
    gap: 3px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .prints
  {
    grid-column: 1 / -1;
  }
  .rotulo
  {
    font-size: 0.8rem;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
    font-weight: 400;
    font-size: 0.85rem;
  }
  .zona
  {
    border-style: dashed;
  }
  ul
  {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  li
  {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 400;
    font-size: 0.78rem;
  }
  img
  {
    width: 56px;
    height: 40px;
    object-fit: cover;
    border: 1px solid var(--borda);
    border-radius: 4px;
  }
  .link
  {
    justify-self: start;
    border: none;
    background: none;
    padding: 0;
    color: var(--marca);
    text-decoration: underline;
    font-size: 0.8rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  @media (max-width: 700px)
  {
    .detalhe
    {
      grid-template-columns: 1fr;
    }
  }
</style>
