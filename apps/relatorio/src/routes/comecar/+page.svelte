<script lang="ts">
  import { idCurto } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, salvar } from '#lib/armazenamento.ts';

  const dados = carregar();

  // quem já tem gente cadastrada pode abrir esta tela para rever a configuração; o formulário vem preenchido com o que já existe
  let uso = $state<'equipe' | 'sozinha'>('equipe');
  let pasta = $state(dados.prefixo || 'DEV');
  let nomesEquipe = $state(dados.pessoas.map((p) => p.nome).join('\n'));

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

    <label class="campo">
      <span>Nome da pasta / projeto</span>
      <input bind:value={pasta} placeholder="DEV" />
    </label>

    {#if uso === 'equipe'}
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
