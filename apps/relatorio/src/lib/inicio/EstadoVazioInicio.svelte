<script lang="ts">
  let { projeto }: { projeto: string } = $props();
</script>

<section class="vazio">
  <div class="texto">
    <h2>Nenhum print salvo para {projeto}</h2>
    <p>Sem uma leitura do painel não há o que medir. Cole o primeiro print ou arquivo CSV no diário: a tela passa a mostrar a saúde da semana, as tarefas e a carga de cada pessoa.</p>
  </div>
  <a href="/painel" class="botao principal">Abrir diário do painel</a>
</section>

<style>
  .vazio
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px 32px;
    padding: 20px 22px;
    background: var(--superficie);
    border: 1px dashed var(--borda-forte);
    border-radius: var(--raio);
  }
  .texto
  {
    max-width: 62ch;
  }
  h2
  {
    margin: 0 0 4px;
    font-size: 1.05rem;
  }
  p
  {
    margin: 0;
    color: var(--suave);
    font-size: 0.92rem;
  }
  a
  {
    text-decoration: none;
  }
</style>
