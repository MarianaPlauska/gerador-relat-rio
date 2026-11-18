<script lang="ts">
  import type { CardSnapshot, Pessoa, Ritmo, Situacao } from '@supervisao/core';

  // Sem `aoEditar`/`aoRemover`, edita direto os cards recebidos (foto já guardada).
  // Com eles, cada mudança vai para a camada de ajustes manuais da tela (sobrevive quando os prints são lidos de novo).
  let { cards = $bindable(), pessoas, aoEditar, aoRemover }: {
    cards: CardSnapshot[];
    pessoas: Pessoa[];
    aoEditar?: (codigo: string, parcial: Partial<CardSnapshot>) => void;
    aoRemover?: (codigo: string) => void;
  } = $props();

  const ritmos: Ritmo[] = ['no_ritmo', 'em_risco', 'atrasado'];
  const situacoes: Situacao[] = ['concluido', 'atrasado', 'vence_15_dias', 'a_iniciar', 'em_execucao', 'sem_data'];

  function editar(card: CardSnapshot, parcial: Partial<CardSnapshot>)
  {
    if (aoEditar) aoEditar(card.codigo, parcial);
    else Object.assign(card, parcial);
  }

  const opcional = (valor: string) => valor || undefined;
</script>

<div class="rolagem">
  <table>
    <thead>
      <tr>
        <th>Card</th><th>Título</th><th>Pessoa (etapa atual)</th><th>Etapa</th><th>Comentário</th>
        <th>Início</th><th>Previsão</th><th>Vencimento</th><th>Ritmo</th><th>Situação</th><th>Status do card</th><th>Conferir</th><th></th>
      </tr>
    </thead>
    <tbody>
      <!-- chave pela posição: editar o código não pode recriar a linha a cada letra -->
      {#each cards as card, i (i)}
        <tr class:conferir={card.avisosLeitura?.length}>
          <td><input class="curto" value={card.codigo} oninput={(e) => editar(card, { codigo: e.currentTarget.value })} /></td>
          <td><input value={card.titulo ?? ''} oninput={(e) => editar(card, { titulo: opcional(e.currentTarget.value) })} /></td>
          <td>
            <select value={card.responsavelEtapaAtual ?? ''} onchange={(e) => editar(card, { responsavelEtapaAtual: opcional(e.currentTarget.value) })}>
              <option value="">-</option>
              {#each pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
              {#if card.responsavelEtapaAtual && !pessoas.some((p) => p.id === card.responsavelEtapaAtual)}
                <option value={card.responsavelEtapaAtual}>{card.responsavelEtapaAtual}</option>
              {/if}
            </select>
          </td>
          <td><input value={card.etapaAtual ?? ''} oninput={(e) => editar(card, { etapaAtual: opcional(e.currentTarget.value) })} /></td>
          <td>
            <input class="comentario-card" value={card.comentario ?? ''} oninput={(e) => editar(card, { comentario: opcional(e.currentTarget.value) })} placeholder="Adicionar comentário" />
          </td>
          <td><input type="date" value={card.inicio ?? ''} onchange={(e) => editar(card, { inicio: opcional(e.currentTarget.value) })} /></td>
          <td><input type="date" value={card.previsao ?? ''} onchange={(e) => editar(card, { previsao: opcional(e.currentTarget.value) })} /></td>
          <td><input type="date" value={card.vencimento ?? ''} onchange={(e) => editar(card, { vencimento: opcional(e.currentTarget.value) })} /></td>
          <td>
            <select value={card.ritmoPainel ?? ''} onchange={(e) => editar(card, { ritmoPainel: ritmos.find((r) => r === e.currentTarget.value) })}>
              <option value="">-</option>
              {#each ritmos as r (r)}<option value={r}>{r.replace('_', ' ')}</option>{/each}
            </select>
          </td>
          <td>
            <select value={card.situacao ?? ''} onchange={(e) => editar(card, { situacao: situacoes.find((s) => s === e.currentTarget.value) })}>
              <option value="">-</option>
              {#each situacoes as s (s)}<option value={s}>{s.replaceAll('_', ' ')}</option>{/each}
            </select>
          </td>
          <td>
            <input class="curto" value={card.statusCard ?? ''} oninput={(e) => editar(card, { statusCard: opcional(e.currentTarget.value) })} />
            {#if card.abertura || card.planejadoPara || (!card.responsavelEtapaAtual && card.responsaveis.length)}
              <small>
                {[
                  card.abertura && `aberto ${card.abertura.split('-').reverse().join('/')}`,
                  card.planejadoPara && `começa ${card.planejadoPara.split('-').reverse().join('/')}`,
                  !card.responsavelEtapaAtual && card.responsaveis.map((id) => pessoas.find((p) => p.id === id)?.nome ?? id).join(', '),
                ].filter(Boolean).join(' - ')}
              </small>
            {/if}
          </td>
          <td class="avisos">{card.avisosLeitura?.join(', ')}</td>
          <td><button onclick={() => (aoRemover ? aoRemover(card.codigo) : cards.splice(i, 1))}>remover</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  table input, table select
  {
    padding: 3px 6px;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  .curto
  {
    width: 90px;
  }
  .comentario-card
  {
    min-width: 170px;
    width: 100%;
  }
  .conferir
  {
    background: var(--vermelho-fundo);
  }
  small
  {
    display: block;
    color: var(--suave);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .avisos
  {
    color: var(--vermelho);
    font-size: 0.82rem;
  }
</style>
