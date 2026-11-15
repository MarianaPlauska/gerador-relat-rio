<script lang="ts">
  import { roadmap, type SituacaoRoadmap } from '#lib/roadmap.ts';

  const nomes: Record<SituacaoRoadmap, string> = { pronto: 'pronto', andando: 'em teste', planejado: 'planejado' };
</script>

<main>
  <span class="prompt">&gt; roadmap</span>
  <h1>Roadmap<span class="cursor">_</span></h1>
  <p class="dica">O que o OrbisOS já faz em 2026 e o que vem em 2027. As datas são a intenção, não promessa.</p>

  {#each roadmap as etapa (etapa.periodo)}
    <section class="cartao">
      <h2>{etapa.periodo}</h2>
      <ul>
        {#each etapa.itens as item (item.titulo)}
          <li>
            <span class="marca {item.situacao}">{nomes[item.situacao]}</span>
            <div><b>{item.titulo}</b><p class="dica">{item.texto}</p></div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</main>

<style>
  ul
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li
  {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: var(--size-3);
    padding: var(--size-3) 0;
    border-bottom: 1px dashed var(--borda);
    align-items: baseline;
  }
  li:last-child
  {
    border-bottom: none;
  }
  li p
  {
    margin: 2px 0 0;
  }
  .marca
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid var(--borda-forte);
    border-radius: 999px;
    padding: 1px 8px;
    text-align: center;
    color: var(--suave);
  }
  .marca.pronto
  {
    color: var(--verde);
    border-color: var(--verde);
  }
  .marca.andando
  {
    color: var(--amarelo);
    border-color: var(--amarelo);
  }
</style>
