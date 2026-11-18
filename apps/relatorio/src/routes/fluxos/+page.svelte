<script lang="ts">
  import {
    agoraLocal,
    fluxoDaLista,
    fluxoDaSemana,
    fluxoDosCards,
    fluxoDoRegistroPainel,
    idCurto,
    lerFluxo,
    novoFluxograma,
    pedidoDeFluxo,
    prepararTextoLivre,
    type CardSnapshot,
    type Fluxograma,
    type LigacaoFluxo,
    type NoFluxo,
  } from '@supervisao/core';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import EditorFluxo from '#lib/EditorFluxo.svelte';
  import { svgDoFluxo } from '#lib/fluxograma.ts';
  import { copiar } from '#lib/saidas.ts';
  import { dataMedia } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const abertoId = $derived(page.url.searchParams.get('id'));
  const aberto = $derived(dados.fluxos.find((f) => f.id === abertoId));

  // aba ativa para montagem de fluxos
  let abaAtiva = $state<'texto' | 'semana' | 'relatorios'>('texto');

  let nome = $state('');
  let texto = $state('');
  let aviso = $state('');
  let pedidoCopiado = $state(false);

  const ordenados = $derived([...dados.fluxos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)));

  // cards da última foto do painel
  const ultimoSnapshot = $derived([...dados.fotos].sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const cardsHoje = $derived(ultimoSnapshot?.cards ?? []);

  function abrir(f: Fluxograma)
  {
    goto(`/fluxos?id=${f.id}`);
  }

  function guardar(f: Fluxograma)
  {
    dados.fluxos = [f, ...dados.fluxos];
    abrir(f);
  }

  function montarTexto()
  {
    if (!texto.trim())
    {
      aviso = 'Escreva ou cole os passos do processo.';
      return;
    }
    const r = lerFluxo(texto);
    if (!r.nos.some((n) => n.tipo !== 'inicio' && n.tipo !== 'fim'))
    {
      aviso = 'Não encontrei passos no texto para montar o diagrama.';
      return;
    }
    const primeiro = r.nos.find((n) => n.tipo === 'passo' || n.tipo === 'decisao')!.texto;
    const f = { ...novoFluxograma(nome || primeiro.slice(0, 50)), nos: r.nos, ligacoes: r.ligacoes };
    aviso = '';
    nome = '';
    texto = '';
    guardar(f);
  }

  async function copiarPedido()
  {
    await copiar(pedidoDeFluxo(texto));
    pedidoCopiado = true;
    setTimeout(() => (pedidoCopiado = false), 2000);
  }

  function carregarExemploExames()
  {
    nome = 'Agendamento de exames no sistema';
    texto = [
      'Início // Abertura do fluxo de agendamento de exames',
      'Tipo de exame? admissional: Selecionar candidato cadastrado // A seleção parte do candidato já cadastrado no sistema / demais exames: Escolher funcionário, dia e cidade',
      'Selecionar candidato cadastrado // Validar CPF e ficha médica do candidato',
      'Escolher funcionário, dia e cidade // Consultar disponibilidade na clínica credenciada',
      'Emitir guia de encaminhamento // Enviar protocolo por e-mail e SMS',
      'Fim // Agendamento concluído'
    ].join('\n');
  }

  function carregarExemploAtendimento()
  {
    nome = 'Fluxo de atendimento ao cliente';
    texto = [
      'Receber chamado // Notificação de abertura do cliente via portal',
      'Documentos completos? não: Solicitar complementação / sim: Analisar viabilidade',
      'Solicitar complementação // Aguardar envio de comprovantes faltantes',
      'Analisar viabilidade // Avaliar escopo técnico da entrega',
      'Aprovado pelo gestor? sim: Liberar implantação / não: Registrar motivo de recusa',
      'Liberar implantação // Criar acessos e notificar equipe',
      'Registrar motivo de recusa // Devolver feedback ao cliente',
      'Fim // Processo finalizado'
    ].join('\n');
  }

  function gerarDaSemana(inicio: string)
  {
    const plano = dados.planos.find((p) => p.inicio === inicio);
    if (!plano) return;
    const nomePessoa = (id: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id;
    const f = fluxoDaSemana(plano, nomePessoa);
    guardar(f);
  }

  function gerarDosCardsHoje()
  {
    if (!cardsHoje.length)
    {
      aviso = 'Nenhum card encontrado no snapshot de hoje para gerar fluxo.';
      return;
    }
    const f = fluxoDosCards(cardsHoje, `Demandas ativas de ${dataMedia(agoraLocal().slice(0, 10))}`);
    guardar(f);
  }

  function gerarDoRegistro(id: string)
  {
    const r = dados.registros.find((x) => x.id === id);
    if (!r) return;
    const f = fluxoDoRegistroPainel(r);
    guardar(f);
  }

  function gerarDaLista(id: string)
  {
    const l = dados.listas.find((x) => x.id === id);
    if (!l) return;
    guardar(fluxoDaLista(l));
  }

  function duplicar(f: Fluxograma)
  {
    const agora = agoraLocal();
    dados.fluxos = [{ ...$state.snapshot(f), id: idCurto(), nome: `${f.nome} (cópia)`, criadoEm: agora, atualizadoEm: agora }, ...dados.fluxos];
  }

  function excluir(f: Fluxograma)
  {
    if (!confirm(`Excluir o fluxo "${f.nome}"?`)) return;
    dados.fluxos = dados.fluxos.filter((x) => x.id !== f.id);
  }

  function mudar(id: string, campos: Partial<Fluxograma>)
  {
    dados.fluxos = dados.fluxos.map((f) => (f.id === id ? { ...f, ...campos, atualizadoEm: agoraLocal() } : f));
  }

  function aoMudarDesenho(id: string, nos: NoFluxo[], ligacoes: LigacaoFluxo[])
  {
    const f = dados.fluxos.find((x) => x.id === id);
    if (!f || JSON.stringify([f.nos, f.ligacoes]) === JSON.stringify([nos, ligacoes])) return;
    mudar(id, { nos, ligacoes });
  }

  const passos = (f: Fluxograma) => f.nos.filter((n) => n.tipo === 'passo' || n.tipo === 'decisao').length;
</script>

<main class:largo={!!aberto}>
  <span class="prompt">&gt; fluxos</span>
  {#if aberto}
    {@const f = aberto}
    <div class="topo-editor">
      <button class="btn-voltar" onclick={() => goto('/fluxos')}>&larr; Meus fluxos</button>
      <input class="nome" value={f.nome} oninput={(e) => mudar(f.id, { nome: e.currentTarget.value })} aria-label="Nome do fluxo" />
      <input class="descricao" value={f.descricao} oninput={(e) => mudar(f.id, { descricao: e.currentTarget.value })} placeholder="Descrição do processo (vai no PDF)" aria-label="Descrição do fluxo" />
    </div>
    {#key f.id}
      <SvelteFlowProvider>
        <EditorFluxo fluxo={f} onmudar={(nos, ligacoes) => aoMudarDesenho(f.id, nos, ligacoes)} />
      </SvelteFlowProvider>
    {/key}
  {:else}
    <div class="cabecalho-pagina">
      <h1>Fluxos de processo<span class="cursor">_</span></h1>
      <p class="subtitulo">Mapeie processos, orientações e decisões com percurso guiado e lacunas em tempo real.</p>
    </div>

    {#if abertoId}
      <p class="dica">Esse fluxo não existe mais neste navegador.</p>
    {/if}

    <!-- PAINEL CENTRAL DE CRIAÇÃO BASEADO EM FONTES (TEXTOS SOLTOS PRIMEIRO, DEPOIS DIA/SEMANA, DEPOIS RELATÓRIOS) -->
    <section class="cartao criador-fluxos">
      <div class="abas-fontes">
        <button class="aba-btn" class:ativa={abaAtiva === 'texto'} onclick={() => (abaAtiva = 'texto')}>
          Texto solto (primeiro)
        </button>
        <button class="aba-btn" class:ativa={abaAtiva === 'semana'} onclick={() => (abaAtiva = 'semana')}>
          Do dia / Da semana ({dados.planos.length} semanas, {cardsHoje.length} cards hoje)
        </button>
        <button class="aba-btn" class:ativa={abaAtiva === 'relatorios'} onclick={() => (abaAtiva = 'relatorios')}>
          Dos relatórios / Diário ({dados.registros.length} registros, {dados.listas.length} listas)
        </button>
      </div>

      {#if aviso}<p class="aviso">{aviso}</p>{/if}

      <!-- ABA 1: TEXTOS SOLTOS -->
      {#if abaAtiva === 'texto'}
        <div class="conteudo-aba">
          <div class="linha-topo-aba">
            <span class="dica-aba">Cole qualquer procedimento, lista de passos, anotação ou instruções operacionais:</span>
            <div class="botoes-exemplos">
              <span class="rotulo-exemplos">Exemplos rápidos:</span>
              <button class="btn-exemplo" onclick={carregarExemploExames}>Exames com Decisão</button>
              <button class="btn-exemplo" onclick={carregarExemploAtendimento}>Triagem de Chamados</button>
            </div>
          </div>

          <input bind:value={nome} placeholder="Nome do fluxo (ex.: Agendamento de exames)" />
          <textarea
            bind:value={texto}
            rows="8"
            placeholder={'Cole o texto corrido ou os passos, um por linha:\nReceber solicitação // Ticket aberto pelo cliente\nDocumentos completos? sim: Analisar viabilidade / não: Solicitar complementação\nSolicitar complementação // Aguardar retorno por 48h\nAnalisar viabilidade\nLiberar implantação\nFim'}
          ></textarea>

          <p class="dica-sintaxe">
            <b>Dica de formatação:</b> use <code>// orientações</code> para adicionar anotações que aparecem ao <i>Percorrer</i>. Para decisões condicionais: <code>Pergunta? sim: Passo A / não: Passo B</code>.
          </p>

          <div class="acoes-criador">
            <button class="principal grande" onclick={montarTexto}>Montar fluxo a partir do texto</button>
            <button onclick={copiarPedido}>{pedidoCopiado ? 'Pedido copiado!' : 'Copiar pedido para IA'}</button>
            <button class="neutro" onclick={() => guardar(novoFluxograma(nome || 'Fluxo em branco'))}>Fluxo em branco</button>
          </div>
        </div>

      <!-- ABA 2: DO DIA / DA SEMANA -->
      {:else if abaAtiva === 'semana'}
        <div class="conteudo-aba">
          <p class="dica-aba">Gere automaticamente um fluxo operacional a partir das entregas da semana ou das demandas ativas do dia:</p>

          <div class="grade-fontes">
            <!-- OPÇÃO SEMANA -->
            <div class="card-fonte">
              <span class="etiqueta">Semana</span>
              <h3>Plano da Semana</h3>
              <p>Mapeia as entregas planejadas da semana, agrupadas por pessoa com prazos nos detalhes de cada etapa.</p>

              {#if dados.planos.length === 0}
                <p class="dica-vazio">Nenhum plano de semana registrado ainda no sistema.</p>
              {:else}
                <div class="seletor-semana-linha">
                  <select id="seletor-semana" class="select-completo" onchange={(e) => { if (e.currentTarget.value) gerarDaSemana(e.currentTarget.value); }}>
                    <option value="">Selecione uma semana...</option>
                    {#each [...dados.planos].sort((a, b) => b.inicio.localeCompare(a.inicio)) as p (p.inicio)}
                      {@const totalItens = p.pessoas.reduce((acc, curr) => acc + curr.itens.length, 0)}
                      <option value={p.inicio}>
                        Semana de {dataMedia(p.inicio)} ({totalItens} entregas · {p.pessoas.length} pessoas)
                      </option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>

            <!-- OPÇÃO DEMANDAS DE HOJE -->
            <div class="card-fonte">
              <span class="etiqueta">Painel do dia</span>
              <h3>Demandas de Hoje</h3>
              <p>Mapeia os cards prioritários do dia (em execução, em risco ou atrasados) com responsáveis e prazos nos detalhes.</p>

              <div class="info-hoje">
                <span>{cardsHoje.length} cards encontrados no último snapshot</span>
              </div>

              <button class="principal" onclick={gerarDosCardsHoje} disabled={!cardsHoje.length}>
                Gerar fluxo das demandas de hoje
              </button>
            </div>
          </div>
        </div>

      <!-- ABA 3: DOS RELATÓRIOS / DIÁRIO DO PAINEL -->
      {:else if abaAtiva === 'relatorios'}
        <div class="conteudo-aba">
          <p class="dica-aba">Transforme registros do diário com imagens transcritas ou listas de conferência em fluxos:</p>

          <div class="grade-fontes">
            <!-- REGISTROS DO DIÁRIO DO PAINEL -->
            <div class="card-fonte">
              <span class="etiqueta">Diário</span>
              <h3>Diário do Painel</h3>
              <p>Converte o motivo do registro, as imagens conferidas e os comentários em etapas sequenciais ricas.</p>

              {#if dados.registros.length === 0}
                <p class="dica-vazio">Nenhum registro no Diário do Painel ainda. Cole prints na aba Painel.</p>
              {:else}
                <select class="select-completo" onchange={(e) => { if (e.currentTarget.value) gerarDoRegistro(e.currentTarget.value); }}>
                  <option value="">Selecione um registro do diário...</option>
                  {#each [...dados.registros].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30) as r (r.id)}
                    <option value={r.id}>
                      {dataMedia(r.data)} · [{r.pasta || 'Geral'}] {r.motivo || 'Registro sem título'} ({r.capturas?.length ?? 0} prints)
                    </option>
                  {/each}
                </select>
              {/if}
            </div>

            <!-- LISTAS DE CONFERÊNCIA -->
            <div class="card-fonte">
              <span class="etiqueta">Checklists</span>
              <h3>Checklists / Listas</h3>
              <p>Transforma as etapas cadastradas em uma lista de checagem em um fluxo do início ao fim.</p>

              {#if dados.listas.length === 0}
                <p class="dica-vazio">Nenhuma lista criada ainda na aba Checklist.</p>
              {:else}
                <select class="select-completo" onchange={(e) => { if (e.currentTarget.value) gerarDaLista(e.currentTarget.value); }}>
                  <option value="">Selecione uma lista de checagem...</option>
                  {#each dados.listas as l (l.id)}
                    <option value={l.id}>
                      {l.nome} ({l.etapas.length} etapas)
                    </option>
                  {/each}
                </select>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </section>

    <!-- LISTA DE FLUXOS SALVOS -->
    <div class="secao-meus-fluxos">
      <h2>Meus fluxos salvos ({ordenados.length})</h2>
      {#if !ordenados.length}
        <p class="dica">Nenhum fluxo criado ainda. Escolha uma das opções acima para montar o primeiro.</p>
      {:else}
        <div class="grade-fluxos">
          {#each ordenados as f (f.id)}
            <article class="cartao-fluxo">
              <button class="miniatura" onclick={() => abrir(f)} aria-label="Abrir {f.nome}">
                {#if f.nos.length}
                  {@html svgDoFluxo(f).svg}
                {:else}
                  <span class="dica">fluxo em branco</span>
                {/if}
              </button>
              <div class="info-fluxo">
                <strong class="titulo-fluxo">{f.nome}</strong>
                <span class="meta-fluxo">{passos(f)} {passos(f) === 1 ? 'etapa' : 'etapas'} · atualizado em {dataMedia(f.atualizadoEm)}</span>
              </div>
              <div class="botoes-fluxo">
                <button class="principal" onclick={() => abrir(f)}>Abrir editor</button>
                <button onclick={() => duplicar(f)}>Duplicar</button>
                <button class="perigo" onclick={() => excluir(f)}>Excluir</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  main.largo
  {
    max-width: none;
  }
  .cabecalho-pagina
  {
    margin-bottom: var(--size-4);
  }
  .cabecalho-pagina h1
  {
    margin-bottom: 4px;
  }
  .subtitulo
  {
    margin: 0;
    color: var(--suave);
    font-size: 0.92rem;
  }
  .topo-editor
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
    margin: var(--size-2) 0 var(--size-3);
  }
  .btn-voltar
  {
    font-size: 0.85rem;
    padding: 6px 12px;
  }
  .topo-editor .nome
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.05rem;
    min-width: 260px;
    background: var(--superficie);
  }
  .topo-editor .descricao
  {
    flex: 1;
    min-width: 220px;
    background: var(--superficie);
  }

  /* CRIADOR DE FLUXOS COM ABAS */
  .criador-fluxos
  {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border-top: 3px solid var(--marca);
  }
  .abas-fontes
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border-bottom: 1px solid var(--borda);
    padding-bottom: 10px;
  }
  .aba-btn
  {
    font-size: 0.88rem;
    padding: 8px 16px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    color: var(--suave);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s;
  }
  .aba-btn:hover
  {
    color: var(--texto);
    border-color: var(--borda-forte);
  }
  .aba-btn.ativa
  {
    background: var(--marca-clara);
    border-color: var(--marca);
    color: var(--marca);
    font-weight: 600;
  }
  .conteudo-aba
  {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .linha-topo-aba
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .dica-aba
  {
    margin: 0;
    font-size: 0.88rem;
    color: var(--texto);
    font-weight: 500;
  }
  .botoes-exemplos
  {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rotulo-exemplos
  {
    font-size: 0.78rem;
    color: var(--suave);
  }
  .btn-exemplo
  {
    font-size: 0.76rem;
    padding: 3px 8px;
    background: var(--superficie-2);
    border: 1px dashed var(--borda-forte);
    border-radius: 4px;
    cursor: pointer;
    color: var(--texto);
  }
  .btn-exemplo:hover
  {
    border-color: var(--marca);
    color: var(--marca);
  }
  textarea
  {
    width: 100%;
    resize: vertical;
    font-family: var(--fonte-maquina);
    font-size: 0.86rem;
    line-height: 1.4;
    padding: 10px 12px;
    box-sizing: border-box;
  }
  .dica-sintaxe
  {
    margin: 0;
    font-size: 0.82rem;
    color: var(--suave);
  }
  .dica-sintaxe code
  {
    font-family: var(--fonte-maquina);
    background: var(--superficie-2);
    padding: 1px 5px;
    border-radius: 3px;
    color: var(--texto);
  }
  .acoes-criador
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }
  .principal.grande
  {
    font-size: 0.92rem;
    padding: 8px 18px;
  }

  /* GRADE DE FONTES (SEMANA E RELATÓRIOS) */
  .grade-fontes
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-top: 6px;
  }
  .card-fonte
  {
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card-fonte h3
  {
    margin: 0;
    font-size: 1.05rem;
    color: var(--texto);
  }
  .card-fonte p
  {
    margin: 0;
    font-size: 0.82rem;
    color: var(--suave);
    line-height: 1.35;
  }
  .select-completo
  {
    width: 100%;
    padding: 8px 10px;
    font-size: 0.85rem;
    background: var(--superficie);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio-pequeno);
    color: var(--texto);
    margin-top: auto;
  }
  .info-hoje
  {
    font-size: 0.82rem;
    color: var(--suave);
    margin-top: auto;
  }
  .dica-vazio
  {
    font-size: 0.8rem;
    color: var(--suave);
    font-style: italic;
    margin-top: auto;
  }
  .aviso
  {
    margin: 0;
    color: var(--vermelho);
    font-size: 0.88rem;
  }

  /* LISTAGEM DE FLUXOS */
  .secao-meus-fluxos
  {
    margin-top: var(--size-6);
  }
  .grade-fluxos
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--size-3);
    margin-top: var(--size-3);
  }
  .cartao-fluxo
  {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
  }
  .miniatura
  {
    height: 140px;
    padding: 8px;
    display: grid;
    place-items: center;
    background: #ffffff;
    border-radius: var(--raio-pequeno);
    border: 1px solid var(--borda);
    overflow: hidden;
    cursor: pointer;
  }
  .miniatura :global(svg)
  {
    max-width: 100%;
    max-height: 124px;
    height: auto;
  }
  .info-fluxo
  {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .titulo-fluxo
  {
    font-size: 0.95rem;
    color: var(--texto);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-fluxo
  {
    font-size: 0.76rem;
    color: var(--suave);
  }
  .botoes-fluxo
  {
    display: flex;
    gap: 6px;
    margin-top: auto;
  }
  .botoes-fluxo button
  {
    font-size: 0.78rem;
    padding: 4px 8px;
  }
  .botoes-fluxo .perigo
  {
    color: var(--vermelho);
    margin-left: auto;
  }
</style>
