<script lang="ts">
  import { gruposDaPlanilha, lerValor, novaLinha, totaisPorGrupo, type LinhaPlanilha, type Planilha, type PrioridadeLinha, type SituacaoLinha } from '@supervisao/core';
  import { moeda } from '#lib/formato.ts';

  let { planilha = $bindable() }: { planilha: Planilha } = $props();

  const grupos = $derived(gruposDaPlanilha(planilha));
  const subtotais = $derived(new Map(totaisPorGrupo(planilha).map((g) => [g.grupo, g])));
  let filtro = $state('');
  let grupoNovo = $state('');

  const numero = (l: LinhaPlanilha, campo: 'min' | 'ref' | 'max', texto: string) =>
  {
    l[campo] = lerValor(texto);
  };

  function adicionarLinha(grupo: string)
  {
    planilha.grupos = gruposDaPlanilha(planilha);
    planilha.linhas.push(novaLinha(grupo));
  }

  function adicionarGrupo()
  {
    const nome = grupoNovo.trim();
    if (!nome || grupos.includes(nome)) return;
    planilha.grupos = [...gruposDaPlanilha(planilha), nome];
    planilha.linhas.push(novaLinha(nome));
    grupoNovo = '';
  }

  function moverGrupo(grupo: string, passo: number)
  {
    const lista = gruposDaPlanilha(planilha);
    const i = lista.indexOf(grupo);
    const j = i + passo;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    planilha.grupos = lista;
  }

  function removerLinha(id: string)
  {
    planilha.linhas = planilha.linhas.filter((l) => l.id !== id);
  }

  function removerGrupo(grupo: string)
  {
    if (!confirm(`Remover o grupo "${grupo}" e os itens dele?`)) return;
    planilha.linhas = planilha.linhas.filter((l) => l.grupo !== grupo);
    planilha.grupos = planilha.grupos.filter((g) => g !== grupo);
  }

  const visivel = (l: LinhaPlanilha) => !filtro.trim() || `${l.item} ${l.detalhe} ${l.loja} ${l.observacao}`.toLowerCase().includes(filtro.toLowerCase());
</script>

<section class="cartao">
  <div class="topo">
    <h2>Itens</h2>
    <input class="busca" bind:value={filtro} placeholder="Filtrar itens" aria-label="Filtrar itens" />
  </div>
  <div class="rolagem">
    {#each grupos as grupo, gi (grupo)}
      {@const linhas = planilha.linhas.filter((l) => l.grupo === grupo)}
      <div class="grupo">
        <div class="cab-grupo">
          <b>{grupo}</b>
          <span class="dica maquina">{subtotais.get(grupo)?.itens ?? 0} incluídos · {moeda(subtotais.get(grupo)?.ref, planilha.moeda)}</span>
          <span class="acoes">
            <button class="x" title="Subir o grupo" disabled={gi === 0} onclick={() => moverGrupo(grupo, -1)}>▲</button>
            <button class="x" title="Descer o grupo" disabled={gi === grupos.length - 1} onclick={() => moverGrupo(grupo, 1)}>▼</button>
            <button class="x" title="Remover o grupo" onclick={() => removerGrupo(grupo)}>x</button>
          </span>
        </div>
        <table>
          <thead>
            <tr><th>Incluir</th><th>Item</th><th>Link</th><th>Detalhe</th><th>Loja</th><th>Qtd</th><th>Mín</th><th>Ref</th><th>Máx</th><th>Situação</th><th>Prioridade</th><th>Observação</th><th></th></tr>
          </thead>
          <tbody>
            {#each linhas.filter(visivel) as l (l.id)}
              <tr class:fora={!l.incluir}>
                <td><input type="checkbox" bind:checked={l.incluir} aria-label="Incluir no total" /></td>
                <td><input class="largo" bind:value={l.item} /></td>
                <td class="link">
                  <input class="curtolink" placeholder="https://..." value={l.link ?? ''} onchange={(e) => (l.link = e.currentTarget.value.trim() || undefined)} />
                  {#if l.link}<a href={l.link} target="_blank" rel="noopener noreferrer" title="Abrir o link">abrir</a>{/if}
                </td>
                <td><input class="largo" bind:value={l.detalhe} /></td>
                <td><input class="medio" bind:value={l.loja} /></td>
                <td><input class="curto" type="number" min="0" step="any" bind:value={l.qtd} /></td>
                {#each ['min', 'ref', 'max'] as const as campo (campo)}
                  <td><input class="valor" inputmode="decimal" value={l[campo] ?? ''} onchange={(e) => numero(l, campo, e.currentTarget.value)} /></td>
                {/each}
                <td>
                  <select bind:value={l.situacao} class:estim={l.situacao === 'estimativa'}>
                    {#each [['verificado', 'Verificado'], ['estimativa', 'Estimativa']] as [v, n] (v)}<option value={v as SituacaoLinha}>{n}</option>{/each}
                  </select>
                </td>
                <td>
                  <select bind:value={l.prioridade}>
                    {#each [['essencial', 'Essencial'], ['importante', 'Importante'], ['desejavel', 'Desejável']] as [v, n] (v)}<option value={v as PrioridadeLinha}>{n}</option>{/each}
                  </select>
                </td>
                <td><input class="largo" bind:value={l.observacao} /></td>
                <td><button class="x" title="Remover o item" onclick={() => removerLinha(l.id)}>x</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <button class="link-btn" onclick={() => adicionarLinha(grupo)}>+ item em {grupo}</button>
      </div>
    {/each}
  </div>
  <div class="novo-grupo">
    <input bind:value={grupoNovo} placeholder="Novo grupo" onkeydown={(e) => e.key === 'Enter' && adicionarGrupo()} />
    <button disabled={!grupoNovo.trim()} onclick={adicionarGrupo}>Adicionar grupo</button>
  </div>
</section>

<style>
  .topo
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-3);
    margin-bottom: var(--size-3);
  }
  .topo h2
  {
    margin: 0;
  }
  .busca
  {
    width: 220px;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  .grupo
  {
    margin-bottom: var(--size-5);
  }
  .cab-grupo
  {
    display: flex;
    align-items: center;
    gap: var(--size-3);
    padding: var(--size-2) var(--size-3);
    background: var(--superficie-2);
    border-left: 3px solid var(--marca);
    border-radius: var(--raio-pequeno);
  }
  .acoes
  {
    margin-left: auto;
    display: flex;
    gap: var(--size-1);
  }
  table input, table select
  {
    padding: 2px var(--size-1);
    font-size: 0.82rem;
  }
  .largo
  {
    width: 170px;
  }
  .medio
  {
    width: 120px;
  }
  .curtolink
  {
    width: 96px;
  }
  .valor
  {
    width: 84px;
    text-align: right;
  }
  .curto
  {
    width: 56px;
  }
  tr.fora td
  {
    opacity: 0.55;
  }
  select.estim
  {
    background: var(--amarelo-fundo);
  }
  td.link
  {
    white-space: nowrap;
  }
  .x
  {
    border: none;
    background: none;
    color: var(--suave);
    padding: 0 var(--size-2);
  }
  .x:hover:not(:disabled)
  {
    color: var(--vermelho);
  }
  .link-btn
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: var(--size-2) 0;
    font-size: 0.84rem;
  }
  .novo-grupo
  {
    display: flex;
    gap: var(--size-2);
  }
</style>
