<script lang="ts">
  import { idCurto } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, salvar } from '#lib/armazenamento.ts';

  const dados = carregar();

  // quem já tem gente cadastrada pode abrir esta tela para rever a configuração: já vem preenchida com o que já existe
  let uso = $state<'equipe' | 'sozinha' | undefined>(dados.pessoas.length ? 'equipe' : undefined);
  let pasta = $state(dados.prefixo || 'DEV');
  let nomesEquipe = $state(dados.pessoas.map((p) => p.nome).join('\n'));

  // um passo por vez: o 1 pergunta o uso, o resto (pasta, e se for equipe, as pessoas) vem depois, até Concluir
  let passo = $state(1);
  const ultimoPasso = $derived(uso === 'sozinha' ? 2 : 3);
  const etapas = $derived(
    uso === 'sozinha'
      ? [{ n: 1, rotulo: 'Uso' }, { n: 2, rotulo: 'Pasta' }]
      : [{ n: 1, rotulo: 'Uso' }, { n: 2, rotulo: 'Pasta' }, { n: 3, rotulo: 'Equipe' }],
  );
  const podeAvancar = $derived(passo === 1 ? !!uso : passo === 2 ? !!pasta.trim() : true);
  const rotuloBotao = $derived(passo === ultimoPasso ? 'Concluir' : 'Avançar');

  function idDoNome(nome: string): string
  {
    return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || idCurto();
  }

  function concluir()
  {
    const p = pasta.trim().toUpperCase() || 'DEV';
    const pessoas = uso === 'equipe'
      ? nomesEquipe.split('\n').map((n) => n.trim()).filter(Boolean).map((nome) => ({ id: idDoNome(nome), nome, capacidadeHorasSemana: 40, pastas: [p] }))
      : [];
    salvar({ ...dados, prefixo: p, projetos: [p], pessoas, onboardingFeito: true });
    goto('/', { replaceState: true });
  }

  function avancar()
  {
    if (!podeAvancar) return;
    if (passo === ultimoPasso) concluir();
    else passo += 1;
  }

  function voltar()
  {
    passo = Math.max(1, passo - 1);
  }

  function pular()
  {
    salvar({ ...dados, onboardingFeito: true });
    goto('/', { replaceState: true });
  }
</script>

<div class="tela-comecar">
  <main class="caixa-comecar">
    <span class="prompt">&gt; comecar</span>
    <h1>Vamos começar<span class="cursor">_</span></h1>

    <section class="cartao caixa-inicio">
      <div class="passos" role="list" aria-label="Passos">
        {#each etapas as et, i (et.n)}
          <div class="passo" class:feito={et.n < passo} class:atual={et.n === passo}>
            <span class="bolha">{et.n < passo ? '✓' : et.n}</span>
            <span class="rotulo-passo">{et.rotulo}</span>
          </div>
          {#if i < etapas.length - 1}<span class="linha" class:feita={et.n < passo}></span>{/if}
        {/each}
      </div>

      {#if passo === 1}
        <p class="dica">Só para configurar certinho: como você vai usar o OrbisOS?</p>
        <div class="opcoes-uso" role="radiogroup">
          <label class:selecionada={uso === 'equipe'}>
            <input type="radio" bind:group={uso} value="equipe" />
            <span>Acompanho uma equipe</span>
            <small>Crio uma pasta/projeto e já cadastro quem executa as tarefas</small>
          </label>
          <label class:selecionada={uso === 'sozinha'}>
            <input type="radio" bind:group={uso} value="sozinha" />
            <span>Só o meu trabalho</span>
            <small>Sem equipe por enquanto; posso adicionar pessoas depois</small>
          </label>
        </div>
      {:else if passo === 2}
        <label class="campo">
          <span>Nome da pasta / projeto</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={pasta} placeholder="DEV" autofocus />
        </label>
      {:else if passo === 3}
        <label class="campo">
          <span>Pessoas da equipe</span>
          <textarea bind:value={nomesEquipe} rows="6" placeholder={'Um nome por linha, por exemplo:\nRodrigo Cinelli\nDouglas Cerqueira'}></textarea>
          <small class="dica">Pode deixar em branco e adicionar depois na Início.</small>
        </label>
      {/if}

      <div class="acoes">
        <button type="button" class="link" onclick={pular}>Pular por enquanto</button>
        <div class="botoes-nav">
          {#if passo > 1}
            <button type="button" onclick={voltar}>Voltar</button>
          {/if}
          <button type="button" class="principal" disabled={!podeAvancar} onclick={avancar}>{rotuloBotao}</button>
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  .tela-comecar
  {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    overflow: auto;
    padding: var(--size-6);
    background: var(--fundo);
  }
  .caixa-comecar
  {
    width: 100%;
    max-width: 680px;
  }
  .caixa-comecar > .prompt
  {
    display: block;
    margin-bottom: var(--size-1);
  }
  .caixa-comecar > h1
  {
    margin-bottom: var(--size-4);
  }
  .caixa-inicio
  {
    display: grid;
    gap: var(--size-5);
    padding: var(--size-6);
    font-size: 1.05rem;
  }
  .passos
  {
    display: flex;
    align-items: flex-start;
  }
  .passo
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    color: var(--suave);
  }
  .bolha
  {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--borda-forte);
    background: var(--superficie-2);
    font-size: 0.9rem;
    font-weight: 700;
  }
  .rotulo-passo
  {
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .passo.feito .bolha
  {
    border-color: var(--marca);
    background: var(--marca);
    color: var(--sobre-marca);
  }
  .passo.feito .rotulo-passo
  {
    color: var(--suave);
  }
  .passo.atual .bolha
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  .passo.atual .rotulo-passo
  {
    color: var(--texto);
    font-weight: 600;
  }
  .linha
  {
    flex: 1;
    height: 1px;
    margin: 16px 10px 0;
    background: var(--borda-forte);
  }
  .linha.feita
  {
    background: var(--marca);
  }
  .opcoes-uso
  {
    display: grid;
    gap: var(--size-3);
  }
  .opcoes-uso label
  {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--size-3);
    padding: var(--size-4);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
  }
  .opcoes-uso label.selecionada
  {
    border-color: var(--marca);
    background: var(--marca-clara);
  }
  .opcoes-uso input
  {
    grid-row: 1 / 3;
    align-self: start;
    margin-top: 3px;
  }
  .opcoes-uso span
  {
    font-weight: 600;
  }
  .opcoes-uso small
  {
    color: var(--suave);
    font-size: 0.85rem;
  }
  .campo
  {
    display: grid;
    gap: 8px;
    min-height: 160px;
  }
  .campo > span
  {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .campo input, .campo textarea
  {
    font-size: 1rem;
  }
  .campo textarea
  {
    font-family: var(--fonte-maquina);
    resize: vertical;
  }
  .acoes
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .botoes-nav
  {
    display: flex;
    gap: var(--size-2);
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--suave);
    text-decoration: underline;
  }
  .link:hover
  {
    color: var(--texto);
  }
</style>
