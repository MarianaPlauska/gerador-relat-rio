<script lang="ts">
  import { nomesSecoes, nomesTotais, type Bloco, type SecaoPadrao, type TotaisPainel } from '@supervisao/core';
  import { rotuloBloco } from './modelos.ts';

  let { blocos, onmudar }: { blocos: Bloco[]; onmudar: (novos: Bloco[]) => void } = $props();

  const indicadores = Object.entries(nomesTotais) as [keyof TotaisPainel, string][];
  const secoesFora = $derived((Object.keys(nomesSecoes) as SecaoPadrao[]).filter((s) => !blocos.some((b) => b.tipo === 'secao' && b.secao === s)));
  let aberto = $state<number | undefined>();

  function mudar(i: number, novo: Bloco)
  {
    onmudar(blocos.map((b, j) => (j === i ? novo : b)));
  }

  function mover(i: number, passo: number)
  {
    const j = i + passo;
    if (j < 0 || j >= blocos.length) return;
    const novos = [...blocos];
    [novos[i], novos[j]] = [novos[j]!, novos[i]!];
    onmudar(novos);
    if (aberto === i) aberto = j;
  }

  function remover(i: number)
  {
    onmudar(blocos.filter((_, j) => j !== i));
    aberto = undefined;
  }

  // o bloco novo entra no fim e já abre para editar
  function adicionar(b: Bloco)
  {
    const posicao = blocos.length;
    onmudar([...blocos, b]);
    aberto = b.tipo === 'secao' || b.tipo === 'quebra' ? undefined : posicao;
  }

  function alternarIndicador(i: number, b: Extract<Bloco, { tipo: 'tabela' }>, chave: keyof TotaisPainel)
  {
    mudar(i, { ...b, indicadores: b.indicadores.includes(chave) ? b.indicadores.filter((x) => x !== chave) : [...b.indicadores, chave] });
  }
</script>

<ol class="blocos">
  {#each blocos as b, i (i)}
    <li class={b.tipo}>
      <div class="linha">
        <span class="n">{i + 1}</span>
        {#if b.tipo === 'texto' || b.tipo === 'grafico' || b.tipo === 'tabela'}
          <button class="nome editavel" onclick={() => (aberto = aberto === i ? undefined : i)}>{rotuloBloco(b)} <small>{aberto === i ? 'fechar' : 'editar'}</small></button>
        {:else}
          <span class="nome">{rotuloBloco(b)}</span>
        {/if}
        <button class="mini" title="Subir" disabled={i === 0} onclick={() => mover(i, -1)}>&uarr;</button>
        <button class="mini" title="Descer" disabled={i === blocos.length - 1} onclick={() => mover(i, 1)}>&darr;</button>
        <button class="mini" title="Remover" onclick={() => remover(i)}>&times;</button>
      </div>
      {#if aberto === i}
        <div class="edicao">
          {#if b.tipo === 'texto'}
            <label>Título <input value={b.titulo} oninput={(e) => mudar(i, { ...b, titulo: e.currentTarget.value })} /></label>
            <label>Texto <textarea rows="5" value={b.texto} oninput={(e) => mudar(i, { ...b, texto: e.currentTarget.value })} placeholder="Um parágrafo por linha. Linhas com - viram lista."></textarea></label>
          {:else if b.tipo === 'grafico'}
            <label>Indicador
              <select value={b.indicador} onchange={(e) => mudar(i, { ...b, indicador: e.currentTarget.value as keyof TotaisPainel })}>
                {#each indicadores as [chave, nome] (chave)}<option value={chave}>{nome}</option>{/each}
              </select>
            </label>
            <label>Legenda (opcional) <input value={b.titulo ?? ''} oninput={(e) => mudar(i, { ...b, titulo: e.currentTarget.value || undefined })} /></label>
            <label class="marca"><input type="checkbox" checked={!!b.comMeta} onchange={(e) => mudar(i, { ...b, comMeta: e.currentTarget.checked })} /> mostrar a meta do painel</label>
          {:else if b.tipo === 'tabela'}
            <label>Legenda (opcional) <input value={b.titulo ?? ''} oninput={(e) => mudar(i, { ...b, titulo: e.currentTarget.value || undefined })} /></label>
            <div class="indicadores">
              {#each indicadores as [chave, nome] (chave)}
                <label class="marca"><input type="checkbox" checked={b.indicadores.includes(chave)} onchange={() => alternarIndicador(i, b, chave)} /> {nome}</label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </li>
  {:else}
    <li class="vazio">Nenhum bloco. Adicione abaixo.</li>
  {/each}
</ol>

<div class="adicionar">
  <button onclick={() => adicionar({ tipo: 'texto', titulo: 'Observações', texto: '' })}>+ Texto</button>
  <button onclick={() => adicionar({ tipo: 'grafico', indicador: 'dentroDoPrazoPct', comMeta: true })}>+ Gráfico</button>
  <button onclick={() => adicionar({ tipo: 'tabela', indicadores: ['dentroDoPrazoPct', 'concluidos'] })}>+ Tabela</button>
  <button onclick={() => adicionar({ tipo: 'quebra' })}>+ Quebra de página</button>
  {#if secoesFora.length}
    <select value="" onchange={(e) => { const s = e.currentTarget.value as SecaoPadrao; e.currentTarget.value = ''; if (s) adicionar({ tipo: 'secao', secao: s }); }}>
      <option value="">+ Seção pronta...</option>
      {#each secoesFora as s (s)}<option value={s}>{nomesSecoes[s]}</option>{/each}
    </select>
  {/if}
</div>

<style>
  .blocos
  {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 4px;
  }
  li
  {
    border: 1px solid var(--borda);
    border-left: 3px solid var(--marca);
    border-radius: 8px;
    background: var(--superficie);
  }
  li.texto, li.grafico, li.tabela
  {
    border-left-color: var(--amarelo);
  }
  li.quebra
  {
    border-left-color: var(--borda);
    border-style: dashed;
  }
  li.vazio
  {
    padding: 8px;
    font-size: 0.85rem;
    color: var(--suave);
  }
  .linha
  {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
  }
  .n
  {
    font-family: var(--fonte-maquina, monospace);
    font-size: 0.75rem;
    color: var(--suave);
    width: 18px;
  }
  .nome
  {
    flex: 1;
    font-size: 0.86rem;
    text-align: left;
  }
  .editavel
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--texto);
    font: inherit;
    font-size: 0.86rem;
  }
  .editavel small
  {
    color: var(--marca);
    text-decoration: underline;
    margin-left: 4px;
  }
  .mini
  {
    width: 26px;
    height: 26px;
    padding: 0;
    font-size: 0.9rem;
  }
  .edicao
  {
    display: grid;
    gap: 8px;
    padding: 8px 10px 10px 28px;
    border-top: 1px dashed var(--borda);
  }
  .edicao label
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.82rem;
  }
  .edicao label.marca
  {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
  .indicadores
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 8px;
    max-height: 180px;
    overflow-y: auto;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .adicionar
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .adicionar button, .adicionar select
  {
    font-size: 0.8rem;
    padding: 5px 9px;
  }
</style>
