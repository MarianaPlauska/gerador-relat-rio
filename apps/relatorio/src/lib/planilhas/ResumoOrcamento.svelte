<script lang="ts">
  import { aplicarCortes, foraDoTotal, lerValor, ocupacao, sugestaoDeCortes, totaisDaLinha, totaisPorGrupo, totalGeral, type Planilha } from '@supervisao/core';
  import { moeda } from '#lib/formato.ts';

  let { planilha = $bindable() }: { planilha: Planilha } = $props();

  const grupos = $derived(totaisPorGrupo(planilha));
  const total = $derived(totalGeral(planilha));
  const uso = $derived(ocupacao(planilha));
  const cortes = $derived(sugestaoDeCortes(planilha));
  const fmt = (n: number | undefined) => `${moeda(n, planilha.moeda)}${planilha.unidade && n !== undefined ? ` ${planilha.unidade}` : ''}`;
  const doGrupo = (grupo: string) => uso?.porGrupo.find((g) => g.grupo === grupo);
  const cenarios = $derived(uso ? ([['Mínimo', uso.min], ['Referência', uso.ref], ['Máximo', uso.max]] as const) : []);
  const pctDoGrupo = (grupo: string) => uso?.porGrupo.find((g) => g.grupo === grupo)?.pctDoOrcamento;

  function mudarOrcamento(texto: string)
  {
    const v = lerValor(texto);
    planilha.orcamento = v && v > 0 ? v : undefined;
  }
</script>

<section class="cartao">
  <h2>Resumo por grupo</h2>
  <table>
    <thead>
      <tr><th>Grupo</th><th class="num">Itens</th><th class="num">Mínimo</th><th class="num">Referência</th><th class="num">Máximo</th><th class="num">% estimado</th>{#if uso}<th class="num">% do orçamento</th>{/if}</tr>
    </thead>
    <tbody>
      {#each grupos as g (g.grupo)}
        <tr>
          <td><b>{g.grupo}</b></td>
          <td class="num">{g.itens}</td>
          <td class="num">{fmt(g.min)}</td>
          <td class="num">{fmt(g.ref)}</td>
          <td class="num">{fmt(g.max)}</td>
          <td class="num" class:aviso-cel={g.pctEstimado >= 50}>{g.pctEstimado}%</td>
          {#if uso}
            {@const proprio = doGrupo(g.grupo)}
            <td class="num" class:estoura-cel={proprio?.estoura}>{proprio?.pctDoGrupo !== undefined ? `${proprio.pctDoGrupo}% de ${fmt(proprio.orcamentoDoGrupo)}` : `${pctDoGrupo(g.grupo) ?? 0}%`}</td>
          {/if}
        </tr>
      {/each}
      <tr class="total">
        <td>TOTAL</td><td class="num">{total.itens}</td><td class="num">{fmt(total.min)}</td><td class="num">{fmt(total.ref)}</td><td class="num">{fmt(total.max)}</td><td class="num">{total.pctEstimado}%</td>{#if uso}<td class="num">{uso.ref.pct}%</td>{/if}
      </tr>
    </tbody>
  </table>
  <p class="dica">Fora do total (Incluir = não): {fmt(foraDoTotal(planilha))}. Total se incluir tudo: {fmt(total.ref + foraDoTotal(planilha))}. % estimado é a parte do valor que ainda não foi verificada.</p>
</section>

<section class="cartao">
  <h2>Orçamento</h2>
  <label class="campo">Quanto posso gastar
    <input value={planilha.orcamento ?? ''} inputmode="decimal" placeholder="ex.: 25.000" onchange={(e) => mudarOrcamento(e.currentTarget.value)} />
  </label>

  {#if uso}
    <div class="cenarios">
      {#each cenarios as [nome, c] (nome)}
        <div class="cenario" class:estoura={c.estoura}>
          <span class="etiqueta">{nome}</span>
          <b class="maquina">{fmt(c.usado)}</b>
          <span class="barra"><span style:width="{Math.min(c.pct, 100)}%"></span></span>
          <span class="dica">{c.pct}% do orçamento · {c.estoura ? `estoura em ${fmt(-c.diferenca)}` : `sobra ${fmt(c.diferenca)}`}</span>
        </div>
      {/each}
    </div>

    {#if cortes.cortes.length}
      <div class="cortes">
        <h3>Para caber na referência</h3>
        <ul>
          {#each cortes.cortes as l (l.id)}<li><b>{l.item}</b> <span class="dica">{l.prioridade === 'desejavel' ? 'desejável' : 'importante'} · {fmt(totaisDaLinha(l).ref)}</span></li>{/each}
        </ul>
        <p class="dica">{cortes.cabe ? `Tirando esses itens o total fica em ${fmt(cortes.novoTotal)}.` : `Mesmo tirando tudo que não é essencial o total fica em ${fmt(cortes.novoTotal)}, acima do orçamento.`} Os itens continuam na planilha, só deixam de contar.</p>
        <button onclick={() => aplicarCortes(planilha, cortes.cortes.map((l) => l.id))}>Deixar de incluir esses itens</button>
      </div>
    {:else if uso.ref.estoura}
      <p class="aviso">A referência passa do orçamento, e só restam itens essenciais.</p>
    {/if}
  {:else}
    <p class="dica">Informe o orçamento para ver quanto dele está ocupado, o que sobra ou estoura e o que cortar para caber.</p>
  {/if}
</section>

<style>
  .total td
  {
    font-weight: 700;
    border-top: 2px solid var(--borda-forte);
  }
  .estoura-cel
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  .aviso-cel
  {
    color: var(--amarelo);
  }
  .campo
  {
    display: grid;
    gap: var(--size-1);
    max-width: 280px;
    margin-bottom: var(--size-4);
  }
  .cenarios
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: var(--size-3);
  }
  .cenario
  {
    display: grid;
    gap: var(--size-1);
    padding: var(--size-3);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    background: var(--superficie-2);
  }
  .cenario.estoura
  {
    border-color: var(--vermelho);
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--borda);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
  }
  .cenario.estoura .barra span
  {
    background: var(--vermelho);
  }
  .cortes
  {
    margin-top: var(--size-4);
  }
  .cortes ul
  {
    margin: 0 0 var(--size-2);
    padding-left: var(--size-5);
  }
  .cortes h3
  {
    margin-top: 0;
  }
</style>
