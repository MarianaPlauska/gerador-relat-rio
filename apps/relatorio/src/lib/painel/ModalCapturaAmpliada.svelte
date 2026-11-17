<script lang="ts">
  import type { CapturaLida } from '@supervisao/core';

  let {
    captura = $bindable(),
    aoFechar,
    aoReprocessar,
    aoInspecionarCard,
  }: {
    captura: CapturaLida;
    aoFechar: () => void;
    aoReprocessar: () => void;
    aoInspecionarCard: (codigo: string) => void;
  } = $props();

  let zoomImagemModal = $state(false);
</script>

<div class="modal-backdrop" role="presentation" onclick={aoFechar}>
  <div
    class="modal-janela modal-largo"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && aoFechar()}
  >
    <div class="linha-entre modal-topo">
      <div>
        <span class="etiqueta">Visualização ampliada da captura</span>
        <h2>{captura.nome}</h2>
      </div>
      <div class="linha">
        {#if captura.imagemDataUrl}
          <button type="button" onclick={() => (zoomImagemModal = !zoomImagemModal)}>
            {zoomImagemModal ? 'Ajustar imagem à janela' : 'Zoom 100% na imagem'}
          </button>
        {/if}
        <button type="button" class="principal" onclick={aoFechar}>Fechar</button>
      </div>
    </div>

    <div class="modal-corpo-captura" class:zoom-ativo={zoomImagemModal}>
      <div class="modal-area-imagem">
        {#if captura.imagemDataUrl}
          <img src={captura.imagemDataUrl} alt={captura.nome} class:img-zoom={zoomImagemModal} />
        {:else}
          <pre class="texto-bruto-modal">{captura.texto}</pre>
        {/if}
      </div>

      <div class="modal-area-dados">
        <div class="chips">
          <span class="pilula">{captura.cards.length} demandas lidas</span>
          {#if captura.confiancaVinculoPct !== undefined}
            <span class="pilula novo">{captura.confiancaVinculoPct}% confiança de correlação</span>
          {/if}
        </div>
        {#if captura.motivoVinculo}
          <p class="dica"><b>Correlação:</b> {captura.motivoVinculo}</p>
        {/if}
        {#if captura.porPessoa?.length}
          <div class="por-pessoa-print">
            <span class="etiqueta">Divisão por pessoa neste print:</span>
            {#each captura.porPessoa as gp (gp.pessoa)}
              <span class="item-pessoa-print"><b>{gp.pessoa}</b> &rarr; {gp.tarefas.join(', ')}</span>
            {/each}
          </div>
        {/if}
        {#if captura.cards.length}
          <div class="lista-cards-no-modal">
            <span class="etiqueta">Demandas identificadas neste print (clique para inspecionar etapas):</span>
            <div class="chips">
              {#each captura.cards as cod (cod)}
                <button
                  type="button"
                  class="pilula btn-card-modal-jump"
                  onclick={() => aoInspecionarCard(cod)}
                >
                  {cod}
                </button>
              {/each}
            </div>
          </div>
        {/if}
        <label class="comentario">Comentário sobre este print
          <textarea rows="3" bind:value={captura.comentario} placeholder="Suas observações sobre este print..."></textarea>
        </label>
        <label class="comentario">Texto extraído (OCR editável)
          <textarea rows="8" bind:value={captura.texto}></textarea>
        </label>
        <button type="button" onclick={aoReprocessar}>Reprocessar com o texto corrigido</button>
      </div>
    </div>
  </div>
</div>

<style>
  .linha, .chips { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(8, 12, 20, 0.76); backdrop-filter: blur(3px); z-index: 900; display: grid; place-items: center; padding: 18px; overflow-y: auto; }
  .modal-janela { background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: var(--raio); padding: 18px; width: 100%; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); }
  .modal-largo { max-width: 1140px; }
  .modal-topo h2 { margin: 2px 0 0; font-size: 1.15rem; }
  .modal-corpo-captura { display: grid; grid-template-columns: 1.25fr 1fr; gap: 16px; align-items: start; }
  .modal-corpo-captura.zoom-ativo { grid-template-columns: 1fr; }
  .modal-area-imagem { background: var(--fundo); border: 1px solid var(--borda); border-radius: 8px; padding: 8px; overflow: auto; max-height: 75vh; }
  .modal-area-imagem img { width: 100%; height: auto; object-fit: contain; display: block; }
  .modal-area-imagem img.img-zoom { width: auto; max-width: none; }
  .modal-area-dados { display: flex; flex-direction: column; gap: 10px; }
  .btn-card-modal-jump { cursor: pointer; border: 1px solid var(--marca); color: var(--marca); }
  .por-pessoa-print { display: flex; flex-direction: column; gap: 3px; margin: 6px 0; padding: 6px 10px; background: var(--superficie-2); border-radius: 4px; border: 1px solid var(--borda); font-size: 0.82rem; }
  .item-pessoa-print { color: var(--texto); }
  .comentario { display: block; font-weight: 600; font-size: 0.86rem; }
  textarea { width: 100%; background: var(--superficie-2); font-size: 0.9rem; margin: 6px 0; }
  .pilula.novo { background: var(--verde-fundo); color: var(--verde); }
  @media (max-width: 1024px) { .modal-corpo-captura { grid-template-columns: 1fr; } }
</style>
