<script lang="ts">
  import type { ResumoPessoaProjeto } from '@supervisao/core';
  import DetalhePessoa from './DetalhePessoa.svelte';

  let { pessoas, projeto, expandida = $bindable(null), aoAdicionar, aoUmAUm }: {
    pessoas: ResumoPessoaProjeto[];
    projeto: string;
    expandida?: string | null;
    aoAdicionar: (nome: string) => void;
    aoUmAUm: (pessoaId: string) => void;
  } = $props();

  let novo = $state('');

  function adicionar()
  {
    if (!novo.trim()) return;
    aoAdicionar(novo.trim());
    novo = '';
  }
</script>

<section class="painel">
  <header>
    <div>
      <span class="etiqueta">Projeto {projeto}</span>
      <h2>Equipe <span class="contagem">{pessoas.length}</span></h2>
    </div>
    <a href="/semana">plano da semana</a>
  </header>

  <div class="rolagem">
    <table>
      <thead>
        <tr>
          <th>Pessoa</th>
          <th class="d">Tarefas</th>
          <th class="d" title="Tempo estipulado na semana / capacidade semanal">Horas</th>
          <th title="No ritmo, em risco e atrasadas">Ritmo</th>
          <th class="d" title="Nível de entrega na semana">Entrega</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each pessoas as p (p.pessoa.id)}
          {@const aberta = expandida === p.pessoa.id}
          <tr class="pessoa" class:aberta class:livre={p.total === 0} onclick={() => (expandida = aberta ? null : p.pessoa.id)}>
            <td>
              <button type="button" class="nome" aria-expanded={aberta} onclick={(e) => { e.stopPropagation(); expandida = aberta ? null : p.pessoa.id; }}>
                <span class="seta">{aberta ? '▾' : '▸'}</span>{p.pessoa.nome}
              </button>
              {#if p.estagioCritico}<span class="pilula atrasado" title={p.motivoEstagioCritico}>sobrecarregada</span>{/if}
            </td>
            <td class="d">{p.total}</td>
            <td class="d" title="{p.probabilidadeMaisServicosPct}% de chance de absorver mais serviços">{p.horasEstipuladasSemana}h / {p.capacidadeHorasSemana}h</td>
            <td>
              {#if p.total === 0}
                <span class="mudo">livre na semana</span>
              {:else}
                <div class="ritmo" title="{p.noRitmo} no ritmo · {p.emRisco} em risco · {p.atrasado} atrasadas">
                  <span class="r-ok" style:flex={p.noRitmo + p.concluidos}></span>
                  <span class="r-risco" style:flex={p.emRisco}></span>
                  <span class="r-atraso" style:flex={p.atrasado}></span>
                </div>
              {/if}
            </td>
            <td class="d">{p.total === 0 ? '-' : `${p.nivelEntregaPct}%`}</td>
            <td class="acao"><button type="button" class="mini" onclick={(e) => { e.stopPropagation(); aoUmAUm(p.pessoa.id); }} title="Abrir pauta de 1:1">1:1</button></td>
          </tr>
          {#if aberta}
            <tr class="linha-detalhe"><td colspan="6"><DetalhePessoa {p} /></td></tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <div class="adicionar">
    <input bind:value={novo} placeholder="Adicionar pessoa ao projeto {projeto}" onkeydown={(e) => e.key === 'Enter' && adicionar()} aria-label="Nome da pessoa" />
    <button type="button" onclick={adicionar} disabled={!novo.trim()}>Adicionar</button>
  </div>
</section>

<style>
  .painel
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px 18px;
    min-width: 0;
  }
  header
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }
  h2
  {
    margin: 0;
    font-size: 1.05rem;
  }
  .contagem
  {
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
    color: var(--suave);
    font-weight: 400;
    margin-left: 4px;
  }
  header a
  {
    color: var(--suave);
    font-size: 0.84rem;
    text-decoration: none;
  }
  header a:hover
  {
    color: var(--texto);
    text-decoration: underline;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  th, td
  {
    padding: 9px 6px;
    vertical-align: middle;
    white-space: nowrap;
  }
  th
  {
    border-bottom: 1px solid var(--borda-forte);
  }
  .d
  {
    text-align: right;
    font-family: var(--fonte-maquina);
    font-variant-numeric: tabular-nums;
  }
  th.d
  {
    font-family: var(--fonte-texto);
  }
  .pessoa
  {
    cursor: var(--cursor-clique);
  }
  .pessoa:hover, .pessoa.aberta
  {
    background: var(--superficie-2);
  }
  .nome
  {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: var(--texto);
    text-align: left;
  }
  .nome:hover:not(:disabled)
  {
    background: none;
    box-shadow: none;
  }
  .seta
  {
    display: inline-block;
    width: 14px;
    color: var(--suave);
    font-size: 0.75rem;
  }
  .livre td:not(:first-child)
  {
    color: var(--suave);
  }
  .livre .nome
  {
    font-weight: 500;
  }
  .mudo
  {
    color: var(--suave);
    font-size: 0.84rem;
  }
  .ritmo
  {
    display: flex;
    gap: 2px;
    width: 64px;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--borda);
  }
  .r-ok
  {
    background: var(--verde);
  }
  .r-risco
  {
    background: var(--amarelo);
  }
  .r-atraso
  {
    background: var(--vermelho);
  }
  .acao
  {
    text-align: right;
  }
  .mini
  {
    padding: 1px 8px;
    font-size: 0.78rem;
    color: var(--suave);
  }
  .pilula
  {
    display: block;
    width: max-content;
    margin: 3px 0 0 14px;
  }
  .linha-detalhe td
  {
    padding: 0;
    white-space: normal;
    border-bottom: 1px solid var(--borda);
  }
  .adicionar
  {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--borda);
  }
  .adicionar input
  {
    flex: 1;
    min-width: 0;
  }
</style>
