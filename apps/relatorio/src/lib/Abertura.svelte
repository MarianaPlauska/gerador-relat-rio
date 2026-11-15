<script lang="ts">
  import { chuva } from '#lib/chuva.ts';

  let { terminar }: { terminar: () => void } = $props();

  const linhas = ['> iniciando o sistema', '> lendo o painel do gestor', '> montando a semana', '> pronto'];
  let nome = $state('');
  let ditas = $state<string[]>([]);
  let saindo = $state(false);
  let encerrada = false;

  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function fim()
  {
    if (encerrada) return;
    encerrada = true;
    saindo = true;
    setTimeout(terminar, 400);
  }

  $effect(() =>
  {
    let parar = false;
    (async () =>
    {
      let titulo = '';
      const feitas: string[] = [];
      for (const letra of 'OrbisOS')
      {
        if (parar) return;
        titulo += letra;
        nome = titulo;
        await espera(120);
      }
      await espera(200);
      for (const linha of linhas)
      {
        let escrita = '';
        feitas.push('');
        for (const letra of linha)
        {
          if (parar) return;
          escrita += letra;
          feitas[feitas.length - 1] = escrita;
          ditas = [...feitas];
          await espera(16);
        }
        await espera(180);
      }
      await espera(500);
      if (!parar) fim();
    })();
    return () =>
    {
      parar = true;
    };
  });
</script>

<svelte:window onkeydown={fim} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="abertura" class:saindo onclick={fim}>
  <canvas use:chuva={{ fundo: 'rgba(15, 19, 24, 0.14)', cor: '#4cc38a', tamanho: 16, fps: 16 }}></canvas>
  <div class="miolo">
    <h1>{nome}<span class="cursor">_</span></h1>
    <div class="terminal">
      {#each ditas as linha, i (i)}<p>{linha}</p>{/each}
    </div>
    <span class="pular">clique ou aperte uma tecla para pular</span>
  </div>
</div>

<style>
  .abertura
  {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    background: var(--barra);
    transition: opacity 0.4s;
  }
  .abertura.saindo
  {
    opacity: 0;
  }
  canvas
  {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.35;
  }
  .miolo
  {
    position: relative;
    text-align: left;
    min-width: min(420px, 86vw);
  }
  h1
  {
    font-size: clamp(2.6rem, 9vw, 4.6rem);
    color: #fff;
    margin: 0 0 var(--size-4);
    letter-spacing: -0.02em;
    text-shadow: 0 0 28px color-mix(in srgb, var(--marca) 45%, transparent);
  }
  .terminal
  {
    min-height: 6.4em;
    font-family: var(--fonte-maquina);
    color: var(--marca);
    font-size: 0.95rem;
  }
  .terminal p
  {
    margin: 0;
  }
  .pular
  {
    display: block;
    margin-top: var(--size-5);
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: #7c8797;
  }
</style>
