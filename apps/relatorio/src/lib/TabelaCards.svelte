<script lang="ts">
  import type { CardSnapshot, Pessoa, Ritmo, Situacao } from '@supervisao/core';

  let { cards = $bindable(), pessoas }: { cards: CardSnapshot[]; pessoas: Pessoa[] } = $props();

  const ritmos: Ritmo[] = ['no_ritmo', 'em_risco', 'atrasado'];
  const situacoes: Situacao[] = ['concluido', 'atrasado', 'vence_15_dias', 'a_iniciar', 'em_execucao', 'sem_data'];
</script>

<div class="rolagem">
  <table>
    <thead>
      <tr>
        <th>Card</th><th>Título</th><th>Pessoa (etapa atual)</th><th>Etapa</th><th>Etapas</th>
        <th>Início</th><th>Previsão</th><th>Vencimento</th><th>Ritmo</th><th>Situação</th><th>Status do card</th><th>Conferir</th><th></th>
      </tr>
    </thead>
    <tbody>
      <!-- chave pela posição: editar o código não pode recriar a linha a cada letra -->
      {#each cards as card, i (i)}
        <tr class:conferir={card.avisosLeitura?.length}>
          <td><input class="curto" bind:value={card.codigo} /></td>
          <td><input bind:value={card.titulo} /></td>
          <td>
            <select bind:value={card.responsavelEtapaAtual}>
              <option value={undefined}>-</option>
              {#each pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
              {#if card.responsavelEtapaAtual && !pessoas.some((p) => p.id === card.responsavelEtapaAtual)}
                <option value={card.responsavelEtapaAtual}>{card.responsavelEtapaAtual} (não cadastrada)</option>
              {/if}
            </select>
          </td>
          <td><input bind:value={card.etapaAtual} /></td>
          <td class="etapas">
            <input type="number" class="mini" bind:value={card.etapasConcluidas} />/<input type="number" class="mini" bind:value={card.etapasTotal} />
          </td>
          <td><input type="date" bind:value={card.inicio} /></td>
          <td><input type="date" bind:value={card.previsao} /></td>
          <td><input type="date" bind:value={card.vencimento} /></td>
          <td>
            <select bind:value={card.ritmoPainel}>
              <option value={undefined}>-</option>
              {#each ritmos as r (r)}<option value={r}>{r.replace('_', ' ')}</option>{/each}
            </select>
          </td>
          <td>
            <select bind:value={card.situacao}>
              <option value={undefined}>-</option>
              {#each situacoes as s (s)}<option value={s}>{s.replaceAll('_', ' ')}</option>{/each}
            </select>
          </td>
          <td>
            <input class="curto" bind:value={card.statusCard} />
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
          <td><button onclick={() => cards.splice(i, 1)}>remover</button></td>
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
  .mini
  {
    width: 52px;
  }
  .etapas
  {
    white-space: nowrap;
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
