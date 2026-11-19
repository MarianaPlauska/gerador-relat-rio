<script lang="ts">
  import '@fontsource/courier-prime/400.css';
  import '@fontsource/courier-prime/700.css';
  import '@fontsource/ibm-plex-sans/400.css';
  import '@fontsource/ibm-plex-sans/600.css';
  import '@fontsource/pixelify-sans/400.css';
  import '@fontsource/pixelify-sans/700.css';
  import '../app.css';
  import { DropdownMenu } from 'bits-ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, exportarJson } from '#lib/armazenamento.ts';
  import { chuva } from '#lib/chuva.ts';
  import Abertura from '#lib/Abertura.svelte';
  import FaixaSomenteLeitura from '#lib/FaixaSomenteLeitura.svelte';
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
      nome: 'Listas, Fluxos e Planilhas',
      itens: [
        { href: '/listas', nome: 'Listas', dica: 'Checklists de implantação por fase e empresa' },
        { href: '/fluxos', nome: 'Fluxos', dica: 'Editor visual de fluxogramas de processo' },
        { href: '/planilhas', nome: 'Planilhas', dica: 'Organize material solto em planilha, com orçamento e .xlsx' },
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

<div class="pagina">
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

  {#if !aberta}
    <FaixaSomenteLeitura />
  {/if}

  <div class="conteudo">
    {@render children()}
  </div>

  {#if abertura && !aberta}
    <Abertura terminar={terminarAbertura} />
  {/if}

  {#if !aberta}
    <Paleta bind:aberta={paletaAberta} {trocarTema} baixarBackup={() => exportarJson(carregar())} {sair} />
  {/if}

  <!-- o rodapé aparece em todas as páginas; nas telas abertas (entrada e relatório por link) fica sem os atalhos do app -->
  <footer>
    <div class="rodape">
      <div class="rodape-sobre">
        <div class="rodape-marca">
          <a href={aberta ? undefined : '/'} class="nome-rodape">OrbisOS<span>_</span></a>
          <span class="badge-autor">Mariana Coutinho (Plauska)</span>
        </div>
        <p class="sobre-resumo">
          Ferramenta de supervisão de desenvolvimento. Transforma o painel do gestor (prints, texto ou CSV) em acompanhamento e relatório: lê cards, prazos, ritmo e totais; compara semana com semana; gera semáforo e constatações; guarda plano, riscos e compromissos; emite PDF ou link interativo para a gestão responder (Ciente, Concordo, Dúvida).
        </p>
      </div>

      <div class="rodape-direita">
        {#if !aberta}
          <div class="rodape-links">
            <a href="/painel">Diário</a>
            <a href="/cards">Cards</a>
            <a href="/semana">Semana</a>
            <a href="/fluxos">Fluxos</a>
            <a href="/relatorio">Relatório</a>
            <a href="/modelos">Modelos</a>
            <a href="/roadmap">Roadmap</a>
          </div>
        {/if}
        <a href="https://github.com/MarianaPlauska/gerador-relat-rio" target="_blank" rel="noopener noreferrer" class="card-github">
          <svg class="git-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          <span class="git-repo">GitHub: MarianaPlauska/gerador-relat-rio</span>
        </a>
      </div>
    </div>
  </footer>
</div>

<style>
  .pagina
  {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .conteudo
  {
    flex: 1 0 auto;
  }
  footer
  {
    margin-top: var(--size-6);
    flex-shrink: 0;
    background: var(--barra);
    border-top: 1px solid var(--borda-forte);
    color: #9aa5b4;
    font-size: 0.78rem;
  }
  .rodape
  {
    max-width: 1280px;
    margin: 0 auto;
    padding: 14px var(--size-6);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 16px 32px;
  }
  .rodape-sobre
  {
    flex: 1 1 480px;
    max-width: 720px;
  }
  .rodape-marca
  {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .nome-rodape
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 0.98rem;
    color: #fff;
    text-decoration: none;
  }
  .nome-rodape span
  {
    color: var(--marca);
  }
  .badge-autor
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--marca);
  }
  .sobre-resumo
  {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.4;
    color: #9aa5b4;
  }
  .rodape-direita
  {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  .rodape-links
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  .rodape-links a
  {
    font-family: var(--fonte-maquina);
    color: #c9d3cd;
    text-decoration: none;
    font-size: 0.76rem;
    transition: color 0.15s;
  }
  .rodape-links a:hover
  {
    color: var(--marca);
  }
  .card-github
  {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--raio-pequeno);
    text-decoration: none;
    color: #e4ebe7;
    transition: border-color 0.15s, color 0.15s;
  }
  .card-github:hover
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  .git-icon
  {
    width: 15px;
    height: 15px;
    flex: none;
  }
  .git-repo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.74rem;
  }
  @media (max-width: 760px)
  {
    .rodape
    {
      padding: 14px var(--size-3);
    }
    .rodape-direita
    {
      align-items: flex-start;
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
