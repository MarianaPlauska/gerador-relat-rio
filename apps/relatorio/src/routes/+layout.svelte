<script lang="ts">
  import '@fontsource/courier-prime/400.css';
  import '@fontsource/courier-prime/700.css';
  import '@fontsource/ibm-plex-sans/400.css';
  import '@fontsource/ibm-plex-sans/600.css';
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();

  const links = [
    { href: '/', nome: 'Início' },
    { href: '/painel', nome: 'Colar painel' },
    { href: '/cards', nome: 'Cards' },
    { href: '/semana', nome: 'Semana' },
    { href: '/relatorio', nome: 'Relatório' },
  ];
</script>

<nav>
  <a href="/" class="marca">supervisão<span>_dev</span></a>
  <div class="links">
    {#each links as l (l.href)}
      <a href={l.href} class:ativo={page.url.pathname === l.href}>{l.nome}</a>
    {/each}
  </div>
</nav>

{@render children()}

<style>
  nav
  {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 0 28px;
    height: 60px;
    background: var(--marca-escura);
    border-bottom: 1px solid #000;
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
  }
  .marca span
  {
    color: var(--marca);
  }
  .links
  {
    display: flex;
    gap: 4px;
    height: 100%;
    overflow-x: auto;
  }
  .links a
  {
    display: flex;
    align-items: center;
    font-family: var(--fonte-maquina);
    color: #9aa39e;
    text-decoration: none;
    padding: 0 14px;
    font-size: 0.95rem;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  .links a:hover
  {
    color: #fff;
  }
  .links .ativo
  {
    color: #fff;
    border-bottom-color: var(--marca);
    font-weight: 700;
  }
</style>
