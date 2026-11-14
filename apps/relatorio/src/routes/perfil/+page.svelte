<script lang="ts">
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { nuvem, recuperarSenha, sairDaNuvem, textoDoErro, trocarNomeDaConta, trocarSenha } from '#lib/nuvem.svelte.ts';
  import { atualizarSessao, fecharSessao, lerSessao } from '#lib/sessao.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const sessao = lerSessao();
  let nome = $state(nuvem.nome ?? sessao?.nome ?? '');
  const logada = $derived(nuvem.estado === 'ok' || nuvem.estado === 'sincronizando' || nuvem.estado === 'erro');
  let escuro = $state(document.documentElement.dataset.tema !== 'claro');
  let senhaAtual = $state('');
  let senhaNova = $state('');
  let msg = $state<Record<string, { ok: boolean; texto: string }>>({});
  let importando = $state(false);

  const avisar = (onde: string, ok: boolean, texto: string) => (msg[onde] = { ok, texto });

  async function salvarNome()
  {
    const n = nome.trim();
    if (!n) return;
    try
    {
      if (logada) await trocarNomeDaConta(n);
      atualizarSessao({ nome: n });
      if (!dados.identificacao.elaboradoPor) dados.identificacao.elaboradoPor = n;
      avisar('nome', true, 'Nome atualizado.');
    }
    catch (e)
    {
      avisar('nome', false, textoDoErro(e));
    }
  }

  function mudarTema(claro: boolean)
  {
    escuro = !claro;
    if (claro) document.documentElement.dataset.tema = 'claro';
    else delete document.documentElement.dataset.tema;
    try
    {
      localStorage.setItem('orbisos-tema', claro ? 'claro' : 'escuro');
    }
    catch
    {
      // sem armazenamento: vale só nesta aba
    }
  }

  async function mudarSenha()
  {
    try
    {
      await trocarSenha(senhaAtual, senhaNova);
      senhaAtual = '';
      senhaNova = '';
      avisar('senha', true, 'Senha trocada.');
    }
    catch (e)
    {
      avisar('senha', false, textoDoErro(e));
    }
  }

  async function esqueci()
  {
    if (!nuvem.email) return;
    try
    {
      await recuperarSenha(nuvem.email);
      avisar('senha', true, `Enviei um e-mail para ${nuvem.email} com o link para criar uma senha nova.`);
    }
    catch (e)
    {
      avisar('senha', false, textoDoErro(e));
    }
  }

  async function importar(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo || !confirm('Importar este backup substitui os dados deste navegador. Continuar?')) return;
    importando = true;
    try
    {
      salvar(await importarJson(arquivo));
      location.reload();
    }
    catch
    {
      avisar('dados', false, 'Não consegui ler esse arquivo.');
      importando = false;
    }
  }

  function sair()
  {
    fecharSessao();
    sairDaNuvem().catch(() => {});
    goto('/entrar');
  }
</script>

<main>
  <span class="prompt">&gt; perfil</span>
  <h1>Meu perfil<span class="cursor">_</span></h1>

  <div class="duas">
    <section class="cartao">
      <h2>Conta</h2>
      <div class="avatar-linha">
        <span class="avatar">{(nome || '?').charAt(0).toUpperCase()}</span>
        <div>
          <strong>{nome || 'sem nome'}</strong>
          <p class="dica">{nuvem.email ?? 'sem conta na nuvem: dados só neste navegador'}</p>
        </div>
      </div>
      <label>Nome <input bind:value={nome} autocomplete="name" /></label>
      <div class="linha">
        <button class="principal" disabled={!nome.trim()} onclick={salvarNome}>Salvar nome</button>
        {#if msg.nome}<span class:ok={msg.nome.ok} class:ruim={!msg.nome.ok}>{msg.nome.texto}</span>{/if}
      </div>
      <p class="dica">
        Nuvem: <b>{nuvem.estado === 'desligada' ? 'desligada' : nuvem.estado === 'sem_login' ? 'sem login' : nuvem.estado === 'sincronizando' ? 'sincronizando' : nuvem.estado === 'erro' ? 'com erro' : 'tudo guardado'}</b>
        {#if nuvem.estado === 'sem_login'}- <a href="/entrar">entrar ou criar conta</a>{/if}
        {#if nuvem.estado === 'desligada'}- ainda sem projeto Firebase configurado.{/if}
      </p>
    </section>

    <section class="cartao">
      <h2>Identificação dos relatórios</h2>
      <p class="dica">Aparece na capa e no quadro de aprovação do PDF.</p>
      <label>Elaborado por <input bind:value={dados.identificacao.elaboradoPor} /></label>
      <label>Cargo <input bind:value={dados.identificacao.cargo} /></label>
      <label>Área <input bind:value={dados.identificacao.area} /></label>
      <label>Destinatário (gestor) <input bind:value={dados.identificacao.destinatario} /></label>
      <label>Prefixo dos cards <input bind:value={dados.prefixo} maxlength="8" /></label>
    </section>

    <section class="cartao">
      <h2>Aparência</h2>
      <div class="linha">
        <button class:principal={escuro} onclick={() => mudarTema(false)}>Escuro</button>
        <button class:principal={!escuro} onclick={() => mudarTema(true)}>Claro</button>
      </div>
      <p class="dica">A escolha fica salva neste navegador.</p>
    </section>

    <section class="cartao">
      <h2>Segurança</h2>
      {#if logada}
        <label>Senha atual <input type="password" bind:value={senhaAtual} autocomplete="current-password" /></label>
        <label>Senha nova <input type="password" bind:value={senhaNova} autocomplete="new-password" placeholder="pelo menos 6 caracteres" /></label>
        <div class="linha">
          <button class="principal" disabled={!senhaAtual || senhaNova.length < 6} onclick={mudarSenha}>Trocar senha</button>
          <button onclick={esqueci}>Esqueci a senha atual</button>
        </div>
        {#if msg.senha}<p class:ok={msg.senha.ok} class:ruim={!msg.senha.ok}>{msg.senha.texto}</p>{/if}
      {:else}
        <p class="dica">A troca de senha aparece quando você estiver conectada à sua conta.</p>
      {/if}
    </section>

    <section class="cartao">
      <h2>Seus dados</h2>
      <div class="linha">
        <button onclick={() => exportarJson(carregar())}>Baixar backup</button>
        <label class="arquivo botao">Importar backup<input type="file" accept="application/json,.json" onchange={importar} disabled={importando} hidden /></label>
      </div>
      {#if msg.dados}<p class="ruim">{msg.dados.texto}</p>{/if}
      <p class="dica">O backup tem fotos do painel, planos, listas, fluxos e modelos. Os links publicados ficam na <a href="/retornos">tela Retornos</a>.</p>
    </section>

    <section class="cartao">
      <h2>Sessão</h2>
      <p class="dica">Entrou {sessao ? `em ${sessao.desde.slice(8, 10)}/${sessao.desde.slice(5, 7)}` : ''}. Sair não apaga nada.</p>
      <button class="perigo" onclick={sair}>Sair</button>
    </section>
  </div>
</main>

<style>
  .duas
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--size-4);
    align-items: start;
  }
  .duas .cartao
  {
    margin-top: 0;
    display: grid;
    gap: var(--size-3);
  }
  .duas h2
  {
    margin: 0;
  }
  label
  {
    display: grid;
    gap: var(--size-1);
  }
  .linha
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
  }
  .avatar-linha
  {
    display: flex;
    align-items: center;
    gap: var(--size-3);
  }
  .avatar-linha p
  {
    margin: 0;
  }
  .avatar
  {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--marca);
    color: var(--sobre-marca);
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.3rem;
  }
  .ok
  {
    color: var(--verde);
    font-size: 0.86rem;
  }
  .ruim
  {
    color: var(--vermelho);
    font-size: 0.86rem;
  }
  p
  {
    margin: 0;
  }
  .perigo
  {
    color: var(--vermelho);
    justify-self: start;
  }
  .arquivo
  {
    cursor: var(--cursor-clique);
  }
</style>
