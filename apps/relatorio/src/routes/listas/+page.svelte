<script lang="ts">
  import { idCurto, itensDoTexto, modelosDeLista, novaLista, progressoDaLista, situacaoDoItem, type ItemLista, type Lista, type SituacaoItem } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerImagem } from '#lib/ocr.ts';
  import { dataMedia, hoje } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  let atualId = $state(dados.listas[0]?.id);
  let criando = $state(!dados.listas.length);
  let nomeNova = $state('');
  let etapasNova = $state('');
  let colado = $state('');
  let lendo = $state<number | null>(null);
  let busca = $state('');
  let filtro = $state<'todas' | 'pendentes' | SituacaoItem>('todas');
  let marcadorFiltro = $state('');
  let aberto = $state<string | undefined>();
  let editandoEtapas = $state(false);

  const lista = $derived(dados.listas.find((l) => l.id === atualId));
  const progresso = $derived(lista ? progressoDaLista(lista) : undefined);
  const marcadores = $derived(lista ? [...new Set(lista.itens.map((i) => i.marcador).filter((m): m is string => !!m))].sort() : []);
  const visiveis = $derived(!lista ? [] : lista.itens.filter((i) =>
  {
    const s = situacaoDoItem(lista, i).situacao;
    if (filtro === 'pendentes' ? s === 'concluido' : filtro !== 'todas' && s !== filtro) return false;
    if (marcadorFiltro && i.marcador !== marcadorFiltro) return false;
    return !busca || `${i.nome} ${i.notas}`.toLowerCase().includes(busca.toLowerCase());
  }));
  const nomesSituacao: Record<SituacaoItem, string> = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído' };

  function usarModelo(m: (typeof modelosDeLista)[number])
  {
    nomeNova = m.nome;
    etapasNova = m.etapas.join('\n');
  }

  function criar()
  {
    const l = novaLista(nomeNova.trim() || 'Nova lista', etapasNova.split('\n'), modelosDeLista.find((m) => m.nome === nomeNova.trim())?.descricao ?? '', hoje());
    dados.listas.push(l);
    atualId = l.id;
    criando = false;
    nomeNova = '';
    etapasNova = '';
  }

  function excluirLista(l: Lista)
  {
    if (!confirm(`Excluir a lista "${l.nome}" com ${l.itens.length} itens e as anotações?`)) return;
    dados.listas = dados.listas.filter((x) => x.id !== l.id);
    atualId = dados.listas[0]?.id;
    criando = !dados.listas.length;
  }

  function adicionar()
  {
    if (!lista) return;
    lista.itens.push(...itensDoTexto(colado, lista.itens.map((i) => i.nome), hoje()));
    colado = '';
  }

  async function lerPrint(e: Event & { currentTarget: HTMLInputElement })
  {
    const arquivo = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!arquivo) return;
    lendo = 0;
    try
    {
      colado = await lerImagem(arquivo, (p) => (lendo = p));
    }
    finally
    {
      lendo = null;
    }
  }

  function marcar(item: ItemLista, etapaId: string)
  {
    if (item.feitas[etapaId]) delete item.feitas[etapaId];
    else item.feitas[etapaId] = hoje();
    item.atualizadoEm = hoje();
  }

  function marcarTodas(item: ItemLista)
  {
    if (!lista) return;
    const tudo = situacaoDoItem(lista, item).situacao === 'concluido';
    item.feitas = tudo ? {} : Object.fromEntries(lista.etapas.map((e) => [e.id, item.feitas[e.id] ?? hoje()]));
    item.atualizadoEm = hoje();
  }

  function removerItem(item: ItemLista)
  {
    if (!lista || !confirm(`Remover "${item.nome}" da lista?`)) return;
    lista.itens = lista.itens.filter((i) => i.id !== item.id);
  }

  function removerEtapa(id: string)
  {
    if (!lista || !confirm('Remover esta etapa? As marcações dela somem de todos os itens.')) return;
    lista.etapas = lista.etapas.filter((e) => e.id !== id);
    for (const i of lista.itens) delete i.feitas[id];
  }

  function moverEtapa(i: number, passo: number)
  {
    if (!lista) return;
    const j = i + passo;
    if (j < 0 || j >= lista.etapas.length) return;
    [lista.etapas[i], lista.etapas[j]] = [lista.etapas[j]!, lista.etapas[i]!];
  }
</script>

<main>
  <span class="etiqueta">listas</span>
  <h1>Listas de checagem<span class="cursor">_</span></h1>
  <p class="dica">Cada lista tem as suas etapas; cada linha (uma empresa, por exemplo) marca o que já foi feito e guarda o que você fez e por quê.</p>

  <nav class="abas">
    {#each dados.listas as l (l.id)}
      <button class:ativa={l.id === atualId && !criando} onclick={() => { atualId = l.id; criando = false; aberto = undefined; }}>
        {l.nome} <small>{progressoDaLista(l).concluidos}/{l.itens.length}</small>
      </button>
    {/each}
    <button class="nova" class:ativa={criando} onclick={() => (criando = true)}>+ nova lista</button>
  </nav>

  {#if criando}
    <section class="cartao">
      <h2>Nova lista</h2>
      <div class="modelos">
        <span class="dica">Começar de um modelo:</span>
        {#each modelosDeLista as m (m.nome)}<button onclick={() => usarModelo(m)}>{m.nome}</button>{/each}
      </div>
      <label>Nome <input bind:value={nomeNova} placeholder="Ex.: Teste de agendamentos" /></label>
      <label>Etapas, uma por linha <textarea rows="5" bind:value={etapasNova} placeholder={'Verificar se há agendamentos\nBaixar a planilha\n...'}></textarea></label>
      <button class="principal" disabled={!etapasNova.trim()} onclick={criar}>Criar lista</button>
    </section>
  {:else if lista && progresso}
    <section class="cartao">
      <div class="cabeca">
        <input class="titulo" bind:value={lista.nome} aria-label="Nome da lista" />
        <div class="acoes">
          <button class="link" onclick={() => (editandoEtapas = !editandoEtapas)}>{editandoEtapas ? 'fechar etapas' : 'editar etapas'}</button>
          <button class="link perigo" onclick={() => excluirLista(lista)}>excluir lista</button>
        </div>
      </div>
      <input class="descricao" bind:value={lista.descricao} placeholder="Para que serve esta lista" aria-label="Descrição" />
      <div class="progresso">
        <div class="barra"><span style="width: {progresso.pct}%"></span></div>
        <span><b>{progresso.concluidos}</b> de {progresso.total} concluídos ({progresso.pct}%) - {progresso.emAndamento} em andamento - {progresso.naoIniciados} não iniciados</span>
      </div>

      {#if editandoEtapas}
        <div class="etapas-edicao">
          {#each lista.etapas as e, i (e.id)}
            <div class="linha">
              <span class="n">{i + 1}</span>
              <input bind:value={e.nome} />
              <button class="mini" disabled={i === 0} onclick={() => moverEtapa(i, -1)}>&uarr;</button>
              <button class="mini" disabled={i === lista.etapas.length - 1} onclick={() => moverEtapa(i, 1)}>&darr;</button>
              <button class="mini" onclick={() => removerEtapa(e.id)}>&times;</button>
            </div>
          {/each}
          <button onclick={() => lista.etapas.push({ id: idCurto(), nome: 'Nova etapa' })}>+ etapa</button>
        </div>
      {/if}
    </section>

    <section class="cartao">
      <details open={!lista.itens.length}>
        <summary>Adicionar itens</summary>
        <p class="dica">Cole do Excel (nome numa coluna e etiqueta na outra) ou escreva um nome por linha. De um print, o texto lido aparece aqui para você conferir antes de adicionar. Nomes repetidos ficam de fora.</p>
        <textarea rows="5" bind:value={colado} placeholder={'AAXIS AI BRASIL SERVICOS EM TECNOLOGIA\tSó escritório\nCLÍNICA COPACABANA\tRisco médio'}></textarea>
        <div class="linha">
          <button class="principal" disabled={!colado.trim()} onclick={adicionar}>Adicionar {itensDoTexto(colado, lista.itens.map((i) => i.nome)).length || ''} itens</button>
          <label class="botao">Ler print <input type="file" accept="image/*" hidden onchange={lerPrint} /></label>
          {#if lendo !== null}<progress value={lendo}></progress> <span class="dica">lendo a imagem...</span>{/if}
        </div>
      </details>
    </section>

    {#if lista.itens.length}
      <section class="cartao">
        <div class="filtros">
          <input type="search" bind:value={busca} placeholder="Buscar nome ou anotação" />
          <select bind:value={filtro}>
            <option value="todas">Todas</option>
            <option value="pendentes">Pendentes</option>
            <option value="nao_iniciado">Não iniciadas</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluido">Concluídas</option>
          </select>
          {#if marcadores.length}
            <select bind:value={marcadorFiltro}>
              <option value="">Todas as etiquetas</option>
              {#each marcadores as m (m)}<option value={m}>{m}</option>{/each}
            </select>
          {/if}
          <span class="dica">{visiveis.length} de {lista.itens.length}</span>
        </div>

        <div class="rolagem">
          <table>
            <thead>
              <tr>
                <th class="n">#</th>
                <th>Item</th>
                {#each lista.etapas as e (e.id)}<th class="etapa">{e.nome}</th>{/each}
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {#each visiveis as item (item.id)}
                {@const s = situacaoDoItem(lista, item)}
                <tr class:feito={s.situacao === 'concluido'}>
                  <td class="n">{lista.itens.indexOf(item) + 1}</td>
                  <td>
                    <button class="nome" onclick={() => (aberto = aberto === item.id ? undefined : item.id)}>
                      {item.nome}
                      {#if item.notas}<span class="tem-nota" title={item.notas}>nota</span>{/if}
                    </button>
                    {#if item.marcador}<span class="marcador">{item.marcador}</span>{/if}
                  </td>
                  {#each lista.etapas as e (e.id)}
                    <td class="caixa">
                      <input type="checkbox" checked={!!item.feitas[e.id]} title={item.feitas[e.id] ? `feito em ${dataMedia(item.feitas[e.id])}` : e.nome} aria-label={e.nome} onchange={() => marcar(item, e.id)} />
                    </td>
                  {/each}
                  <td>
                    <button class="situacao {s.situacao}" title="marcar ou desmarcar todas" onclick={() => marcarTodas(item)}>{nomesSituacao[s.situacao]}</button>
                    <small>{s.feitas}/{s.total} etapas</small>
                  </td>
                </tr>
                {#if aberto === item.id}
                  <tr class="detalhe">
                    <td></td>
                    <td colspan={lista.etapas.length + 2}>
                      <div class="detalhe-grade">
                        <label>O que fiz e por quê
                          <textarea rows="3" value={item.notas} oninput={(ev) => { item.notas = ev.currentTarget.value; item.atualizadoEm = hoje(); }} placeholder="Ex.: sem agendamentos novos; planilha subiu com 3 linhas a menos porque o CPF começava com 0."></textarea>
                        </label>
                        <div>
                          <label>Etiqueta <input bind:value={item.marcador} placeholder="Só escritório, Risco baixo..." /></label>
                          <label>Nome <input bind:value={item.nome} /></label>
                          <p class="dica">
                            {#each lista.etapas.filter((e) => item.feitas[e.id]) as e (e.id)}{e.nome}: {dataMedia(item.feitas[e.id])}<br />{/each}
                            Atualizado em {dataMedia(item.atualizadoEm)}
                          </p>
                          <button class="link perigo" onclick={() => removerItem(item)}>remover da lista</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {/if}
</main>

<style>
  main
  {
    padding: 24px 28px 48px;
    max-width: 1240px;
    margin: 0 auto;
  }
  h1
  {
    font-size: 2rem;
    margin: 4px 0 6px;
  }
  .cursor
  {
    color: var(--marca);
  }
  h2
  {
    font-size: 1rem;
    margin: 0 0 10px;
  }
  .cartao
  {
    margin-top: 14px;
  }
  .abas
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;
  }
  .abas button
  {
    font-size: 0.84rem;
  }
  .abas .ativa
  {
    background: var(--tinta, #111);
    color: #fff;
  }
  .abas small
  {
    font-family: var(--fonte-maquina);
    opacity: 0.7;
    margin-left: 4px;
  }
  .nova
  {
    border-style: dashed;
  }
  .modelos, .linha, .filtros, .cabeca, .acoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .modelos
  {
    margin-bottom: 10px;
  }
  label
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.84rem;
    margin-bottom: 8px;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .cabeca
  {
    justify-content: space-between;
  }
  .titulo
  {
    font-family: var(--fonte-maquina);
    font-size: 1.2rem;
    font-weight: 700;
    border: none;
    background: none;
    padding: 2px 0;
    flex: 1;
    min-width: 200px;
  }
  .descricao
  {
    width: 100%;
    border: none;
    background: none;
    padding: 0;
    color: var(--suave);
    font-size: 0.86rem;
  }
  .progresso
  {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    font-size: 0.86rem;
  }
  .barra
  {
    flex: 0 0 220px;
    height: 8px;
    background: var(--borda);
    border-radius: 4px;
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--verde);
  }
  .etapas-edicao
  {
    margin-top: 12px;
    display: grid;
    gap: 6px;
    max-width: 560px;
  }
  .etapas-edicao input
  {
    flex: 1;
  }
  .n
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: var(--suave);
    width: 28px;
  }
  .mini
  {
    width: 28px;
    padding: 2px 0;
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.82rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  summary
  {
    cursor: var(--cursor-clique);
    color: var(--marca);
    font-weight: 600;
  }
  .filtros
  {
    margin-bottom: 10px;
  }
  .filtros input
  {
    min-width: 240px;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  table
  {
    width: 100%;
    border-collapse: collapse;
  }
  th
  {
    font-size: 0.72rem;
    text-align: left;
    vertical-align: bottom;
    padding: 6px;
  }
  th.etapa
  {
    width: 92px;
    text-align: center;
    font-weight: 600;
  }
  td
  {
    border-top: 1px solid var(--borda);
    padding: 8px 6px;
    vertical-align: middle;
  }
  tr.feito td
  {
    background: var(--verde-fundo);
  }
  .caixa
  {
    text-align: center;
  }
  .caixa input
  {
    width: 22px;
    height: 22px;
    accent-color: var(--verde);
    cursor: var(--cursor-clique);
  }
  .nome
  {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    text-align: left;
    color: var(--texto);
  }
  .tem-nota
  {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--marca);
    border: 1px solid var(--marca);
    border-radius: 4px;
    padding: 0 4px;
    margin-left: 4px;
  }
  .marcador
  {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    border: 1px solid var(--borda);
    border-radius: 6px;
    padding: 0 6px;
    margin-top: 3px;
  }
  .situacao
  {
    font-size: 0.74rem;
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .situacao.concluido
  {
    background: var(--verde);
    color: #fff;
    border-color: var(--verde);
  }
  .situacao.em_andamento
  {
    background: var(--marca-clara);
  }
  td small
  {
    display: block;
    color: var(--suave);
    font-size: 0.72rem;
  }
  .detalhe td
  {
    border-top: none;
    background: var(--superficie);
  }
  .detalhe-grade
  {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 16px;
  }
  @media (max-width: 800px)
  {
    .detalhe-grade
    {
      grid-template-columns: 1fr;
    }
  }
</style>
