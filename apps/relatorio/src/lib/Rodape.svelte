<script lang="ts">
  let { linkInicio = true }: { linkInicio?: boolean } = $props();

  const GITHUB = 'https://github.com/MarianaPlauska/gerador-relat-rio';
  const LINKEDIN = 'https://www.linkedin.com/in/mariana-costa-coutinho-715331249/';
</script>

<footer>
  <div class="rodape">
    <p class="sobre">
      <a href={linkInicio ? '/' : undefined} class="marca">OrbisOS<span>_</span></a>
      Do print ao relatório em um minuto: o painel da equipe vira decisão.
    </p>

    <nav class="links" aria-label="Autora e código">
      <a href={GITHUB} target="_blank" rel="noopener noreferrer" class="link-externo">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
      <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" class="link-externo">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
        Mariana Costa Coutinho
      </a>
    </nav>
  </div>
</footer>

<style>
  footer
  {
    margin-top: var(--size-6);
    flex-shrink: 0;
    background: var(--barra);
    border-top: 1px solid var(--borda-forte);
    color: #9aa5b4;
    font-size: 0.82rem;
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
    gap: 12px 32px;
  }
  .sobre
  {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
  }
  .marca
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 0.98rem;
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
    flex-wrap: wrap;
    gap: 8px;
  }
  .link-externo
  {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: rgb(255 255 255 / 4%);
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: var(--raio-pequeno);
    text-decoration: none;
    color: #e4ebe7;
    font-family: var(--fonte-maquina);
    font-size: 0.76rem;
    transition: border-color 0.15s, color 0.15s;
  }
  .link-externo:hover
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  svg
  {
    width: 15px;
    height: 15px;
    flex: none;
  }
  @media (max-width: 760px)
  {
    .rodape
    {
      padding: 14px var(--size-3);
    }
  }
</style>
