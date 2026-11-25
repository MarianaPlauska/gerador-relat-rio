<script lang="ts">
  import { idCurto } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, salvar } from '#lib/armazenamento.ts';

  const dados = carregar();

  // quem já tem gente cadastrada pode abrir esta tela para rever a configuração: já vem com tudo aberto e preenchido
  let uso = $state<'equipe' | 'sozinha' | undefined>(dados.pessoas.length ? 'equipe' : undefined);
  let pasta = $state(dados.prefixo || 'DEV');
  let nomesEquipe = $state(dados.pessoas.map((p) => p.nome).join('\n'));

  // cada parte preenchida abre a próxima: uso -> pasta -> (se for equipe) pessoas
  const etapaAtual = $derived(!uso ? 1 : uso === 'sozinha' || pasta.trim() ? (uso === 'sozinha' ? 2 : 3) : 2);
  const etapas = $derived(
    uso === 'sozinha'
      ? [{ n: 1, rotulo: 'Uso' }, { n: 2, rotulo: 'Pasta' }]
      : [{ n: 1, rotulo: 'Uso' }, { n: 2, rotulo: 'Pasta' }, { n: 3, rotulo: 'Equipe' }],
  );

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

  function pular()
  {
    salvar({ ...dados, onboardingFeito: true });
    goto('/', { replaceState: true });
  }
</script>

<main>
  <span class="prompt">&gt; comecar</span>
  <h1>Vamos começar<span class="cursor">_</span></h1>

  <section class="cartao caixa-inicio">
    <h2>Antes de abrir o painel</h2>

    <div class="passos" role="list" aria-label="Passos">
      {#each etapas as et, i (et.n)}
        <div class="passo" class:feito={et.n < etapaAtual} class:atual={et.n === etapaAtual}>
          <span class="bolha">{et.n < etapaAtual ? '✓' : et.n}</span>
          <span class="rotulo-passo">{et.rotulo}</span>
        </div>
        {#if i < etapas.length - 1}<span class="linha" class:feita={et.n < etapaAtual}></span>{/if}
      {/each}
    </div>

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

    {#if uso}
      <label class="campo">
        <span>Nome da pasta / projeto</span>
        <input bind:value={pasta} placeholder="DEV" />
      </label>
    {/if}

    {#if uso === 'equipe' && pasta.trim()}
      <label class="campo">
        <span>Pessoas da equipe</span>
        <textarea bind:value={nomesEquipe} rows="4" placeholder={'Um nome por linha, por exemplo:\nRodrigo Cinelli\nDouglas Cerqueira'}></textarea>
        <small class="dica">Pode deixar em branco e adicionar depois na Início.</small>
      </label>
    {/if}

    <div class="acoes">
      <button type="button" class="link" onclick={pular}>Pular por enquanto</button>
      <button type="button" class="principal" onclick={concluir}>Começar</button>
    </div>
  </section>
</main>

<style>
  .caixa-inicio
  {
    max-width: 560px;
    display: grid;
    gap: var(--size-4);
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
    gap: 4px;
    color: var(--suave);
  }
  .bolha
  {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--borda-forte);
    background: var(--superficie-2);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .rotulo-passo
  {
    font-size: 0.76rem;
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
    margin: 13px 8px 0;
    background: var(--borda-forte);
  }
  .linha.feita
  {
    background: var(--marca);
  }
  .opcoes-uso
  {
    display: grid;
    gap: var(--size-2);
  }
  .opcoes-uso label
  {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--size-2);
    padding: var(--size-3);
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
    font-size: 0.82rem;
  }
  .campo
  {
    display: grid;
    gap: 6px;
  }
  .campo > span
  {
    font-size: 0.85rem;
    font-weight: 600;
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
