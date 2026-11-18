<script lang="ts">
  import type { BarraGantt, GanttSemana, LinhaGantt } from '@supervisao/core';

  let { gantt, aoSelecionarCard, selecionado }: { gantt: GanttSemana; aoSelecionarCard?: (codigo: string) => void; selecionado?: string | null } = $props();

  const pct = (valor: number, linha: LinhaGantt) => (valor / (linha.horasDia * gantt.dias.length)) * 100;
  const esquerda = (dia: number, hora: number, linha: LinhaGantt) => pct(dia * linha.horasDia + hora, linha);
  const horas = (h: number) => `${String(h).replace('.', ',')} h`;

  function titulo(b: BarraGantt): string
  {
    const partes = [`${b.codigo}: ${b.assunto}`, `${horas(b.horas)} de trabalho`];
    if (b.iniciaApos) partes.push(`começa depois de ${b.iniciaApos}`);
    if (b.prazo) partes.push(`prazo ${b.prazo.split('-').reverse().join('/')}${b.estouraPrazo ? ' (a fila passa do prazo)' : ''}`);
    if (b.horasAlemDaSemana > 0) partes.push(`${horas(b.horasAlemDaSemana)} ficam para depois desta semana`);
    return partes.join(' | ');
  }

  const nomesPorCodigo = $derived(new Map(gantt.linhas.flatMap((l) => l.barras.map((b) => [b.codigo, l.pessoa] as const))));
  const conflitos = $derived(gantt.dependencias.filter((d) => d.conflito));
  const estouros = $derived(gantt.linhas.flatMap((l) => l.barras.filter((b) => b.estouraPrazo).map((b) => ({ ...b, pessoa: l.pessoa }))));
  const vazio = $derived(gantt.linhas.every((l) => l.barras.length === 0));
</script>

{#if vazio}
  <p class="dica">Nenhuma tarefa aberta para distribuir na semana.</p>
{:else}
  <div class="gantt" role="table" aria-label="Cronograma da semana por pessoa">
    <div class="linha-gantt cabecalho" role="row">
      <span class="nome-col"></span>
      <div class="trilho dias" role="rowgroup">
        {#each gantt.dias as d (d.iso)}
          <span class="dia" class:hoje={d.hoje} class:passado={d.passado} role="columnheader">{d.rotulo}</span>
        {/each}
      </div>
    </div>

    {#each gantt.linhas as linha (linha.pessoaId)}
      <div class="linha-gantt" role="row">
        <div class="nome-col" role="rowheader">
          <b>{linha.pessoa}</b>
          <small>
            {#if linha.barras.length === 0}
              livre a semana toda
            {:else}
              {horas(linha.horasLivresSemana)} livres
            {/if}
          </small>
          {#if linha.sobrecarga}<span class="selo-sobrecarga" title={linha.horasAlemDaSemana > 0 ? `${horas(linha.horasAlemDaSemana)} não cabem na semana` : 'Sobrecarga crítica'}>sobrecarga</span>{/if}
        </div>
        <div class="trilho" role="cell">
          <div class="fundo-dias">
            {#each gantt.dias as d (d.iso)}<span class:passado={d.passado}></span>{/each}
          </div>
          {#each linha.barras as b (b.codigo)}
            <div class="faixa">
              {#each b.segmentos as s, i (i)}
                <button
                  type="button"
                  class="barra"
                  class:critica={b.critica}
                  class:andamento={b.emAndamento}
                  class:estoura={b.estouraPrazo}
                  class:marcada={selecionado === b.codigo}
                  style:left="{esquerda(s.dia, s.de, linha)}%"
                  style:width="{pct(s.ate - s.de, linha)}%"
                  title={titulo(b)}
                  onclick={() => aoSelecionarCard?.(b.codigo)}
                >{#if i === 0}{b.codigo.replace(/^[A-Z]+-/, '')}{/if}</button>
              {/each}
              {#if b.horasAlemDaSemana > 0}
                <span class="alem" title={titulo(b)}>{b.codigo} +{horas(b.horasAlemDaSemana)} depois</span>
              {/if}
            </div>
          {/each}
          {#if linha.livreAPartirDe}
            <div class="faixa">
              <span class="livre" style:left="{esquerda(linha.livreAPartirDe.dia, linha.livreAPartirDe.hora, linha)}%" title="Livre a partir daqui">livre</span>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  {#if conflitos.length || estouros.length}
    <ul class="avisos-gantt">
      {#each estouros as b (b.codigo)}
        <li>{b.codigo} ({b.pessoa}): a fila passa do prazo de {b.prazo?.split('-').reverse().join('/')}.</li>
      {/each}
      {#each conflitos as d (`${d.de}|${d.para}`)}
        <li>{d.de} ({nomesPorCodigo.get(d.de)}) e {d.para} ({nomesPorCodigo.get(d.para)}) são relacionadas e rodam ao mesmo tempo: vale alinhar.</li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .gantt { display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; overflow-x: auto; }
  .linha-gantt { display: grid; grid-template-columns: 150px minmax(420px, 1fr); gap: 10px; align-items: start; min-width: 600px; }
  .nome-col { display: flex; flex-direction: column; gap: 2px; padding-top: 3px; }
  .nome-col small { color: var(--suave); }
  .selo-sobrecarga { align-self: flex-start; font-family: var(--fonte-maquina); font-size: 0.66rem; padding: 0 6px; border-radius: 999px; border: 1px solid var(--vermelho); color: var(--vermelho); background: var(--vermelho-fundo); }
  .trilho { position: relative; display: flex; flex-direction: column; gap: 3px; }
  .trilho.dias { flex-direction: row; gap: 0; }
  .dia { flex: 1; text-align: center; font-family: var(--fonte-maquina); font-size: 0.72rem; color: var(--suave); padding: 2px 0; border-left: 1px solid var(--borda); }
  .dia.hoje { color: var(--marca); font-weight: 700; }
  .dia.passado { opacity: 0.55; }
  .fundo-dias { position: absolute; inset: 0; display: flex; pointer-events: none; }
  .fundo-dias span { flex: 1; border-left: 1px solid var(--borda); }
  .fundo-dias span.passado { background: repeating-linear-gradient(135deg, transparent 0 6px, rgb(128 128 128 / 8%) 6px 7px); }
  .faixa { position: relative; height: 22px; }
  .barra { position: absolute; top: 0; height: 22px; min-width: 4px; padding: 0 4px; font-family: var(--fonte-maquina); font-size: 0.68rem; line-height: 20px; text-align: left; overflow: hidden; white-space: nowrap; border-radius: 3px; border: 1px solid var(--borda-forte); background: var(--superficie-2); color: var(--texto); cursor: pointer; }
  .barra.andamento { background: var(--marca-clara); border-color: var(--marca); color: var(--marca); }
  .barra.critica { background: var(--vermelho-fundo); border-color: var(--vermelho); color: var(--vermelho); }
  .barra.estoura { outline: 1px dashed var(--vermelho); outline-offset: 1px; }
  .barra.marcada, .barra:hover { filter: brightness(1.25); box-shadow: 0 0 0 1px var(--marca); }
  .alem { position: absolute; right: 0; top: 0; height: 22px; line-height: 20px; padding: 0 6px; font-family: var(--fonte-maquina); font-size: 0.66rem; color: var(--vermelho); background: var(--vermelho-fundo); border: 1px dashed var(--vermelho); border-radius: 3px; }
  .livre { position: absolute; top: 0; right: 0; height: 22px; line-height: 20px; padding: 0 8px; font-family: var(--fonte-maquina); font-size: 0.66rem; color: var(--verde); border: 1px dashed var(--verde); background: var(--verde-fundo); border-radius: 3px; }
  .avisos-gantt { margin: 8px 0 0 18px; padding: 0; font-size: 0.78rem; color: var(--amarelo); display: flex; flex-direction: column; gap: 3px; }
</style>
