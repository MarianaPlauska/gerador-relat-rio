<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, salvar } from '#lib/armazenamento.ts';
  import { chuva } from '#lib/chuva.ts';
  import { criarConta, entrarComEmail, nuvem, recuperarSenha, textoDoErro } from '#lib/nuvem.svelte.ts';
  import { abrirSessao } from '#lib/sessao.ts';

  const dados = carregar();
  const comConta = nuvem.estado !== 'desligada';
  const pedidoModo = page.url.searchParams.get('modo');
  let modo = $state<'entrar' | 'criar' | 'esqueci'>(pedidoModo === 'esqueci' ? 'esqueci' : pedidoModo === 'criar' ? 'criar' : 'entrar');
  let semConta = $state(!comConta && pedidoModo !== 'conta' && pedidoModo !== 'esqueci');
  let nome = $state(dados.identificacao.elaboradoPor);
  let email = $state('');
  let senha = $state('');
  let manter = $state(true);
  let erro = $state('');
  let aviso = $state('');
  let ocupado = $state(false);

  function concluir(nomeFinal: string, emailFinal?: string)
  {
    // o nome vai para "Elaborado por" do relatório e para a saudação da central
    if (!dados.identificacao.elaboradoPor) salvar({ ...dados, identificacao: { ...dados.identificacao, elaboradoPor: nomeFinal } });
    abrirSessao({ nome: nomeFinal, email: emailFinal, desde: new Date().toISOString() }, manter);
    // depois de entrar, sempre a Início
    goto('/', { replaceState: true });
  }

  async function enviar(e: SubmitEvent)
  {
    e.preventDefault();
    erro = '';
    aviso = '';
    if (semConta)
    {
      if (nome.trim()) concluir(nome.trim());
      return;
    }
    ocupado = true;
    try
    {
      if (modo === 'esqueci')
      {
        await recuperarSenha(email.trim());
        aviso = 'Enviei um e-mail para você criar uma senha nova. Olhe também o spam.';
      }
      else if (modo === 'criar')
      {
        await criarConta(nome.trim(), email.trim(), senha, manter);
        concluir(nome.trim(), email.trim());
      }
      else
      {
        const conta = await entrarComEmail(email.trim(), senha, manter);
        concluir(conta.nome || nuvem.nome || dados.identificacao.elaboradoPor || email.split('@')[0]!, conta.email ?? email.trim());
      }
    }
    catch (e2)
    {
      erro = textoDoErro(e2);
    }
    finally
    {
      ocupado = false;
    }
  }

  const podeEnviar = $derived(
    semConta ? !!nome.trim()
      : modo === 'esqueci' ? !!email.trim()
      : modo === 'criar' ? !!nome.trim() && !!email.trim() && senha.length >= 6
      : !!email.trim() && !!senha,
  );
  function trocar(m: typeof modo)
  {
    modo = m;
    erro = '';
    aviso = '';
  }
</script>

<div class="tela">
  <canvas use:chuva={{ fundo: 'rgba(8, 11, 15, 0.16)', cor: '#4cc38a', tamanho: 15, fps: 14 }}></canvas>
  <div class="vinheta"></div>

  <form class="caixa" onsubmit={enviar}>
    <span class="prompt">&gt; supervisão_dev</span>
    <h1>OrbisOS<span class="cursor">_</span></h1>
    <p class="lema">painel, plano, riscos e relatório num lugar só.</p>

    {#if !semConta}
      <div class="abas" role="tablist">
        <button type="button" role="tab" aria-selected={modo !== 'criar'} class:ativa={modo !== 'criar'} onclick={() => trocar('entrar')}>entrar</button>
        <button type="button" role="tab" aria-selected={modo === 'criar'} class:ativa={modo === 'criar'} onclick={() => trocar('criar')}>criar conta</button>
      </div>
    {/if}

    {#if semConta || modo === 'criar'}
      <label>
        <span>nome</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={nome} autocomplete="name" placeholder="Como você quer ser chamada" autofocus />
      </label>
    {/if}
    {#if !semConta}
      <label>
        <span>e-mail</span>
        <input type="email" bind:value={email} autocomplete="email" placeholder="voce@empresa.com" />
      </label>
      {#if modo !== 'esqueci'}
        <label>
          <span>senha</span>
          <input type="password" bind:value={senha} autocomplete={modo === 'criar' ? 'new-password' : 'current-password'} placeholder={modo === 'criar' ? 'pelo menos 6 caracteres' : ''} />
        </label>
      {/if}
    {/if}
    {#if modo !== 'esqueci'}
      <label class="manter"><input type="checkbox" bind:checked={manter} /> manter conectada neste navegador</label>
    {/if}
    <button class="entrar" disabled={!podeEnviar || ocupado}>
      {ocupado ? 'aguarde...' : semConta ? 'entrar' : modo === 'criar' ? 'criar conta' : modo === 'esqueci' ? 'enviar e-mail' : 'entrar'}
    </button>

    {#if !semConta}
      {#if modo === 'esqueci'}
        <button type="button" class="link" onclick={() => trocar('entrar')}>voltar</button>
      {:else if modo === 'entrar'}
        <button type="button" class="link" onclick={() => trocar('esqueci')}>esqueci a senha</button>
      {/if}
    {/if}
    {#if erro}<p class="erro">{erro}</p>{/if}
    {#if aviso}<p class="ok">{aviso}</p>{/if}
    {#if comConta}
      <button type="button" class="link" onclick={() => { semConta = !semConta; erro = ''; aviso = ''; }}>
        {semConta ? 'usar minha conta e sincronizar' : 'continuar sem conta, só neste navegador'}
      </button>
    {/if}
    <p class="rodape">seus dados ficam neste navegador{comConta ? ' e, com conta, no Firebase' : ''}.</p>
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
    color: #4cc38a;
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
    color: #4cc38a;
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
    border-color: #4cc38a;
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
    accent-color: #4cc38a;
  }
  .entrar
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    border-radius: 8px;
    padding: 11px;
    font-size: 0.95rem;
  }
  .entrar
  {
    background: #4cc38a;
    border: 1px solid #4cc38a;
    color: #06231a;
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
    color: #06231a;
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
  .abas
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    overflow: hidden;
  }
  .abas button
  {
    border: none;
    border-radius: 0;
    background: transparent;
    color: #9aa39e;
    padding: 8px;
    font-family: var(--fonte-maquina);
  }
  .abas button.ativa
  {
    background: rgba(18, 164, 84, 0.18);
    color: #e8efe9;
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: #9aa39e;
    font-size: 0.82rem;
    text-decoration: underline;
    justify-self: start;
  }
  .link:hover:not(:disabled)
  {
    color: #e8efe9;
  }
  .ok
  {
    margin: 0;
    font-size: 0.84rem;
    color: #5fcf98;
  }
</style>
