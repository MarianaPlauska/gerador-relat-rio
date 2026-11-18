<script lang="ts">
  import { numerosForaDoPacote } from '@supervisao/core';
  import { escreverComIa, iaDisponivel, modeloIa } from '#lib/ia.ts';

  interface Item
  {
    rotulo?: string;
    instrucao: string;
    aceitar: (texto: string) => void;
  }

  // um campo (instrucao + aceitar) ou vários de uma vez (lote): o botão aparece uma vez só
  let { instrucao, aceitar, lote, fatos, rotuloBotao }: {
    instrucao?: string;
    aceitar?: (texto: string) => void;
    lote?: Item[];
    fatos: () => string;
    rotuloBotao?: string;
  } = $props();

  const itens = $derived<Item[]>(lote ?? (instrucao && aceitar ? [{ instrucao, aceitar }] : []));

  let etapa = $state<'parado' | 'carregando' | 'escrevendo' | 'pronto'>('parado');
  let pct = $state(0);
  let status = $state('');
  let erro = $state('');
  let atual = $state(0);
  let resultados = $state<{ texto: string; fora: string[] }[]>([]);

  const disponivel = iaDisponivel();

  async function escrever()
  {
    erro = '';
    resultados = [];
    etapa = 'carregando';
    const material = fatos();
    try
    {
      for (const [i, item] of itens.entries())
      {
        atual = i;
        resultados[i] = { texto: '', fora: [] };
        const final = await escreverComIa(
          item.instrucao,
          material,
          (parcial) =>
          {
            etapa = 'escrevendo';
            resultados[i] = { texto: parcial, fora: [] };
          },
          (p, t) =>
          {
            pct = p;
            status = t;
          },
        );
        resultados[i] = { texto: final, fora: numerosForaDoPacote(final, material) };
      }
      etapa = 'pronto';
    }
    catch (e)
    {
      erro = e instanceof Error ? e.message : 'Não consegui rodar o modelo neste navegador.';
      etapa = 'parado';
    }
  }

  function usar(i: number)
  {
    itens[i]?.aceitar(resultados[i]?.texto ?? '');
    resultados[i] = { texto: '', fora: [] };
    if (resultados.every((r) => !r.texto)) etapa = 'parado';
  }

  function usarTodos()
  {
    itens.forEach((_, i) => usar(i));
    etapa = 'parado';
  }

  const foraDoPacote = $derived(resultados.flatMap((r) => r.fora));
</script>

<div class="ia">
  {#if etapa === 'parado'}
    <div class="chamada">
      <button class="botao-ia" disabled={!disponivel || itens.length === 0} onclick={escrever} title={disponivel ? `Modelo ${modeloIa}, roda neste navegador` : 'Precisa de Chrome ou Edge com WebGPU'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9z" /><path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" /></svg>
        {rotuloBotao ?? (itens.length > 1 ? `Escrever os ${itens.length} campos com IA` : 'Escrever com IA')}
      </button>
      {#if !disponivel}<span class="dica">Precisa de Chrome ou Edge com WebGPU.</span>{/if}
    </div>
  {:else if etapa === 'carregando'}
    <div class="carregando">
      <span class="barra"><span style:width="{pct}%"></span></span>
      <span class="dica">{pct}% - {status || 'preparando o modelo (na primeira vez baixa cerca de 1 GB e fica guardado)'}</span>
    </div>
  {:else}
    <div class="previa">
      <p class="rotulo">{etapa === 'escrevendo' ? `escrevendo${itens.length > 1 ? ` ${atual + 1} de ${itens.length}` : ''}...` : 'rascunho, revise antes de usar'}</p>
      {#each resultados as r, i (i)}
        {#if r.texto}
          <div class="item-previa">
            {#if itens[i]?.rotulo}<b class="titulo-item">{itens[i]!.rotulo}</b>{/if}
            <pre>{r.texto}</pre>
            {#if etapa === 'pronto'}
              {#if r.fora.length}<p class="alerta">Números que não estão no pacote conferido: {r.fora.join(', ')}. Confira ou apague essas linhas.</p>{/if}
              {#if itens.length > 1}<button class="link" onclick={() => usar(i)}>usar só este</button>{/if}
            {/if}
          </div>
        {/if}
      {/each}
      {#if etapa === 'pronto'}
        <div class="acoes">
          <button class="principal" onclick={usarTodos}>{itens.length > 1 ? 'Usar todos' : 'Usar este texto'}</button>
          <button onclick={escrever}>Escrever de novo</button>
          <button onclick={() => (etapa = 'parado')}>Descartar</button>
        </div>
        {#if itens.length > 1 && foraDoPacote.length}<span class="dica">{foraDoPacote.length} número(s) fora do pacote nos rascunhos acima.</span>{/if}
      {/if}
    </div>
  {/if}
  {#if erro}<p class="alerta">{erro}</p>{/if}
</div>

<style>
  .ia
  {
    display: grid;
    gap: var(--size-2);
    margin-top: var(--size-1);
  }
  .chamada
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-2) var(--size-3);
  }
  .botao-ia
  {
    display: inline-flex;
    align-items: center;
    gap: var(--size-2);
    border-color: var(--marca);
    color: var(--marca);
    background: var(--marca-clara);
  }
  .botao-ia svg
  {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .botao-ia:disabled
  {
    border-color: var(--borda-forte);
    color: var(--suave);
    background: transparent;
  }
  .chamada .dica
  {
    flex: 1 1 200px;
    margin: 0;
    font-size: 0.8rem;
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--borda);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
    transition: width 0.3s;
  }
  .previa
  {
    border: 1px dashed var(--marca);
    border-radius: var(--raio-pequeno);
    padding: var(--size-3);
    background: var(--marca-clara);
    display: grid;
    gap: var(--size-2);
  }
  .rotulo
  {
    margin: 0;
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: var(--marca);
  }
  .item-previa
  {
    display: grid;
    gap: var(--size-1);
  }
  .titulo-item
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: var(--texto);
  }
  pre
  {
    margin: 0;
    white-space: pre-wrap;
    font-family: var(--fonte-texto);
    font-size: 0.9rem;
    color: var(--texto);
  }
  .alerta
  {
    margin: var(--size-1) 0 0;
    padding: var(--size-2);
    border-radius: var(--raio-pequeno);
    background: var(--amarelo-fundo);
    color: var(--amarelo);
    font-size: 0.84rem;
  }
  .acoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    margin-top: var(--size-1);
  }
</style>
