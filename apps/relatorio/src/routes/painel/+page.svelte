<script lang="ts">
  import
  {
    agoraLocal, descreverEtapa, detectarOrigem, ehCsvDeDemandas, fotoVazia, gerarPalavrasDaAutora, idCurto, interpretarAnotacao,
    lerCards, lerCsvDemandas, lerOndas, lerTotais, mesclarNaFoto, nomesTotais, sugerirDaCaptura,
    type Anotacao, type CapturaLida, type CardSnapshot, type EtapaAnotada, type Onda, type OrigemLeitura, type Ritmo, type Snapshot, type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerColagem } from '#lib/colagem.ts';
  import { lerImagem, miniaturaDataUrl } from '#lib/ocr.ts';
  import TabelaCards from '#lib/TabelaCards.svelte';
  import { dataMedia } from '#lib/semana.ts';

  type ChaveTotal = keyof TotaisPainel;
  type Aba = 'colar' | 'conferir' | 'pasta';

  const gruposTotais: { titulo: string; chaves: ChaveTotal[]; dica?: string; secundario?: boolean }[] = [
    { titulo: 'Cronograma', chaves: ['itensCronograma', 'concluidos', 'concluidosPct', 'vencem15Dias', 'atrasadosVencimento'] },
    { titulo: 'Em andamento e ritmo', chaves: ['demandasEmAndamento', 'etapaRodando', 'ritmoNoRitmo', 'ritmoEmRisco', 'ritmoAtrasadas'] },
    { titulo: 'Prazo e eficiência', chaves: ['dentroDoPrazoPct', 'metaPct', 'concluidasNoPeriodo', 'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade'] },
    { titulo: 'Etapas e tempo', chaves: ['etapasConcluidas', 'etapasConcluidasVariacao', 'tempoMedianoEtapaMin', 'ociosoPct', 'ociosoHoras', 'tempoLimpoMedianaH', 'tempoLimpoVariacaoH', 'tempoLimpoMediaDias'] },
    {
      titulo: 'Outros números (opcional)',
      secundario: true,
      dica: '"Parada há" mostra há quantos dias as demandas abertas estão sem andar, separadas em faixas. Só preencha se quiser guardar.',
      chaves: ['aindaPlanejado', 'emExecucao', 'datasFixadas', 'paradasEntreEtapas', 'emAbertoAgora', 'foraDoPrazo', 'previsoesSemana', 'previsaoVencida', 'qualidadePct', 'idadeAte1Dia', 'idade1a3Dias', 'idade3a7Dias', 'idade7a15Dias', 'idadeMais15Dias'],
    },
  ];

  let dados = $state<Dados>(carregar());
  let dataFoto = $state(agoraLocal().slice(0, 10));
  let pastaAtual = $state(dados.prefixo || 'DEV');
  let novaPasta = $state('');
  let buscaPasta = $state('');
  let aba = $state<Aba>('colar');

  let texto = $state('');
  let origemEscolhida = $state<'auto' | OrigemLeitura>('auto');
  let aviso = $state('');
  let progresso = $state<number | null>(null);
  let totaisLidos = $state<TotaisPainel>({});
  let cardsLidos = $state<CardSnapshot[]>([]);
  let ondasLidas = $state<Onda[]>([]);
  let capturasLidas = $state<CapturaLida[]>([]);
  let capturaAtiva = $state<string | null>(null);
  let leu = $state(false);

  let textoAnotacao = $state('');
  let anotacaoLida = $state<Anotacao | null>(null);
  let novaEtapa = $state('');
  let novaEtapaDesc = $state('');

  // correções feitas na foto salva gravam na hora
  $effect(() => salvar($state.snapshot(dados)));

  const pastasDisponiveis = $derived([...new Set([dados.prefixo || 'DEV', ...dados.fotos.map((f) => f.pasta).filter((p): p is string => !!p), pastaAtual.trim()].filter(Boolean))]);
  const fotosDaPasta = $derived(
    dados.fotos
      .filter((f) => (f.pasta ?? dados.prefixo) === pastaAtual)
      .sort((a, b) => b.data.localeCompare(a.data)),
  );
  const fotosFiltradas = $derived.by(() =>
  {
    const q = buscaPasta.trim().toLowerCase();
    if (!q) return fotosDaPasta;
    return fotosDaPasta.filter((f) =>
      f.data.includes(q) ||
      (f.pasta ?? '').toLowerCase().includes(q) ||
      (f.anotacao?.resumo ?? '').toLowerCase().includes(q) ||
      (f.anotacao?.palavrasDaAutora ?? '').toLowerCase().includes(q) ||
      (f.anotacao?.etapas ?? []).some((e) => e.texto.toLowerCase().includes(q) || (e.descricao ?? '').toLowerCase().includes(q)) ||
      f.cards.some((c) => c.codigo.toLowerCase().includes(q) || (c.titulo ?? '').toLowerCase().includes(q)),
    );
  });

  const indiceFoto = $derived(dados.fotos.findIndex((f) => f.data === dataFoto && (f.pasta ?? dados.prefixo) === pastaAtual));
  const foto = $derived<Snapshot>(dados.fotos[indiceFoto] ?? { ...fotoVazia(dataFoto), pasta: pastaAtual });
  const origemDetectada = $derived(texto ? detectarOrigem(texto) : null);
  const chavesLidas = $derived(Object.keys(totaisLidos) as ChaveTotal[]);
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '';

  const nomesOrigem: Record<OrigemLeitura, string> = {
    em_execucao: 'Quem está cuidando de quê',
    fila: 'Fila - demandas a iniciar',
    cronograma: 'Lista do cronograma',
    demandas: 'Lista de demandas',
    card: 'Card aberto (etapas)',
  };
  const ritmos: Ritmo[] = ['no_ritmo', 'em_risco', 'atrasado'];

  const ctxExplicacao = () => ({
    prefixo: dados.prefixo,
    cards: cardsLidos.length ? cardsLidos : foto.cards,
    totais: Object.keys(totaisLidos).length ? totaisLidos : foto.totais,
    ondas: ondasLidas.length ? ondasLidas : foto.ondas,
    pessoas: dados.pessoas,
  });

  function interpretar()
  {
    if (!textoAnotacao.trim() && !cardsLidos.length && !chavesLidas.length) return;
    const base = textoAnotacao.trim()
      ? interpretarAnotacao(textoAnotacao, ctxExplicacao())
      : {
          texto: '',
          resumo: `Leitura de ${capturasLidas.length || 1} ${capturasLidas.length === 1 ? 'captura' : 'capturas'} na pasta ${pastaAtual} (${cardsLidos.length} cards e ${chavesLidas.length} indicadores).`,
          etapas: sugerirEtapasAutomaticas(),
        };
    if (!base.palavrasDaAutora) base.palavrasDaAutora = gerarPalavrasDaAutora(base.resumo, base.etapas, ctxExplicacao());
    anotacaoLida = base;
  }

  function sugerirEtapasAutomaticas(): EtapaAnotada[]
  {
    const sugs = capturasLidas.flatMap((c) => c.sugestoes);
    const unicas = [...new Set(sugs)].slice(0, 4);
    return unicas.map((s) => ({
      texto: s.replace(/\.$/, ''),
      descricao: descreverEtapa(s, [], ctxExplicacao()),
      feito: false,
    }));
  }

  function regerarExplicacoes(a: Anotacao)
  {
    const ctx = ctxExplicacao();
    for (const e of a.etapas)
    {
      e.descricao = descreverEtapa(e.texto, e.cards ?? [], ctx);
    }
    a.palavrasDaAutora = gerarPalavrasDaAutora(a.resumo, a.etapas, ctx);
  }

  function moverEtapa(lista: EtapaAnotada[], i: number, d: number)
  {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
  }

  function criarPasta()
  {
    const nome = novaPasta.trim().toUpperCase();
    if (!nome) return;
    pastaAtual = nome;
    dados.prefixo = nome;
    novaPasta = '';
  }

  function apagarFoto(alvoData = dataFoto, alvoPasta = pastaAtual)
  {
    const f = dados.fotos.find((x) => x.data === alvoData && (x.pasta ?? dados.prefixo) === alvoPasta);
    if (!f) return;
    if (!confirm(`Apagar o registro de ${alvoData} na pasta ${alvoPasta} (${Object.keys(f.totais).length} totais e ${f.cards.length} cards)?`)) return;
    dados.fotos = dados.fotos.filter((x) => !(x.data === alvoData && (x.pasta ?? dados.prefixo) === alvoPasta));
    aviso = `Registro de ${alvoData} (${alvoPasta}) apagado.`;
  }

  async function aoColar(e: ClipboardEvent)
  {
    const colado = lerColagem(e);
    if (!colado) return;
    e.preventDefault();
    if (colado.tipo === 'texto')
    {
      texto = colado.texto;
      registrarCapturaTexto(colado.texto, 'Texto colado');
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

  async function lerImagens(imagens: Blob[])
  {
    try
    {
      for (const [i, imagem] of imagens.entries())
      {
        const nomeImg = imagem instanceof File && imagem.name ? imagem.name : `Print ${capturasLidas.length + 1}`;
        aviso = `Lendo a imagem ${i + 1} de ${imagens.length} (${nomeImg})...`;
        progresso = 0;
        const [transcrito, dataUrl] = await Promise.all([
          lerImagem(imagem, (p) => (progresso = p)),
          miniaturaDataUrl(imagem).catch(() => undefined),
        ]);
        texto = transcrito;
        registrarCaptura(transcrito, nomeImg, dataUrl);
      }
      aviso = `${imagens.length === 1 ? 'Imagem lida' : `${imagens.length} imagens lidas`}! Veja abaixo o que saiu de cada print e as sugestões, ou avance para a Etapa 2.`;
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

  function registrarCapturaTexto(conteudo: string, rotulo = 'Trecho de texto')
  {
    registrarCaptura(conteudo, `${rotulo} ${capturasLidas.length + 1}`, undefined);
  }

  function registrarCaptura(conteudo: string, nome: string, imagemDataUrl?: string)
  {
    const origem = origemEscolhida === 'auto' ? detectarOrigem(conteudo) : origemEscolhida;
    const csv = ehCsvDeDemandas(conteudo) ? lerCsvDemandas(conteudo, { prefixo: dados.prefixo, pessoas: dados.pessoas }) : undefined;
    if (csv) aviso = `CSV lido: ${csv.cards.length} demandas.${csv.repetidos.length ? ` IDs repetidos: ${csv.repetidos.join(', ')}.` : ''}`;
    const totais = csv ? {} : lerTotais(conteudo);
    const cards = csv ? csv.cards : lerCards(conteudo, { prefixo: dados.prefixo, pessoas: dados.pessoas, origem, hoje: dataFoto });
    const ondas = lerOndas(conteudo);
    if (ondas.length) ondasLidas = ondas;

    const { avisos, sugestoes } = sugerirDaCaptura({ origem, totais, cards, ondas });
    const cap: CapturaLida = {
      id: idCurto(),
      nome: `${nome} · ${nomesOrigem[origem]}`,
      origem,
      texto: conteudo,
      ...(imagemDataUrl ? { imagemDataUrl } : {}),
      totais: Object.keys(totais) as ChaveTotal[],
      cards: cards.map((c) => c.codigo),
      ondas: ondas.length,
      avisos,
      sugestoes,
    };
    capturasLidas = [...capturasLidas, cap];
    capturaAtiva = cap.id;

    const acumulado = mesclarNaFoto({ data: dataFoto, totais: $state.snapshot(totaisLidos), cards: $state.snapshot(cardsLidos) }, totais, cards);
    totaisLidos = acumulado.totais;
    cardsLidos = acumulado.cards;
    leu = true;

    if (textoAnotacao.trim() || !anotacaoLida) interpretar();
  }

  function reprocessarCaptura(cap: CapturaLida)
  {
    const origem = cap.origem;
    const totais = lerTotais(cap.texto);
    const cards = lerCards(cap.texto, { prefixo: dados.prefixo, pessoas: dados.pessoas, origem, hoje: dataFoto });
    const ondas = lerOndas(cap.texto);
    const { avisos, sugestoes } = sugerirDaCaptura({ origem, totais, cards, ondas });
    cap.totais = Object.keys(totais) as ChaveTotal[];
    cap.cards = cards.map((c) => c.codigo);
    cap.ondas = ondas.length;
    cap.avisos = avisos;
    cap.sugestoes = sugestoes;
    recalcularTudoDasCapturas();
  }

  function removerCaptura(id: string)
  {
    capturasLidas = capturasLidas.filter((c) => c.id !== id);
    if (capturaAtiva === id) capturaAtiva = capturasLidas[0]?.id ?? null;
    recalcularTudoDasCapturas();
  }

  function recalcularTudoDasCapturas()
  {
    let acumTotais: TotaisPainel = {};
    let acumCards: CardSnapshot[] = [];
    let acumOndas: Onda[] = [];
    for (const c of capturasLidas)
    {
      const csv = ehCsvDeDemandas(c.texto) ? lerCsvDemandas(c.texto, { prefixo: dados.prefixo, pessoas: dados.pessoas }) : undefined;
      const t = csv ? {} : lerTotais(c.texto);
      const cds = csv ? csv.cards : lerCards(c.texto, { prefixo: dados.prefixo, pessoas: dados.pessoas, origem: c.origem, hoje: dataFoto });
      const ods = lerOndas(c.texto);
      if (ods.length) acumOndas = ods;
      const m = mesclarNaFoto({ data: dataFoto, totais: acumTotais, cards: acumCards }, t, cds);
      acumTotais = m.totais;
      acumCards = m.cards;
    }
    totaisLidos = acumTotais;
    cardsLidos = acumCards;
    ondasLidas = acumOndas;
    leu = capturasLidas.length > 0;
  }

  function limparLeitura()
  {
    texto = '';
    totaisLidos = {};
    cardsLidos = [];
    ondasLidas = [];
    capturasLidas = [];
    capturaAtiva = null;
    textoAnotacao = '';
    anotacaoLida = null;
    leu = false;
  }

  function salvarNaFoto(irParaRelatorio = false)
  {
    let anotacaoFinal = anotacaoLida ? $state.snapshot(anotacaoLida) : undefined;
    if (anotacaoFinal && (anotacaoFinal.resumo || anotacaoFinal.etapas.length || anotacaoFinal.palavrasDaAutora))
    {
      const antigas = (foto.anotacao?.etapas ?? []).filter((e) => !anotacaoFinal!.etapas.some((n) => n.texto === e.texto));
      anotacaoFinal = {
        texto: [foto.anotacao?.texto, anotacaoFinal.texto].filter(Boolean).join('\n\n'),
        resumo: anotacaoFinal.resumo || foto.anotacao?.resumo || '',
        palavrasDaAutora: anotacaoFinal.palavrasDaAutora || foto.anotacao?.palavrasDaAutora,
        etapas: [...antigas, ...anotacaoFinal.etapas],
      };
    }
    const nova = mesclarNaFoto(
      foto,
      totaisLidos,
      $state.snapshot(cardsLidos),
      $state.snapshot(ondasLidas),
      { pasta: pastaAtual, anotacao: anotacaoFinal, capturas: $state.snapshot(capturasLidas) },
    );
    dados.fotos = [
      ...dados.fotos.filter((f) => !(f.data === dataFoto && (f.pasta ?? dados.prefixo) === pastaAtual)),
      nova,
    ].sort((a, b) => a.data.localeCompare(b.data));
    salvar($state.snapshot(dados));
    aviso = `Salvo na pasta ${pastaAtual} (${dataFoto}): ${chavesLidas.length} totais, ${cardsLidos.length} cards, ${capturasLidas.length} ${capturasLidas.length === 1 ? 'captura' : 'capturas'}${anotacaoFinal ? ' e material da etapa' : ''}.`;
    limparLeitura();
    if (irParaRelatorio) goto('/relatorio');
    else aba = 'pasta';
  }

  async function aoImportar(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    dados = await importarJson(arquivo);
    salvar($state.snapshot(dados));
    aviso = 'Dados importados.';
  }

  function digitarTotal(chave: ChaveTotal, valor: string)
  {
    const numero = valor === '' ? undefined : Number(valor);
    const nova: Snapshot = { ...foto, pasta: pastaAtual, totais: { ...foto.totais, [chave]: numero } };
    if (numero === undefined) delete nova.totais[chave];
    dados.fotos = [
      ...dados.fotos.filter((f) => !(f.data === dataFoto && (f.pasta ?? dados.prefixo) === pastaAtual)),
      nova,
    ].sort((a, b) => a.data.localeCompare(b.data));
    salvar($state.snapshot(dados));
  }

  function contar(f: Snapshot, pessoaId: string, ritmo: Ritmo): number
  {
    return f.cards.filter((c) => c.responsavelEtapaAtual === pessoaId && c.ritmoPainel === ritmo).length;
  }
</script>

{#snippet editorAnotacao(a: Anotacao)}
  <div class="material-grade">
    <label class="bloco">
      <span>Resumo da etapa <small>(em uma frase, o que este recorte mostra)</small></span>
      <textarea rows="2" bind:value={a.resumo} placeholder="Ex.: Semana focada em destravar a fila de homologação e fechar os itens da Onda 1."></textarea>
    </label>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="bloco">
        <span class="linha-entre">
          <span>Palavras da autora <small>(descritivo geral em 1ª pessoa para o relatório)</small></span>
          <button class="link" onclick={() => regerarExplicacoes(a)}>regerar explicações com dados lidos</button>
        </span>
        <textarea rows="3" bind:value={a.palavrasDaAutora} placeholder="Sua visão geral sobre o momento da equipe, os gargalos e a estratégia adotada nesta etapa."></textarea>
      </label>
  </div>

  <div class="cabecalho-etapas">
    <h4>Etapas e explicação de cada passo ({a.etapas.filter((e) => e.feito).length}/{a.etapas.length} concluídas)</h4>
    <span class="dica">Cada etapa tem o título do passo e um descritivo explicando o que será feito e o impacto nos cards.</span>
  </div>

  {#if a.etapas.length}
    <ol class="etapas-detalhadas">
      {#each a.etapas as e, i (i)}
        <li class:feito-item={e.feito}>
          <div class="etapa-topo">
            <input type="checkbox" bind:checked={e.feito} title="Marcar etapa como concluída" />
            <span class="num-etapa">Etapa {i + 1}</span>
            <input class="largo titulo-etapa" class:feito={e.feito} bind:value={e.texto} placeholder="O que será feito nesta etapa" />
            {#if e.cards?.length}
              <span class="pilula">{e.cards.join(', ')}</span>
            {/if}
            <button class="link" onclick={() => moverEtapa(a.etapas, i, -1)} disabled={i === 0} title="Subir">↑</button>
            <button class="link" onclick={() => moverEtapa(a.etapas, i, 1)} disabled={i === a.etapas.length - 1} title="Descer">↓</button>
            <button class="link perigo" onclick={() => a.etapas.splice(i, 1)}>remover</button>
          </div>
          <label class="etapa-desc">
            <span>O que entendi / descritivo desta etapa:</span>
            <input bind:value={e.descricao} placeholder="Explicação detalhada do que esta etapa faz, com quem e qual o resultado esperado" />
          </label>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="dica">Nenhuma etapa descrita ainda. Adicione abaixo ou clique em "Regerar explicações".</p>
  {/if}

  <div class="nova-etapa-box">
    <input class="largo" bind:value={novaEtapa} placeholder="Título da nova etapa (ex.: Alinhar escopo do DEV-102 com Rodrigo)" />
    <input class="largo" bind:value={novaEtapaDesc} placeholder="Descritivo da etapa (se deixar vazio, o sistema gera uma explicação)" onkeydown={(ev) => {
      if (ev.key === 'Enter' && novaEtapa.trim()) {
        a.etapas.push({ texto: novaEtapa.trim(), descricao: novaEtapaDesc.trim() || descreverEtapa(novaEtapa, [], ctxExplicacao()), feito: false });
        novaEtapa = '';
        novaEtapaDesc = '';
      }
    }} />
    <button onclick={() => {
      if (!novaEtapa.trim()) return;
      a.etapas.push({ texto: novaEtapa.trim(), descricao: novaEtapaDesc.trim() || descreverEtapa(novaEtapa, [], ctxExplicacao()), feito: false });
      novaEtapa = '';
      novaEtapaDesc = '';
    }}>+ Adicionar etapa</button>
  </div>
{/snippet}

{#snippet tabelaOndas(ondas: Onda[])}
  <table>
    <thead><tr><th>Onda</th><th>Início</th><th>Fim</th><th>Itens</th><th>Concl.</th><th>%</th><th>Próx. venc.</th><th>Situação</th></tr></thead>
    <tbody>
      {#each ondas as o (o.nome)}
        <tr>
          <td>{o.nome}</td><td>{dataMedia(o.inicio)}</td><td>{dataMedia(o.fim)}</td><td>{o.itens ?? '-'}</td><td>{o.concluidos ?? '-'}</td>
          <td>{o.pct === undefined ? '-' : `${o.pct}%`}</td><td>{dataMedia(o.proximoVencimento)}</td><td>{o.situacao ?? '-'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<main>
  <span class="prompt">&gt; colar painel · pasta {pastaAtual}</span>
  <header>
    <div>
      <h1>Colar o painel<span class="cursor">_</span></h1>
      <p class="dica sub">Envie os prints, veja o que foi lido de cada imagem com sugestões, monte o material explicativo da etapa e salve na pasta.</p>
    </div>
    <div class="controles-topo">
      <label title="Pasta onde este registro fica guardado (ex.: DEV, SUPORTE, IMPLANTAÇÃO)">
        Pasta
        <select bind:value={pastaAtual} onchange={() => { dados.prefixo = pastaAtual; }}>
          {#each pastasDisponiveis as p (p)}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <div class="nova-pasta">
        <input class="curto" bind:value={novaPasta} placeholder="Nova (ex: QA)" onkeydown={(e) => e.key === 'Enter' && criarPasta()} />
        <button onclick={criarPasta} disabled={!novaPasta.trim()}>+ Pasta</button>
      </div>
      <label>Data da foto <input type="date" bind:value={dataFoto} /></label>
      <label>Prefixo <input class="curto" bind:value={dados.prefixo} /></label>
      <button onclick={() => exportarJson($state.snapshot(dados))}>Exportar JSON</button>
      <label class="botao">Importar JSON <input type="file" accept="application/json" onchange={aoImportar} hidden /></label>
    </div>
  </header>

  <nav class="passos" aria-label="Etapas do painel">
    <button class="passo" class:ativo={aba === 'colar'} onclick={() => (aba = 'colar')}>
      <span class="num">1</span>
      <div>
        <b>Colar imagens e descrever</b>
        <small>{capturasLidas.length} {capturasLidas.length === 1 ? 'imagem lida' : 'imagens lidas'}</small>
      </div>
    </button>
    <button class="passo" class:ativo={aba === 'conferir'} onclick={() => { if (!anotacaoLida && (textoAnotacao.trim() || leu)) interpretar(); aba = 'conferir'; }}>
      <span class="num">2</span>
      <div>
        <b>Material da etapa e conferência</b>
        <small>{cardsLidos.length} cards · {chavesLidas.length} totais · {anotacaoLida?.etapas.length ?? 0} etapas</small>
      </div>
    </button>
    <button class="passo" class:ativo={aba === 'pasta'} onclick={() => (aba = 'pasta')}>
      <span class="num">3</span>
      <div>
        <b>Pasta {pastaAtual} e números salvos</b>
        <small>{fotosDaPasta.length} {fotosDaPasta.length === 1 ? 'registro salvo' : 'registros salvos'}</small>
      </div>
    </button>
  </nav>

  {#if aviso}<p class="aviso">{aviso}</p>{/if}

  {#if aba === 'colar'}
    <section class="cartao">
      <div class="linha-entre">
        <h2>1. Cole os prints ou o texto do painel (Ctrl+V)</h2>
        {#if progresso !== null}<progress value={progresso}></progress>{/if}
      </div>
      <p class="dica">
        Tire prints do painel (Win+Shift+S) e cole aqui com <b>Ctrl+V</b>, ou arraste várias imagens de uma vez.
        Cada imagem fica separada abaixo mostrando exatamente o que foi transcrito dela, os cards/totais reconhecidos e sugestões automáticas.
      </p>

      <div class="grade-entrada">
        <div>
          <label class="rotulo-caixa" for="area-colagem">Área de colagem de prints / texto do painel</label>
          <textarea id="area-colagem" rows="5" bind:value={texto} onpaste={aoColar} ondrop={aoSoltar} ondragover={(e) => e.preventDefault()} placeholder="Clique aqui e aperte Ctrl+V para colar um print ou texto, ou arraste imagens para cá..."></textarea>
          <div class="linha">
            <label>Tipo de trecho
              <select bind:value={origemEscolhida}>
                <option value="auto">Detectar sozinho{origemDetectada ? ` (${nomesOrigem[origemDetectada]})` : ''}</option>
                {#each Object.entries(nomesOrigem) as [valor, nome] (valor)}
                  <option value={valor}>{nome}</option>
                {/each}
              </select>
            </label>
            <button onclick={() => registrarCapturaTexto(texto, 'Texto colado')} disabled={!texto.trim()}>Ler este texto</button>
            <label class="botao">Escolher imagens
              <input type="file" accept="image/*" multiple hidden onchange={(e) => lerImagens([...(e.currentTarget.files ?? [])])} />
            </label>
            <label class="botao">Escolher CSV
              <input type="file" accept=".csv,text/csv" hidden onchange={async (e) => { const arquivo = e.currentTarget.files?.[0]; if (arquivo) { texto = await arquivo.text(); registrarCapturaTexto(texto, `CSV ${arquivo.name}`); } e.currentTarget.value = ''; }} />
            </label>
            {#if leu}<button onclick={limparLeitura}>Limpar tudo</button>{/if}
          </div>
        </div>

        <div>
          <label class="rotulo-caixa" for="area-anotacao">Descreva a situação e o que será feito nesta etapa</label>
          <textarea id="area-anotacao" class="anotacao" rows="5" bind:value={textoAnotacao}
            placeholder="Conte o contexto e os próximos passos. Ex.: A fila do Douglas travou na homologação. Primeiro vamos alinhar o {dados.prefixo}-12 com o cliente, depois repriorizar a fila e por fim atualizar as previsões."></textarea>
          <div class="linha">
            <button class="principal" onclick={() => { interpretar(); aba = 'conferir'; }} disabled={!textoAnotacao.trim() && !leu}>
              Gerar material de explicações e conferir &rarr;
            </button>
          </div>
        </div>
      </div>

      {#if capturasLidas.length}
        <div class="bloco-capturas">
          <div class="linha-entre">
            <h3>O que foi transcrito de cada imagem ({capturasLidas.length})</h3>
            <span class="dica">Clique em uma imagem para revisar a transcrição, mudar o tipo de trecho ou adicionar as sugestões às etapas.</span>
          </div>

          <div class="abas-capturas">
            {#each capturasLidas as cap, idx (cap.id)}
              <button class="aba-cap" class:ativa={capturaAtiva === cap.id} onclick={() => (capturaAtiva = cap.id)}>
                <b>#{idx + 1} {cap.nome}</b>
                <small>{cap.cards.length} cards · {cap.totais.length} totais{cap.avisos.length ? ` · ⚠ ${cap.avisos.length}` : ''}</small>
              </button>
            {/each}
          </div>

          {#each capturasLidas.filter((c) => c.id === (capturaAtiva ?? capturasLidas[0]?.id)) as cap (cap.id)}
            <div class="detalhe-captura">
              <div class="col-img">
                {#if cap.imagemDataUrl}
                  <img src={cap.imagemDataUrl} alt={cap.nome} />
                {:else}
                  <div class="sem-img">Trecho colado como texto / CSV</div>
                {/if}
                <div class="linha">
                  <label>Interpretado como
                    <select bind:value={cap.origem} onchange={() => reprocessarCaptura(cap)}>
                      {#each Object.entries(nomesOrigem) as [valor, nome] (valor)}
                        <option value={valor}>{nome}</option>
                      {/each}
                    </select>
                  </label>
                  <button class="link perigo" onclick={() => removerCaptura(cap.id)}>remover esta captura</button>
                </div>
              </div>

              <div class="col-transcricao">
                <div class="resumo-extraido">
                  <span class="pilula">{cap.cards.length} cards: {cap.cards.slice(0, 8).join(', ') || 'nenhum'}{cap.cards.length > 8 ? '...' : ''}</span>
                  <span class="pilula">{cap.totais.length} indicadores lidos</span>
                  {#if cap.ondas}<span class="pilula">{cap.ondas} ondas</span>{/if}
                </div>

                {#if cap.avisos.length}
                  <div class="caixa-aviso">
                    <b>Pontos para conferir nesta imagem:</b>
                    <ul>{#each cap.avisos as av, i (i)}<li>{av}</li>{/each}</ul>
                  </div>
                {/if}

                {#if cap.sugestoes.length}
                  <div class="caixa-sugestao">
                    <div class="linha-entre">
                      <b>Sugestões do sistema a partir desta imagem:</b>
                      <button class="link" onclick={() => {
                        anotacaoLida ??= interpretarAnotacao(textoAnotacao, ctxExplicacao());
                        for (const s of cap.sugestoes) {
                          if (!anotacaoLida.etapas.some((e) => e.texto === s)) {
                            anotacaoLida.etapas.push({ texto: s, descricao: descreverEtapa(s, cap.cards, ctxExplicacao()), feito: false, cards: cap.cards.slice(0, 4) });
                          }
                        }
                        aviso = 'Sugestões adicionadas às etapas do material!';
                      }}>+ mandar sugestões para as etapas</button>
                    </div>
                    <ul>{#each cap.sugestoes as sg, i (i)}<li>{sg}</li>{/each}</ul>
                  </div>
                {/if}

                <label class="bloco">
                  <span>Texto transcrito desta imagem <small>(se o leitor trocou alguma letra ou número, corrija aqui e clique em Reprocessar)</small></span>
                  <textarea rows="5" bind:value={cap.texto}></textarea>
                </label>
                <button onclick={() => reprocessarCaptura(cap)}>Reprocessar transcrição desta imagem</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if aba === 'conferir'}
    <section class="cartao">
      <div class="linha-entre">
        <h2>2. Material explicativo da etapa e conferência</h2>
        <div class="linha">
          <button onclick={() => (aba = 'colar')}>&larr; Voltar para colar mais</button>
          <button class="principal" onclick={() => salvarNaFoto(false)} disabled={!chavesLidas.length && !cardsLidos.length && !anotacaoLida?.resumo && !anotacaoLida?.etapas.length && !capturasLidas.length}>
            Salvar na pasta {pastaAtual} ({dataFoto})
          </button>
          <button class="principal" onclick={() => salvarNaFoto(true)} disabled={!chavesLidas.length && !cardsLidos.length && !anotacaoLida?.resumo && !anotacaoLida?.etapas.length && !capturasLidas.length}>
            Salvar e abrir no Relatório &rarr;
          </button>
        </div>
      </div>

      <div class="bloco-material">
        <h3>Material de explicações da etapa</h3>
        <p class="dica">
          Este material fica salvo junto com a foto na pasta <b>{pastaAtual}</b> e entra automaticamente no relatório (PDF e link interativo) com o resumo, as palavras da autora, a tabela de etapas e os prints colados.
        </p>
        {#if !anotacaoLida}
          <button onclick={interpretar}>Gerar material explicativo agora</button>
        {:else}
          {@render editorAnotacao(anotacaoLida)}
        {/if}
      </div>

      <h3>Totais encontrados ({chavesLidas.length})</h3>
      {#if chavesLidas.length}
        <table>
          <tbody>
            {#each chavesLidas as chave (chave)}
              <tr>
                <td>{nomesTotais[chave]}</td>
                <td><input type="number" class="curto" bind:value={totaisLidos[chave]} /></td>
                <td><button onclick={() => delete totaisLidos[chave]}>remover</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="dica">Nenhum total neste trecho.</p>
      {/if}

      {#if ondasLidas.length}
        <h3>Resumo por onda ({ondasLidas.length})</h3>
        {@render tabelaOndas(ondasLidas)}
        <button class="link perigo" onclick={() => (ondasLidas = [])}>descartar ondas</button>
      {/if}

      <h3>Cards encontrados ({cardsLidos.length})</h3>
      {#if cardsLidos.length}
        <TabelaCards bind:cards={cardsLidos} pessoas={dados.pessoas} />
      {:else}
        <p class="dica">Nenhum card com o prefixo {dados.prefixo}- neste trecho.</p>
      {/if}
    </section>
  {/if}

  {#if aba === 'pasta'}
    <section class="cartao">
      <div class="linha-entre">
        <div>
          <h2>3. Pasta {pastaAtual} — histórico, materiais salvos e ajustes</h2>
          <p class="dica">Procure qualquer card, etapa, palavra da autora ou data guardada dentro de <b>{pastaAtual}</b>, ou edite os números e etapas da foto de {dataFoto}.</p>
        </div>
        <input class="busca-pasta" bind:value={buscaPasta} placeholder="Buscar em {pastaAtual} (código, etapa, texto, data)..." />
      </div>

      <div class="lista-pasta">
        {#each fotosFiltradas as f (`${f.pasta ?? dados.prefixo}_${f.data}`)}
          <div class="item-pasta" class:selecionada={f.data === dataFoto}>
            <div class="linha-entre">
              <div>
                <span class="pilula">{f.pasta ?? dados.prefixo}</span>
                <b>{dataMedia(f.data)}</b>
                <span class="dica">· {f.cards.length} cards · {Object.keys(f.totais).length} totais · {f.anotacao?.etapas.length ?? 0} etapas · {f.capturas?.length ?? 0} prints</span>
              </div>
              <div class="linha">
                {#if f.data !== dataFoto}
                  <button onclick={() => (dataFoto = f.data)}>Abrir registro</button>
                {/if}
                <button onclick={() => goto(`/relatorio?de=${f.data}&ate=${f.data}`)}>Usar no relatório</button>
                <button class="link perigo" onclick={() => apagarFoto(f.data, f.pasta ?? dados.prefixo)}>apagar</button>
              </div>
            </div>
            {#if f.anotacao?.resumo}
              <p class="resumo-pasta"><b>Resumo:</b> {f.anotacao.resumo}</p>
            {/if}
            {#if f.anotacao?.palavrasDaAutora}
              <p class="autora-pasta"><b>Palavras da autora:</b> "{f.anotacao.palavrasDaAutora}"</p>
            {/if}
          </div>
        {:else}
          <p class="dica">Nenhum registro encontrado na pasta {pastaAtual}{buscaPasta ? ` para "${buscaPasta}"` : ''}.</p>
        {/each}
      </div>

      <hr class="divisoria" />

      <h3>Editar registro aberto: {pastaAtual} em {dataMedia(dataFoto)}</h3>
      <p class="dica">Qualquer ajuste abaixo é gravado na hora e já atualiza o relatório.</p>

      {#if indiceFoto >= 0 && foto.anotacao}
        <details open>
          <summary>Material da etapa e palavras da autora ({foto.anotacao.etapas.filter((e) => e.feito).length}/{foto.anotacao.etapas.length} etapas feitas)</summary>
          {@render editorAnotacao(dados.fotos[indiceFoto]!.anotacao!)}
          <button class="link perigo" onclick={() => (dados.fotos[indiceFoto]!.anotacao = undefined)}>remover material desta foto</button>
        </details>
      {:else if indiceFoto >= 0}
        <button onclick={() => (dados.fotos[indiceFoto]!.anotacao = { texto: '', resumo: '', palavrasDaAutora: '', etapas: [] })}>+ Criar material de explicações para esta foto</button>
      {/if}

      {#if indiceFoto >= 0 && foto.capturas?.length}
        <details>
          <summary>Prints e transcrições salvos nesta foto ({foto.capturas.length})</summary>
          <div class="galeria-salva">
            {#each foto.capturas as cap (cap.id)}
              <div class="card-cap-salva">
                <div class="linha-entre">
                  <b>{cap.nome}</b>
                  <span class="dica">{cap.cards.length} cards · {cap.totais.length} totais</span>
                </div>
                {#if cap.imagemDataUrl}<img src={cap.imagemDataUrl} alt={cap.nome} />{/if}
                {#if cap.sugestoes.length}<p class="dica"><b>Sugestões:</b> {cap.sugestoes.join(' ')}</p>{/if}
              </div>
            {/each}
          </div>
        </details>
      {/if}

      {#if indiceFoto >= 0 && foto.ondas?.length}
        <details>
          <summary>Resumo por onda ({foto.ondas.length})</summary>
          {@render tabelaOndas(foto.ondas)}
          <button class="link perigo" onclick={() => (dados.fotos[indiceFoto]!.ondas = undefined)}>remover ondas desta foto</button>
        </details>
      {/if}

      {#if indiceFoto >= 0 && foto.cards.length}
        <details>
          <summary>Cards salvos nesta foto ({foto.cards.length})</summary>
          <TabelaCards bind:cards={dados.fotos[indiceFoto]!.cards} pessoas={dados.pessoas} />
        </details>
      {/if}

      <details>
        <summary>Números do painel (digitar ou corrigir manualmente)</summary>
        <p class="dica">Preencha só o que aparece no painel do gestor. Campo vazio fica fora do relatório.</p>
        {#each gruposTotais as g (g.titulo)}
          <fieldset class:secundario={g.secundario}>
            <legend>{g.titulo}</legend>
            {#if g.dica}<p class="dica">{g.dica}</p>{/if}
            <div class="grade">
              {#each g.chaves as chave (chave)}
                <label>
                  {nomesTotais[chave]}
                  <input type="number" class="curto" value={foto.totais[chave] ?? ''} onchange={(e) => digitarTotal(chave, e.currentTarget.value)} />
                </label>
              {/each}
            </div>
          </fieldset>
        {/each}
      </details>

      <details>
        <summary>Distribuição por pessoa nesta foto</summary>
        <table>
          <thead><tr><th>Pessoa</th><th>No ritmo</th><th>Em risco</th><th>Atrasado</th></tr></thead>
          <tbody>
            {#each dados.pessoas as p (p.id)}
              <tr><td>{nomePessoa(p.id)}</td>{#each ritmos as r (r)}<td>{contar(foto, p.id, r)}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>
  {/if}
</main>

<style>
  header, .linha, .controles-topo, .nova-pasta
  {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  header
  {
    justify-content: space-between;
    margin-bottom: 14px;
  }
  h1
  {
    margin: 0;
  }
  .sub
  {
    margin: 2px 0 0;
  }
  .linha-entre
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .passos
  {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 12px 0;
  }
  .passo
  {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    padding: 12px 14px;
    border-radius: var(--raio);
    background: var(--superficie);
    border: 1px solid var(--borda);
  }
  .passo.ativo
  {
    border-color: var(--marca);
    background: var(--marca-clara);
  }
  .passo .num
  {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--fonte-maquina);
    font-weight: 700;
    background: var(--superficie-2);
    color: var(--marca);
  }
  .passo.ativo .num
  {
    background: var(--marca);
    color: var(--sobre-marca);
  }
  .passo small
  {
    display: block;
    color: var(--suave);
    font-size: 0.78rem;
  }
  .grade-entrada
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 10px;
  }
  .rotulo-caixa
  {
    display: block;
    font-weight: 600;
    font-size: 0.88rem;
    margin-bottom: 4px;
  }
  textarea
  {
    width: 100%;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.82rem;
    margin: 6px 0;
    background: var(--superficie-2);
  }
  textarea.anotacao, .bloco textarea
  {
    font-family: inherit;
    font-size: 0.9rem;
  }
  .bloco-capturas
  {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--borda);
  }
  .abas-capturas
  {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
  }
  .aba-cap
  {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
  }
  .aba-cap.ativa
  {
    border-color: var(--marca);
    background: var(--marca-clara);
  }
  .aba-cap small
  {
    color: var(--suave);
    font-size: 0.75rem;
  }
  .detalhe-captura
  {
    display: grid;
    grid-template-columns: minmax(240px, 340px) 1fr;
    gap: 16px;
    padding: 14px;
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    background: var(--superficie-2);
  }
  .col-img img
  {
    width: 100%;
    max-height: 260px;
    object-fit: contain;
    border-radius: 6px;
    border: 1px solid var(--borda);
    background: #000;
    margin-bottom: 8px;
  }
  .sem-img
  {
    height: 120px;
    display: grid;
    place-items: center;
    border: 1px dashed var(--borda);
    border-radius: 6px;
    color: var(--suave);
    font-size: 0.85rem;
    margin-bottom: 8px;
  }
  .resumo-extraido
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .caixa-aviso, .caixa-sugestao
  {
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 0.86rem;
  }
  .caixa-aviso
  {
    background: var(--vermelho-fundo);
    border-left: 3px solid var(--vermelho);
  }
  .caixa-sugestao
  {
    background: var(--marca-clara);
    border-left: 3px solid var(--marca);
  }
  .caixa-aviso ul, .caixa-sugestao ul
  {
    margin: 4px 0 0 18px;
    padding: 0;
  }
  .bloco-material
  {
    padding: 14px;
    border: 1px solid var(--borda);
    border-left: 3px solid var(--marca);
    border-radius: var(--raio);
    background: var(--superficie-2);
    margin: 12px 0 18px;
  }
  .material-grade
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 10px 0;
  }
  .bloco
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 600;
    font-size: 0.86rem;
  }
  .bloco small
  {
    font-weight: 400;
    color: var(--suave);
  }
  .cabecalho-etapas
  {
    margin: 12px 0 6px;
  }
  .cabecalho-etapas h4
  {
    margin: 0;
  }
  .etapas-detalhadas
  {
    list-style: none;
    padding: 0;
    margin: 8px 0;
    display: grid;
    gap: 8px;
  }
  .etapas-detalhadas li
  {
    padding: 10px 12px;
    border: 1px solid var(--borda);
    border-radius: 8px;
    background: var(--superficie);
  }
  .etapas-detalhadas li.feito-item
  {
    opacity: 0.75;
  }
  .etapa-topo
  {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .num-etapa
  {
    font-family: var(--fonte-maquina);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--marca);
    white-space: nowrap;
  }
  .titulo-etapa
  {
    font-weight: 600;
  }
  .etapa-desc
  {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding-left: 26px;
    font-size: 0.82rem;
    color: var(--suave);
  }
  .etapa-desc input
  {
    flex: 1;
    font-size: 0.84rem;
  }
  .nova-etapa-box
  {
    display: grid;
    grid-template-columns: 1fr 1.3fr auto;
    gap: 8px;
    margin-top: 10px;
  }
  .largo
  {
    flex: 1;
    min-width: 180px;
  }
  .feito
  {
    text-decoration: line-through;
    color: var(--suave);
  }
  .busca-pasta
  {
    min-width: 280px;
  }
  .lista-pasta
  {
    display: grid;
    gap: 8px;
    margin: 12px 0;
    max-height: 300px;
    overflow-y: auto;
  }
  .item-pasta
  {
    padding: 10px 14px;
    border: 1px solid var(--borda);
    border-radius: 8px;
    background: var(--superficie-2);
  }
  .item-pasta.selecionada
  {
    border-color: var(--marca);
  }
  .resumo-pasta, .autora-pasta
  {
    margin: 6px 0 0;
    font-size: 0.86rem;
  }
  .autora-pasta
  {
    color: var(--suave);
    font-style: italic;
  }
  .divisoria
  {
    border: none;
    border-top: 1px solid var(--borda);
    margin: 18px 0;
  }
  .galeria-salva
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    margin: 10px 0;
  }
  .card-cap-salva
  {
    padding: 10px;
    border: 1px solid var(--borda);
    border-radius: 8px;
    background: var(--superficie-2);
  }
  .card-cap-salva img
  {
    width: 100%;
    max-height: 160px;
    object-fit: contain;
    margin-top: 6px;
    border-radius: 4px;
  }
  .grade
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px 20px;
    margin: 12px 0;
  }
  fieldset
  {
    border: 1px solid var(--borda);
    border-radius: 10px;
    margin: 12px 0;
    padding: 4px 14px 8px;
  }
  legend
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    padding: 0 6px;
  }
  .secundario
  {
    background: var(--superficie-2);
  }
  .grade label
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  summary
  {
    cursor: var(--cursor-clique);
    color: var(--marca);
    font-weight: 600;
    margin: 8px 0;
  }
  .curto
  {
    width: 90px;
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    margin-left: 8px;
    text-decoration: underline;
    font-size: 0.82rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .aviso
  {
    margin: 10px 0;
  }
  @media (max-width: 900px)
  {
    .passos, .grade-entrada, .detalhe-captura, .material-grade, .nova-etapa-box
    {
      grid-template-columns: 1fr;
    }
  }
</style>
