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
  const nomesRitmo: Record<Ritmo, string> = { no_ritmo: 'No ritmo', em_risco: 'Em risco', atrasado: 'Atrasado' };
  const nomesSituacao: Record<Situacao, string> = {
    concluido: 'Concluída', atrasado: 'Atrasada', vence_15_dias: 'Vence em até 15 dias', a_iniciar: 'A iniciar', em_execucao: 'Em execução', sem_data: 'Sem data',
  };

  function editar(card: CardSnapshot, parcial: Partial<CardSnapshot>)
  {
    if (aoEditar) aoEditar(card.codigo, parcial);
    else Object.assign(card, parcial);
  }

  const opcional = (valor: string) => valor || undefined;
</script>

<p class="explica">
  <b>Corrigir a leitura, campo por campo.</b> Cada linha é uma tarefa como o sistema entendeu.
  Só mexa se algo veio errado ou faltando: o que você mudar aqui vale para este registro e entra no relatório.
  Linhas em vermelho são as que o leitor pediu para conferir. Role para o lado para ver as datas.
</p>
<div class="rolagem">
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Tarefa</th><th title="Quem está cuidando da etapa em que a tarefa está agora">Com quem está agora</th><th>Etapa atual</th><th>Sua anotação</th>
        <th>Começou em</th><th title="Quando o painel prevê a entrega">Previsão de entrega</th><th title="Data limite combinada">Prazo final</th><th title="No ritmo, em risco ou atrasado, como o painel mostra">Ritmo</th><th title="Calculado pelas datas">Situação do prazo</th><th>Status no painel</th><th title="O que o leitor pediu para conferir">Conferir leitura</th><th></th>
      </tr>
    </thead>
    <tbody>
      <!-- chave pela posição: editar o código não pode recriar a linha a cada letra -->
      {#each cards as card, i (i)}
        <tr class:conferir={card.avisosLeitura?.length}>
          <td><input class="curto" value={card.codigo} oninput={(e) => editar(card, { codigo: e.currentTarget.value })} /></td>
          <td><input class="titulo" title={card.titulo} value={card.titulo ?? ''} oninput={(e) => editar(card, { titulo: opcional(e.currentTarget.value) })} /></td>
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
              {#each ritmos as r (r)}<option value={r}>{nomesRitmo[r]}</option>{/each}
            </select>
          </td>
          <td>
            <select value={card.situacao ?? ''} onchange={(e) => editar(card, { situacao: situacoes.find((s) => s === e.currentTarget.value) })}>
              <option value="">-</option>
              {#each situacoes as s (s)}<option value={s}>{nomesSituacao[s]}</option>{/each}
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
  .explica
  {
    font-size: 0.84rem;
    color: var(--suave);
    margin: 10px 0 6px;
  }
  .explica b
  {
    color: var(--texto);
  }
  table input, table select
  {
    padding: 3px 6px;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  .titulo
  {
    min-width: 280px;
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
