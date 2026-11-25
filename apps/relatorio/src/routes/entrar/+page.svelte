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
  // o link do e-mail de nova senha volta para cá com o e-mail preenchido
  let email = $state(page.url.searchParams.get('email') ?? '');
  let senha = $state('');
  let verSenha = $state(false);
  let manter = $state(true);
  let erro = $state('');
  let ocupado = $state(false);
  // e-mail para onde foi o link de nova senha
  let enviadoPara = $state('');

  function concluir(nomeFinal: string, emailFinal?: string, contaNova = false)
  {
    // o nome vai para "Elaborado por" do relatório e para a saudação da central
    if (!dados.identificacao.elaboradoPor) salvar({ ...dados, identificacao: { ...dados.identificacao, elaboradoPor: nomeFinal } });
    abrirSessao({ nome: nomeFinal, email: emailFinal, desde: new Date().toISOString() }, manter);
    // conta (ou uso local) sem nenhuma pessoa cadastrada ainda: pergunta o uso antes de abrir a Início
    goto(contaNova || !dados.pessoas.length ? '/comecar' : '/', { replaceState: true });
  }

  async function enviar(e: SubmitEvent)
  {
    e.preventDefault();
    erro = '';
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
        enviadoPara = email.trim();
      }
      else if (modo === 'criar')
      {
        await criarConta(nome.trim(), email.trim(), senha, manter);
        concluir(nome.trim(), email.trim(), true);
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
      : modo === 'esqueci' ? /\S+@\S+\.\S+/.test(email.trim())
      : modo === 'criar' ? !!nome.trim() && !!email.trim() && senha.length >= 6
      : !!email.trim() && !!senha,
  );
  function trocar(m: typeof modo)
  {
    modo = m;
    erro = '';
    enviadoPara = '';
  }
  const titulo = $derived(semConta ? 'Entrar neste navegador' : modo === 'criar' ? 'Criar conta' : modo === 'esqueci' ? 'Recuperar acesso' : 'Entrar');
</script>

<div class="tela">
  <canvas use:chuva={{ fundo: 'rgba(16, 36, 32, 0.2)', cor: '#4cc38a', tamanho: 14, fps: 12 }}></canvas>

  <div class="centro-tela">
    <div class="marca">
      <span class="prompt">&gt; acesso_restrito</span>
      <h1>OrbisOS<span class="cursor">_</span></h1>
      <p>Painel, plano da semana, riscos e relatório num lugar só.</p>
    </div>

    <div class="janela">
      <div class="barra">
        <span class="luzes" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="caminho">orbisos://{semConta ? 'local' : modo === 'esqueci' ? 'recuperar' : modo}</span>
        <span class="status-barra" class:on={comConta}>{comConta ? 'firebase on' : 'local'}</span>
      </div>
    <form class="caixa" onsubmit={enviar}>
      {#if modo === 'esqueci' && enviadoPara}
        <div class="enviado">
          <div class="icone-ok" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
          </div>
          <h2>Confira seu e-mail</h2>
          <p>Mandamos um link para <strong>{enviadoPara}</strong>. Abra o link, crie a senha nova e volte para entrar.</p>
          <p class="dica">Não chegou em 2 minutos? Olhe o spam ou envie de novo.</p>
          <button type="button" class="principal-login" onclick={() => trocar('entrar')}>Voltar para entrar</button>
          <button type="button" class="link" disabled={ocupado} onclick={async () => { ocupado = true; try { await recuperarSenha(enviadoPara); } catch (e2) { erro = textoDoErro(e2); } finally { ocupado = false; } }}>{ocupado ? 'enviando...' : 'enviar de novo'}</button>
        </div>
      {:else}
        <header>
          {#if modo === 'esqueci'}
            <button type="button" class="voltar" onclick={() => trocar('entrar')}>&larr; voltar</button>
          {/if}
          <h2>{titulo}</h2>
          <p class="sub">
            {#if semConta}Seus dados ficam só neste navegador.
            {:else if modo === 'esqueci'}Digite o e-mail da conta. Enviamos um link para você criar uma senha nova.
            {:else if modo === 'criar'}Sua conta guarda tudo no Firebase e abre em qualquer computador.
            {:else}Use o e-mail e a senha da sua conta.{/if}
          </p>
        </header>

        {#if !semConta && modo !== 'esqueci'}
          <div class="abas" role="tablist">
            <button type="button" role="tab" aria-selected={modo === 'entrar'} class:ativa={modo === 'entrar'} onclick={() => trocar('entrar')}>Entrar</button>
            <button type="button" role="tab" aria-selected={modo === 'criar'} class:ativa={modo === 'criar'} onclick={() => trocar('criar')}>Criar conta</button>
          </div>
        {/if}

        {#if semConta || modo === 'criar'}
          <label>
            <span>Nome</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input bind:value={nome} autocomplete="name" placeholder="Como você quer ser chamada" autofocus />
          </label>
        {/if}
        {#if !semConta}
          <label>
            <span>E-mail</span>
            <input type="email" bind:value={email} autocomplete="email" placeholder="voce@empresa.com" />
          </label>
          {#if modo !== 'esqueci'}
            <label>
              <span class="linha-rotulo">
                Senha
                {#if modo === 'entrar'}<button type="button" class="link" onclick={() => trocar('esqueci')}>Esqueci a senha</button>{/if}
              </span>
              <div class="campo-senha">
                <input type={verSenha ? 'text' : 'password'} bind:value={senha} autocomplete={modo === 'criar' ? 'new-password' : 'current-password'} placeholder={modo === 'criar' ? 'pelo menos 6 caracteres' : ''} />
                <button type="button" class="mostrar" onclick={() => (verSenha = !verSenha)}>{verSenha ? 'ocultar' : 'mostrar'}</button>
              </div>
            </label>
          {/if}
        {/if}
        {#if modo !== 'esqueci'}
          <label class="manter"><input type="checkbox" bind:checked={manter} /> Manter conectada neste navegador</label>
        {/if}

        {#if erro}<p class="erro" role="alert">{erro}</p>{/if}

        <button class="principal-login" disabled={!podeEnviar || ocupado}>
          {ocupado ? 'Aguarde...' : semConta ? 'Entrar' : modo === 'criar' ? 'Criar conta' : modo === 'esqueci' ? 'Enviar link' : 'Entrar'}
        </button>

        {#if comConta && modo !== 'esqueci'}
          <button type="button" class="link centro" onclick={() => { semConta = !semConta; erro = ''; }}>
            {semConta ? 'Usar minha conta e sincronizar' : 'Continuar sem conta, só neste navegador'}
          </button>
        {/if}
      {/if}
      {#if erro && enviadoPara}<p class="erro" role="alert">{erro}</p>{/if}
    </form>
    </div>
  </div>
</div>

<style>
  /* cobre a tela toda, inclusive a barra do topo; a chuva ocupa o fundo inteiro */
  .tela
  {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    background:
      radial-gradient(ellipse at 50% 0%, #1d5a4c 0%, transparent 60%),
      linear-gradient(160deg, #164a40 0%, #123a33 45%, #10241f 100%);
    color: #14201c;
    overflow: auto;
    animation: surgir 0.4s ease-out;
  }
  canvas
  {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.32;
  }
  .centro-tela
  {
    position: relative;
    width: min(440px, calc(100vw - 32px));
    display: grid;
    gap: 22px;
    padding: 32px 0;
  }
  .marca
  {
    display: grid;
    gap: 6px;
    justify-items: center;
    text-align: center;
    color: #e9f3ee;
  }
  .prompt
  {
    font-family: var(--fonte-maquina);
    font-size: 0.8rem;
    color: #8be6b8;
  }
  h1
  {
    margin: 0;
    font-size: 3.2rem;
    color: #fff;
    text-shadow: 0 0 24px rgba(76, 195, 138, 0.35);
  }
  .cursor
  {
    color: #4cc38a;
    animation: piscar 1s steps(1) infinite;
  }
  .marca p
  {
    margin: 0;
    color: #c4d8cf;
    font-size: 0.95rem;
  }
  /* o formulário é uma janela de terminal: barra com caminho e estado da nuvem */
  .janela
  {
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(139, 230, 184, 0.35);
    box-shadow: 0 0 0 4px rgba(76, 195, 138, 0.08), 0 24px 60px rgba(0, 0, 0, 0.35);
    animation: subir 0.5s ease-out;
  }
  .barra
  {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    background: #0f2924;
    font-family: var(--fonte-maquina);
    font-size: 0.76rem;
    color: #8fb3a5;
  }
  .luzes
  {
    display: flex;
    gap: 6px;
  }
  .luzes i
  {
    width: 9px;
    height: 9px;
    background: #2c5248;
  }
  .luzes i:first-child
  {
    background: #4cc38a;
  }
  .caminho
  {
    flex: 1;
    color: #d5ebe1;
  }
  .status-barra
  {
    color: #8fb3a5;
  }
  .status-barra.on
  {
    color: #6fdba5;
  }
  .status-barra.on::before
  {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: #4cc38a;
    box-shadow: 0 0 8px #4cc38a;
    vertical-align: middle;
  }
  .caixa
  {
    display: grid;
    gap: 16px;
    padding: 26px 26px 22px;
    background: #ffffff;
  }
  header
  {
    display: grid;
    gap: 6px;
  }
  h2
  {
    margin: 0;
    font-size: 1.5rem;
    color: #10241f;
  }
  .sub, .enviado p
  {
    margin: 0;
    font-size: 0.88rem;
    color: #55665f;
    line-height: 1.45;
  }
  label
  {
    display: grid;
    gap: 6px;
  }
  label > span
  {
    font-size: 0.8rem;
    font-weight: 600;
    color: #33433d;
  }
  .linha-rotulo
  {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  input:not([type='checkbox'])
  {
    width: 100%;
    box-sizing: border-box;
    background: #f7faf9;
    border: 1px solid #cdd9d4;
    color: #10241f;
    border-radius: 10px;
    padding: 11px 12px;
    font-size: 0.95rem;
  }
  input:not([type='checkbox'])::placeholder
  {
    color: #93a29c;
  }
  input:not([type='checkbox']):focus
  {
    outline: none;
    background: #fff;
    border-color: #1f9d68;
    box-shadow: 0 0 0 3px rgba(31, 157, 104, 0.18);
  }
  .campo-senha
  {
    position: relative;
  }
  .campo-senha input
  {
    padding-right: 76px;
  }
  .mostrar
  {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: #1f7a54;
    font-size: 0.78rem;
    padding: 4px 8px;
  }
  .manter
  {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #44554e;
  }
  .manter input
  {
    accent-color: #1f9d68;
  }
  .principal-login
  {
    border-radius: 10px;
    padding: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    background: #1f9d68;
    border: 1px solid #1f9d68;
    color: #fff;
  }
  .principal-login:hover:not(:disabled)
  {
    background: #188457;
    border-color: #188457;
    color: #fff;
  }
  .principal-login:disabled
  {
    opacity: 0.45;
  }
  .abas
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    gap: 4px;
    background: #edf2f0;
    border-radius: 10px;
  }
  .abas button
  {
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #55665f;
    padding: 8px;
    font-weight: 600;
  }
  .abas button.ativa
  {
    background: #fff;
    color: #10241f;
    box-shadow: 0 1px 3px rgba(16, 36, 31, 0.12);
  }
  .link, .voltar
  {
    border: none;
    background: none;
    padding: 0;
    color: #1f7a54;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .link:hover:not(:disabled), .voltar:hover, .mostrar:hover
  {
    color: #10241f;
    text-decoration: underline;
  }
  .voltar
  {
    justify-self: start;
  }
  .centro
  {
    justify-self: center;
    font-weight: 500;
    color: #55665f;
  }
  .erro
  {
    margin: 0;
    padding: 9px 12px;
    border-radius: 8px;
    background: #fdecea;
    color: #a3271b;
    font-size: 0.84rem;
  }
  .enviado
  {
    display: grid;
    gap: 12px;
    text-align: center;
    justify-items: center;
  }
  .enviado .principal-login
  {
    width: 100%;
  }
  .icone-ok
  {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #e3f5ec;
    color: #1f9d68;
  }
  .dica
  {
    font-size: 0.8rem !important;
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
  @keyframes subir
  {
    from
    {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  @media (prefers-reduced-motion: reduce)
  {
    .tela, .cursor, .janela
    {
      animation: none;
    }
  }
</style>
