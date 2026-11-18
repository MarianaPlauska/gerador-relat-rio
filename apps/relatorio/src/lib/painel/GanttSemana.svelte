<script lang="ts">
  import type { BarraGantt, GanttSemana, LinhaGantt } from '@supervisao/core';

  let { gantt, aoSelecionarCard, selecionado, aoReordenar }: {
    gantt: GanttSemana;
    aoSelecionarCard?: (codigo: string) => void;
    selecionado?: string | null;
    // a ordem da fila de uma pessoa mudou (arrastando uma barra ou com Alt + setas)
    aoReordenar?: (pessoaId: string, codigos: string[]) => void;
  } = $props();

  const pct = (valor: number, linha: LinhaGantt) => (valor / (linha.horasDia * gantt.dias.length)) * 100;
  const esquerda = (dia: number, hora: number, linha: LinhaGantt) => pct(dia * linha.horasDia + hora, linha);
  const horas = (h: number) => `${String(h).replace('.', ',')} h`;

  let arrastando = $state<{ pessoaId: string; codigo: string } | null>(null);
  let sobre = $state<string | null>(null);

  function mover(linha: LinhaGantt, codigo: string, destino: number)
  {
    const codigos = linha.barras.map((b) => b.codigo);
    const de = codigos.indexOf(codigo);
    if (de === -1 || destino < 0 || destino >= codigos.length || de === destino) return;
    codigos.splice(de, 1);
    codigos.splice(destino, 0, codigo);
    aoReordenar?.(linha.pessoaId, codigos);
  }

  function soltar(linha: LinhaGantt, codigoAlvo: string)
  {
    if (arrastando && arrastando.pessoaId === linha.pessoaId) mover(linha, arrastando.codigo, linha.barras.findIndex((b) => b.codigo === codigoAlvo));
    arrastando = null;
    sobre = null;
  }

  function teclas(e: KeyboardEvent, linha: LinhaGantt, codigo: string)
  {
    if (!aoReordenar || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    mover(linha, codigo, linha.barras.findIndex((b) => b.codigo === codigo) + (e.key === 'ArrowUp' ? -1 : 1));
  }

  const motivoDia = (motivo: 'feriado' | 'ausencia' | null) => (motivo === 'feriado' ? 'Feriado' : motivo === 'ausencia' ? 'Ausente' : '');

  function titulo(b: BarraGantt): string
  {
    const partes = [`${b.codigo}: ${b.assunto}`, `${horas(b.horas)} de trabalho`];
    if (b.iniciaApos) partes.push(`começa depois de ${b.iniciaApos}`);
    if (b.prazo) partes.push(`prazo ${b.prazo.split('-').reverse().join('/')}${b.estouraPrazo ? ' (a fila passa do prazo)' : ''}`);
    if (b.horasAlemDaSemana > 0) partes.push(`${horas(b.horasAlemDaSemana)} ficam para depois desta semana`);
    if (aoReordenar) partes.push('arraste para mudar a ordem da fila (ou Alt + seta para cima ou para baixo)');
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
          <span class="dia" class:hoje={d.hoje} class:passado={d.passado} class:feriado={d.feriado} role="columnheader" title={d.feriado ? 'Feriado' : undefined}>{d.rotulo}{d.feriado ? ' (feriado)' : ''}</span>
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
            {#each gantt.dias as d, i (d.iso)}
              <span class:passado={d.passado} class:feriado={linha.semExpediente[i] === 'feriado'} class:ausente={linha.semExpediente[i] === 'ausencia'} title={motivoDia(linha.semExpediente[i] ?? null)}>{motivoDia(linha.semExpediente[i] ?? null)}</span>
            {/each}
          </div>
          {#each linha.barras as b (b.codigo)}
            <div
              class="faixa"
              class:alvo={sobre === b.codigo && arrastando?.pessoaId === linha.pessoaId}
              role="group"
              aria-label="Tarefa {b.codigo}"
              ondragover={(e) => { if (arrastando?.pessoaId === linha.pessoaId) { e.preventDefault(); sobre = b.codigo; } }}
              ondragleave={() => { if (sobre === b.codigo) sobre = null; }}
              ondrop={(e) => { e.preventDefault(); soltar(linha, b.codigo); }}
            >
              {#each b.segmentos as s, i (i)}
                <button
                  type="button"
                  class="barra"
                  class:critica={b.critica}
                  class:andamento={b.emAndamento}
                  class:estoura={b.estouraPrazo}
                  class:marcada={selecionado === b.codigo}
                  class:arrastavel={!!aoReordenar}
                  draggable={!!aoReordenar}
                  style:left="{esquerda(s.dia, s.de, linha)}%"
                  style:width="{pct(s.ate - s.de, linha)}%"
                  title={titulo(b)}
                  onclick={() => aoSelecionarCard?.(b.codigo)}
                  onkeydown={(e) => teclas(e, linha, b.codigo)}
                  ondragstart={(e) => { arrastando = { pessoaId: linha.pessoaId, codigo: b.codigo }; e.dataTransfer?.setData('text/plain', b.codigo); }}
                  ondragend={() => { arrastando = null; sobre = null; }}
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
  .fundo-dias span.feriado, .fundo-dias span.ausente { display: flex; align-items: flex-end; justify-content: center; font-family: var(--fonte-maquina); font-size: 0.62rem; color: var(--suave); background: repeating-linear-gradient(45deg, rgb(128 128 128 / 14%) 0 5px, transparent 5px 10px); }
  .fundo-dias span.ausente { background: repeating-linear-gradient(45deg, var(--amarelo-fundo) 0 5px, transparent 5px 10px); color: var(--amarelo); }
  .dia.feriado { color: var(--suave); text-decoration: line-through; }
  .faixa.alvo { outline: 1px dashed var(--marca); outline-offset: 1px; border-radius: 3px; }
  .barra.arrastavel { cursor: grab; }
  .barra.arrastavel:active { cursor: grabbing; }
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
