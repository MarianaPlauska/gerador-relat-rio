<script lang="ts">
  import { atrasado, textoEvento, type SemanaVista } from './rotulos.ts';

  let { vista, hojeIso, rotulo, diaAberto = $bindable() }: {
    vista: SemanaVista[];
    hojeIso: string;
    rotulo: string;
    diaAberto: string | null;
  } = $props();

  function abrirPeloTeclado(evento: KeyboardEvent, iso: string)
  {
    if (evento.target !== evento.currentTarget || (evento.key !== 'Enter' && evento.key !== ' ')) return;
    evento.preventDefault();
    diaAberto = iso;
  }
</script>

<div class="calendario-scroll">
  <div class="grade" role="grid" aria-label="Calendário de {rotulo}">
    <div class="nomes" role="row">
      {#each ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as nome, i (nome)}
        <span role="columnheader" class:fim={i >= 5}>{nome}</span>
      {/each}
    </div>

    {#each vista as semana (semana.id)}
      <div class="semana" role="row">
        {#if semana.faixas > 0}
          <div class="barras" style:grid-template-rows="repeat({semana.faixas}, 22px)">
            {#each semana.barras as barra (barra.evento.id)}
              <a
                class="barra ev-{barra.evento.tipo}"
                class:corta-antes={barra.continuaAntes}
                class:corta-depois={barra.continuaDepois}
                class:ev-atrasado={atrasado(barra.evento, hojeIso)}
                style:grid-column="{barra.coluna} / span {barra.span}"
                style:grid-row={barra.faixa + 1}
                href={barra.evento.href}
                title={textoEvento(barra.evento)}
              >{barra.evento.titulo}</a>
            {/each}
          </div>
        {/if}
        <div class="dias">
          {#each semana.celulas as celula (celula.iso)}
            <div
              class="dia"
              class:fora={celula.fora}
              class:fim={celula.fimDeSemana}
              class:hoje={celula.iso === hojeIso}
              class:selecionado={celula.iso === diaAberto}
              role="gridcell"
              tabindex="0"
              onclick={() => (diaAberto = celula.iso)}
              onkeydown={(e) => abrirPeloTeclado(e, celula.iso)}
            >
              <button type="button" class="num-dia" aria-pressed={celula.iso === diaAberto} onclick={() => (diaAberto = celula.iso)}>
                {celula.numero}
              </button>
              {#each celula.pontos as ponto (ponto.id)}
                <a class="chip ev-{ponto.tipo}" class:ev-atrasado={atrasado(ponto, hojeIso)} class:feito={ponto.concluido} href={ponto.href} title={textoEvento(ponto)}>{ponto.titulo}</a>
              {/each}
              {#if celula.extra > 0}
                <button type="button" class="mais" onclick={() => (diaAberto = celula.iso)}>+{celula.extra}</button>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .calendario-scroll
  {
    overflow-x: auto;
    margin-top: var(--size-3);
  }
  .grade
  {
    min-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nomes, .dias, .barras
  {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .nomes span
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--suave);
    padding: 0 6px 4px;
  }
  .nomes .fim, .dia.fim
  {
    color: var(--suave);
  }
  .semana
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .barras
  {
    gap: 3px 4px;
  }
  .barra, .chip
  {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
    border-radius: 3px;
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .barra
  {
    padding: 2px 6px;
  }
  .barra.corta-antes
  {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .barra.corta-depois
  {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .dias
  {
    gap: 4px;
  }
  .dia
  {
    min-height: 112px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 4px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    text-align: left;
  }
  .dia.fora
  {
    opacity: 0.48;
  }
  .dia.hoje
  {
    border-color: var(--marca);
  }
  .dia.selecionado
  {
    box-shadow: inset 0 0 0 2px var(--marca);
    background: var(--marca-clara);
  }
  .num-dia, .mais
  {
    border: none;
    background: transparent;
    box-shadow: none;
    padding: 0 4px;
    min-height: 0;
    font-family: var(--fonte-maquina);
  }
  .num-dia
  {
    align-self: flex-end;
    flex: none;
    line-height: 1.6;
    color: var(--texto);
  }
  .dia.hoje .num-dia
  {
    background: var(--marca);
    color: var(--sobre-marca);
    border-radius: var(--raio-pequeno);
  }
  .chip
  {
    padding: 1px 4px;
  }
  .chip.feito
  {
    opacity: 0.6;
    text-decoration: line-through;
  }
  .mais
  {
    color: var(--suave);
    text-align: left;
    font-size: 0.72rem;
  }
</style>
