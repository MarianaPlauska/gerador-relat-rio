<script lang="ts">
  import '@fontsource/courier-prime/400.css';
  import '@fontsource/courier-prime/700.css';
  import '@fontsource/ibm-plex-sans/400.css';
  import '@fontsource/ibm-plex-sans/600.css';
  import '../app.css';
  import { DropdownMenu } from 'bits-ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, exportarJson } from '#lib/armazenamento.ts';
  import { chuva } from '#lib/chuva.ts';
  import { fecharSessao, lerSessao } from '#lib/sessao.ts';

  let { children } = $props();

  const links = [
    { href: '/', nome: 'Início' },
    { href: '/painel', nome: 'Colar painel' },
    { href: '/cards', nome: 'Cards' },
    { href: '/semana', nome: 'Semana' },
    { href: '/listas', nome: 'Listas' },
    { href: '/relatorio', nome: 'Relatório' },
  ];

  let escuro = $state(typeof document === 'undefined' || document.documentElement.dataset.tema !== 'claro');
  const nome = $derived(page.url.pathname && (lerSessao()?.nome ?? ''));

  function trocarTema()
  {
    escuro = !escuro;
    if (escuro) delete document.documentElement.dataset.tema;
    else document.documentElement.dataset.tema = 'claro';
    try
    {
      localStorage.setItem('orbisos-tema', escuro ? 'escuro' : 'claro');
    }
    catch
    {
      // sem armazenamento: o tema vale só nesta aba
    }
  }

  function sair()
  {
    fecharSessao();
    goto('/entrar');
  }
</script>

{#if page.url.pathname !== '/entrar'}
  <nav>
    <canvas class="chuva-nav" use:chuva={{ fundo: 'rgba(6, 9, 8, 0.2)', cor: '#12a454', tamanho: 12 }}></canvas>
    <a href="/" class="marca">OrbisOS<span>_</span></a>
    <div class="links">
      {#each links as l (l.href)}
        <a href={l.href} class:ativo={page.url.pathname === l.href}>{l.nome}</a>
      {/each}
    </div>
    <div class="direita">
      <button class="tema" onclick={trocarTema} title="Trocar tema" aria-label="Trocar para o tema {escuro ? 'claro' : 'escuro'}">
        {#if escuro}
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>
        {/if}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="usuario" aria-label="Menu da conta">
          <span class="inicial">{(nome || '?').charAt(0).toUpperCase()}</span>
          <span class="nome-usuario">{nome.split(' ')[0]}</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="menu-conta" sideOffset={8} align="end">
            <div class="menu-titulo">{nome || 'sem nome'}</div>
            <DropdownMenu.Item class="menu-item" onSelect={() => goto('/modelos')}>Modelos de relatório</DropdownMenu.Item>
            <DropdownMenu.Item class="menu-item" onSelect={() => exportarJson(carregar())}>Baixar backup</DropdownMenu.Item>
            <DropdownMenu.Item class="menu-item" onSelect={trocarTema}>Tema {escuro ? 'claro' : 'escuro'}</DropdownMenu.Item>
            <DropdownMenu.Separator class="menu-separador" />
            <DropdownMenu.Item class="menu-item perigo" onSelect={sair}>Sair</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  </nav>
{/if}

{@render children()}

<style>
  canvas
  {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .chuva-nav
  {
    opacity: 0.4;
  }
  .marca, .links, .direita
  {
    position: relative;
  }
  nav
  {
    display: flex;
    align-items: center;
    gap: var(--size-5);
    padding: 0 var(--size-6);
    height: 58px;
    background: #060908;
    border-bottom: 1px solid rgb(30 196 107 / 18%);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .marca
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.15rem;
    color: #fff;
    text-decoration: none;
    white-space: nowrap;
  }
  .marca span
  {
    color: #1ec46b;
    animation: piscar 1.1s steps(1) infinite;
  }
  .links
  {
    display: flex;
    gap: 2px;
    height: 100%;
    overflow-x: auto;
    flex: 1;
    scrollbar-width: none;
  }
  .links a
  {
    display: flex;
    align-items: center;
    font-family: var(--fonte-maquina);
    color: #93a19a;
    text-decoration: none;
    padding: 0 var(--size-3);
    font-size: 0.92rem;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    transition: color 0.15s;
  }
  .links a:hover
  {
    color: #fff;
  }
  .links .ativo
  {
    color: #fff;
    border-bottom-color: #1ec46b;
    font-weight: 700;
  }
  .direita
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
  }
  .tema
  {
    width: 36px;
    height: 36px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: transparent;
    border-color: rgb(255 255 255 / 12%);
    color: #c9d3cd;
  }
  .tema svg
  {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .tema:hover:not(:disabled)
  {
    color: #fff;
    border-color: #1ec46b;
  }
  /* o gatilho e o menu do Bits UI ficam fora do escopo deste componente */
  :global(.usuario)
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
    padding: 3px 12px 3px 3px;
    border-radius: var(--radius-round);
    background: rgb(255 255 255 / 5%);
    border: 1px solid rgb(255 255 255 / 12%);
    color: #e4ebe7;
    font-family: var(--fonte-maquina);
  }
  :global(.usuario:hover)
  {
    border-color: #1ec46b !important;
  }
  .inicial
  {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #1ec46b;
    color: #04130b;
    font-weight: 700;
  }
  :global(.menu-conta)
  {
    z-index: 50;
    min-width: 210px;
    padding: var(--size-2);
    background: var(--superficie);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio);
    box-shadow: var(--sombra);
    animation: surgir-menu 0.12s var(--curva);
  }
  .menu-titulo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    color: var(--suave);
    padding: var(--size-1) var(--size-2) var(--size-2);
  }
  :global(.menu-item)
  {
    padding: var(--size-2);
    border-radius: var(--raio-pequeno);
    font-size: 0.9rem;
    color: var(--texto);
    outline: none;
    cursor: var(--cursor-clique);
  }
  :global(.menu-item[data-highlighted])
  {
    background: var(--marca-clara);
    color: var(--marca);
  }
  :global(.menu-item.perigo)
  {
    color: var(--vermelho);
  }
  :global(.menu-separador)
  {
    height: 1px;
    background: var(--borda);
    margin: var(--size-1) 0;
  }
  @keyframes surgir-menu
  {
    from
    {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (max-width: 700px)
  {
    nav
    {
      padding: 0 var(--size-3);
      gap: var(--size-3);
    }
    .nome-usuario
    {
      display: none;
    }
  }
</style>
