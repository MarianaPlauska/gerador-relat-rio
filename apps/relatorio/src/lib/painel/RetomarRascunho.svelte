<script lang="ts">
  import { haQuantoTempo, type Rascunho } from '#lib/rascunho.ts';

  let { rascunho, aoContinuar, aoDescartar }: { rascunho: Rascunho; aoContinuar: () => void; aoDescartar: () => void } = $props();

  const n = $derived(rascunho.capturas.length);
  const cards = $derived(new Set(rascunho.capturas.flatMap((c) => c.cards)).size);
</script>

<section class="retomar" role="status">
  <div class="texto">
    <b>Você parou no meio de um registro.</b>
    <span>
      {n} {n === 1 ? 'print/arquivo' : 'prints/arquivos'}{cards ? ` · ${cards} ${cards === 1 ? 'demanda' : 'demandas'}` : ''}{rascunho.motivo.trim() ? ` · "${rascunho.motivo.trim()}"` : ''}
      · salvo {haQuantoTempo(rascunho.salvoEm)} · pasta {rascunho.pasta}
    </span>
  </div>
  <div class="acoes">
    <button type="button" class="principal" onclick={aoContinuar}>Continuar de onde parou</button>
    <button type="button" class="link" onclick={aoDescartar}>descartar</button>
  </div>
</section>

<style>
  .retomar
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    margin: 0 0 14px;
    padding: 10px 14px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-left: 3px solid var(--marca);
    border-radius: var(--raio);
  }
  .texto
  {
    display: grid;
    gap: 2px;
    font-size: 0.86rem;
  }
  .texto span
  {
    color: var(--suave);
    font-variant-numeric: tabular-nums;
  }
  .acoes
  {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--suave);
    text-decoration: underline;
    font-size: 0.82rem;
  }
</style>
