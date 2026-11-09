<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
</script>

<nav>
  <a href="/" class:ativo={page.url.pathname === '/'}>Entrada do painel</a>
  <a href="/cards" class:ativo={page.url.pathname === '/cards'}>Cards</a>
</nav>

{@render children()}

<style>
  :global(body)
  {
    font-family: system-ui, sans-serif;
    margin: 0;
    background: #f6f7f8;
    color: #1d2329;
  }
  nav
  {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    background: #1d2329;
  }
  a
  {
    color: #c9d1d9;
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 6px;
  }
  .ativo
  {
    background: #2f3b46;
    color: #fff;
  }
</style>
