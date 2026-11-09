<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();

  const links = [
    { href: '/', nome: 'Entrada do painel' },
    { href: '/cards', nome: 'Cards' },
    { href: '/semana', nome: 'Semana' },
    { href: '/relatorio', nome: 'Relatório' },
  ];
</script>

<nav>
  <span class="marca">Supervisão <b>DEV</b></span>
  {#each links as l (l.href)}
    <a href={l.href} class:ativo={page.url.pathname === l.href}>{l.nome}</a>
  {/each}
</nav>

{@render children()}

<style>
  nav
  {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 24px;
    background: var(--marca-escura);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .marca
  {
    color: #fff;
    margin-right: 24px;
    letter-spacing: 0.02em;
  }
  a
  {
    color: #b8cdd2;
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 0.92rem;
  }
  a:hover
  {
    color: #fff;
  }
  .ativo
  {
    background: rgb(255 255 255 / 12%);
    color: #fff;
  }
  @media print
  {
    nav
    {
      display: none;
    }
  }
</style>
