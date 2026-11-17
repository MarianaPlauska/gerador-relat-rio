<script lang="ts">
  import
  {
    agruparPorPessoa, agoraLocal, analisarTimeNoProjeto, compararComAnteriores, consolidarArvoreDeCards, correlacionarCapturaComArvore,
    detectarOrigem, ehCsvDeDemandas, fotoVazia, idCurto, lerCards, lerCsvDemandas, lerOndas, lerTotais,
    linhasNaoReconhecidas, mesclarNaFoto, nomesTotais, pessoasDoProjeto, segundaDaSemana, somarDias, sugerirDaCaptura, unirCapturas,
    type CapturaLida, type CardSnapshot, type Onda, type OrigemLeitura, type RegistroPainel, type Snapshot, type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerColagem } from '#lib/colagem.ts';
  import { lerImagem, miniaturaDataUrl } from '#lib/ocr.ts';
  import TabelaCards from '#lib/TabelaCards.svelte';
  import { dataCurta, dataMedia } from '#lib/semana.ts';

  type ChaveTotal = keyof TotaisPainel;

  const gruposTotais: { titulo: string; chaves: ChaveTotal[]; secundario?: boolean }[] = [
    { titulo: 'Cronograma', chaves: ['itensCronograma', 'concluidos', 'concluidosPct', 'vencem15Dias', 'atrasadosVencimento'] },
    { titulo: 'Em andamento e ritmo', chaves: ['demandasEmAndamento', 'etapaRodando', 'ritmoNoRitmo', 'ritmoEmRisco', 'ritmoAtrasadas'] },
    { titulo: 'Prazo e eficiência', chaves: ['dentroDoPrazoPct', 'metaPct', 'concluidasNoPeriodo', 'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade'] },
    { titulo: 'Etapas e tempo', chaves: ['etapasConcluidas', 'etapasConcluidasVariacao', 'tempoMedianoEtapaMin', 'ociosoPct', 'ociosoHoras', 'tempoLimpoMedianaH', 'tempoLimpoVariacaoH', 'tempoLimpoMediaDias'] },
    {
      titulo: 'Outros números (opcional)',
      secundario: true,
      chaves: ['aindaPlanejado', 'emExecucao', 'datasFixadas', 'paradasEntreEtapas', 'emAbertoAgora', 'foraDoPrazo', 'previsoesSemana', 'previsaoVencida', 'qualidadePct', 'idadeAte1Dia', 'idade1a3Dias', 'idade3a7Dias', 'idade7a15Dias', 'idadeMais15Dias'],
    },
  ];

  const nomesOrigemPadrao: Record<string, string> = {
    em_execucao: 'Quem está cuidando de quê',
    fila: 'Fila de demandas a iniciar',
    cronograma: 'Cronograma',
    demandas: 'Lista de demandas',
    card: 'Card aberto (etapas)',
  };

  const obterNomeOrigem = (origem: string) => nomesOrigemPadrao[origem] || origem;
  const nomesOrigem: Record<string, string> = new Proxy(nomesOrigemPadrao, {
    get: (target, prop: string) => target[prop] || prop,
  });

  let criandoOpcaoPara = $state<string | null>(null);
  let textoNovaOpcao = $state('');

  function adicionarNovaOpcao(capId: string)
  {
    const nome = textoNovaOpcao.trim();
    if (!nome)
    {
      criandoOpcaoPara = null;
      return;
    }
    if (!dados.origensPersonalizadas) dados.origensPersonalizadas = [];
    if (!dados.origensPersonalizadas.includes(nome) && !nomesOrigemPadrao[nome])
    {
      dados.origensPersonalizadas = [...dados.origensPersonalizadas, nome];
    }
    const cap = capturas.find((c) => c.id === capId);
    if (cap)
    {
      cap.origem = nome;
      cap.nome = `${cap.nome.split(' · ')[0]} · ${nome}`;
      recalcular();
    }
    criandoOpcaoPara = null;
    textoNovaOpcao = '';
  }

  let dados = $state<Dados>(carregar());
  let aba = $state<'novo' | 'diario'>('novo');
  let pastaAtual = $state(dados.registros.at(-1)?.pasta ?? dados.prefixo ?? 'DEV');
  let novaPasta = $state('');
  let dataRegistro = $state(agoraLocal().slice(0, 10));
  let aviso = $state('');
  let progresso = $state<number | null>(null);

  // novo registro em andamento
  let caixa = $state('');
  let capturas = $state<CapturaLida[]>([]);
  let totaisLidos = $state<TotaisPainel>({});
  let cardsLidos = $state<CardSnapshot[]>([]);
  let ondasLidas = $state<Onda[]>([]);
  let motivo = $state('');
  let textoFinal = $state('');
  let editouTexto = $state(false);
  let novaPessoaNome = $state('');
  let pessoaExpandidaEnvio = $state<string | null>(null);

  // diário
  let busca = $state('');
  let marcados = $state<string[]>([]);
  let dataNumeros = $state(agoraLocal().slice(0, 10));

  $effect(() => salvar($state.snapshot(dados)));

  const pastas = $derived([...new Set([dados.prefixo || 'DEV', ...dados.registros.map((r) => r.pasta), ...dados.fotos.map((f) => f.pasta).filter((p): p is string => !!p), ...(dados.pessoas.flatMap((p) => p.pastas ?? [])), pastaAtual])].filter(Boolean));
  const registrosDaPasta = $derived([...dados.registros].filter((r) => r.pasta === pastaAtual).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)));
  const registrosFiltrados = $derived.by(() =>
  {
    const q = busca.trim().toLowerCase();
    if (!q) return registrosDaPasta;
    return registrosDaPasta.filter((r) => [r.data, r.motivo, r.texto, ...r.cards, ...r.capturas.map((c) => c.comentario ?? '')].join(' ').toLowerCase().includes(q));
  });
  const fotosDaPasta = $derived(dados.fotos.filter((f) => (f.pasta ?? dados.prefixo) === pastaAtual).sort((a, b) => b.data.localeCompare(a.data)));
  const fotoBase = $derived(fotosDaPasta.find((f) => f.data <= dataRegistro));
  const indiceFotoNumeros = $derived(dados.fotos.findIndex((f) => f.data === dataNumeros && (f.pasta ?? dados.prefixo) === pastaAtual));
  const fotoNumeros = $derived<Snapshot>(dados.fotos[indiceFotoNumeros] ?? { ...fotoVazia(dataNumeros), pasta: pastaAtual });
  const chavesLidas = $derived(Object.keys(totaisLidos) as ChaveTotal[]);
  const avisosCards = $derived(cardsLidos.filter((c) => c.avisosLeitura?.length).length);
  const unido = $derived(unirCapturas($state.snapshot(capturas) as CapturaLida[], { motivo }));
  const comentados = $derived(capturas.filter((c) => c.comentario?.trim()).length);
  const podeSalvar = $derived(capturas.length > 0 || !!motivo.trim() || !!textoFinal.trim());
  const porPessoaConsolidado = $derived(agruparPorPessoa(cardsLidos, dados.pessoas));
  const pessoasDaPasta = $derived(pessoasDoProjeto(dados.pessoas, [...cardsLidos, ...(fotoBase?.cards ?? [])], pastaAtual));

  const semanaRegistro = $derived(segundaDaSemana(dataRegistro));
  const analiseEnvio = $derived(
    analisarTimeNoProjeto({
      pessoas: dados.pessoas,
      fotos: [...fotosDaPasta.filter((f) => f.data < dataRegistro), { data: dataRegistro, pasta: pastaAtual, totais: totaisLidos, cards: cardsLidos }],
      planos: dados.planos,
      pasta: pastaAtual,
      semanaInicio: semanaRegistro,
      semanaFim: somarDias(semanaRegistro, 6),
      hoje: dataRegistro,
    }),
  );

  // o texto final acompanha os comentários até a supervisora mexer nele
  $effect(() =>
  {
    if (!editouTexto) textoFinal = unido.texto;
  });

  function adicionarPessoaNaPasta()
  {
    const nome = novaPessoaNome.trim();
    if (!nome) return;
    const id = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || idCurto();
    const existente = dados.pessoas.find((p) => p.id === id || p.nome.toLowerCase() === nome.toLowerCase());
    if (existente)
    {
      const pastasAtuais = existente.pastas ?? (pastaAtual === 'DEV' ? ['DEV'] : ['DEV']);
      if (!pastasAtuais.includes(pastaAtual)) existente.pastas = [...pastasAtuais, pastaAtual];
    }
    else
    {
      dados.pessoas = [...dados.pessoas, { id, nome, capacidadeHorasSemana: 40, pastas: [pastaAtual] }];
    }
    novaPessoaNome = '';
    recalcular();
  }

  function analisar(
    conteudo: string,
    origemForcada: OrigemLeitura | undefined,
    anteriores: CardSnapshot[],
    capturasPrevias: CapturaLida[] = [],
    cardPaiForcado?: string,
  )
  {
    const origem = origemForcada ?? detectarOrigem(conteudo);
    const csv = ehCsvDeDemandas(conteudo) ? lerCsvDemandas(conteudo, { prefixo: pastaAtual, pessoas: dados.pessoas }) : undefined;
    const totais = csv ? {} : lerTotais(conteudo);
    const cardsBrutos = csv ? csv.cards : lerCards(conteudo, { prefixo: pastaAtual, pessoas: dados.pessoas, origem, hoje: dataRegistro });
    const corr = correlacionarCapturaComArvore(cardsBrutos, anteriores, capturasPrevias, dados.pessoas, cardPaiForcado);
    const cards = corr.cards.filter((c) => c.codigo !== '__ORFAO__');
    const ondas = lerOndas(conteudo);
    const comp = compararComAnteriores(cards, anteriores);
    const { avisos, sugestoes } = sugerirDaCaptura({ origem, totais, cards, ondas });
    const porPessoa = agruparPorPessoa(cards, dados.pessoas).map(({ pessoa, tarefas }) => ({ pessoa, tarefas }));
    return {
      origem,
      totais,
      cards,
      ondas,
      avisos,
      sugestoes,
      naoReconhecido: linhasNaoReconhecidas(conteudo, pastaAtual),
      repetidos: comp.repetidos,
      novos: comp.novos,
      porPessoa,
      cardPaiVinculado: corr.cardPaiVinculado,
      confiancaVinculoPct: corr.confiancaVinculoPct,
      motivoVinculo: corr.motivoVinculo,
    };
  }

  function juntar(t: TotaisPainel, c: CardSnapshot[], novoT: TotaisPainel, novoC: CardSnapshot[])
  {
    const m = mesclarNaFoto({ data: dataRegistro, totais: t, cards: c }, novoT, novoC);
    return { totais: m.totais, cards: consolidarArvoreDeCards(m.cards) };
  }

  function registrarCaptura(conteudo: string, nome: string, imagemDataUrl?: string)
  {
    const previas = $state.snapshot(capturas) as CapturaLida[];
    const a = analisar(conteudo, undefined, [...cardsLidos, ...(fotoBase?.cards ?? [])], previas);
    capturas = [
      ...capturas,
      {
        id: idCurto(), nome: `${nome} · ${nomesOrigem[a.origem]}`, origem: a.origem, texto: conteudo, ...(imagemDataUrl ? { imagemDataUrl } : {}),
        totais: Object.keys(a.totais) as ChaveTotal[], cards: a.cards.map((c) => c.codigo), ondas: a.ondas.length, avisos: a.avisos, sugestoes: a.sugestoes,
        comentario: '', naoReconhecido: a.naoReconhecido, repetidos: a.repetidos, novos: a.novos, porPessoa: a.porPessoa,
        ...(a.cardPaiVinculado ? { cardPaiVinculado: a.cardPaiVinculado } : {}),
        ...(a.confiancaVinculoPct !== undefined ? { confiancaVinculoPct: a.confiancaVinculoPct } : {}),
        ...(a.motivoVinculo ? { motivoVinculo: a.motivoVinculo } : {}),
      },
    ];
    const j = juntar($state.snapshot(totaisLidos), $state.snapshot(cardsLidos), a.totais, a.cards);
    totaisLidos = j.totais;
    cardsLidos = j.cards;
    if (a.ondas.length) ondasLidas = a.ondas;
  }

  // refaz tudo a partir do texto de cada print (depois de corrigir um texto, mudar o tipo ou ajustar o card pai)
  function recalcular()
  {
    let t: TotaisPainel = {};
    let c: CardSnapshot[] = [];
    let o: Onda[] = [];
    const base = fotoBase?.cards ?? [];
    const processadas: CapturaLida[] = [];
    for (const cap of capturas)
    {
      const a = analisar(cap.texto, cap.origem, [...c, ...base], processadas, cap.cardPaiVinculado);
      const j = juntar(t, c, a.totais, a.cards);
      t = j.totais;
      c = j.cards;
      if (a.ondas.length) o = a.ondas;
      const atualizada: CapturaLida = {
        ...cap,
        totais: Object.keys(a.totais) as ChaveTotal[],
        cards: a.cards.map((x) => x.codigo),
        ondas: a.ondas.length,
        avisos: a.avisos,
        sugestoes: a.sugestoes,
        naoReconhecido: a.naoReconhecido,
        repetidos: a.repetidos,
        novos: a.novos,
        porPessoa: a.porPessoa,
        ...(a.cardPaiVinculado ? { cardPaiVinculado: a.cardPaiVinculado } : {}),
        ...(a.confiancaVinculoPct !== undefined ? { confiancaVinculoPct: a.confiancaVinculoPct } : {}),
        ...(a.motivoVinculo ? { motivoVinculo: a.motivoVinculo } : {}),
      };
      processadas.push(atualizada);
    }
    capturas = processadas;
    totaisLidos = t;
    cardsLidos = c;
    ondasLidas = o;
  }

  function atualizarHorasCard(codigo: string, valor: string)
  {
    const num = Number(valor);
    if (Number.isNaN(num) || num < 0) return;
    cardsLidos = cardsLidos.map((c) => (c.codigo === codigo ? { ...c, horasEstimadas: num } : c));
  }

  function removerCaptura(id: string)
  {
    capturas = capturas.filter((c) => c.id !== id);
    recalcular();
  }

  async function lerImagens(imagens: Blob[])
  {
    try
    {
      for (const [i, imagem] of imagens.entries())
      {
        const nome = imagem instanceof File && imagem.name ? imagem.name.replace(/\.[^.]+$/, '') : `Print ${capturas.length + 1}`;
        aviso = `Lendo a imagem ${i + 1} de ${imagens.length}. Na primeira vez baixa o idioma, pode demorar.`;
        progresso = 0;
        const [texto, miniatura] = await Promise.all([lerImagem(imagem, (p) => (progresso = p), dados.prefixo), miniaturaDataUrl(imagem).catch(() => undefined)]);
        registrarCaptura(texto, nome, miniatura);
      }
      aviso = `${imagens.length === 1 ? 'Imagem lida' : `${imagens.length} imagens lidas`}. Confira abaixo e comente cada print. Pode colar o próximo.`;
    }
    catch (erro)
    {
      aviso = `Não consegui ler a imagem: ${String(erro)}`;
    }
    finally
    {
      progresso = null;
    }
  }

  async function aoColar(e: ClipboardEvent)
  {
    const colado = lerColagem(e);
    if (!colado) return;
    e.preventDefault();
    if (colado.tipo === 'texto')
    {
      registrarCaptura(colado.texto, `Texto ${capturas.length + 1}`);
      caixa = '';
      return;
    }
    await lerImagens([colado.imagem]);
  }

  function aoSoltar(e: DragEvent)
  {
    const imagens = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!imagens.length) return;
    e.preventDefault();
    lerImagens(imagens);
  }

  function limpar()
  {
    caixa = '';
    capturas = [];
    totaisLidos = {};
    cardsLidos = [];
    ondasLidas = [];
    motivo = '';
    textoFinal = '';
    editouTexto = false;
  }

  function salvarRegistro(emitir = false)
  {
    // garante que novas pessoas lidas nos cards deste projeto fiquem salvas na equipe do projeto
    const descobertas = pessoasDoProjeto(dados.pessoas, cardsLidos, pastaAtual);
    for (const p of descobertas)
    {
      if (!dados.pessoas.some((x) => x.id === p.id))
      {
        dados.pessoas = [...dados.pessoas, p];
      }
    }

    const registro: RegistroPainel = {
      id: idCurto(),
      pasta: pastaAtual,
      data: dataRegistro,
      criadoEm: agoraLocal(),
      motivo: motivo.trim(),
      resumo: unido.resumo,
      texto: textoFinal.trim(),
      capturas: $state.snapshot(capturas) as CapturaLida[],
      cards: cardsLidos.map((c) => c.codigo),
    };
    dados.registros = [...dados.registros, registro];
    if (chavesLidas.length || cardsLidos.length || ondasLidas.length)
    {
      const foto = dados.fotos.find((f) => f.data === dataRegistro && (f.pasta ?? dados.prefixo) === pastaAtual) ?? { ...fotoVazia(dataRegistro), pasta: pastaAtual };
      const nova = mesclarNaFoto(foto, $state.snapshot(totaisLidos), $state.snapshot(cardsLidos), $state.snapshot(ondasLidas), { pasta: pastaAtual });
      dados.fotos = [...dados.fotos.filter((f) => f !== foto), nova].sort((a, b) => a.data.localeCompare(b.data));
    }
    salvar($state.snapshot(dados));
    limpar();
    if (emitir)
    {
      emitirRelatorio([registro.id]);
      return;
    }
    aviso = `Guardado no diário do projeto ${pastaAtual} (${dataMedia(registro.data)}).`;
    aba = 'diario';
  }

  // o relatório recebe só os registros escolhidos; nada é obrigatório
  function emitirRelatorio(ids: string[])
  {
    const rs = dados.registros.filter((r) => ids.includes(r.id));
    if (!rs.length) return;
    const datas = rs.map((r) => r.data).sort();
    const de = datas[0]!;
    const ate = datas.at(-1)!;
    const chave = `${de}_${ate}`;
    const atuais = dados.relatorios[chave] ?? {};
    dados.relatorios[chave] = { ...atuais, blocos: { ...atuais.blocos, registro: [{ tipo: 'anotacao', registroIds: ids, comImagens: true }] } };
    dados.ultimoModelo = 'registro';
    salvar($state.snapshot(dados));
    goto(`/relatorio?de=${de}&ate=${ate}`);
  }

  function apagarRegistro(id: string)
  {
    const r = dados.registros.find((x) => x.id === id);
    if (!r || !confirm(`Apagar o registro de ${dataMedia(r.data)}${r.motivo ? ` (${r.motivo})` : ''}?`)) return;
    dados.registros = dados.registros.filter((x) => x.id !== id);
    marcados = marcados.filter((m) => m !== id);
  }

  function alternarMarca(id: string)
  {
    marcados = marcados.includes(id) ? marcados.filter((m) => m !== id) : [...marcados, id];
  }

  function criarPasta()
  {
    const nome = novaPasta.trim().toUpperCase();
    if (!nome) return;
    pastaAtual = nome;
    novaPasta = '';
  }

  function digitarTotal(chave: ChaveTotal, valor: string)
  {
    const numero = valor === '' ? undefined : Number(valor);
    const nova: Snapshot = { ...fotoNumeros, pasta: pastaAtual, totais: { ...fotoNumeros.totais, [chave]: numero } };
    if (numero === undefined) delete nova.totais[chave];
    dados.fotos = [...dados.fotos.filter((f) => !(f.data === dataNumeros && (f.pasta ?? dados.prefixo) === pastaAtual)), nova].sort((a, b) => a.data.localeCompare(b.data));
  }

  async function aoImportar(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    dados = await importarJson(arquivo);
    salvar($state.snapshot(dados));
    aviso = 'Dados importados.';
  }
</script>

<main>
  <span class="prompt">&gt; diário do painel · projeto {pastaAtual}</span>
  <header>
    <div>
      <h1>Diário do painel<span class="cursor">_</span></h1>
      <p class="dica sub">Guarde prints e comentários por projeto. As pessoas e tarefas são agrupadas automaticamente sem repetição.</p>
    </div>
    <div class="topo-controles">
      <label>Projeto
        <select bind:value={pastaAtual}>{#each pastas as p (p)}<option value={p}>{p}</option>{/each}</select>
      </label>
      <input class="curto" bind:value={novaPasta} placeholder="Novo projeto" onkeydown={(e) => e.key === 'Enter' && criarPasta()} />
      <button onclick={criarPasta} disabled={!novaPasta.trim()}>+ Projeto</button>
    </div>
  </header>

  <div class="barra-equipe-projeto">
    <span class="etiqueta">Equipe ({pastaAtual}):</span>
    {#each pessoasDaPasta as p (p.id)}
      <span class="pilula">{p.nome}</span>
    {/each}
    <div class="add-pessoa-inline">
      <input bind:value={novaPessoaNome} placeholder="Adicionar pessoa ao projeto" onkeydown={(e) => e.key === 'Enter' && adicionarPessoaNaPasta()} />
      <button onclick={adicionarPessoaNaPasta} disabled={!novaPessoaNome.trim()}>+ Pessoa</button>
    </div>
  </div>

  <div class="abas" role="tablist">
    <button role="tab" aria-selected={aba === 'novo'} class:ativa={aba === 'novo'} onclick={() => (aba = 'novo')}>Novo registro{capturas.length ? ` (${capturas.length} ${capturas.length === 1 ? 'print' : 'prints'})` : ''}</button>
    <button role="tab" aria-selected={aba === 'diario'} class:ativa={aba === 'diario'} onclick={() => (aba = 'diario')}>Diário do projeto {pastaAtual} ({registrosDaPasta.length})</button>
  </div>

  {#if aviso}<p class="aviso">{aviso}</p>{/if}

  {#if aba === 'novo'}
    {#if capturas.length === 0}
      <section class="cartao passo upload-reduzido">
        <div class="linha-entre topo-upload">
          <h2><span class="num">1</span> Envie os prints do painel</h2>
          <span class="dica-rapida">Cole prints (Ctrl+V), arraste imagens ou selecione arquivos:</span>
        </div>
        <textarea
          class="zona-compacta"
          rows="2"
          bind:value={caixa}
          onpaste={aoColar}
          ondrop={aoSoltar}
          ondragover={(e) => e.preventDefault()}
          placeholder="Clique aqui e cole com Ctrl+V (Win+Shift+S tira o print) ou solte as imagens aqui"
        ></textarea>
        <div class="linha botoes-upload">
          <label class="botao mini">Escolher imagens <input type="file" accept="image/*" multiple hidden onchange={(e) => lerImagens([...(e.currentTarget.files ?? [])])} /></label>
          <label class="botao mini">Escolher CSV <input type="file" accept=".csv,text/csv" hidden onchange={async (e) => { const f = e.currentTarget.files?.[0]; if (f) registrarCaptura(await f.text(), `CSV ${f.name}`); e.currentTarget.value = ''; }} /></label>
          <button class="mini" onclick={() => { registrarCaptura(caixa, `Texto ${capturas.length + 1}`); caixa = ''; }} disabled={!caixa.trim()}>Ler o texto digitado</button>
          {#if progresso !== null}<progress value={progresso}></progress>{/if}
        </div>
      </section>
    {:else}
      <!-- QUANDO JÁ TEM PRINTS ENVIADOS: BARRA ULTRA-COMPACTA PARA NÃO OCUPAR ESPAÇO -->
      <section class="cartao passo upload-barra-compacta feito">
        <div class="linha-entre barra-compacta-conteudo">
          <div class="status-upload-linha">
            <span class="num mini">✓</span>
            <span class="status-txt"><b>{capturas.length} {capturas.length === 1 ? 'print enviado' : 'prints enviados'}</b></span>
          </div>
          <div class="acoes-upload-rapido">
            <textarea
              class="zona-micro"
              rows="1"
              bind:value={caixa}
              onpaste={aoColar}
              ondrop={aoSoltar}
              ondragover={(e) => e.preventDefault()}
              placeholder="＋ Cole mais prints (Ctrl+V) ou solte aqui..."
            ></textarea>
            <div class="botoes-upload-feita">
              <label class="botao mini">＋ Imagens <input type="file" accept="image/*" multiple hidden onchange={(e) => lerImagens([...(e.currentTarget.files ?? [])])} /></label>
              <label class="botao mini">＋ CSV <input type="file" accept=".csv,text/csv" hidden onchange={async (e) => { const f = e.currentTarget.files?.[0]; if (f) registrarCaptura(await f.text(), `CSV ${f.name}`); e.currentTarget.value = ''; }} /></label>
              {#if caixa.trim()}
                <button class="mini" onclick={() => { registrarCaptura(caixa, `Texto ${capturas.length + 1}`); caixa = ''; }}>Ler texto</button>
              {/if}
              {#if progresso !== null}<progress value={progresso}></progress>{/if}
            </div>
          </div>
        </div>
      </section>
    {/if}

    {#if capturas.length}
      <section class="cartao passo" class:feito={comentados > 0}>
        <h2><span class="num">{comentados ? '✓' : '2'}</span> Árvore de correlação e conferência dos prints <small>({comentados}/{capturas.length} comentados)</small></h2>
        <p class="dica">O sistema correlaciona automaticamente a lista geral (Vetor A), os detalhes do pedido (Vetor B1) e as etapas (Vetor B2), sem repetir nomes.</p>

        {#if cardsLidos.length}
          <div class="grade-arvore-envio">
            <!-- RESUMO DAS TAREFAS (SEM REPETIÇÃO DE NOMES) -->
            <div class="caixa-arvore">
              <span class="etiqueta">Resumo das tarefas identificadas ({cardsLidos.length})</span>
              <div class="lista-tarefas-resumo">
                {#each cardsLidos as card (card.codigo)}
                  <div class="item-tarefa-resumo">
                    <div class="linha-entre">
                      <span>
                        <b class="maquina">{card.codigo}</b>
                        {#if card.prioridadeCard}
                          <span class="pilula prio-{card.prioridadeCard.toLowerCase()}">{card.prioridadeCard}</span>
                        {/if}
                        {#if card.statusCard}
                          <span class="badge-status-card">{card.statusCard}</span>
                        {/if}
                      </span>
                      <span class="fontes-vetor">
                        {#if card.fontesCorrelacionadas?.length}
                          [{card.fontesCorrelacionadas.join(' + ')}]
                        {/if}
                        {#if card.etapas?.length}
                          · {card.etapasConcluidas ?? 0}/{card.etapas.length} etapas
                        {/if}
                        · ~{card.horasEstimadas ?? 4}h
                      </span>
                    </div>
                    <div class="assunto-tarefa">{card.assunto || card.titulo || 'Demanda do painel'}</div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- PESSOAS IDENTIFICADAS (CLIQUE PARA EXPANDIR TAREFAS, PEDIDO, ETAPAS E PROBABILIDADE) -->
            <div class="caixa-arvore">
              <span class="etiqueta">Pessoas na semana (clique para ver as tarefas de cada pessoa)</span>
              <div class="lista-pessoas-arvore">
                {#each analiseEnvio.filter((p) => p.total > 0) as p (p.pessoa.id)}
                  {@const aberta = pessoaExpandidaEnvio === p.pessoa.id}
                  <div class="pessoa-no-arvore" class:aberta>
                    <button
                      type="button"
                      class="cabecalho-pessoa-arvore"
                      onclick={() => (pessoaExpandidaEnvio = aberta ? null : p.pessoa.id)}
                    >
                      <span>
                        <span class="seta-arvore">{aberta ? '▾' : '▸'}</span>
                        <b>{p.pessoa.nome}</b>
                        <small>({p.total} {p.total === 1 ? 'tarefa' : 'tarefas'})</small>
                      </span>
                      <span class="metricas-pessoa-arvore">
                        <span class="pilula">{p.horasEstipuladasSemana}h / {p.capacidadeHorasSemana}h</span>
                        <span class="pilula" class:no_ritmo={p.probabilidadeMaisServicosPct >= 60} class:em_risco={p.probabilidadeMaisServicosPct >= 35 && p.probabilidadeMaisServicosPct < 60} class:atrasado={p.probabilidadeMaisServicosPct < 35}>
                          {p.probabilidadeMaisServicosPct}% prob. +serviços
                        </span>
                      </span>
                    </button>

                    {#if aberta}
                      <div class="corpo-pessoa-arvore">
                        <div class="resumo-probabilistico">
                          <span>Entrega: <b>{p.nivelEntregaPct}%</b></span>
                          <span>Demora: <b>{p.nivelDemora}</b> ({p.motivoDemora})</span>
                          <span>Capacidade extra: <b>+{p.servicosExtrasSugeridos} {p.servicosExtrasSugeridos === 1 ? 'serviço' : 'serviços'} (~{p.horasLivresEstimadas}h livres)</b></span>
                        </div>

                        {#each p.tarefas as tar (tar.codigo)}
                          <div class="card-filho-arvore">
                            <div class="linha-entre">
                              <span>
                                <b class="maquina">{tar.codigo}</b> {tar.assunto}
                                {#if tar.prioridadeCard}<span class="badge-status-card">{tar.prioridadeCard}</span>{/if}
                              </span>
                              <label class="mini">Tempo estipulado (h)
                                <input
                                  type="number"
                                  step="0.5"
                                  class="input-horas-curto"
                                  value={tar.horasEstimadas}
                                  onchange={(e) => atualizarHorasCard(tar.codigo, e.currentTarget.value)}
                                />
                              </label>
                            </div>
                            {#if tar.descricaoCompleta}
                              <p class="pedido-completo"><b>O que foi pedido:</b> {tar.descricaoCompleta}</p>
                            {/if}
                            {#if tar.etapas?.length}
                              <ul class="etapas-filhas">
                                {#each tar.etapas as et (et.ordem)}
                                  <li>
                                    <b>{et.ordem}. {et.nome}</b>
                                    <span class="dica">
                                      ({et.situacao.replace('_', ' ')}{et.tempoRodandoHoras !== undefined ? ` · rodando há ${et.tempoRodandoHoras}h` : ''}{et.desde ? ` desde ${et.desde.slice(0, 10).split('-').reverse().join('/')}` : ''})
                                    </span>
                                  </li>
                                {/each}
                              </ul>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        {#each capturas as cap, idx (cap.id)}
          <article class="captura">
            <div class="img">
              {#if cap.imagemDataUrl}<img src={cap.imagemDataUrl} alt={cap.nome} />{:else}<div class="sem-img">texto / CSV</div>{/if}
            </div>
            <div class="conteudo">
              <div class="linha-entre">
                <b>#{idx + 1} {cap.nome.split(' · ')[0]}</b>
                <span class="linha linha-acoes-captura">
                  {#if criandoOpcaoPara === cap.id}
                    <div class="linha-nova-opcao">
                      <input
                        class="input-nova-opcao"
                        bind:value={textoNovaOpcao}
                        placeholder="Nome da opção (ex.: Homologação...)"
                        onkeydown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); adicionarNovaOpcao(cap.id); }
                          else if (e.key === 'Escape') { criandoOpcaoPara = null; }
                        }}
                      />
                      <button class="btn-salvar-opcao" onclick={() => adicionarNovaOpcao(cap.id)}>Salvar</button>
                      <button class="link" onclick={() => { criandoOpcaoPara = null; textoNovaOpcao = ''; }}>cancelar</button>
                    </div>
                  {:else}
                    <label class="mini">Entendi como
                      <select
                        value={cap.origem}
                        onchange={(e) => {
                          const val = e.currentTarget.value;
                          if (val === '__nova__') {
                            criandoOpcaoPara = cap.id;
                            textoNovaOpcao = '';
                          } else {
                            cap.origem = val;
                            cap.nome = `${cap.nome.split(' · ')[0]} · ${obterNomeOrigem(val)}`;
                            recalcular();
                          }
                        }}
                      >
                        <optgroup label="Padrões">
                          {#each Object.entries(nomesOrigemPadrao) as [v, n] (v)}
                            <option value={v}>{n}</option>
                          {/each}
                        </optgroup>
                        {#if dados.origensPersonalizadas && dados.origensPersonalizadas.length > 0}
                          <optgroup label="Personalizados">
                            {#each dados.origensPersonalizadas as custom (custom)}
                              <option value={custom}>{custom}</option>
                            {/each}
                          </optgroup>
                        {/if}
                        <option value="__nova__">+ Criar nova opção...</option>
                      </select>
                    </label>
                    <button
                      class="btn-adicionar-opcao"
                      onclick={() => { criandoOpcaoPara = cap.id; textoNovaOpcao = ''; }}
                      title="Criar nova opção personalizada de classificação"
                    >
                      +
                    </button>
                    <button class="link perigo" onclick={() => removerCaptura(cap.id)}>remover</button>
                  {/if}
                </span>
              </div>
              <div class="chips">
                <span class="pilula">{cap.cards.length} cards{cap.cards.length ? `: ${cap.cards.slice(0, 6).join(', ')}${cap.cards.length > 6 ? '...' : ''}` : ''}</span>
                <span class="pilula">{cap.totais.length} indicadores</span>
                {#if cap.ondas}<span class="pilula">{cap.ondas} ondas</span>{/if}
                {#if cap.novos?.length}<span class="pilula novo">{cap.novos.length} novos</span>{/if}
                {#if cap.repetidos?.length}<span class="pilula repetido">{cap.repetidos.length} já vistos</span>{/if}
              </div>
              {#if cap.cardPaiVinculado || cap.origem === 'card'}
                <div class="vinculo-arvore-barra">
                  <span class="etiqueta">Vetor Filho &rarr; Pai:</span>
                  <select
                    value={cap.cardPaiVinculado ?? cap.cards[0] ?? ''}
                    onchange={(e) => { cap.cardPaiVinculado = e.currentTarget.value || undefined; recalcular(); }}
                  >
                    <option value="">Detectar automaticamente</option>
                    {#each cardsLidos as c (c.codigo)}
                      <option value={c.codigo}>{c.codigo} ({c.assunto || c.titulo || 'Demanda'})</option>
                    {/each}
                  </select>
                  {#if cap.confiancaVinculoPct !== undefined}
                    <span class="pilula novo">{cap.confiancaVinculoPct}% confiança</span>
                  {/if}
                  {#if cap.motivoVinculo}
                    <small class="dica">{cap.motivoVinculo}</small>
                  {/if}
                </div>
              {/if}
              {#if cap.porPessoa?.length}
                <div class="por-pessoa-print">
                  {#each cap.porPessoa as gp (gp.pessoa)}
                    <span class="item-pessoa-print"><b>{gp.pessoa}</b> &rarr; {gp.tarefas.join(', ')}</span>
                  {/each}
                </div>
              {/if}
              {#if cap.avisos.length}<p class="alerta">[Atenção] {cap.avisos.join(' ')}</p>{/if}
              {#if cap.repetidos?.some((r) => r.mudou.length)}
                <p class="mudou"><b>Mudou desde antes:</b> {cap.repetidos.filter((r) => r.mudou.length).slice(0, 5).map((r) => `${r.codigo} (${r.mudou.join('; ')})`).join(' | ')}</p>
              {/if}
              <label class="comentario">Seu comentário sobre este print
                <textarea rows="2" bind:value={cap.comentario} placeholder="O que você acha desta etapa? O que está acontecendo, o que vai fazer, o que preocupa..."></textarea>
              </label>
              {#if cap.sugestoes.length}
                <p class="dica"><b>Sugestões:</b> {cap.sugestoes.join(' ')}
                  <button class="link" onclick={() => (cap.comentario = [cap.comentario, ...cap.sugestoes].filter(Boolean).join(' '))}>usar no comentário</button></p>
              {/if}
              <details>
                <summary>Texto lido e complemento {cap.naoReconhecido?.length ? `(${cap.naoReconhecido.length} linhas sem card)` : ''}</summary>
                {#if cap.naoReconhecido?.length}
                  <p class="dica">Trechos do print que não viraram card nem número. Podem ser o complemento de algo já visto:</p>
                  <ul class="complemento">{#each cap.naoReconhecido as l, i (i)}<li>{l}</li>{/each}</ul>
                {/if}
                <textarea rows="5" bind:value={cap.texto}></textarea>
                <button onclick={recalcular}>Reprocessar com o texto corrigido</button>
              </details>
            </div>
          </article>
        {/each}
        <details class="conferir">
          <summary>Conferir cards e números lidos ({cardsLidos.length} cards, {chavesLidas.length} números{avisosCards ? `, ${avisosCards} para revisar` : ''})</summary>
          {#if chavesLidas.length}
            <table><tbody>
              {#each chavesLidas as chave (chave)}
                <tr><td>{nomesTotais[chave]}</td><td><input type="number" class="curto" bind:value={totaisLidos[chave]} /></td><td><button onclick={() => delete totaisLidos[chave]}>remover</button></td></tr>
              {/each}
            </tbody></table>
          {/if}
          {#if cardsLidos.length}<TabelaCards bind:cards={cardsLidos} pessoas={pessoasDaPasta} />{/if}
        </details>
      </section>
    {/if}

    <section class="cartao passo" class:feito={!!motivo.trim()}>
      <h2><span class="num">{motivo.trim() ? '✓' : capturas.length ? '3' : '2'}</span> Motivo e resumo do registro</h2>
      <div class="duas">
        <label>Motivo ou título deste registro <input bind:value={motivo} placeholder="Ex.: Fechamento da Onda 1, fila travada em homologação" /></label>
        <label>Dia do registro <input type="date" bind:value={dataRegistro} /></label>
      </div>
      <label class="bloco">
        <span class="linha-entre">Texto do registro (prints e comentários unidos){#if editouTexto}<button class="link" onclick={() => (editouTexto = false)}>refazer a partir dos comentários</button>{/if}</span>
        <textarea rows="5" value={textoFinal} oninput={(e) => { textoFinal = e.currentTarget.value; editouTexto = true; }} placeholder="Montado automaticamente conforme você comenta os prints, ou digite livremente aqui."></textarea>
      </label>
    </section>

    <section class="cartao passo">
      <h2><span class="num">{capturas.length ? '4' : '3'}</span> Guardar no diário</h2>
      <div class="linha acoes-guardar">
        <button class="principal" onclick={() => salvarRegistro(false)} disabled={!podeSalvar}>Guardar no projeto {pastaAtual}</button>
        <button class="botao-pdf-destaque" onclick={() => salvarRegistro(true)} disabled={!podeSalvar}>Guardar e emitir PDF deste registro</button>
        {#if podeSalvar}<button class="link perigo" onclick={limpar}>descartar</button>{/if}
      </div>
    </section>
  {:else}
    <section class="cartao">
      <div class="linha-entre">
        <h2>Diário da pasta {pastaAtual}</h2>
        <input class="busca" bind:value={busca} placeholder="Buscar por data, motivo, card ou texto" />
      </div>
      {#if marcados.length}
        <div class="barra-marcados">
          <b>{marcados.length} {marcados.length === 1 ? 'registro marcado' : 'registros marcados'}</b>
          <button class="principal" onclick={() => emitirRelatorio(marcados)}>Gerar relatório com os marcados</button>
          <button class="link" onclick={() => (marcados = [])}>limpar marcação</button>
        </div>
      {/if}
      {#each registrosFiltrados as r (r.id)}
        <article class="registro">
          <div class="linha-entre">
            <label class="marcar"><input type="checkbox" checked={marcados.includes(r.id)} onchange={() => alternarMarca(r.id)} /> <b>{dataCurta(r.data)}</b> {r.motivo || r.resumo || 'Sem motivo'}</label>
            <span class="linha">
              <span class="dica">{r.capturas.length} prints · {r.cards.length} cards</span>
              <button class="link" onclick={() => emitirRelatorio([r.id])}>PDF deste registro</button>
              <button class="link perigo" onclick={() => apagarRegistro(r.id)}>apagar</button>
            </span>
          </div>
          {#if r.capturas.some((c) => c.imagemDataUrl)}
            <div class="miniaturas">{#each r.capturas.filter((c) => c.imagemDataUrl) as c (c.id)}<img src={c.imagemDataUrl} alt={c.nome} />{/each}</div>
          {/if}
          <details>
            <summary>Ver e editar o texto</summary>
            <label class="bloco">Motivo <input bind:value={r.motivo} /></label>
            <textarea rows="6" bind:value={r.texto}></textarea>
          </details>
        </article>
      {:else}
        <p class="dica">{busca ? 'Nada encontrado para essa busca.' : `Nenhum registro na pasta ${pastaAtual} ainda. Use "Novo registro" para guardar o primeiro.`}</p>
      {/each}
    </section>

    <details class="cartao avancado">
      <summary>Números e cards da pasta (avançado)</summary>
      <p class="dica">O que foi lido dos prints fica aqui, por dia. Corrija ou digite o que faltar.</p>
      <label>Dia <select bind:value={dataNumeros}>
        {#each [...new Set([dataNumeros, ...fotosDaPasta.map((f) => f.data)])].sort().reverse() as d (d)}<option value={d}>{dataMedia(d)}</option>{/each}
      </select></label>
      {#each gruposTotais as g (g.titulo)}
        <fieldset class:secundario={g.secundario}>
          <legend>{g.titulo}</legend>
          <div class="grade">
            {#each g.chaves as chave (chave)}
              <label>{nomesTotais[chave]} <input type="number" class="curto" value={fotoNumeros.totais[chave] ?? ''} onchange={(e) => digitarTotal(chave, e.currentTarget.value)} /></label>
            {/each}
          </div>
        </fieldset>
      {/each}
      {#if indiceFotoNumeros >= 0 && fotoNumeros.cards.length}
        <h3>Cards deste dia ({fotoNumeros.cards.length})</h3>
        <TabelaCards bind:cards={dados.fotos[indiceFotoNumeros]!.cards} pessoas={dados.pessoas} />
      {/if}
      <div class="linha">
        <label>Prefixo dos cards <input class="curto" bind:value={dados.prefixo} /></label>
        <button onclick={() => exportarJson($state.snapshot(dados))}>Exportar JSON</button>
        <label class="botao">Importar JSON <input type="file" accept="application/json" onchange={aoImportar} hidden /></label>
      </div>
    </details>
  {/if}
</main>

<style>
  header, .linha, .topo-controles, .chips { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  header { justify-content: space-between; margin-bottom: 12px; }
  h1 { margin: 0; }
  .sub { margin: 2px 0 0; max-width: 60ch; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .abas { display: flex; gap: 6px; border-bottom: 1px solid var(--borda); margin-bottom: 12px; }
  .abas button { border: none; border-bottom: 3px solid transparent; border-radius: 0; background: none; padding: 10px 16px; font-weight: 600; color: var(--suave); }
  .abas button.ativa { color: var(--marca); border-bottom-color: var(--marca); }
  .passo h2 { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .passo h2 small { font-weight: 400; color: var(--suave); font-size: 0.8rem; }
  .num { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--superficie-2); color: var(--marca); font-family: var(--fonte-maquina); font-size: 0.95rem; }
  .passo.feito .num { background: var(--marca); color: var(--sobre-marca); }
  .num.mini { width: 22px; height: 22px; font-size: 0.8rem; }
  textarea { width: 100%; background: var(--superficie-2); font-size: 0.9rem; margin: 6px 0; }

  /* UPLOAD COMPACTO E REDUZIDO */
  .upload-reduzido { padding: 12px 16px; }
  .topo-upload h2 { margin: 0; font-size: 1.05rem; }
  .dica-rapida { font-size: 0.8rem; color: var(--suave); }
  .zona-compacta { border: 1.5px dashed var(--borda-forte); text-align: center; padding: 10px 14px; min-height: 48px; margin: 6px 0; border-radius: var(--raio-pequeno); resize: none; font-size: 0.84rem; }
  .botoes-upload { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }

  .upload-barra-compacta { padding: 8px 14px; margin-bottom: 12px; background: var(--superficie); border-left: 3px solid var(--marca); }
  .barra-compacta-conteudo { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
  .status-upload-linha { display: flex; align-items: center; gap: 8px; flex: none; }
  .status-txt { font-size: 0.86rem; color: var(--texto); }
  .acoes-upload-rapido { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
  .zona-micro { width: 260px; min-width: 180px; height: 32px; padding: 5px 8px; font-size: 0.78rem; border: 1.5px dashed var(--borda-forte); border-radius: 4px; resize: none; margin: 0; }
  .botoes-upload-feita { display: flex; align-items: center; gap: 6px; }

  /* OPÇÃO PERSONALIZADA EM 'ENTENDI COMO' */
  .linha-acoes-captura { display: flex; align-items: center; gap: 6px; }
  .btn-adicionar-opcao { padding: 1px 7px; font-size: 0.85rem; font-weight: 700; background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: 4px; color: var(--marca); cursor: pointer; line-height: 1.3; }
  .btn-adicionar-opcao:hover { border-color: var(--marca); background: var(--marca-clara); }
  .linha-nova-opcao { display: flex; align-items: center; gap: 6px; background: var(--superficie); padding: 3px 6px; border: 1px solid var(--marca); border-radius: 4px; }
  .input-nova-opcao { font-size: 0.78rem; padding: 3px 6px; border: 1px solid var(--borda); border-radius: 3px; min-width: 150px; background: var(--fundo); color: var(--texto); }
  .btn-salvar-opcao { font-size: 0.74rem; padding: 3px 8px; background: var(--marca); color: var(--sobre-marca); border: none; border-radius: 3px; cursor: pointer; font-weight: 600; }

  /* EQUIPE DO PROJETO E ÁRVORE DE CORRELAÇÃO */
  .barra-equipe-projeto { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 12px; background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); }
  .barra-equipe-projeto .pilula { background: var(--superficie-2); border: 1px solid var(--borda); color: var(--texto); }
  .add-pessoa-inline { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .add-pessoa-inline input { font-size: 0.8rem; padding: 3px 8px; width: 190px; }
  .add-pessoa-inline button { font-size: 0.78rem; padding: 3px 8px; }

  .grade-arvore-envio { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; margin: 12px 0; }
  .caixa-arvore { background: var(--superficie-2); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .lista-tarefas-resumo, .lista-pessoas-arvore { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
  .item-tarefa-resumo { background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--cor-barra); border-radius: 4px; padding: 7px 10px; font-size: 0.82rem; display: flex; flex-direction: column; gap: 3px; }
  .assunto-tarefa { color: var(--texto); line-height: 1.3; }
  .fontes-vetor { font-family: var(--fonte-maquina); font-size: 0.72rem; color: var(--suave); }
  .badge-status-card { font-family: var(--fonte-maquina); font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--suave); margin-left: 4px; }
  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }

  .pessoa-no-arvore { background: var(--superficie); border: 1px solid var(--borda); border-radius: 6px; overflow: hidden; }
  .pessoa-no-arvore.aberta { border-color: var(--marca); }
  .cabecalho-pessoa-arvore { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; background: none; border: none; text-align: left; color: var(--texto); font-family: inherit; }
  .seta-arvore { color: var(--marca); margin-right: 4px; font-family: var(--fonte-maquina); }
  .metricas-pessoa-arvore { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .corpo-pessoa-arvore { border-top: 1px solid var(--borda); padding: 10px; background: var(--superficie-2); display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; }
  .resumo-probabilistico { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 6px 8px; background: var(--superficie); border-radius: 4px; border: 1px solid var(--borda); font-size: 0.76rem; color: var(--suave); }
  .resumo-probabilistico b { color: var(--texto); }
  .card-filho-arvore { background: var(--superficie); border: 1px solid var(--borda); border-radius: 4px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .input-horas-curto { width: 64px; font-size: 0.78rem; padding: 2px 5px; }
  .pedido-completo { margin: 4px 0 0; font-size: 0.78rem; line-height: 1.35; color: var(--suave); white-space: pre-line; background: var(--superficie-2); padding: 6px 8px; border-radius: 4px; }
  .etapas-filhas { margin: 4px 0 0; padding-left: 18px; font-size: 0.78rem; display: flex; flex-direction: column; gap: 2px; }

  .vinculo-arvore-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; padding: 6px 10px; background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--marca); border-radius: 4px; }
  .vinculo-arvore-barra select { font-size: 0.78rem; padding: 2px 6px; max-width: 280px; }
  .por-pessoa-print { display: flex; flex-direction: column; gap: 3px; margin: 6px 0; padding: 6px 10px; background: var(--superficie); border-radius: 4px; border: 1px solid var(--borda); font-size: 0.82rem; }
  .item-pessoa-print { color: var(--texto); }

  /* BOTÃO DE GUARDAR E EMITIR PDF NÍTIDO E EM DESTAQUE */
  .acoes-guardar { gap: 12px; }
  .botao-pdf-destaque { background: var(--marca-clara); border: 1.5px solid var(--marca); color: var(--marca); font-weight: 700; padding: var(--size-2) var(--size-4); cursor: pointer; }
  .botao-pdf-destaque:hover:not(:disabled) { background: var(--marca); color: var(--sobre-marca); }
  .captura { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; gap: 14px; padding: 12px; margin: 10px 0; border: 1px solid var(--borda); border-radius: var(--raio); background: var(--superficie-2); }
  .img img { width: 100%; max-height: 240px; object-fit: contain; border-radius: 6px; border: 1px solid var(--borda); background: var(--fundo); }
  .sem-img { height: 100px; display: grid; place-items: center; border: 1px dashed var(--borda); border-radius: 6px; color: var(--suave); }
  .mini { font-size: 0.78rem; display: flex; gap: 6px; align-items: center; }
  .chips { margin: 8px 0; }
  .pilula.novo { background: var(--verde-fundo); color: var(--verde); }
  .pilula.repetido { background: var(--amarelo-fundo); color: var(--amarelo); }
  .alerta { color: var(--vermelho); font-size: 0.86rem; margin: 4px 0; }
  .mudou { font-size: 0.84rem; margin: 4px 0; }
  .comentario { display: block; font-weight: 600; font-size: 0.86rem; }
  .complemento { margin: 4px 0 8px 18px; padding: 0; font-size: 0.82rem; color: var(--suave); }
  .duas { display: grid; grid-template-columns: 1fr 200px; gap: 12px; margin: 8px 0; }
  .duas label, .bloco { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 0.86rem; }
  .bloco { margin-top: 8px; }
  .conferir, .avancado { margin-top: 10px; }
  .avancado { padding: 12px 16px; }
  summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; margin: 6px 0; }
  .busca { min-width: 280px; }
  .barra-marcados { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 10px 14px; margin: 10px 0; border-radius: var(--raio); background: var(--marca-clara); }
  .registro { padding: 12px 14px; margin: 10px 0; border: 1px solid var(--borda); border-radius: var(--raio); background: var(--superficie-2); }
  .marcar { display: flex; gap: 8px; align-items: center; font-weight: 400; }
  .miniaturas { display: flex; gap: 8px; margin: 8px 0; overflow-x: auto; }
  .miniaturas img { height: 70px; border-radius: 4px; border: 1px solid var(--borda); }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px 20px; margin: 10px 0; }
  .grade label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  fieldset { border: 1px solid var(--borda); border-radius: 10px; margin: 10px 0; padding: 4px 14px 8px; }
  legend { font-family: var(--fonte-maquina); font-weight: 700; padding: 0 6px; }
  .secundario { background: var(--superficie-2); }
  .curto { width: 100px; }
  .link { border: none; background: none; padding: 0; margin-left: 6px; text-decoration: underline; font-size: 0.84rem; }
  .perigo { color: var(--vermelho); }
  .aviso { margin: 10px 0; }
  @media (max-width: 800px) { .captura, .duas { grid-template-columns: 1fr; } }
</style>
