<script lang="ts">
  import { modelosProntos, pedidoDeModelo, validarModelo, type Bloco, type Modelo } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import ListaDeBlocos from '#lib/ListaDeBlocos.svelte';
  import { baixarModelo, ehPronto, novoId, rotuloBloco } from '#lib/modelos.ts';
  import { copiar } from '#lib/saidas.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  let editando = $state<string | undefined>();
  let descricao = $state('');
  let resposta = $state('');
  let erros = $state<string[]>([]);
  let aviso = $state('');

  const atual = $derived(dados.modelos.find((m) => m.id === editando));

  function avisar(texto: string)
  {
    aviso = texto;
    setTimeout(() => (aviso = ''), 2500);
  }

  function guardar(m: Modelo)
  {
    // id repetido vira cópia, para não sobrescrever um modelo pronto ou outro meu
    const novo = ehPronto(m.id) || dados.modelos.some((x) => x.id === m.id) ? { ...m, id: novoId() } : m;
    dados.modelos.push(novo);
    editando = novo.id;
  }

  const duplicar = (m: Modelo) => guardar({ ...$state.snapshot(m) as Modelo, id: novoId(), nome: `${m.nome} (cópia)` });

  function excluir(m: Modelo)
  {
    if (!confirm(`Excluir o modelo "${m.nome}"? Os relatórios já baixados não mudam.`)) return;
    dados.modelos = dados.modelos.filter((x) => x.id !== m.id);
    if (dados.ultimoModelo === m.id) dados.ultimoModelo = 'semanal';
    if (editando === m.id) editando = undefined;
  }

  function mudar<K extends keyof Modelo>(campo: K, valor: Modelo[K])
  {
    const i = dados.modelos.findIndex((m) => m.id === editando);
    if (i >= 0) dados.modelos[i] = { ...dados.modelos[i]!, [campo]: valor };
  }

  function importar(texto: string)
  {
    const r = validarModelo(texto);
    erros = r.erros;
    if (!r.modelo) return;
    guardar(r.modelo);
    resposta = '';
    avisar(r.erros.length ? 'Modelo importado; o que não foi reconhecido ficou de fora.' : 'Modelo importado.');
  }

  async function lerArquivo(e: Event & { currentTarget: HTMLInputElement })
  {
    const arquivo = e.currentTarget.files?.[0];
    if (arquivo) importar(await arquivo.text());
    e.currentTarget.value = '';
  }

  async function copiarPedido()
  {
    await copiar(pedidoDeModelo(descricao));
    avisar('Pedido copiado. Cole num chat de IA gratuito e traga a resposta para a caixa abaixo.');
  }
</script>

<main>
  <span class="etiqueta">modelos</span>
  <h1>Modelos de relatório<span class="cursor">_</span></h1>
  <p class="dica">Um modelo é a lista de blocos do PDF, em ordem. Escolha o modelo na tela <a href="/relatorio">Relatório</a>; lá você ainda pode inserir blocos só naquele relatório.</p>
  {#if aviso}<p class="ok">{aviso}</p>{/if}

  <div class="colunas">
    <section>
      <h2>Prontos</h2>
      {#each modelosProntos as m (m.id)}
        <article>
          <div class="cabeca">
            <b>{m.nome}</b>
            <span class="etiquetas"><i>{m.periodo === 'livre' ? 'período livre' : 'semana'}</i><i>capa {m.capa}</i><i>{m.blocos.length} blocos</i></span>
          </div>
          <p>{m.descricao}</p>
          <div class="acoes"><button onclick={() => duplicar(m)}>Duplicar para editar</button><button class="link" onclick={() => baixarModelo(m)}>exportar</button></div>
        </article>
      {/each}

      <h2>Meus modelos</h2>
      {#each dados.modelos as m (m.id)}
        <article class:ativo={editando === m.id}>
          <div class="cabeca">
            <b>{m.nome}</b>
            <span class="etiquetas"><i>{m.periodo === 'livre' ? 'período livre' : 'semana'}</i><i>capa {m.capa}</i><i>{m.blocos.length} blocos</i></span>
          </div>
          {#if m.descricao}<p>{m.descricao}</p>{/if}
          <div class="acoes">
            <button onclick={() => (editando = editando === m.id ? undefined : m.id)}>{editando === m.id ? 'Fechar' : 'Editar'}</button>
            <button onclick={() => duplicar(m)}>Duplicar</button>
            <button class="link" onclick={() => baixarModelo(m)}>exportar</button>
            <button class="link perigo" onclick={() => excluir(m)}>excluir</button>
          </div>
        </article>
      {:else}
        <p class="dica">Nenhum ainda. Duplique um pronto, salve os blocos de um relatório como modelo ou peça para uma IA gratuita montar.</p>
      {/each}

      <label class="arquivo">Importar modelo (.json) <input type="file" accept=".json,application/json" onchange={lerArquivo} /></label>
    </section>

    <section>
      {#if atual}
        <div class="editor">
          <h2>Editando: {atual.nome}</h2>
          <div class="campos">
            <label>Nome <input value={atual.nome} oninput={(e) => mudar('nome', e.currentTarget.value)} /></label>
            <label>Título da capa <input value={atual.titulo} oninput={(e) => mudar('titulo', e.currentTarget.value)} /></label>
            <label class="largo">Para que serve <input value={atual.descricao} oninput={(e) => mudar('descricao', e.currentTarget.value)} /></label>
            <label>Sigla do número
              <input value={atual.sigla} maxlength="4" oninput={(e) => mudar('sigla', e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '') || 'RM')} />
            </label>
            <label>Período
              <select value={atual.periodo} onchange={(e) => mudar('periodo', e.currentTarget.value as Modelo['periodo'])}>
                <option value="semana">Uma semana</option>
                <option value="livre">Do dia X ao dia Y</option>
              </select>
            </label>
            <label>Capa
              <select value={atual.capa} onchange={(e) => mudar('capa', e.currentTarget.value as Modelo['capa'])}>
                <option value="completa">Página inteira</option>
                <option value="curta">Faixa no topo</option>
              </select>
            </label>
            <label class="marca"><input type="checkbox" checked={atual.sumario} onchange={(e) => mudar('sumario', e.currentTarget.checked)} /> com sumário</label>
          </div>
          <h3>Blocos</h3>
          <ListaDeBlocos blocos={atual.blocos} onmudar={(novos: Bloco[]) => mudar('blocos', novos)} />
          <p class="dica resumo">{atual.blocos.map(rotuloBloco).join(' > ')}</p>
        </div>
      {/if}

      <div class="ia">
        <h2>Criar com uma IA gratuita</h2>
        <p class="dica">Sem custo e sem conexão do sistema com IA: você copia o pedido, cola em qualquer chat gratuito e traz a resposta de volta. Só a estrutura do modelo vai no pedido, nenhum dado do painel.</p>
        <label>1. Descreva o modelo
          <textarea rows="3" bind:value={descricao} placeholder="Ex.: relatório mensal curto para a diretoria, com capa curta, prazo e concluídos em gráfico, riscos e uma seção de texto para próximos passos."></textarea>
        </label>
        <button onclick={copiarPedido}>2. Copiar pedido para a IA</button>
        <label>3. Cole aqui a resposta da IA
          <textarea rows="6" bind:value={resposta} placeholder={'{ "nome": "...", "blocos": [ ... ] }'}></textarea>
        </label>
        <button class="principal" disabled={!resposta.trim()} onclick={() => importar(resposta)}>4. Importar modelo</button>
        {#if erros.length}
          <ul class="erros">{#each erros as e, i (i)}<li>{e}</li>{/each}</ul>
        {/if}
      </div>
    </section>
  </div>
</main>

<style>
  main
  {
    padding: 24px 28px 48px;
    max-width: 1200px;
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
    margin: 18px 0 8px;
  }
  h3
  {
    font-size: 0.9rem;
    margin: 14px 0 6px;
  }
  .dica a
  {
    color: var(--marca);
  }
  .ok
  {
    background: var(--verde-fundo);
    border-radius: var(--raio);
    padding: 8px 12px;
    margin-top: 8px;
  }
  .colunas
  {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 24px;
    align-items: start;
  }
  article, .editor, .ia
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 12px 14px;
    margin-bottom: 8px;
  }
  article.ativo
  {
    border-color: var(--marca);
  }
  article p
  {
    font-size: 0.86rem;
    margin: 4px 0 8px;
  }
  .cabeca
  {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .etiquetas
  {
    display: flex;
    gap: 4px;
  }
  .etiquetas i
  {
    font-style: normal;
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    background: var(--marca-clara);
    border-radius: 4px;
    padding: 1px 6px;
  }
  .acoes
  {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .acoes button:not(.link)
  {
    font-size: 0.8rem;
    padding: 5px 10px;
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
  .campos
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }
  .campos label, .ia label, .arquivo
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.84rem;
  }
  .campos .largo
  {
    grid-column: 1 / -1;
  }
  .campos .marca
  {
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
  .arquivo
  {
    margin-top: 12px;
  }
  .resumo
  {
    margin-top: 10px;
  }
  .ia
  {
    display: grid;
    gap: 10px;
  }
  .ia h2
  {
    margin: 0;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .erros
  {
    color: var(--vermelho);
    font-size: 0.84rem;
    padding-left: 18px;
  }
  @media (max-width: 900px)
  {
    .colunas
    {
      grid-template-columns: 1fr;
    }
  }
</style>
