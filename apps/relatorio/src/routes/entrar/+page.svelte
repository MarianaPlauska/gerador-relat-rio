<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, salvar } from '#lib/armazenamento.ts';
  import { chuva } from '#lib/chuva.ts';
  import { entrar as entrarComGoogle, nuvem } from '#lib/nuvem.svelte.ts';
  import { abrirSessao } from '#lib/sessao.ts';

  const dados = carregar();
  let nome = $state(dados.identificacao.elaboradoPor);
  let manter = $state(true);
  let erro = $state('');
  const destino = () =>
  {
    const volta = page.url.searchParams.get('volta') ?? '/';
    return volta.startsWith('/') && !volta.startsWith('//') ? volta : '/';
  };

  function concluir(nomeFinal: string, email?: string)
  {
    // o nome vai para "Elaborado por" do relatório e para a saudação da central
    if (!dados.identificacao.elaboradoPor) salvar({ ...dados, identificacao: { ...dados.identificacao, elaboradoPor: nomeFinal } });
    abrirSessao({ nome: nomeFinal, email, desde: new Date().toISOString() }, manter);
    goto(destino(), { replaceState: true });
  }

  async function google()
  {
    try
    {
      await entrarComGoogle();
      concluir(nuvem.email?.split('@')[0] ?? nome.trim(), nuvem.email);
    }
    catch (e)
    {
      erro = `Não consegui entrar com Google: ${e}`;
    }
  }
</script>

<div class="tela">
  <canvas use:chuva={{ fundo: 'rgba(7, 10, 9, 0.16)', cor: '#12a454', tamanho: 15, fps: 14 }}></canvas>
  <div class="vinheta"></div>

  <form class="caixa" onsubmit={(e) => { e.preventDefault(); if (nome.trim()) concluir(nome.trim()); }}>
    <span class="prompt">&gt; supervisão_dev</span>
    <h1>OrbisOS<span class="cursor">_</span></h1>
    <p class="lema">painel, plano, riscos e relatório num lugar só.</p>

    <label>
      <span>nome</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={nome} autocomplete="name" placeholder="Como você quer ser chamada" autofocus />
    </label>
    <label class="manter"><input type="checkbox" bind:checked={manter} /> manter conectada neste navegador</label>
    <button class="entrar" disabled={!nome.trim()}>entrar</button>

    {#if nuvem.estado !== 'desligada'}
      <button type="button" class="google" onclick={google}>entrar com Google e sincronizar</button>
    {/if}
    {#if erro}<p class="erro">{erro}</p>{/if}
    <p class="rodape">seus dados ficam neste navegador{nuvem.estado !== 'desligada' ? ' e, com Google, no Firebase' : ''}.</p>
  </form>
</div>

<style>
  /* cobre a tela toda, inclusive a barra do topo */
  .tela
  {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    background: #070a09;
    overflow: hidden;
    animation: surgir 0.4s ease-out;
  }
  canvas
  {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.5;
  }
  /* centro mais escuro: a chuva fica nas bordas e não cansa a leitura */
  .vinheta
  {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba(7, 10, 9, 0.92) 0%, rgba(7, 10, 9, 0.6) 45%, rgba(7, 10, 9, 0.15) 100%);
  }
  .caixa
  {
    position: relative;
    width: min(380px, calc(100vw - 32px));
    display: grid;
    gap: 14px;
    padding: 32px 28px 24px;
    border: 1px solid rgba(18, 164, 84, 0.35);
    border-radius: 14px;
    background: rgba(10, 15, 13, 0.82);
    backdrop-filter: blur(6px);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(18, 164, 84, 0.08);
    color: #e8efe9;
  }
  .prompt
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: #12a454;
  }
  h1
  {
    font-family: var(--fonte-maquina);
    font-size: 2.4rem;
    margin: 0;
    color: #fff;
  }
  .cursor
  {
    color: #12a454;
    animation: piscar 1s steps(1) infinite;
  }
  .lema
  {
    margin: -8px 0 6px;
    font-size: 0.86rem;
    color: #9aa39e;
  }
  label
  {
    display: grid;
    gap: 6px;
  }
  label span
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: #9aa39e;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  input:not([type='checkbox'])
  {
    background: #0b110e;
    border: 1px solid #24302a;
    color: #fff;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.95rem;
  }
  input:not([type='checkbox']):focus
  {
    outline: none;
    border-color: #12a454;
    box-shadow: 0 0 0 3px rgba(18, 164, 84, 0.2);
  }
  .manter
  {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    color: #b8c1bc;
  }
  .manter input
  {
    accent-color: #12a454;
  }
  .entrar, .google
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    border-radius: 8px;
    padding: 11px;
    font-size: 0.95rem;
  }
  .entrar
  {
    background: #12a454;
    border: 1px solid #12a454;
    color: #04130b;
  }
  .entrar:disabled
  {
    opacity: 0.45;
  }
  /* o hover geral dos botões pinta o texto de verde: aqui o fundo já é verde */
  .entrar:hover:not(:disabled)
  {
    background: #19c065;
    border-color: #19c065;
    color: #04130b;
  }
  .google:hover:not(:disabled)
  {
    border-color: #12a454;
    color: #fff;
  }
  .google
  {
    background: transparent;
    border: 1px solid #2f3d36;
    color: #e8efe9;
  }
  .erro
  {
    color: #ff8a80;
    font-size: 0.82rem;
    margin: 0;
  }
  .rodape
  {
    margin: 4px 0 0;
    font-size: 0.74rem;
    color: #6f7a74;
    text-align: center;
  }
  @keyframes piscar
  {
    50%
    {
      opacity: 0;
    }
  }
  @keyframes surgir
  {
    from
    {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce)
  {
    .tela, .cursor
    {
      animation: none;
    }
  }
</style>
