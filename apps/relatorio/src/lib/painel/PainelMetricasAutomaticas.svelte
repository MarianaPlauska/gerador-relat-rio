<script lang="ts">
  import type { MetricasAutomaticasPasta } from '@supervisao/core';
  import GraficoLinhaDemandas from './GraficoLinhaDemandas.svelte';

  let {
    metricas,
    tituloGrafico,
    aoSelecionarCard,
  }: {
    metricas: MetricasAutomaticasPasta;
    tituloGrafico?: string;
    aoSelecionarCard?: (codigo: string) => void;
  } = $props();
</script>

<div class="kpis-auto-grade">
  <div class="kpi-auto-card">
    <span class="etiqueta">Total de demandas</span>
    <b>{metricas.totais.itensCronograma ?? 0}</b>
    <small>{metricas.totais.concluidos ?? 0} concluídas ({metricas.totais.concluidosPct ?? 0}%)</small>
  </div>
  <div class="kpi-auto-card alerta-kpi">
    <span class="etiqueta">Em risco / Atrasadas</span>
    <b>{metricas.totais.ritmoEmRisco ?? 0} em risco · {metricas.totais.ritmoAtrasadas ?? 0} atrasadas</b>
    <small>{metricas.totais.ritmoNoRitmo ?? 0} no ritmo</small>
  </div>
  <div class="kpi-auto-card">
    <span class="etiqueta">Tempo estipulado e média</span>
    <b>{metricas.totalHorasEstipuladas}h totais</b>
    <small>Média de {metricas.mediaHorasPorCard}h por demanda · {metricas.totais.tempoMedianoEtapaMin ?? 90} min/etapa</small>
  </div>
  <div class="kpi-auto-card">
    <span class="etiqueta">Etapas concluídas</span>
    <b>{metricas.etapasConcluidasCount} / {metricas.etapasTotalCount}</b>
    <small>{metricas.totalHorasRodando}h rodando no momento</small>
  </div>
</div>

<div class="grade-atencao-gargalos">
  <div class="caixa-atencao">
    <span class="etiqueta">Pontos de atenção automáticos</span>
    <ul class="lista-pontos-atencao">
      {#each metricas.pontosDeAtencao as pt, i (i)}
        <li>{pt}</li>
      {/each}
    </ul>
  </div>
  <div class="caixa-atencao">
    <span class="etiqueta">Onde estão demorando mais (reorganizado por prioridade e tempo)</span>
    <div class="lista-gargalos">
      {#each metricas.gargalosDemora.slice(0, 5) as g (g.codigo)}
        <div class="item-gargalo">
          <div>
            <b class="maquina">{g.codigo}</b>
            <span class="pilula prio-{g.prioridade.toLowerCase()}">{g.prioridade}</span>
            {#if g.responsavel}<small>({g.responsavel})</small>{/if}
          </div>
          <span class="motivo-gargalo">{g.motivo}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<GraficoLinhaDemandas
  serie={metricas.serieGraficoLinha}
  {...(tituloGrafico ? { titulo: tituloGrafico } : {})}
  {...(aoSelecionarCard ? { aoClicarPonto: aoSelecionarCard } : {})}
/>

<style>
  .kpis-auto-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin: 10px 0; }
  .kpi-auto-card { background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
  .kpi-auto-card.alerta-kpi { border-left: 3px solid var(--amarelo); }
  .kpi-auto-card b { font-size: 1.02rem; color: var(--texto); }
  .kpi-auto-card small { font-size: 0.75rem; color: var(--suave); }

  .grade-atencao-gargalos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin: 10px 0; }
  .caixa-atencao { background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 10px 12px; }
  .lista-pontos-atencao { margin: 6px 0 0 18px; padding: 0; font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px; }
  .lista-gargalos { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
  .item-gargalo { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; padding: 6px 8px; background: var(--superficie-2); border-radius: 4px; font-size: 0.8rem; }
  .motivo-gargalo { font-size: 0.76rem; color: var(--suave); }

  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }
</style>
