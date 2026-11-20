<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import
  {
    agoraLocal,
    criarAta,
    exportarCombinadosParaIntegracao,
    gerarProximaAta,
    idCurto,
    mensagemTeamsDaAta,
    nomesSituacaoCombinado,
    nomesTipoAta,
    pedidoDeAtaParaIa,
    proximaPautaSugerida,
    radarDeCombinados,
    resumoAutomaticoDaAta,
    validarAtaImportada,
    type Ata,
    type CombinadoAta,
    type PrioridadeCombinado,
    type SituacaoCombinado,
    type TipoAta,
  } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { baixarPdfAta } from '#lib/pdfExtras.ts';
  import { baixarTexto, copiar } from '#lib/saidas.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const hoje = agoraLocal().slice(0, 10);
  const abertaId = $derived(page.url.searchParams.get('id'));
  const indice = $derived(dados.atas.findIndex((a) => a.id === abertaId));

  type AbaAta = 'resumo' | 'combinados' | 'pauta' | 'notas';
  let aba = $state<AbaAta>('resumo');

  // Filtros do radar
  let filtroResp = $state('');
  let mostrarConcluidos = $state(false);

  // Ponte com IA gratuita
  let mostrarIa = $state(false);
  let textoBrutoIa = $state('');
  let tituloIa = $state('');
  let tipoIa = $state<TipoAta>('diretoria');
  let respostaIa = $state('');
  let errosIa = $state<string[]>([]);
  let avisosIa = $state<string[]>([]);
  let feedback = $state('');

  // Campos de adição rápida na ata aberta
  let novoParticipante = $state('');
  let novaDecisao = $state('');
  let novaDecisaoResp = $state('');
  let novaTarefa = $state('');
  let novoResp = $state('');
  let novoPrazo = $state('');
  let novaPrioridade = $state<PrioridadeCombinado>('media');
  let novoPonto = $state('');
  let novoPontoDono = $state('');
  let novoTopicoPauta = $state('');
  let novoTopicoProxima = $state('');

  const radar = $derived(radarDeCombinados(dados.atas, hoje));
  const atasOrdenadas = $derived([...dados.atas].sort((a, b) => b.data.localeCompare(a.data) || b.atualizadaEm.localeCompare(a.atualizadaEm)));

  const combinadosFiltrados = $derived.by(() =>
  {
    const base = mostrarConcluidos ? [...radar.emAberto, ...radar.concluidos] : radar.emAberto;
    if (!filtroResp) return base;
    return base.filter((i) => i.combinado.responsavel.toLowerCase() === filtroResp.toLowerCase());
  });

  function avisar(msg: string)
  {
    feedback = msg;
    setTimeout(() =>
    {
      if (feedback === msg) feedback = '';
    }, 2600);
  }

  function dataBr(iso?: string): string
  {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
    return iso.slice(0, 10).split('-').reverse().join('/');
  }

  function criarNovaAta()
  {
    const ata = criarAta({ titulo: 'Reunião de diretoria', data: hoje, tipo: 'diretoria' });
    dados.atas.push(ata);
    aba = 'resumo';
    goto(`/atas?id=${ata.id}`);
  }

  function criarAtaExemplo()
  {
    const ata = criarAta({
      titulo: 'Alinhamento semanal de diretoria',
      data: hoje,
      horario: '14:00',
      tipo: 'diretoria',
      participantes: ['Mariana', 'Diretoria', 'Produto', 'Operações'],
      pauta: ['Status das entregas da semana', 'Prioridades do próximo mês', 'Pontos críticos de prazo'],
      resumoExecutivo: 'Alinhamos o fechamento da sprint atual, priorizamos a automação dos relatórios semanais e definimos os responsáveis pelos destraves de infraestrutura.',
      decisoes: [
        { id: idCurto(), texto: 'Adotar o OrbisOS como fonte única das atas e combinados da diretoria', responsavel: 'Diretoria', impacto: 'Elimina combinados perdidos entre reuniões' },
        { id: idCurto(), texto: 'Fatiar o portal do cliente em 2 entregas menores', responsavel: 'Produto', impacto: 'Reduz risco de atraso no trimestre' },
      ],
      combinados: [
        { id: idCurto(), tarefa: 'Validar orçamento atualizado do trimestre', responsavel: 'Diretoria', prazo: hoje, situacao: 'pendente', prioridade: 'alta' },
        { id: idCurto(), tarefa: 'Publicar matriz de priorização com as áreas parceiras', responsavel: 'Mariana', prazo: hoje, situacao: 'andamento', prioridade: 'alta' },
        { id: idCurto(), tarefa: 'Liberar credenciais do ambiente de homologação', responsavel: 'Infra', situacao: 'bloqueado', prioridade: 'media' },
      ],
      pontosAbertos: [
        { id: idCurto(), texto: 'Definir janela de virada com clientes piloto', dono: 'Operações' },
      ],
      proximaPauta: ['Revisar orçamento aprovado', 'Confirmar data dos clientes piloto'],
    });
    dados.atas.push(ata);
    aba = 'resumo';
    goto(`/atas?id=${ata.id}`);
  }

  function excluirAta(ata: Ata)
  {
    if (!confirm(`Excluir a ata "${ata.titulo}"?`)) return;
    dados.atas = dados.atas.filter((x) => x.id !== ata.id);
    goto('/atas');
  }

  function abrirProximaAta(ata: Ata)
  {
    const prox = gerarProximaAta(ata);
    dados.atas.push(prox);
    aba = 'pauta';
    goto(`/atas?id=${prox.id}`);
    avisar('Próxima ata criada com a pauta herdada!');
  }

  function alternarSituacaoNoRadar(ataId: string, combId: string, nova: SituacaoCombinado)
  {
    const ata = dados.atas.find((a) => a.id === ataId);
    const comb = ata?.combinados.find((c) => c.id === combId);
    if (!ata || !comb) return;
    comb.situacao = nova;
    ata.atualizadaEm = agoraLocal();
  }

  async function copiarPromptIa()
  {
    await copiar(pedidoDeAtaParaIa(textoBrutoIa, { titulo: tituloIa, tipo: tipoIa, data: hoje }));
    avisar('Prompt copiado! Cole na sua IA gratuita e traga o JSON de volta.');
  }

  function importarAtaIa()
  {
    const r = validarAtaImportada(respostaIa, textoBrutoIa);
    errosIa = r.erros;
    avisosIa = r.avisos;
    if (!r.ata) return;
    dados.atas.push(r.ata);
    textoBrutoIa = '';
    respostaIa = '';
    mostrarIa = false;
    aba = 'resumo';
    goto(`/atas?id=${r.ata.id}`);
  }

  async function copiarTeams(ata: Ata)
  {
    await copiar(mensagemTeamsDaAta(ata));
    avisar('Resumo copiado para o Teams!');
  }

  function baixarMarkdown(ata: Ata)
  {
    baixarTexto(mensagemTeamsDaAta(ata), `ata-${ata.data}.md`);
  }

  async function copiarJsonIntegracao()
  {
    const eventos = exportarCombinadosParaIntegracao(dados.atas, true);
    await copiar(JSON.stringify(eventos, null, 2));
    avisar(`${eventos.length} combinado(s) copiados em JSON para integração!`);
  }

  function adicionarParticipante(ata: Ata)
  {
    const nome = novoParticipante.trim();
    if (!nome) return;
    if (!ata.participantes.includes(nome)) ata.participantes.push(nome);
    ata.atualizadaEm = agoraLocal();
    novoParticipante = '';
  }

  function adicionarDecisao(ata: Ata)
  {
    const texto = novaDecisao.trim();
    if (!texto) return;
    ata.decisoes.push({ id: idCurto(), texto, responsavel: novaDecisaoResp.trim() || undefined });
    ata.atualizadaEm = agoraLocal();
    novaDecisao = '';
    novaDecisaoResp = '';
  }

  function adicionarCombinado(ata: Ata)
  {
    const tarefa = novaTarefa.trim();
    if (!tarefa) return;
    const item: CombinadoAta = {
      id: idCurto(),
      tarefa,
      responsavel: novoResp.trim() || 'A definir',
      prazo: novoPrazo || undefined,
      situacao: 'pendente',
      prioridade: novaPrioridade,
    };
    ata.combinados.push(item);
    ata.atualizadaEm = agoraLocal();
    novaTarefa = '';
    novoResp = '';
    novoPrazo = '';
    novaPrioridade = 'media';
  }

  function adicionarPonto(ata: Ata)
  {
    const texto = novoPonto.trim();
    if (!texto) return;
    ata.pontosAbertos.push({ id: idCurto(), texto, dono: novoPontoDono.trim() || undefined });
    ata.atualizadaEm = agoraLocal();
    novoPonto = '';
    novoPontoDono = '';
  }

  function adicionarPauta(ata: Ata, destino: 'pauta' | 'proximaPauta')
  {
    const texto = (destino === 'pauta' ? novoTopicoPauta : novoTopicoProxima).trim();
    if (!texto) return;
    ata[destino].push(texto);
    ata.atualizadaEm = agoraLocal();
    if (destino === 'pauta') novoTopicoPauta = '';
    else novoTopicoProxima = '';
  }

  function puxarProximaPauta(ata: Ata)
  {
    const sugeridos = proximaPautaSugerida(ata);
    for (const s of sugeridos)
    {
      if (!ata.proximaPauta.includes(s)) ata.proximaPauta.push(s);
    }
    ata.atualizadaEm = agoraLocal();
    avisar('Pauta sugerida atualizada com os itens em aberto.');
  }

  function preencherResumoAutomatico(ata: Ata)
  {
    ata.resumoExecutivo = resumoAutomaticoDaAta(ata, hoje);
    ata.atualizadaEm = agoraLocal();
    avisar('Resumo executivo gerado a partir dos itens da ata.');
  }
</script>

<main>
  {#if feedback}
    <div class="toast" role="status">{feedback}</div>
  {/if}

  {#if indice >= 0}
    {@const ata = dados.atas[indice]!}
    <header>
      <div class="cabecalho-esq">
        <span class="prompt">&gt; <a href="/atas">atas e combinados</a></span>
        <h1>{ata.titulo}<span class="cursor">_</span></h1>
      </div>
      <div class="acoes-topo">
        <button class="principal" onclick={() => copiarTeams(ata)}>Copiar pro Teams</button>
        <button onclick={() => baixarPdfAta($state.snapshot(ata) as Ata)}>Baixar PDF</button>
        <button onclick={() => baixarMarkdown(ata)}>Baixar .md</button>
        <button onclick={() => abrirProximaAta(ata)}>Gerar próxima ata</button>
        <button class="perigo" onclick={() => excluirAta(ata)}>Excluir</button>
      </div>
    </header>

    {#if avisosIa.length}
      <div class="aviso">
        <b>Avisos da importação:</b>
        <ul>{#each avisosIa as a, i (i)}<li>{a}</li>{/each}</ul>
        <button class="link" onclick={() => (avisosIa = [])}>dispensar</button>
      </div>
    {/if}

    <section class="cartao meta-ata">
      <div class="grade-meta">
        <label>
          <span>Título</span>
          <input bind:value={ata.titulo} oninput={() => (ata.atualizadaEm = agoraLocal())} />
        </label>
        <label>
          <span>Tipo</span>
          <select bind:value={ata.tipo} onchange={() => (ata.atualizadaEm = agoraLocal())}>
            {#each Object.entries(nomesTipoAta) as [k, v] (k)}
              <option value={k}>{v}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Data</span>
          <input type="date" bind:value={ata.data} onchange={() => (ata.atualizadaEm = agoraLocal())} />
        </label>
        <label>
          <span>Horário</span>
          <input type="time" bind:value={ata.horario} onchange={() => (ata.atualizadaEm = agoraLocal())} />
        </label>
      </div>

      <div class="participantes">
        <span class="rotulo">Participantes:</span>
        {#each ata.participantes as p, i (p + i)}
          <span class="chip">
            {p}
            <button type="button" class="x" onclick={() => { ata.participantes.splice(i, 1); ata.atualizadaEm = agoraLocal(); }} aria-label="Remover {p}">×</button>
          </span>
        {/each}
        <form class="add-inline" onsubmit={(e) => { e.preventDefault(); adicionarParticipante(ata); }}>
          <input bind:value={novoParticipante} placeholder="+ adicionar participante" />
          <button type="submit">Incluir</button>
        </form>
      </div>
    </section>

    <nav class="abas" aria-label="Seções da ata">
      <button class:ativa={aba === 'resumo'} onclick={() => (aba = 'resumo')}>Resumo & Decisões ({ata.decisoes.length})</button>
      <button class:ativa={aba === 'combinados'} onclick={() => (aba = 'combinados')}>Combinados ({ata.combinados.length})</button>
      <button class:ativa={aba === 'pauta'} onclick={() => (aba = 'pauta')}>Pauta & Próxima ({ata.pontosAbertos.length} abertos)</button>
      <button class:ativa={aba === 'notas'} onclick={() => (aba = 'notas')}>Notas brutas / Transcrição</button>
    </nav>

    {#if aba === 'resumo'}
      <section class="cartao">
        <h2>Resumo executivo</h2>
        <p class="dica">Direto ao ponto para quem não estava na reunião. Você pode escrever livremente ou montar automaticamente com base nas decisões e combinados.</p>
        <textarea rows="4" bind:value={ata.resumoExecutivo} oninput={() => (ata.atualizadaEm = agoraLocal())} placeholder="Principais conclusões e direcionamentos em 2 a 4 linhas..."></textarea>
        <div class="linha-acoes">
          <button onclick={() => preencherResumoAutomatico(ata)}>Gerar resumo automático</button>
        </div>
      </section>

      <section class="cartao">
        <h2>Decisões tomadas</h2>
        <form class="form-linha" onsubmit={(e) => { e.preventDefault(); adicionarDecisao(ata); }}>
          <input class="crescer" bind:value={novaDecisao} placeholder="Ex.: Aprovado fatiar a entrega em 2 fases..." />
          <input bind:value={novaDecisaoResp} placeholder="Responsável (opcional)" />
          <button class="principal" type="submit">Adicionar decisão</button>
        </form>
        {#if ata.decisoes.length}
          <ul class="lista-itens">
            {#each ata.decisoes as d, i (d.id)}
              <li>
                <div class="item-corpo">
                  <strong>{d.texto}</strong>
                  {#if d.responsavel || d.impacto}
                    <small class="dica">{[d.responsavel ? `Resp.: ${d.responsavel}` : '', d.impacto ? `Impacto: ${d.impacto}` : ''].filter(Boolean).join(' · ')}</small>
                  {/if}
                </div>
                <button class="perigo-leve" onclick={() => { ata.decisoes.splice(i, 1); ata.atualizadaEm = agoraLocal(); }}>Remover</button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="dica">Nenhuma decisão registrada ainda.</p>
        {/if}
      </section>
    {:else if aba === 'combinados'}
      <section class="cartao">
        <h2>Combinados e encaminhamentos</h2>
        <form class="form-combinado" onsubmit={(e) => { e.preventDefault(); adicionarCombinado(ata); }}>
          <input class="crescer" bind:value={novaTarefa} placeholder="O que ficou combinado?" />
          <input bind:value={novoResp} placeholder="Quem faz?" />
          <input type="date" bind:value={novoPrazo} />
          <select bind:value={novaPrioridade}>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <button class="principal" type="submit">Incluir</button>
        </form>

        {#if ata.combinados.length}
          <div class="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Prioridade</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each ata.combinados as c, i (c.id)}
                  <tr class:feito={c.situacao === 'concluido'} class:atrasado={c.situacao !== 'concluido' && !!c.prazo && c.prazo < hoje}>
                    <td><input class="celula" bind:value={c.tarefa} oninput={() => (ata.atualizadaEm = agoraLocal())} /></td>
                    <td><input class="celula" bind:value={c.responsavel} oninput={() => (ata.atualizadaEm = agoraLocal())} /></td>
                    <td><input class="celula" type="date" bind:value={c.prazo} onchange={() => (ata.atualizadaEm = agoraLocal())} /></td>
                    <td>
                      <select class="celula" bind:value={c.prioridade} onchange={() => (ata.atualizadaEm = agoraLocal())}>
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                    </td>
                    <td>
                      <select class="celula" bind:value={c.situacao} onchange={() => (ata.atualizadaEm = agoraLocal())}>
                        {#each Object.entries(nomesSituacaoCombinado) as [k, v] (k)}
                          <option value={k}>{v}</option>
                        {/each}
                      </select>
                    </td>
                    <td><button class="perigo-leve" onclick={() => { ata.combinados.splice(i, 1); ata.atualizadaEm = agoraLocal(); }}>×</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="dica">Nenhum combinado adicionado ainda.</p>
        {/if}
      </section>
    {:else if aba === 'pauta'}
      <div class="grade-duas">
        <section class="cartao">
          <h2>Pauta desta reunião</h2>
          <form class="form-linha" onsubmit={(e) => { e.preventDefault(); adicionarPauta(ata, 'pauta'); }}>
            <input class="crescer" bind:value={novoTopicoPauta} placeholder="Adicionar tópico..." />
            <button type="submit">Incluir</button>
          </form>
          <ul class="lista-itens">
            {#each ata.pauta as item, i (item + i)}
              <li>
                <span>{item}</span>
                <button class="perigo-leve" onclick={() => { ata.pauta.splice(i, 1); ata.atualizadaEm = agoraLocal(); }}>×</button>
              </li>
            {:else}
              <li class="dica">Sem tópicos cadastrados.</li>
            {/each}
          </ul>
        </section>

        <section class="cartao">
          <h2>Pontos em aberto (sem resposta)</h2>
          <form class="form-linha" onsubmit={(e) => { e.preventDefault(); adicionarPonto(ata); }}>
            <input class="crescer" bind:value={novoPonto} placeholder="Tema pendente..." />
            <input bind:value={novoPontoDono} placeholder="Dono" />
            <button type="submit">Incluir</button>
          </form>
          <ul class="lista-itens">
            {#each ata.pontosAbertos as p, i (p.id)}
              <li>
                <span>{p.texto} {#if p.dono}<small class="dica">({p.dono})</small>{/if}</span>
                <button class="perigo-leve" onclick={() => { ata.pontosAbertos.splice(i, 1); ata.atualizadaEm = agoraLocal(); }}>×</button>
              </li>
            {:else}
              <li class="dica">Nenhum ponto em aberto.</li>
            {/each}
          </ul>
        </section>
      </div>

      <section class="cartao">
        <h2>Pauta da próxima reunião</h2>
        <div class="linha-acoes">
          <button onclick={() => puxarProximaPauta(ata)}>Puxar pontos em aberto e bloqueios</button>
          <button class="principal" onclick={() => abrirProximaAta(ata)}>Criar próxima ata com esta pauta</button>
        </div>
        <form class="form-linha" onsubmit={(e) => { e.preventDefault(); adicionarPauta(ata, 'proximaPauta'); }}>
          <input class="crescer" bind:value={novoTopicoProxima} placeholder="Adicionar tópico para a próxima rodada..." />
          <button type="submit">Incluir</button>
        </form>
        <ul class="lista-itens">
          {#each ata.proximaPauta as item, i (item + i)}
            <li>
              <span>{item}</span>
              <button class="perigo-leve" onclick={() => { ata.proximaPauta.splice(i, 1); ata.atualizadaEm = agoraLocal(); }}>×</button>
            </li>
          {:else}
            <li class="dica">Clique em "Puxar pontos em aberto" ou adicione tópicos manualmente.</li>
          {/each}
        </ul>
      </section>
    {:else}
      <section class="cartao">
        <h2>Notas brutas ou transcrição</h2>
        <p class="dica">Guarde aqui as anotações livres feitas durante a reunião ou a transcrição colada do Teams para consulta futura.</p>
        <textarea rows="12" bind:value={ata.notasBrutas} oninput={() => (ata.atualizadaEm = agoraLocal())} placeholder="Cole anotações soltas ou a transcrição da reunião..."></textarea>
      </section>
    {/if}
  {:else}
    <header>
      <div class="cabecalho-esq">
        <span class="prompt">&gt; atas e combinados</span>
        <h1>Atas & Radar de Combinados<span class="cursor">_</span></h1>
      </div>
      <div class="acoes-topo">
        <button class="principal" onclick={criarNovaAta}>+ Nova ata</button>
        <button onclick={() => (mostrarIa = !mostrarIa)}>{mostrarIa ? 'Fechar IA gratuita' : 'Estruturar transcrição (IA)'}</button>
        {#if !dados.atas.length}
          <button onclick={criarAtaExemplo}>Carregar exemplo</button>
        {/if}
        {#if radar.emAberto.length}
          <button onclick={copiarJsonIntegracao} title="Copia os combinados em JSON padronizado para integrar com seu app de rotinas">Exportar JSON (API/Rotinas)</button>
        {/if}
      </div>
    </header>
    <p class="dica">Registre atas de diretoria e alinhamentos, gere resumos executivos prontos pro Teams/PDF e acompanhe todos os combinados sem perder nada entre reuniões.</p>

    <div class="kpis">
      <div class="kpi">
        <span>Combinados em aberto</span>
        <strong>{radar.emAberto.length}</strong>
      </div>
      <div class="kpi" class:alerta-vermelho={radar.atrasados.length > 0}>
        <span>Atrasados</span>
        <strong>{radar.atrasados.length}</strong>
      </div>
      <div class="kpi" class:alerta-amarelo={radar.vencendo.length > 0}>
        <span>Vencendo (3 dias)</span>
        <strong>{radar.vencendo.length}</strong>
      </div>
      <div class="kpi">
        <span>Atas registradas</span>
        <strong>{dados.atas.length}</strong>
      </div>
    </div>

    {#if mostrarIa}
      <section class="cartao ia-bloco">
        <h2>Estruturar transcrição com IA gratuita</h2>
        <p class="dica">Cole a transcrição do Teams ou suas anotações bagunçadas. O OrbisOS monta o prompt, você cola no chat gratuito de sua preferência e traz o JSON estruturado de volta.</p>
        <div class="grade-meta">
          <label>
            <span>Título (opcional)</span>
            <input bind:value={tituloIa} placeholder="Ex.: Reunião semanal de diretoria" />
          </label>
          <label>
            <span>Tipo</span>
            <select bind:value={tipoIa}>
              {#each Object.entries(nomesTipoAta) as [k, v] (k)}
                <option value={k}>{v}</option>
              {/each}
            </select>
          </label>
        </div>
        <textarea rows="5" bind:value={textoBrutoIa} placeholder="1. Cole aqui a transcrição ou notas soltas da reunião..."></textarea>
        <div class="linha-acoes">
          <button class="principal" disabled={!textoBrutoIa.trim()} onclick={copiarPromptIa}>Copiar prompt para IA gratuita</button>
        </div>
        <textarea rows="5" bind:value={respostaIa} placeholder="2. Cole aqui o JSON retornado pela IA..."></textarea>
        <div class="linha-acoes">
          <button class="principal" disabled={!respostaIa.trim()} onclick={importarAtaIa}>Criar ata estruturada</button>
        </div>
        {#if errosIa.length}
          <ul class="erros">{#each errosIa as e, i (i)}<li>{e}</li>{/each}</ul>
        {/if}
      </section>
    {/if}

    <section class="cartao">
      <h2>Radar de combinados</h2>
      {#if radar.porResponsavel.length}
        <div class="filtros-resp">
          <button class:ativo={!filtroResp} onclick={() => (filtroResp = '')}>Todos ({radar.emAberto.length})</button>
          {#each radar.porResponsavel as r (r.responsavel)}
            <button class:ativo={filtroResp === r.responsavel} onclick={() => (filtroResp = filtroResp === r.responsavel ? '' : r.responsavel)}>
              {r.responsavel} ({r.abertos}{#if r.atrasados > 0} · {r.atrasados} atr.{/if})
            </button>
          {/each}
          <label class="toggle-concluidos">
            <input type="checkbox" bind:checked={mostrarConcluidos} /> mostrar concluídos
          </label>
        </div>

        {#if combinadosFiltrados.length}
          <ul class="lista-radar">
            {#each combinadosFiltrados as item (item.ataId + item.combinado.id)}
              <li class:atrasado={item.statusPrazo === 'atrasado'} class:vencendo={item.statusPrazo === 'vencendo'} class:feito={item.combinado.situacao === 'concluido'}>
                <input
                  type="checkbox"
                  checked={item.combinado.situacao === 'concluido'}
                  onchange={(e) => alternarSituacaoNoRadar(item.ataId, item.combinado.id, (e.currentTarget as HTMLInputElement).checked ? 'concluido' : 'pendente')}
                  aria-label="Marcar combinado como concluído"
                />
                <div class="radar-info">
                  <strong>{item.combinado.tarefa}</strong>
                  <small>
                    <b>{item.combinado.responsavel}</b>
                    · prazo {dataBr(item.combinado.prazo)}
                    · <a href={`/atas?id=${item.ataId}`}>{item.ataTitulo}</a>
                  </small>
                </div>
                <span class="selo {item.statusPrazo}">
                  {#if item.statusPrazo === 'atrasado'}Atrasado
                  {:else if item.statusPrazo === 'vencendo'}Vencendo
                  {:else if item.combinado.situacao === 'bloqueado'}Bloqueado
                  {:else if item.statusPrazo === 'concluido'}Concluído
                  {:else}No prazo{/if}
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="dica">Nenhum combinado pendente neste filtro.</p>
        {/if}
      {:else}
        <p class="dica">Quando você registrar atas com encaminhamentos, todos os combinados aparecem consolidados aqui por responsável e prazo.</p>
      {/if}
    </section>

    <section class="cartao">
      <h2>Atas registradas</h2>
      {#if atasOrdenadas.length}
        <div class="grade-atas">
          {#each atasOrdenadas as ata (ata.id)}
            {@const abertos = ata.combinados.filter((c) => c.situacao !== 'concluido').length}
            <a class="card-ata" href={`/atas?id=${ata.id}`}>
              <div class="card-ata-topo">
                <span class="tag-tipo">{nomesTipoAta[ata.tipo]}</span>
                <span class="data">{dataBr(ata.data)}</span>
              </div>
              <h3>{ata.titulo}</h3>
              <p class="resumo-curto">{ata.resumoExecutivo || resumoAutomaticoDaAta(ata, hoje)}</p>
              <div class="card-ata-rodape">
                <span>{ata.decisoes.length} decisão(ões)</span>
                <span>{abertos} combinado(s) aberto(s)</span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <p class="dica">Nenhuma ata registrada ainda. Clique em <b>+ Nova ata</b> ou <b>Carregar exemplo</b> para testar.</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .cabecalho-esq
  {
    margin-right: auto;
  }
  .acoes-topo
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
  }
  .toast
  {
    position: fixed;
    right: var(--size-5);
    bottom: var(--size-5);
    z-index: 50;
    background: var(--superficie);
    border: 1px solid var(--marca);
    box-shadow: var(--brilho);
    padding: var(--size-2) var(--size-4);
    border-radius: var(--raio);
    font-family: var(--fonte-maquina);
    font-size: 0.88rem;
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--size-3);
    margin: var(--size-4) 0;
  }
  .kpi
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: var(--size-3) var(--size-4);
    display: grid;
    gap: var(--size-1);
  }
  .kpi span
  {
    font-size: 0.8rem;
    color: var(--suave);
    font-family: var(--fonte-maquina);
    text-transform: uppercase;
  }
  .kpi strong
  {
    font-family: var(--fonte-pixel);
    font-size: 1.8rem;
    line-height: 1;
  }
  .kpi.alerta-vermelho
  {
    border-color: var(--vermelho);
    background: var(--vermelho-fundo);
  }
  .kpi.alerta-vermelho strong
  {
    color: var(--vermelho);
  }
  .kpi.alerta-amarelo
  {
    border-color: var(--amarelo);
    background: var(--amarelo-fundo);
  }
  .kpi.alerta-amarelo strong
  {
    color: var(--amarelo);
  }
  .grade-meta
  {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: var(--size-3);
  }
  .grade-meta label
  {
    display: grid;
    gap: var(--size-1);
    font-size: 0.84rem;
    color: var(--suave);
  }
  .participantes
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-2);
    margin-top: var(--size-3);
    padding-top: var(--size-3);
    border-top: 1px dashed var(--borda);
  }
  .rotulo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.82rem;
    color: var(--suave);
  }
  .chip
  {
    display: inline-flex;
    align-items: center;
    gap: var(--size-1);
    background: var(--superficie-2);
    border: 1px solid var(--borda-forte);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.84rem;
  }
  .chip .x
  {
    border: none;
    background: none;
    padding: 0 2px;
    color: var(--suave);
  }
  .add-inline
  {
    display: flex;
    gap: var(--size-1);
  }
  .abas
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-1);
    margin: var(--size-4) 0 var(--size-3);
    border-bottom: 1px solid var(--borda);
  }
  .abas button
  {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    color: var(--suave);
    margin-bottom: -1px;
  }
  .abas button.ativa
  {
    color: var(--marca);
    border-bottom-color: var(--marca);
  }
  .form-linha, .form-combinado
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    margin-bottom: var(--size-3);
  }
  .crescer
  {
    flex: 1 1 240px;
  }
  .linha-acoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    margin: var(--size-2) 0 var(--size-3);
  }
  .lista-itens, .lista-radar
  {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--size-2);
  }
  .lista-itens li
  {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-3);
    padding: var(--size-2) var(--size-3);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
  }
  .item-corpo
  {
    display: grid;
    gap: 2px;
  }
  .filtros-resp
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-2);
    margin-bottom: var(--size-3);
  }
  .filtros-resp button.ativo
  {
    border-color: var(--marca);
    color: var(--marca);
    background: var(--marca-clara);
  }
  .toggle-concluidos
  {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--size-1);
    font-size: 0.85rem;
    color: var(--suave);
  }
  .lista-radar li
  {
    display: flex;
    align-items: center;
    gap: var(--size-3);
    padding: var(--size-2) var(--size-3);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
  }
  .lista-radar li.atrasado
  {
    border-left: 3px solid var(--vermelho);
  }
  .lista-radar li.vencendo
  {
    border-left: 3px solid var(--amarelo);
  }
  .lista-radar li.feito
  {
    opacity: 0.65;
  }
  .lista-radar li.feito strong
  {
    text-decoration: line-through;
  }
  .radar-info
  {
    flex: 1;
    display: grid;
    gap: 2px;
  }
  .radar-info small
  {
    color: var(--suave);
  }
  .selo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.76rem;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--borda-forte);
  }
  .selo.atrasado
  {
    color: var(--vermelho);
    background: var(--vermelho-fundo);
    border-color: var(--vermelho);
  }
  .selo.vencendo
  {
    color: var(--amarelo);
    background: var(--amarelo-fundo);
    border-color: var(--amarelo);
  }
  .selo.concluido
  {
    color: var(--verde);
    background: var(--verde-fundo);
    border-color: var(--verde);
  }
  .grade-atas
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: var(--size-3);
  }
  .card-ata
  {
    text-decoration: none;
    color: var(--texto);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: var(--size-4);
    display: grid;
    gap: var(--size-2);
    transition: border-color 0.15s var(--curva), transform 0.15s var(--curva);
  }
  .card-ata:hover
  {
    border-color: var(--marca);
    transform: translateY(-2px);
  }
  .card-ata-topo, .card-ata-rodape
  {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    font-family: var(--fonte-maquina);
    color: var(--suave);
  }
  .tag-tipo
  {
    color: var(--marca);
    text-transform: uppercase;
  }
  .card-ata h3
  {
    margin: 0;
    color: var(--texto);
    font-size: 1rem;
  }
  .resumo-curto
  {
    margin: 0;
    font-size: 0.86rem;
    color: var(--suave);
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tabela-wrap
  {
    overflow-x: auto;
  }
  table
  {
    width: 100%;
    border-collapse: collapse;
  }
  th, td
  {
    text-align: left;
    padding: var(--size-2);
    border-bottom: 1px solid var(--borda);
  }
  th
  {
    font-family: var(--fonte-maquina);
    font-size: 0.8rem;
    color: var(--suave);
    text-transform: uppercase;
  }
  tr.feito
  {
    opacity: 0.65;
  }
  tr.atrasado td:first-child input
  {
    border-left: 3px solid var(--vermelho);
  }
  .celula
  {
    width: 100%;
    min-width: 110px;
  }
  .grade-duas
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--size-4);
  }
  .ia-bloco
  {
    display: grid;
    gap: var(--size-3);
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .perigo, .perigo-leve
  {
    color: var(--vermelho);
  }
  .perigo-leve
  {
    border: none;
    background: transparent;
    padding: 2px 6px;
  }
  .erros
  {
    color: var(--vermelho);
    margin: 0;
    padding-left: var(--size-5);
  }
  .link
  {
    border: none;
    background: none;
    color: inherit;
    text-decoration: underline;
    padding: 0;
  }
  @media (max-width: 780px)
  {
    .grade-meta
    {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
