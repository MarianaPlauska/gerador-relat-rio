<script lang="ts">
  import
  {
    anotar, diarioDoPeriodo, idCurto, importarPlanilha, itensDaFase, itensDoTexto, linhasDoTexto, marcarEtapa, mensagemDoDia, modelosDeLista, moverParaFase,
    nomeSituacao, novaLista, previaDaPlanilha, progressoDosItens, situacaoDaFase, situacaoDoItem, textoDaLinha,
    type EstadoEtapa, type FaseLista, type ItemLista, type Lista, type SituacaoItem,
  } from '@supervisao/core';
  import { SvelteSet } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerImagem } from '#lib/ocr.ts';
  import { baixarCsv, lerArquivoPlanilha } from '#lib/planilha.ts';
  import { copiar } from '#lib/saidas.ts';
  import { dataCurta, dataMedia, hoje } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const dia = hoje();
  let atualId = $state(dados.listas[0]?.id);
  let aba = $state<'lista' | 'diario'>('lista');
  let criando = $state(!dados.listas.length);
  let nomeNova = $state('');
  let etapasNova = $state('');
  let fasesNova = $state('');
  let editando = $state(false);

  let busca = $state('');
  let filtro = $state<'todas' | 'pendentes' | SituacaoItem>('todas');
  let marcadorFiltro = $state('');
  let faltaEtapa = $state('');
  const abertos = new SvelteSet<string>();
  const recolhidas = new SvelteSet<string>();
  const selecionados = new SvelteSet<string>();
  let acaoEtapa = $state('');
  let acaoEstado = $state<EstadoEtapa>('feito');
  let acaoFase = $state('');

  let menu = $state<{ itemId: string; etapaId: string } | undefined>();
  let motivo = $state('');
  let ultima = $state<{ registroId: string; rotulo: string } | undefined>();
  let notaRapida = $state('');
  let novaNotaItem = $state('');

  let colado = $state('');
  let faseDosNovos = $state('');
  let lendo = $state<number | null>(null);
  let planilha = $state<string[][] | undefined>();
  let avisoImport = $state('');

  let deDiario = $state(dia);
  let ateDiario = $state(dia);
  let todasNoDiario = $state(true);
  let notaGeral = $state('');
  let copiado = $state(false);

  const lista = $derived(dados.listas.find((l) => l.id === atualId));
  const progresso = $derived(lista ? progressoDosItens(lista, lista.itens) : undefined);
  const marcadores = $derived(lista ? [...new Set(lista.itens.map((i) => i.marcador).filter((m): m is string => !!m))].sort() : []);
  const previa = $derived(lista && planilha ? previaDaPlanilha(planilha, lista) : undefined);
  const diario = $derived(diarioDoPeriodo(todasNoDiario || !lista ? dados.listas : [lista], deDiario, ateDiario));
  const diarioPorDia = $derived(Object.entries(diario.reduce<Record<string, typeof diario>>((m, r) => ((m[r.quando.slice(0, 10)] ??= []).push(r), m), {})));

  // fases na ordem, mais o grupo "sem fase" quando houver item sem fase
  const grupos = $derived(!lista ? [] : [
    ...lista.fases.map((f) => ({ fase: f as FaseLista | undefined, id: f.id })),
    ...(lista.itens.some((i) => !i.faseId || !lista.fases.some((f) => f.id === i.faseId)) || !lista.fases.length ? [{ fase: undefined, id: 'sem-fase' }] : []),
  ]);
  const faseDeHoje = $derived(lista?.fases.find((f) => { const s = situacaoDaFase(lista, f, dia); return s === 'em_execucao' || s === 'atrasada' || s === 'prevista'; })?.id);

  function itensDoGrupo(l: Lista, fase: FaseLista | undefined): ItemLista[]
  {
    const base = fase ? itensDaFase(l, fase.id) : l.itens.filter((i) => !i.faseId || !l.fases.some((f) => f.id === i.faseId));
    return base.filter((i) =>
    {
      const s = situacaoDoItem(l, i).situacao;
      if (filtro === 'pendentes' ? s === 'concluido' : filtro !== 'todas' && s !== filtro) return false;
      if (marcadorFiltro && i.marcador !== marcadorFiltro) return false;
      if (faltaEtapa && i.marcas[faltaEtapa]) return false;
      return !busca || `${i.nome} ${i.notas} ${i.responsavel ?? ''}`.toLowerCase().includes(busca.toLowerCase());
    });
  }

  const nomesFase = { concluida: 'Concluída', em_execucao: 'Em execução', prevista: 'Prevista', atrasada: 'Atrasada' };
  const nomesEstado: Record<EstadoEtapa, string> = { feito: 'Feito', nao_se_aplica: 'Não se aplica', travado: 'Travado' };

  function usarModelo(m: (typeof modelosDeLista)[number])
  {
    nomeNova = m.nome;
    etapasNova = m.etapas.join('\n');
    fasesNova = (m.fases ?? []).join('\n');
  }

  function criar()
  {
    const modelo = modelosDeLista.find((m) => m.nome === nomeNova.trim());
    const l = novaLista(nomeNova.trim() || 'Nova lista', etapasNova.split('\n'), modelo?.descricao ?? '', dia, fasesNova.split('\n').map((f) => f.trim()).filter(Boolean));
    dados.listas.push(l);
    atualId = l.id;
    criando = false;
    aba = 'lista';
    nomeNova = etapasNova = fasesNova = '';
  }

  function excluirLista(l: Lista)
  {
    if (!confirm(`Excluir a lista "${l.nome}" com ${l.itens.length} itens, o diário e as anotações?`)) return;
    dados.listas = dados.listas.filter((x) => x.id !== l.id);
    atualId = dados.listas[0]?.id;
    criando = !dados.listas.length;
  }

  // clique: marca ou desmarca "feito"; botão direito: as outras situações
  function clicar(l: Lista, item: ItemLista, etapaId: string)
  {
    const feito = item.marcas[etapaId]?.estado === 'feito';
    const r = marcarEtapa(l, item, etapaId, feito ? undefined : 'feito');
    if (feito) return;
    ultima = { registroId: r.id, rotulo: `${item.nome} / ${l.etapas.find((e) => e.id === etapaId)?.nome}` };
    notaRapida = '';
  }

  function abrirMenu(e: MouseEvent, item: ItemLista, etapaId: string)
  {
    e.preventDefault();
    menu = { itemId: item.id, etapaId };
    motivo = item.marcas[etapaId]?.motivo ?? '';
  }

  function escolher(l: Lista, item: ItemLista, etapaId: string, estado: EstadoEtapa | undefined)
  {
    marcarEtapa(l, item, etapaId, estado, motivo.trim());
    menu = undefined;
  }

  function salvarNotaRapida()
  {
    const r = lista?.diario.find((x) => x.id === ultima?.registroId);
    if (r && notaRapida.trim()) r.texto = notaRapida.trim();
    ultima = undefined;
  }

  function aplicarEmMassa(l: Lista)
  {
    const itens = l.itens.filter((i) => selecionados.has(i.id));
    if (acaoEtapa) for (const i of itens) marcarEtapa(l, i, acaoEtapa, acaoEstado);
    if (acaoFase) moverParaFase(l, itens, acaoFase === 'sem-fase' ? undefined : acaoFase);
    selecionados.clear();
    acaoEtapa = acaoFase = '';
  }

  function adicionar(l: Lista)
  {
    const novos = itensDoTexto(colado, l.itens.map((i) => i.nome), dia);
    for (const i of novos) i.faseId = faseDosNovos || undefined;
    l.itens.push(...novos);
    colado = '';
    avisoImport = `${novos.length} itens adicionados.`;
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

  async function lerArquivo(e: Event & { currentTarget: HTMLInputElement })
  {
    const arquivo = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!arquivo) return;
    try
    {
      planilha = await lerArquivoPlanilha(arquivo);
    }
    catch (erro)
    {
      avisoImport = `Não consegui ler o arquivo: ${erro}`;
    }
  }

  function importar(l: Lista)
  {
    if (!planilha) return;
    const r = importarPlanilha(planilha, l);
    avisoImport = `Importado: ${r.novos} novos, ${r.atualizados} atualizados${r.etapasNovas.length ? `, etapas novas: ${r.etapasNovas.join(', ')}` : ''}${r.fasesNovas.length ? `, fases novas: ${r.fasesNovas.join(', ')}` : ''}.`;
    planilha = undefined;
  }

  const rotuloCampo = (c: ReturnType<typeof previaDaPlanilha>['campos'][number]) =>
    typeof c === 'object' ? `etapa ${c.etapa}` : { nome: 'nome', cnpjs: 'CNPJs', fase: 'fase', marcador: 'etiqueta', responsavel: 'responsável', notas: 'anotações', ignorar: 'ignorada' }[c];

  function moverEtapa(l: Lista, i: number, passo: number)
  {
    const j = i + passo;
    if (j < 0 || j >= l.etapas.length) return;
    [l.etapas[i], l.etapas[j]] = [l.etapas[j]!, l.etapas[i]!];
  }

  function moverFase(l: Lista, i: number, passo: number)
  {
    const j = i + passo;
    if (j < 0 || j >= l.fases.length) return;
    [l.fases[i], l.fases[j]] = [l.fases[j]!, l.fases[i]!];
  }

  function removerEtapa(l: Lista, id: string)
  {
    if (!confirm('Remover esta etapa? As marcações dela somem de todos os itens.')) return;
    l.etapas = l.etapas.filter((e) => e.id !== id);
    for (const i of l.itens) delete i.marcas[id];
  }

  function removerFase(l: Lista, id: string)
  {
    if (!confirm('Remover esta fase? Os itens dela ficam sem fase.')) return;
    l.fases = l.fases.filter((f) => f.id !== id);
    for (const i of l.itens) if (i.faseId === id) i.faseId = undefined;
  }

  function removerItem(l: Lista, item: ItemLista)
  {
    if (!confirm(`Remover "${item.nome}" da lista?`)) return;
    l.itens = l.itens.filter((i) => i.id !== item.id);
    abertos.delete(item.id);
  }

  async function copiarTeams()
  {
    await copiar(mensagemDoDia(dados.listas, ateDiario));
    copiado = true;
    setTimeout(() => (copiado = false), 2000);
  }

  function pdfDoDiario()
  {
    dados.ultimoModelo = 'diario';
    salvar($state.snapshot(dados));
    goto('/relatorio');
  }
</script>

<svelte:window onclick={() => (menu = undefined)} onkeydown={(e) => e.key === 'Escape' && (menu = undefined)} />

<main>
  <span class="prompt">&gt; listas</span>
  <h1>Listas de checagem<span class="cursor">_</span></h1>
  <p class="dica">Fases com data, etapas suas, uma linha por empresa e um diário com tudo o que você marcou e anotou.</p>

  <nav class="abas">
    {#each dados.listas as l (l.id)}
      {@const p = progressoDosItens(l, l.itens)}
      <button class:ativa={l.id === atualId && !criando && aba === 'lista'} onclick={() => { atualId = l.id; criando = false; aba = 'lista'; }}>
        {l.nome} <small>{p.concluidos}/{p.total}</small>
      </button>
    {/each}
    <button class="nova" class:ativa={criando} onclick={() => (criando = true)}>+ nova lista</button>
    <button class="diario-aba" class:ativa={aba === 'diario' && !criando} onclick={() => { aba = 'diario'; criando = false; }}>diário</button>
  </nav>

  {#if criando}
    <section class="cartao">
      <h2>Nova lista</h2>
      <div class="linha">
        <span class="dica">Começar de um modelo:</span>
        {#each modelosDeLista as m (m.nome)}<button onclick={() => usarModelo(m)}>{m.nome}</button>{/each}
      </div>
      <label>Nome <input bind:value={nomeNova} placeholder="Ex.: Implantação" /></label>
      <div class="duas">
        <label>Etapas, uma por linha <textarea rows="6" bind:value={etapasNova}></textarea></label>
        <label>Fases, uma por linha (opcional) <textarea rows="6" bind:value={fasesNova} placeholder={'Fase 1\nFase 2'}></textarea></label>
      </div>
      <p class="dica">Também dá para criar só com o nome e importar a planilha depois: as colunas viram etapas e a coluna Fase cria as fases.</p>
      <button class="principal" disabled={!nomeNova.trim()} onclick={criar}>Criar lista</button>
    </section>
  {:else if aba === 'diario'}
    <section class="cartao">
      <div class="cabeca">
        <h2>Diário</h2>
        <div class="linha">
          <label class="inline">De <input type="date" bind:value={deDiario} /></label>
          <label class="inline">Até <input type="date" bind:value={ateDiario} /></label>
          {#if lista}<label class="marca"><input type="checkbox" bind:checked={todasNoDiario} /> todas as listas</label>{/if}
        </div>
      </div>
      <div class="linha acoes-diario">
        <button onclick={copiarTeams}>{copiado ? 'Copiado!' : `Copiar mensagem de ${dataCurta(ateDiario)} para o Teams`}</button>
        <button onclick={pdfDoDiario}>Gerar PDF do diário</button>
      </div>
      {#if lista}
        <div class="linha nota-geral">
          <input bind:value={notaGeral} placeholder={`Anotação geral em ${lista.nome}`} onkeydown={(e) => { if (e.key === 'Enter' && notaGeral.trim()) { anotar(lista, notaGeral.trim()); notaGeral = ''; } }} />
          <button disabled={!notaGeral.trim()} onclick={() => { anotar(lista, notaGeral.trim()); notaGeral = ''; }}>anotar</button>
        </div>
      {/if}
      {#each diarioPorDia as [data, registros] (data)}
        <div class="dia">
          <span class="data maquina">{dataMedia(data)}</span>
          <ul>
            {#each registros as r (r.id)}
              <li class={r.tipo}>
                <span class="hora maquina">{r.quando.slice(11, 16)}</span>
                {#if todasNoDiario && dados.listas.length > 1}<span class="de-lista">{r.lista}</span>{/if}
                <span>{textoDaLinha(r)}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <p class="dica">Nada registrado no período. Marcar uma etapa ou anotar numa empresa já entra aqui.</p>
      {/each}
    </section>
  {:else if lista && progresso}
    <section class="cartao">
      <div class="cabeca">
        <input class="titulo" bind:value={lista.nome} aria-label="Nome da lista" />
        <div class="linha">
          <button class="link" onclick={() => baixarCsv(lista)}>baixar Excel (.csv)</button>
          <button class="link" onclick={() => (editando = !editando)}>{editando ? 'fechar edição' : 'etapas e fases'}</button>
          <button class="link perigo" onclick={() => excluirLista(lista)}>excluir lista</button>
        </div>
      </div>
      <input class="descricao" bind:value={lista.descricao} placeholder="Para que serve esta lista" aria-label="Descrição" />
      <div class="resumo maquina">
        <span><b>{progresso.concluidos}</b>/{progresso.total} concluídos</span>
        <span><b>{progresso.emAndamento}</b> em andamento</span>
        <span class:alerta={progresso.travados > 0}><b>{progresso.travados}</b> travados</span>
        <span><b>{progresso.naoIniciados}</b> não iniciados</span>
        {#if progresso.cnpjs}<span><b>{progresso.cnpjsConcluidos}</b>/{progresso.cnpjs} CNPJs</span>{/if}
        <div class="barra"><span style:width="{progresso.pct}%"></span></div>
        <b>{progresso.pct}%</b>
      </div>

      {#if lista.fases.length}
        <ol class="cronograma">
          {#each lista.fases as f (f.id)}
            {@const s = situacaoDaFase(lista, f, dia)}
            {@const pf = progressoDosItens(lista, itensDaFase(lista, f.id))}
            <li class={s}>
              {#if f.id === faseDeHoje}<span class="hoje maquina">hoje {dataCurta(dia)}</span>{/if}
              <span class="no"></span>
              <b>{f.nome}</b>
              <span class="dica">{f.data ? dataMedia(f.data) : 'sem data'}</span>
              <span class="situacao-fase">{nomesFase[s]}</span>
              <span class="mini-barra"><span style:width="{pf.pct}%"></span></span>
              <span class="dica maquina">{pf.concluidos}/{pf.total}{pf.cnpjs ? ` · ${pf.cnpjsConcluidos}/${pf.cnpjs} CNPJs` : ''}</span>
            </li>
          {/each}
        </ol>
      {/if}

      {#if editando}
        <div class="duas edicao">
          <div>
            <h3>Etapas</h3>
            {#each lista.etapas as e, i (e.id)}
              <div class="linha">
                <span class="n">{i + 1}</span>
                <input bind:value={e.nome} />
                <button class="mini" disabled={i === 0} onclick={() => moverEtapa(lista, i, -1)}>&uarr;</button>
                <button class="mini" disabled={i === lista.etapas.length - 1} onclick={() => moverEtapa(lista, i, 1)}>&darr;</button>
                <button class="mini" onclick={() => removerEtapa(lista, e.id)}>&times;</button>
              </div>
            {/each}
            <button onclick={() => lista.etapas.push({ id: idCurto(), nome: 'Nova etapa' })}>+ etapa</button>
          </div>
          <div>
            <h3>Fases</h3>
            {#each lista.fases as f, i (f.id)}
              <div class="linha">
                <input bind:value={f.nome} />
                <input type="date" bind:value={f.data} />
                <button class="mini" disabled={i === 0} onclick={() => moverFase(lista, i, -1)}>&uarr;</button>
                <button class="mini" disabled={i === lista.fases.length - 1} onclick={() => moverFase(lista, i, 1)}>&darr;</button>
                <button class="mini" onclick={() => removerFase(lista, f.id)}>&times;</button>
              </div>
            {/each}
            <button onclick={() => lista.fases.push({ id: idCurto(), nome: `Fase ${lista.fases.length + 1}` })}>+ fase</button>
          </div>
        </div>
      {/if}
    </section>

    <section class="cartao">
      <details open={!lista.itens.length}>
        <summary>Adicionar e importar</summary>
        <div class="duas">
          <div>
            <h3>Planilha (Excel ou CSV)</h3>
            <p class="dica">A primeira linha é o cabeçalho. Empresa, CNPJs, Fase, Etiqueta e Responsável viram campos; as outras colunas viram etapas. Na célula: x, sim ou ok = feito; N/A = não se aplica; "travado: motivo" = travado. Quem já existe é atualizado pelo nome.</p>
            <div class="linha">
              <label class="botao">Escolher arquivo (.xlsx ou .csv) <input type="file" accept=".xlsx,.csv,.txt" hidden onchange={lerArquivo} /></label>
            </div>
            <textarea rows="4" placeholder="Ou copie as células no Excel (com o cabeçalho) e cole aqui" oninput={(e) => (planilha = e.currentTarget.value.trim() ? linhasDoTexto(e.currentTarget.value) : undefined)}></textarea>
          </div>
          <div>
            <h3>Só nomes ou print</h3>
            <p class="dica">Um nome por linha (ou nome e etiqueta separados por tabulação). O print vira texto aqui para você conferir.</p>
            <textarea rows="4" bind:value={colado}></textarea>
            <div class="linha">
              {#if lista.fases.length}
                <select bind:value={faseDosNovos} aria-label="Fase dos novos">
                  <option value="">sem fase</option>
                  {#each lista.fases as f (f.id)}<option value={f.id}>{f.nome}</option>{/each}
                </select>
              {/if}
              <button class="principal" disabled={!colado.trim()} onclick={() => adicionar(lista)}>Adicionar {itensDoTexto(colado, lista.itens.map((i) => i.nome)).length || ''}</button>
              <label class="botao">Ler print <input type="file" accept="image/*" hidden onchange={lerPrint} /></label>
              {#if lendo !== null}<progress value={lendo}></progress>{/if}
            </div>
          </div>
        </div>
        {#if previa}
          <div class="previa">
            <b>Prévia da planilha</b>
            <p>{previa.novos} novos, {previa.atualizados} atualizados{previa.ignoradas ? `, ${previa.ignoradas} linhas sem nome ficam de fora` : ''}.</p>
            {#if previa.etapasNovas.length}<p>Etapas novas: {previa.etapasNovas.join(', ')}</p>{/if}
            {#if previa.fasesNovas.length}<p>Fases novas: {previa.fasesNovas.join(', ')}</p>{/if}
            <div class="colunas-previa">
              {#each planilha?.[0] ?? [] as titulo, k (k)}<span><b>{titulo || '(vazia)'}</b> &rarr; {rotuloCampo(previa.campos[k]!)}</span>{/each}
            </div>
            <div class="linha">
              <button class="principal" onclick={() => importar(lista)}>Importar</button>
              <button onclick={() => (planilha = undefined)}>Cancelar</button>
            </div>
          </div>
        {/if}
        {#if avisoImport}<p class="ok">{avisoImport}</p>{/if}
      </details>
    </section>

    {#if lista.itens.length}
      <section class="filtros">
        <input type="search" bind:value={busca} placeholder="Buscar empresa, anotação ou responsável" />
        <select bind:value={filtro} aria-label="Situação">
          <option value="todas">Todas</option>
          <option value="pendentes">Pendentes</option>
          <option value="nao_iniciado">Não iniciadas</option>
          <option value="em_andamento">Em andamento</option>
          <option value="travado">Travadas</option>
          <option value="concluido">Concluídas</option>
        </select>
        <select bind:value={faltaEtapa} aria-label="Falta na etapa">
          <option value="">Falta em qualquer etapa</option>
          {#each lista.etapas as e (e.id)}<option value={e.id}>Falta: {e.nome}</option>{/each}
        </select>
        {#if marcadores.length}
          <select bind:value={marcadorFiltro} aria-label="Etiqueta">
            <option value="">Todas as etiquetas</option>
            {#each marcadores as m (m)}<option value={m}>{m}</option>{/each}
          </select>
        {/if}
        <button class="link" onclick={() => recolhidas.clear()}>expandir tudo</button>
        <button class="link" onclick={() => grupos.forEach((g) => recolhidas.add(g.id))}>recolher</button>
      </section>
      <p class="dica legenda">Clique na caixa: feito. Botão direito: não se aplica, travado (com motivo) ou limpar. Clique no nome: ficha da empresa e o diário dela.</p>

      {#each grupos as g (g.id)}
        {@const itens = itensDoGrupo(lista, g.fase)}
        {@const todos = g.fase ? itensDaFase(lista, g.fase.id) : lista.itens.filter((i) => !i.faseId || !lista.fases.some((f) => f.id === i.faseId))}
        {@const pf = progressoDosItens(lista, todos)}
        <section class="fase">
          <button class="cabeca-fase" onclick={() => (recolhidas.has(g.id) ? recolhidas.delete(g.id) : recolhidas.add(g.id))}>
            <span class="seta" class:fechada={recolhidas.has(g.id)}>&#9662;</span>
            <b>{g.fase?.nome ?? 'Sem fase'}</b>
            {#if g.fase?.data}<span class="chip">{dataMedia(g.fase.data)}</span>{/if}
            {#if g.fase}<span class="chip {situacaoDaFase(lista, g.fase, dia)}">{nomesFase[situacaoDaFase(lista, g.fase, dia)]}</span>{/if}
            <span class="dica maquina contagem">{pf.concluidos}/{pf.total} itens{pf.cnpjs ? ` · ${pf.cnpjsConcluidos}/${pf.cnpjs} CNPJs` : ''}</span>
            <span class="mini-barra larga"><span style:width="{pf.pct}%"></span></span>
          </button>
          {#if !recolhidas.has(g.id)}
            <div class="rolagem">
              <table>
                <thead>
                  <tr>
                    <th class="sel">
                      <input type="checkbox" aria-label="Selecionar a fase" checked={itens.length > 0 && itens.every((i) => selecionados.has(i.id))}
                        onchange={(e) => itens.forEach((i) => (e.currentTarget.checked ? selecionados.add(i.id) : selecionados.delete(i.id)))} />
                    </th>
                    <th>Empresa</th>
                    <th class="num">CNPJs</th>
                    {#each lista.etapas as e (e.id)}<th class="etapa">{e.nome}</th>{/each}
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {#each itens as item (item.id)}
                    {@const s = situacaoDoItem(lista, item)}
                    <tr class={s.situacao}>
                      <td class="sel"><input type="checkbox" aria-label="Selecionar" checked={selecionados.has(item.id)} onchange={() => (selecionados.has(item.id) ? selecionados.delete(item.id) : selecionados.add(item.id))} /></td>
                      <td>
                        <button class="nome" onclick={() => (abertos.has(item.id) ? abertos.delete(item.id) : abertos.add(item.id))}>{item.nome}</button>
                        <div class="sub">
                          {#if item.marcador}<span class="marcador">{item.marcador}</span>{/if}
                          {#if item.responsavel}<span class="dica">{item.responsavel}</span>{/if}
                          {#if lista.diario.some((r) => r.itemId === item.id && r.texto)}<span class="tem-nota">diário</span>{/if}
                        </div>
                      </td>
                      <td class="num maquina">{item.cnpjs ?? '-'}</td>
                      {#each lista.etapas as e (e.id)}
                        {@const m = item.marcas[e.id]}
                        <td class="celula-td">
                          <button class="celula {m?.estado ?? 'vazia'}" aria-label="{e.nome}: {m ? nomesEstado[m.estado] : 'pendente'}"
                            title="{e.nome}: {m ? `${nomesEstado[m.estado]} em ${dataMedia(m.em)}${m.motivo ? ` - ${m.motivo}` : ''}` : 'pendente'}"
                            onclick={(ev) => { ev.stopPropagation(); clicar(lista, item, e.id); }}
                            oncontextmenu={(ev) => { ev.stopPropagation(); abrirMenu(ev, item, e.id); }}>
                            {#if m?.estado === 'feito'}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" /></svg>{:else if m?.estado === 'nao_se_aplica'}n/a{:else if m?.estado === 'travado'}!{/if}
                          </button>
                          {#if menu?.itemId === item.id && menu.etapaId === e.id}
                            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                            <div class="menu" onclick={(ev) => ev.stopPropagation()}>
                              <b>{e.nome}</b>
                              <button onclick={() => escolher(lista, item, e.id, 'feito')}>Feito</button>
                              <button onclick={() => escolher(lista, item, e.id, 'nao_se_aplica')}>Não se aplica</button>
                              <input bind:value={motivo} placeholder="motivo ou anotação" />
                              <button class="travar" onclick={() => escolher(lista, item, e.id, 'travado')}>Travado</button>
                              <button class="link" onclick={() => escolher(lista, item, e.id, undefined)}>limpar</button>
                            </div>
                          {/if}
                        </td>
                      {/each}
                      <td>
                        <span class="situacao {s.situacao}">{nomeSituacao[s.situacao]}</span>
                        <small>{s.feitas}/{s.total} etapas</small>
                      </td>
                    </tr>
                    {#if abertos.has(item.id)}
                      <tr class="detalhe">
                        <td></td>
                        <td colspan={lista.etapas.length + 3}>
                          <div class="ficha">
                            <div>
                              <div class="campos">
                                <label>Nome <input bind:value={item.nome} /></label>
                                <label>Etiqueta <input bind:value={item.marcador} placeholder="Só escritório, Risco baixo..." /></label>
                                <label>CNPJs <input type="number" min="0" bind:value={item.cnpjs} /></label>
                                <label>Responsável <input bind:value={item.responsavel} /></label>
                                <label>Fase
                                  <select value={item.faseId ?? ''} onchange={(e) => moverParaFase(lista, [item], e.currentTarget.value || undefined)}>
                                    <option value="">sem fase</option>
                                    {#each lista.fases as f (f.id)}<option value={f.id}>{f.nome}</option>{/each}
                                  </select>
                                </label>
                              </div>
                              <label>Observação fixa <textarea rows="2" bind:value={item.notas}></textarea></label>
                              <div class="etapas-ficha">
                                {#each lista.etapas as e (e.id)}
                                  {@const m = item.marcas[e.id]}
                                  <div class="linha">
                                    <span>{e.nome}</span>
                                    <select value={m?.estado ?? ''} onchange={(ev) => marcarEtapa(lista, item, e.id, (ev.currentTarget.value || undefined) as EstadoEtapa | undefined)}>
                                      <option value="">pendente</option>
                                      <option value="feito">feito</option>
                                      <option value="nao_se_aplica">não se aplica</option>
                                      <option value="travado">travado</option>
                                    </select>
                                    {#if m?.estado === 'travado'}<input bind:value={m.motivo} placeholder="motivo" />{/if}
                                    {#if m}<span class="dica maquina">{dataCurta(m.em)}</span>{/if}
                                  </div>
                                {/each}
                              </div>
                            </div>
                            <div>
                              <h3>Diário desta empresa</h3>
                              <div class="linha">
                                <input bind:value={novaNotaItem} placeholder="O que fez, por quê, o que falta" onkeydown={(e) => { if (e.key === 'Enter' && novaNotaItem.trim()) { anotar(lista, novaNotaItem.trim(), item.id); novaNotaItem = ''; } }} />
                                <button disabled={!novaNotaItem.trim()} onclick={() => { anotar(lista, novaNotaItem.trim(), item.id); novaNotaItem = ''; }}>anotar</button>
                              </div>
                              <ul class="diario-item">
                                {#each diarioDoPeriodo([lista], '0000-01-01', '9999-12-31').filter((r) => r.itemId === item.id) as r (r.id)}
                                  <li class={r.tipo}><span class="hora maquina">{dataCurta(r.quando)} {r.quando.slice(11, 16)}</span> {textoDaLinha({ ...r, item: undefined })}</li>
                                {:else}
                                  <li class="dica">Nada registrado ainda.</li>
                                {/each}
                              </ul>
                              <button class="link perigo" onclick={() => removerItem(lista, item)}>remover da lista</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    {/if}
                  {:else}
                    <tr><td colspan={lista.etapas.length + 4} class="dica">Nenhum item com estes filtros.</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  {/if}

  {#if lista && selecionados.size && aba === 'lista' && !criando}
    <div class="barra-massa">
      <b>{selecionados.size} selecionados</b>
      <select bind:value={acaoEtapa} aria-label="Etapa">
        <option value="">etapa...</option>
        {#each lista.etapas as e (e.id)}<option value={e.id}>{e.nome}</option>{/each}
      </select>
      <select bind:value={acaoEstado} aria-label="Situação">
        <option value="feito">feito</option>
        <option value="nao_se_aplica">não se aplica</option>
        <option value="travado">travado</option>
      </select>
      {#if lista.fases.length}
        <select bind:value={acaoFase} aria-label="Mover para">
          <option value="">mover para...</option>
          {#each lista.fases as f (f.id)}<option value={f.id}>{f.nome}</option>{/each}
          <option value="sem-fase">sem fase</option>
        </select>
      {/if}
      <button class="principal" disabled={!acaoEtapa && !acaoFase} onclick={() => aplicarEmMassa(lista)}>aplicar</button>
      <button class="link" onclick={() => selecionados.clear()}>limpar seleção</button>
    </div>
  {/if}

  {#if ultima}
    <div class="nota-rapida">
      <span><b>{ultima.rotulo}</b>: feito. O que foi feito?</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={notaRapida} autofocus placeholder="opcional, Enter para salvar" onkeydown={(e) => { if (e.key === 'Enter') salvarNotaRapida(); if (e.key === 'Escape') ultima = undefined; }} />
      <button onclick={salvarNotaRapida}>ok</button>
      <button class="link" onclick={() => (ultima = undefined)}>fechar</button>
    </div>
  {/if}
</main>

<style>
  main
  {
    padding: 24px 28px 96px;
    max-width: 1320px;
    margin: 0 auto;
  }
  .prompt
  {
    font-family: var(--fonte-maquina);
    font-size: 0.85rem;
    color: var(--marca);
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
    margin: 0;
  }
  h3
  {
    font-size: 0.85rem;
    margin: 0 0 8px;
  }
  .cartao
  {
    margin-top: 14px;
  }
  .abas, .linha, .cabeca, .filtros
  {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .abas
  {
    margin-top: 14px;
  }
  .abas button
  {
    font-size: 0.84rem;
  }
  .abas .ativa
  {
    background: var(--marca);
    color: var(--sobre-marca);
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
  .diario-aba
  {
    margin-left: auto;
    font-family: var(--fonte-maquina);
  }
  label
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.84rem;
    margin-bottom: 8px;
  }
  label.inline, label.marca
  {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .duas
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
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
  .resumo
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    margin-top: 12px;
    font-size: 0.8rem;
  }
  .resumo .alerta b
  {
    color: var(--vermelho);
  }
  .barra, .mini-barra
  {
    flex: 1;
    min-width: 120px;
    height: 7px;
    background: var(--borda);
    border-radius: 4px;
    overflow: hidden;
  }
  .barra span, .mini-barra span
  {
    display: block;
    height: 100%;
    background: var(--verde);
  }
  .mini-barra
  {
    flex: none;
    width: 90px;
    min-width: 0;
    height: 5px;
  }
  .mini-barra.larga
  {
    width: 160px;
  }

  /* cronograma das fases: trilho com nós */
  .cronograma
  {
    list-style: none;
    display: flex;
    padding: 34px 0 4px;
    margin: 16px 0 0;
    position: relative;
    overflow-x: auto;
  }
  .cronograma::before
  {
    content: '';
    position: absolute;
    left: 40px;
    right: 40px;
    top: 45px;
    height: 2px;
    background: var(--borda);
  }
  .cronograma li
  {
    position: relative;
    flex: 1 0 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    text-align: center;
    font-size: 0.82rem;
  }
  .cronograma .no
  {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 3px solid var(--borda-forte);
    background: var(--superficie);
    position: relative;
    z-index: 1;
    margin-bottom: 6px;
  }
  .cronograma .concluida .no
  {
    background: var(--verde);
    border-color: var(--verde);
  }
  .cronograma .em_execucao .no
  {
    background: var(--laranja);
    border-color: var(--laranja-fundo);
    box-shadow: 0 0 0 4px var(--laranja-fundo);
  }
  .cronograma .atrasada .no
  {
    border-color: var(--vermelho);
  }
  .situacao-fase
  {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--suave);
  }
  .concluida .situacao-fase
  {
    color: var(--verde);
  }
  .em_execucao .situacao-fase
  {
    color: var(--laranja);
  }
  .atrasada .situacao-fase
  {
    color: var(--vermelho);
  }
  .cronograma .hoje
  {
    position: absolute;
    top: -30px;
    font-size: 0.66rem;
    background: var(--marca-escura);
    color: #fff;
    border-radius: 10px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .edicao
  {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px dashed var(--borda);
  }
  .edicao .linha
  {
    margin-bottom: 6px;
  }
  .edicao input:not([type='date'])
  {
    flex: 1;
  }
  .n
  {
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    color: var(--suave);
    width: 20px;
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
    margin-bottom: 10px;
  }
  .previa
  {
    margin-top: 12px;
    padding: 12px 14px;
    border: 1px solid var(--marca);
    border-radius: 10px;
    background: var(--marca-clara);
    font-size: 0.86rem;
  }
  .previa p
  {
    margin: 4px 0;
  }
  .colunas-previa
  {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 8px 0;
    font-size: 0.78rem;
  }
  .ok
  {
    background: var(--verde-fundo);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.86rem;
  }
  .filtros
  {
    margin-top: 18px;
  }
  .filtros input
  {
    min-width: 260px;
    flex: 1;
  }
  .legenda
  {
    font-size: 0.78rem;
    margin: 6px 0 0;
  }
  .fase
  {
    margin-top: 12px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    overflow: hidden;
  }
  .cabeca-fase
  {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border: none;
    border-radius: 0;
    background: none;
    font: inherit;
    text-align: left;
    color: var(--texto);
  }
  .cabeca-fase b
  {
    font-size: 1.05rem;
  }
  .seta
  {
    color: var(--suave);
    transition: transform 0.15s;
  }
  .seta.fechada
  {
    transform: rotate(-90deg);
  }
  .contagem
  {
    margin-left: auto;
  }
  .chip
  {
    font-size: 0.72rem;
    border: 1px solid var(--borda);
    border-radius: 10px;
    padding: 1px 8px;
    color: var(--suave);
  }
  .chip.concluida
  {
    color: var(--verde);
    border-color: var(--verde);
  }
  .chip.em_execucao
  {
    color: var(--laranja);
    border-color: var(--laranja);
  }
  .chip.atrasada
  {
    color: var(--vermelho);
    border-color: var(--vermelho);
  }
  .rolagem
  {
    overflow-x: auto;
    border-top: 1px solid var(--borda);
  }
  table
  {
    width: 100%;
    border-collapse: collapse;
  }
  th
  {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: left;
    color: var(--suave);
    padding: 8px 6px;
    background: var(--fundo);
  }
  th.etapa
  {
    text-align: center;
    min-width: 64px;
  }
  td
  {
    border-top: 1px solid var(--borda);
    padding: 8px 6px;
    vertical-align: middle;
  }
  .sel
  {
    width: 30px;
    text-align: center;
  }
  .num
  {
    text-align: center;
    width: 52px;
  }
  tr.concluido td
  {
    background: var(--verde-fundo);
  }
  tr.travado td
  {
    background: var(--vermelho-fundo);
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
  .sub
  {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 3px;
  }
  .marcador
  {
    font-size: 0.66rem;
    font-weight: 600;
    text-transform: uppercase;
    border: 1px solid var(--borda);
    border-radius: 6px;
    padding: 0 6px;
  }
  .tem-nota
  {
    font-size: 0.66rem;
    color: var(--marca);
    border: 1px solid var(--marca);
    border-radius: 4px;
    padding: 0 4px;
  }
  .celula-td
  {
    text-align: center;
    position: relative;
  }
  .celula
  {
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 7px;
    border: 1.5px solid var(--borda-forte);
    background: var(--superficie);
    font-family: var(--fonte-maquina);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--suave);
    display: inline-grid;
    place-items: center;
    transition: transform 0.1s, background 0.15s;
  }
  .celula:hover
  {
    border-color: var(--marca);
    transform: scale(1.06);
  }
  .celula.feito
  {
    background: var(--verde);
    border-color: var(--verde);
  }
  .celula svg
  {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--sobre-marca);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .celula.nao_se_aplica
  {
    background: repeating-linear-gradient(135deg, var(--superficie-2), var(--superficie-2) 4px, var(--borda) 4px, var(--borda) 8px);
    border-color: var(--borda);
  }
  .celula.travado
  {
    background: var(--vermelho-fundo);
    border-color: var(--vermelho);
    color: var(--vermelho);
    font-size: 0.9rem;
  }
  .menu
  {
    position: absolute;
    z-index: 20;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    display: grid;
    gap: 6px;
    padding: 10px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: 10px;
    box-shadow: var(--sombra);
    text-align: left;
    font-size: 0.8rem;
  }
  .menu button
  {
    font-size: 0.8rem;
    padding: 5px 8px;
  }
  .menu .travar
  {
    border-color: var(--vermelho);
    color: var(--vermelho);
  }
  .situacao
  {
    display: inline-block;
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--fundo);
    white-space: nowrap;
  }
  .situacao.concluido
  {
    background: var(--verde);
    color: var(--sobre-marca);
  }
  .situacao.em_andamento
  {
    background: var(--marca-clara);
  }
  .situacao.travado
  {
    background: var(--vermelho);
    color: var(--sobre-marca);
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
    background: var(--fundo);
  }
  .ficha
  {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 20px;
    padding: 6px 0;
  }
  .campos
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0 10px;
  }
  .etapas-ficha .linha
  {
    font-size: 0.82rem;
    margin-bottom: 4px;
  }
  .etapas-ficha .linha > span:first-child
  {
    width: 110px;
  }
  .diario-item, .dia ul
  {
    list-style: none;
    padding: 0;
    margin: 8px 0;
    font-size: 0.84rem;
  }
  .diario-item li, .dia li
  {
    padding: 5px 0 5px 10px;
    border-left: 2px solid var(--borda);
    margin-bottom: 2px;
  }
  li.feito
  {
    border-left-color: var(--verde);
  }
  li.travado
  {
    border-left-color: var(--vermelho);
  }
  li.nota
  {
    border-left-color: var(--marca);
  }
  .hora
  {
    color: var(--suave);
    font-size: 0.75rem;
    margin-right: 6px;
  }
  .de-lista
  {
    font-size: 0.7rem;
    border: 1px solid var(--borda);
    border-radius: 6px;
    padding: 0 6px;
    margin-right: 6px;
  }
  .acoes-diario, .nota-geral
  {
    margin: 12px 0;
  }
  .nota-geral input
  {
    flex: 1;
  }
  .dia
  {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 10px;
    margin-top: 10px;
  }
  .dia .data
  {
    color: var(--marca);
    font-weight: 700;
    padding-top: 5px;
  }
  .barra-massa, .nota-rapida
  {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--marca-escura);
    color: #fff;
    box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
    font-size: 0.86rem;
    max-width: calc(100vw - 32px);
  }
  .barra-massa
  {
    bottom: 18px;
  }
  .nota-rapida
  {
    bottom: 76px;
    border: 1px solid var(--marca);
  }
  .nota-rapida input
  {
    min-width: 260px;
  }
  .barra-massa .link, .nota-rapida .link
  {
    color: #9fe3bd;
  }
  @media (max-width: 900px)
  {
    .duas, .ficha
    {
      grid-template-columns: 1fr;
    }
  }
</style>
