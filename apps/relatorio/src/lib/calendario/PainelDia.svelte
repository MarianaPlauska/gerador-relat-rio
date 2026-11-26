<script lang="ts">
  import { idCurto, tiposEventoCalendario, type EventoCalendario, type MarcaCalendario, type TipoEventoCalendario } from '@supervisao/core';
  import { atrasado, diaMes, rotuloDia } from './rotulos.ts';

  let { dia, agenda, hojeIso, marcas = $bindable() }: {
    dia: string | null;
    agenda: EventoCalendario[];
    hojeIso: string;
    marcas: MarcaCalendario[];
  } = $props();

  const nomeTipo = Object.fromEntries(tiposEventoCalendario.map((t) => [t.id, t.nome])) as Record<TipoEventoCalendario, string>;

  let titulo = $state('');
  let ate = $state('');
  let detalhe = $state('');

  // ao trocar de dia, o "até" volta a ser o próprio dia
  $effect(() =>
  {
    ate = dia ?? '';
  });

  const marcaDo = (evento: EventoCalendario) => (evento.tipo === 'marca' ? marcas.find((m) => `marca|${m.id}` === evento.id) : undefined);

  function adicionar(e: SubmitEvent)
  {
    e.preventDefault();
    if (!dia || !titulo.trim()) return;
    const fim = ate && ate >= dia ? ate : dia;
    marcas = [...marcas, { id: idCurto(), titulo: titulo.trim(), inicio: dia, fim, ...(detalhe.trim() ? { detalhe: detalhe.trim() } : {}) }];
    titulo = '';
    detalhe = '';
  }

  const alternarFeita = (m: MarcaCalendario) => (marcas = marcas.map((x) => (x.id === m.id ? { ...x, feita: !x.feita } : x)));
  const remover = (m: MarcaCalendario) => (marcas = marcas.filter((x) => x.id !== m.id));
</script>

<section class="cartao">
  <h2>{dia ? rotuloDia(dia) : 'Dia'}</h2>
  {#if !dia}
    <p class="dica">Clique num dia para ver o que cai nele e marcar algo seu.</p>
  {:else}
    {#if agenda.length === 0}
      <p class="dica">Nada neste dia com os filtros atuais.</p>
    {:else}
      <ul class="agenda">
        {#each agenda as evento (evento.id)}
          {@const minha = marcaDo(evento)}
          <li>
            <span class="pilula ev-{evento.tipo}">{nomeTipo[evento.tipo]}</span>
            <a href={evento.href}>{evento.titulo}</a>
            {#if evento.detalhe}<small class="dica">{evento.detalhe}</small>{/if}
            {#if evento.fim > evento.inicio}<small class="dica">{diaMes(evento.inicio)} a {diaMes(evento.fim)}</small>{/if}
            {#if evento.concluido}<span class="pilula">concluído</span>{/if}
            {#if atrasado(evento, hojeIso)}<span class="pilula ev-vencimento">atrasado</span>{/if}
            {#if minha}
              <button type="button" class="link" onclick={() => alternarFeita(minha)}>{minha.feita ? 'reabrir' : 'marcar feita'}</button>
              <button type="button" class="link perigo" onclick={() => remover(minha)}>remover</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <form class="nova" onsubmit={adicionar}>
      <h3>Marcar neste dia</h3>
      <input bind:value={titulo} placeholder="O que é: entrega, reunião, lembrete..." aria-label="Título da marca" />
      <label>até <input type="date" bind:value={ate} min={dia} /></label>
      <input class="largo" bind:value={detalhe} placeholder="Detalhe (opcional): pessoa, cliente, link..." aria-label="Detalhe da marca" />
      <button class="principal" disabled={!titulo.trim()}>Marcar</button>
    </form>
  {/if}
</section>

<style>
  .agenda
  {
    list-style: none;
    margin: 0 0 var(--size-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--size-2);
  }
  .agenda li
  {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--size-2);
  }
  .agenda a
  {
    color: var(--texto);
    font-weight: 600;
  }
  .pilula
  {
    border-radius: var(--radius-round);
  }
  .nova
  {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--size-2);
    align-items: center;
    padding-top: var(--size-3);
    border-top: 1px dashed var(--borda);
  }
  .nova h3
  {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 0.9rem;
  }
  .nova label
  {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.84rem;
  }
  .nova .largo
  {
    grid-column: 1 / 3;
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--marca);
    text-decoration: underline;
    font-size: 0.82rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  @media (max-width: 640px)
  {
    .nova
    {
      grid-template-columns: 1fr;
    }
    .nova .largo
    {
      grid-column: auto;
    }
  }
</style>
