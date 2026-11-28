<script lang="ts">
  import type { ResumoPessoaProjeto } from '@supervisao/core';
  import { dataCurta } from '#lib/semana.ts';

  let { p }: { p: ResumoPessoaProjeto } = $props();
</script>

<div class="detalhe">
  <section>
    <span class="etiqueta">Tarefas de {p.pessoa.nome} ({p.tarefas.length})</span>
    {#if p.tarefas.length === 0}
      <p class="mudo">Nenhuma tarefa atribuída nesta semana.</p>
    {:else}
      <ul class="tarefas">
        {#each p.tarefas as tar (tar.codigo)}
          <li>
            <div class="topo">
              <span><b class="cod">{tar.codigo}</b> {tar.assunto}
                {#if tar.prioridadeCard}<span class="chip">{tar.prioridadeCard}</span>{/if}
                {#if tar.statusCard}<span class="chip">{tar.statusCard}</span>{/if}
              </span>
              <span class="num-mudo">~{tar.horasEstimadas}h{tar.previsao ? ` · prev. ${dataCurta(tar.previsao)}` : ''}</span>
            </div>
            {#if tar.descricaoCompleta}<p class="pedido"><b>Pedido:</b> {tar.descricaoCompleta}</p>{/if}
            {#if tar.etapas?.length}
              <ul class="etapas">
                {#each tar.etapas as et (et.ordem)}
                  <li>
                    <b>{et.ordem}. {et.nome}</b>
                    <span class="mudo">{et.situacao.replace('_', ' ')}{et.tempoRodandoHoras !== undefined ? ` · rodando há ${et.tempoRodandoHoras}h` : ''}{et.desde ? ` · desde ${et.desde.slice(0, 10).split('-').reverse().join('/')}` : ''}</span>
                  </li>
                {/each}
              </ul>
            {:else if tar.etapa}
              <span class="mudo">Etapa atual: <b>{tar.etapa}</b></span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="duas">
    <div>
      <span class="etiqueta">Etapas em andamento</span>
      <div class="chips">
        {#each p.etapasEmAndamento as et (et)}<span class="chip">{et}</span>{:else}<span class="mudo">Nenhuma etapa em execução</span>{/each}
      </div>
    </div>
    <div>
      <span class="etiqueta">Diagnóstico de demora e ritmo</span>
      <p class="texto">Nível {p.nivelDemora}: {p.motivoDemora}</p>
    </div>
  </section>

  <section class="duas">
    <div>
      <span class="etiqueta">Probabilidade de absorver mais serviços</span>
      <div class="medida">
        <span>Probabilidade <b class="num-mudo">{p.probabilidadeMaisServicosPct}%</b> · +{p.servicosExtrasSugeridos} {p.servicosExtrasSugeridos === 1 ? 'serviço' : 'serviços'} / ~{p.horasLivresCalibradas}h livres</span>
        <div class="trilho"><div class="enchimento" style:width="{p.probabilidadeMaisServicosPct}%"></div></div>
        <small class="mudo">
          {#if p.calibracao.usouHistorico}
            Calibrada pelo histórico: entrega média de {p.calibracao.velocidadeMediaHorasSemana}h por semana (±{p.calibracao.desvioHorasSemana}h) em {p.calibracao.semanasAmostra} {p.calibracao.semanasAmostra === 1 ? 'semana' : 'semanas'}, confiança {p.calibracao.confiancaPct}%. Pela folga da jornada seria {p.probabilidadeBasePct}%.
          {:else}
            Ainda sem histórico de entregas: vale a folga da jornada. Melhora a cada semana guardada.
          {/if}
        </small>
      </div>
      <div class="medida">
        <span>Nível de entrega na semana <b class="num-mudo">{p.nivelEntregaPct}%</b></span>
        <div class="trilho"><div class="enchimento" style:width="{p.nivelEntregaPct}%"></div></div>
      </div>
    </div>
    <div>
      <span class="etiqueta">Rendimento comparativo e acumulado</span>
      <div class="medida">
        <span>Participação na semana <b class="num-mudo">{p.rendimentoSemanaPct}%</b> da equipe</span>
        <div class="trilho"><div class="enchimento" style:width="{p.rendimentoSemanaPct}%"></div></div>
      </div>
      <div class="medida">
        <span>Acumulado ({p.acumuladoSemanas.semanasAtivas} sem.) <b class="num-mudo">{p.rendimentoAcumuladoPct}%</b> · {p.acumuladoSemanas.entregasNoPrazo}/{p.acumuladoSemanas.totalDemandas} no prazo</span>
        <div class="trilho"><div class="enchimento" style:width="{p.rendimentoAcumuladoPct}%"></div></div>
      </div>
    </div>
  </section>

  <section>
    <span class="etiqueta">Sugestões para apoiar a equipe</span>
    <ul class="sugestoes">
      {#each p.sugestoesAjuda as sug, idx (idx)}<li>{sug}</li>{/each}
    </ul>
  </section>
</div>

<style>
  .detalhe
  {
    display: grid;
    gap: 0;
    background: var(--fundo);
    border-top: 1px solid var(--borda);
    font-size: 0.86rem;
  }
  section
  {
    display: grid;
    gap: 6px;
    padding: 12px 16px;
    border-top: 1px solid var(--borda);
    align-content: start;
  }
  section:first-child
  {
    border-top: none;
  }
  .duas
  {
    grid-template-columns: 1fr 1fr;
    gap: 16px 28px;
  }
  .duas > div
  {
    display: grid;
    gap: 6px;
    align-content: start;
    min-width: 0;
  }
  ul
  {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tarefas > li
  {
    display: grid;
    gap: 3px;
    padding: 8px 0;
    border-top: 1px solid var(--borda);
  }
  .tarefas > li:first-child
  {
    border-top: none;
  }
  .topo
  {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cod
  {
    font-family: var(--fonte-maquina);
  }
  .chip
  {
    display: inline-block;
    margin-left: 4px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--suave);
    font-size: 0.74rem;
  }
  .chips
  {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chips .chip
  {
    margin: 0;
  }
  .pedido, .texto
  {
    margin: 0;
    color: var(--suave);
  }
  .etapas
  {
    display: grid;
    gap: 2px;
    padding-left: 12px;
    border-left: 1px solid var(--borda);
  }
  .mudo
  {
    color: var(--suave);
  }
  .num-mudo
  {
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
    color: var(--suave);
    font-weight: 400;
  }
  .medida
  {
    display: grid;
    gap: 4px;
  }
  .trilho
  {
    height: 4px;
    background: var(--borda);
    border-radius: 2px;
    overflow: hidden;
  }
  .enchimento
  {
    height: 100%;
    background: var(--azul);
  }
  .sugestoes
  {
    display: grid;
    gap: 3px;
    padding-left: 16px;
    list-style: disc;
    color: var(--suave);
  }
  @media (max-width: 760px)
  {
    .duas
    {
      grid-template-columns: 1fr;
    }
  }
</style>
