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
  import Abertura from '#lib/Abertura.svelte';
  import Paleta from '#lib/Paleta.svelte';
  import { onMount } from 'svelte';
  import { nuvem, sairDaNuvem } from '#lib/nuvem.svelte.ts';
  import { fecharSessao, lerSessao } from '#lib/sessao.ts';

  let { children } = $props();

  interface ItemMenu
  {
    href: string;
    nome: string;
    dica: string;
  }

  interface GrupoMenu
  {
    id: string;
    nome: string;
    itens: ItemMenu[];
  }

  const gruposMenu: GrupoMenu[] = [
    {
      id: 'painel',
      nome: 'Painel e Cards',
      itens: [
        { href: '/painel', nome: 'Diário do painel', dica: 'Cole prints, comente cada um e guarde por pasta (DEV...)' },
        { href: '/cards', nome: 'Cards', dica: 'Busca, filtros e detalhes das demandas lidas' },
      ],
    },
    {
      id: 'ciclo',
      nome: 'Ciclo e Rotina',
      itens: [
        { href: '/semana', nome: 'Semana', dica: 'Plano semanal, entregas, alertas e compromissos' },
        { href: '/mes', nome: 'Mês', dica: 'Visão consolidada do período e evolução' },
        { href: '/vivos', nome: 'Checklist diário', dica: 'Tarefas do período para marcar e registrar o dia' },
      ],
    },
    {
      id: 'processos',
      nome: 'Listas e Fluxos',
      itens: [
        { href: '/listas', nome: 'Listas', dica: 'Checklists de implantação por fase e empresa' },
        { href: '/fluxos', nome: 'Fluxos', dica: 'Editor visual de fluxogramas de processo' },
      ],
    },
    {
      id: 'saidas',
      nome: 'Relatórios',
      itens: [
        { href: '/relatorio', nome: 'Gerar Relatório', dica: 'PDF técnico, link interativo, Teams e pacote IA' },
        { href: '/modelos', nome: 'Modelos', dica: 'Personalizar seções e estrutura dos relatórios' },
        { href: '/retornos', nome: 'Retornos', dica: 'Respostas e comentários dos links enviados' },
      ],
    },
  ];

  let menuAberto = $state<string | null>(null);
  const grupoAtivo = (g: GrupoMenu) => g.itens.some((i) => page.url.pathname === i.href);

  let paletaAberta = $state(false);
  let abertura = $state(false);

  // a abertura com o nome aparece uma vez por navegador, na Início, para quem tem movimento reduzido ela não aparece
  onMount(() =>
  {
    try
    {
      if (localStorage.getItem('orbisos-abertura') || page.url.pathname !== '/' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      abertura = true;
    }
    catch
    {
      // sem armazenamento: sem abertura
    }
  });

  function terminarAbertura()
  {
    abertura = false;
    try
    {
      localStorage.setItem('orbisos-abertura', '1');
    }
    catch
    {
      // sem armazenamento: ela volta na próxima vez
    }
  }
  let escuro = $state(typeof document === 'undefined' || document.documentElement.dataset.tema !== 'claro');
  // telas abertas sem conta: entrada e relatório recebido por link
  const aberta = $derived(page.url.pathname === '/entrar' || page.url.pathname === '/ler');
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
    sairDaNuvem().catch(() => {});
    goto('/entrar');
  }
</script>

{#if !aberta}
  <nav>
    <canvas class="chuva-nav" use:chuva={{ fundo: 'rgba(15, 19, 24, 0.2)', cor: '#4cc38a', tamanho: 12 }}></canvas>
    <a href="/" class="marca">OrbisOS<span>_</span></a>
    <div class="links" role="menubar">
      <a href="/" class="item-topo" class:ativo={page.url.pathname === '/'}>Início</a>
      {#each gruposMenu as g (g.id)}
        <div
          class="grupo-nav"
          role="none"
          onmouseenter={() => (menuAberto = g.id)}
          onmouseleave={() => { if (menuAberto === g.id) menuAberto = null; }}
        >
          <button
            type="button"
            class="gatilho-nav"
            class:ativo={grupoAtivo(g)}
            aria-expanded={menuAberto === g.id}
            onclick={() => (menuAberto = menuAberto === g.id ? null : g.id)}
          >
            <span>{g.nome}</span>
            <span class="seta" class:aberta={menuAberto === g.id}>▾</span>
          </button>
          {#if menuAberto === g.id}
            <div class="painel-nav" role="menu">
              {#each g.itens as item (item.href)}
                <a
                  href={item.href}
                  role="menuitem"
                  class="subitem-nav"
                  class:ativo={page.url.pathname === item.href}
                  onclick={() => (menuAberto = null)}
                >
                  <b>{item.nome}</b>
                  <small>{item.dica}</small>
                </a>
              {/each}
            </div>
          {/if}
        </div>
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
            <DropdownMenu.Item class="menu-item" onSelect={() => goto('/perfil')}>Meu perfil</DropdownMenu.Item>
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

<div class="conteudo">
  {@render children()}
</div>

{#if abertura && !aberta}
  <Abertura terminar={terminarAbertura} />
{/if}

{#if !aberta}
  <Paleta bind:aberta={paletaAberta} {trocarTema} baixarBackup={() => exportarJson(carregar())} {sair} />
  <footer>
    <div class="rodape">
      <div class="rodape-marca">
        <a href="/" class="nome-rodape">OrbisOS<span>_</span></a>
        <p>Supervisão de desenvolvimento: do painel do gestor ao relatório.</p>
      </div>
      <div class="rodape-links">
        <a href="/painel">Diário do painel</a>
        <a href="/listas">Listas</a>
        <a href="/fluxos">Fluxos</a>
        <a href="/modelos">Modelos</a>
        <a href="/relatorio">Relatório</a>
        <a href="/roadmap">Roadmap 2027</a>
      </div>
      <div class="rodape-info">
        <span>Dados guardados neste navegador{nuvem.estado === 'ok' ? ' e na nuvem' : ''}.</span>
        <span>Sem IA paga: tudo roda no seu computador.</span>
      </div>
    </div>
    <div class="rodape-fim">OrbisOS &copy; {new Date().getFullYear()}</div>
  </footer>
{/if}

<style>
  .conteudo
  {
    min-height: calc(100vh - 58px - var(--altura-rodape, 150px));
  }
  footer
  {
    margin-top: var(--size-8);
    background: var(--barra);
    border-top: 2px solid var(--marca);
    color: #9aa5b4;
    font-size: 0.84rem;
  }
  .rodape
  {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--size-6);
    display: grid;
    grid-template-columns: 1.4fr 1fr 1.2fr;
    gap: var(--size-6);
    align-items: start;
  }
  .nome-rodape
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.05rem;
    color: #fff;
    text-decoration: none;
  }
  .nome-rodape span
  {
    color: var(--marca);
  }
  .rodape-marca p
  {
    margin: var(--size-1) 0 0;
    max-width: 34ch;
  }
  .rodape-links
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-1) var(--size-4);
  }
  .rodape-links a
  {
    color: #9aa5b4;
    text-decoration: none;
  }
  .rodape-links a:hover
  {
    color: #fff;
    text-decoration: underline;
  }
  .rodape-info
  {
    display: grid;
    gap: var(--size-1);
  }
  .rodape-fim
  {
    border-top: 1px solid rgb(255 255 255 / 8%);
    padding: var(--size-3) var(--size-6);
    text-align: center;
    font-family: var(--fonte-maquina);
    font-size: 0.76rem;
  }
  @media (max-width: 760px)
  {
    .rodape
    {
      grid-template-columns: 1fr;
      gap: var(--size-4);
      padding: var(--size-4) var(--size-3);
    }
  }
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
    opacity: 0.3;
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
    background: var(--barra);
    border-bottom: 1px solid rgb(76 195 138 / 20%);
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
    color: var(--marca);
    animation: piscar 1.1s steps(1) infinite;
  }
  .links
  {
    display: flex;
    align-items: stretch;
    gap: 4px;
    height: 100%;
    flex: 1;
  }
  .item-topo, .gatilho-nav
  {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    font-family: var(--fonte-maquina);
    color: #93a19a;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    text-decoration: none;
    padding: 0 var(--size-3);
    font-size: 0.92rem;
    white-space: nowrap;
    transition: color 0.15s;
  }
  .item-topo:hover, .gatilho-nav:hover:not(:disabled)
  {
    color: #fff;
    background: rgb(255 255 255 / 4%);
  }
  .item-topo.ativo, .gatilho-nav.ativo
  {
    color: #fff;
    border-bottom-color: var(--marca);
    font-weight: 700;
  }
  .grupo-nav
  {
    position: relative;
    height: 100%;
  }
  .seta
  {
    font-size: 0.72rem;
    opacity: 0.75;
    transition: transform 0.15s;
  }
  .seta.aberta
  {
    transform: rotate(180deg);
    color: var(--marca);
  }
  .painel-nav
  {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 260px;
    padding: 6px;
    background: var(--superficie);
    border: 1px solid var(--borda-forte);
    border-top: 2px solid var(--marca);
    border-radius: 0 0 var(--raio) var(--raio);
    box-shadow: var(--sombra);
    display: grid;
    gap: 2px;
    z-index: 40;
    animation: surgir-menu 0.12s var(--curva);
  }
  .subitem-nav
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: var(--raio-pequeno);
    text-decoration: none;
    color: var(--texto);
  }
  .subitem-nav b
  {
    font-family: var(--fonte-maquina);
    font-size: 0.88rem;
  }
  .subitem-nav small
  {
    font-size: 0.76rem;
    color: var(--suave);
    white-space: normal;
  }
  .subitem-nav:hover, .subitem-nav.ativo
  {
    background: var(--marca-clara);
  }
  .subitem-nav.ativo b
  {
    color: var(--marca);
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
    border-color: var(--marca);
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
    border-color: var(--marca) !important;
  }
  .inicial
  {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--marca);
    color: var(--sobre-marca);
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
