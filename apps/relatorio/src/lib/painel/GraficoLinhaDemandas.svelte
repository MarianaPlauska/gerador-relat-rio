<script lang="ts">
  import type { PontoGraficoLinhaCard } from '@supervisao/core';

  let {
    serie,
    titulo = 'Gráfico em linha: Tempo estipulado (h) vs Tempo rodando/consumido (h) por prioridade',
    aoClicarPonto,
  }: {
    serie: PontoGraficoLinhaCard[];
    titulo?: string;
    aoClicarPonto?: (codigo: string) => void;
  } = $props();

  const maxH = $derived(Math.max(10, ...serie.map((p) => Math.max(p.horasEstimadas, p.horasRodando))));
  const larg = 720;
  const alt = 210;
  const padX = 48;
  const padY = 28;
  const utilW = larg - padX * 2;
  const utilH = alt - padY * 2;

  function xDe(i: number): number
  {
    return padX + (serie.length <= 1 ? utilW / 2 : (i / (serie.length - 1)) * utilW);
  }

  function yDe(h: number): number
  {
    return padY + utilH - Math.min(1, h / maxH) * utilH;
  }

  const polyEstimado = $derived(serie.map((p, i) => `${xDe(i)},${yDe(p.horasEstimadas)}`).join(' '));
  const polyRodando = $derived(serie.map((p, i) => `${xDe(i)},${yDe(p.horasRodando)}`).join(' '));
</script>

{#if serie.length > 0}
  <div class="caixa-grafico-linha">
    <div class="linha-entre">
      <span class="etiqueta">{titulo}</span>
      <div class="legenda-grafico">
        <span class="item-legenda"><span class="cor-linha-est"></span> Tempo estipulado (h)</span>
        <span class="item-legenda"><span class="cor-linha-rod"></span> Tempo rodando / realizado (h)</span>
      </div>
    </div>
    <div class="svg-wrapper">
      <svg viewBox="0 0 {larg} {alt}" class="svg-grafico-linha">
        {#each [0, 0.5, 1] as frac (frac)}
          {@const y = padY + utilH * (1 - frac)}
          <line x1={padX} y1={y} x2={larg - padX} y2={y} class="grade-svg" />
          <text x={padX - 8} y={y + 4} text-anchor="end" class="eixo-txt">{Math.round(maxH * frac * 10) / 10}h</text>
        {/each}
        <polyline fill="none" stroke="var(--marca)" stroke-width="2.5" points={polyEstimado} />
        <polyline fill="none" stroke="var(--amarelo)" stroke-width="2.5" stroke-dasharray="5 3" points={polyRodando} />
        {#each serie as p, i (p.codigo)}
          <g
            class="ponto-interativo"
            onclick={() => aoClicarPonto?.(p.codigo)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && aoClicarPonto?.(p.codigo)}
          >
            <circle cx={xDe(i)} cy={yDe(p.horasEstimadas)} r={p.destaqueDemora ? 5.5 : 4} fill={p.destaqueDemora ? 'var(--vermelho)' : 'var(--marca)'} />
            <circle cx={xDe(i)} cy={yDe(p.horasRodando)} r="4" fill="var(--amarelo)" />
            <text x={xDe(i)} y={yDe(p.horasEstimadas) - 8} text-anchor="middle" class="valor-ponto">{p.horasEstimadas}h</text>
            <text x={xDe(i)} y={alt - 6} text-anchor="middle" class="rotulo-x">{p.codigo}</text>
          </g>
        {/each}
      </svg>
    </div>
  </div>
{/if}

<style>
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .caixa-grafico-linha { background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 12px; margin: 12px 0; }
  .legenda-grafico { display: flex; gap: 14px; font-size: 0.76rem; color: var(--suave); }
  .item-legenda { display: flex; align-items: center; gap: 5px; }
  .cor-linha-est { width: 14px; height: 3px; background: var(--marca); display: inline-block; }
  .cor-linha-rod { width: 14px; height: 3px; background: var(--amarelo); display: inline-block; }
  .svg-wrapper { width: 100%; overflow-x: auto; margin-top: 8px; }
  .svg-grafico-linha { width: 100%; min-width: 520px; height: auto; max-height: 230px; }
  .grade-svg { stroke: var(--borda); stroke-dasharray: 3 3; stroke-width: 1; }
  .eixo-txt { fill: var(--suave); font-size: 10px; font-family: var(--fonte-maquina); }
  .valor-ponto { fill: var(--texto); font-size: 10px; font-weight: 700; font-family: var(--fonte-maquina); }
  .rotulo-x { fill: var(--suave); font-size: 10px; font-family: var(--fonte-maquina); }
  .ponto-interativo { cursor: pointer; }
</style>
