<script lang="ts">
  import { numerosForaDoPacote } from '@supervisao/core';
  import { escreverComIa, iaDisponivel, modeloIa } from '#lib/ia.ts';

  let { instrucao, fatos, aceitar }: { instrucao: string; fatos: () => string; aceitar: (texto: string) => void } = $props();

  let etapa = $state<'parado' | 'carregando' | 'escrevendo' | 'pronto'>('parado');
  let pct = $state(0);
  let status = $state('');
  let texto = $state('');
  let erro = $state('');
  let fora = $state<string[]>([]);

  const disponivel = iaDisponivel();

  async function escrever()
  {
    erro = '';
    fora = [];
    texto = '';
    etapa = 'carregando';
    const material = fatos();
    try
    {
      const final = await escreverComIa(
        instrucao,
        material,
        (parcial) =>
        {
          etapa = 'escrevendo';
          texto = parcial;
        },
        (p, t) =>
        {
          pct = p;
          status = t;
        },
      );
      texto = final;
      fora = numerosForaDoPacote(final, material);
      etapa = 'pronto';
    }
    catch (e)
    {
      erro = e instanceof Error ? e.message : 'Não consegui rodar o modelo neste navegador.';
      etapa = 'parado';
    }
  }

  function usar()
  {
    aceitar(texto);
    etapa = 'parado';
    texto = '';
  }
</script>

<div class="ia">
  {#if etapa === 'parado'}
    <div class="chamada">
      <button class="botao-ia" disabled={!disponivel} onclick={escrever} title={disponivel ? `Modelo ${modeloIa}, roda neste navegador` : 'Precisa de Chrome ou Edge com WebGPU'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9z" /><path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" /></svg>
        Escrever com IA
      </button>
      <span class="selo">IA local</span>
      <span class="dica">{disponivel ? 'Roda no seu navegador, de graça. Escreve só com os números conferidos do painel e avisa se aparecer número que não está lá. Você revisa antes de usar.' : 'Indisponível: precisa de Chrome ou Edge com WebGPU.'}</span>
    </div>
  {:else if etapa === 'carregando'}
    <div class="carregando">
      <span class="barra"><span style:width="{pct}%"></span></span>
      <span class="dica">{pct}% - {status || 'preparando o modelo (na primeira vez baixa cerca de 1 GB e fica guardado)'}</span>
    </div>
  {:else}
    <div class="previa">
      <p class="rotulo">{etapa === 'escrevendo' ? 'escrevendo...' : 'rascunho da IA local, revise antes de usar'}</p>
      <pre>{texto}</pre>
      {#if etapa === 'pronto'}
        {#if fora.length}<p class="alerta">Números que não estão no pacote conferido: {fora.join(', ')}. Confira ou apague essas linhas.</p>{/if}
        <div class="acoes">
          <button class="principal" onclick={usar}>Usar este texto</button>
          <button onclick={escrever}>Escrever de novo</button>
          <button onclick={() => (etapa = 'parado')}>Descartar</button>
        </div>
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
  .selo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--marca);
    color: var(--marca);
  }
  .chamada .dica
  {
    flex: 1 1 260px;
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
  }
  .rotulo
  {
    margin: 0 0 var(--size-2);
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: var(--marca);
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
    margin: var(--size-2) 0 0;
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
    margin-top: var(--size-3);
  }
</style>
