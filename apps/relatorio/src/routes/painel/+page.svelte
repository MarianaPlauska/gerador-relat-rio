<script lang="ts">
  import
  {
    agruparPorPessoa, agoraLocal, analisarTimeNoProjeto, calcularMetricasAutomaticasDosCards, calcularPeriodoHistoricoPessoa,
    calcularRelacoesEImpactoSemana, compararComAnteriores, consolidarArvoreDeCards, correlacionarCapturaComArvore,
    detectarOrigem, ehCsvDeDemandas, enriquecerCard, fotoVazia, idCurto, lerCards, lerCsvDemandas, lerOndas, lerTotais,
    linhasNaoReconhecidas, mesclarNaFoto, nomesTotais, ordenarCardsResumidos, pessoasDoProjeto, segundaDaSemana, somarDias, sugerirDaCaptura, unirCapturas,
    type CapturaLida, type CardSnapshot, type CriterioOrdenacaoCards, type EtapaCard, type Onda, type OrigemLeitura, type Pessoa, type RegistroPainel, type Snapshot, type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerColagem } from '#lib/colagem.ts';
  import { lerImagem, miniaturaDataUrl } from '#lib/ocr.ts';
  import InspetorTarefaCard from '#lib/painel/InspetorTarefaCard.svelte';
  import ModalCapturaAmpliada from '#lib/painel/ModalCapturaAmpliada.svelte';
  import ModalGerenciarEquipe from '#lib/painel/ModalGerenciarEquipe.svelte';
  import PainelMetricasAutomaticas from '#lib/painel/PainelMetricasAutomaticas.svelte';
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
  let pastaAtual = $state('DEV');
  let inicializouPasta = $state(false);
  let novaPasta = $state('');
  let dataRegistro = $state(agoraLocal().slice(0, 10));
  let aviso = $state('');
  let progresso = $state<number | null>(null);

  $effect(() =>
  {
    if (!inicializouPasta)
    {
      pastaAtual = dados.registros.at(-1)?.pasta ?? dados.prefixo ?? 'DEV';
      inicializouPasta = true;
    }
  });

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
  let ordenacaoTarefas = $state<CriterioOrdenacaoCards>('prioridade_maior');
  let cardSelecionadoCodigo = $state<string | null>(null);
  let modalCardAberto = $state(false);
  let capturaModalId = $state<string | null>(null);
  let modalGerenciarPessoas = $state(false);
  let confirmacaoRemoverPessoa = $state<{
    pessoa: Pessoa;
    escopo: 'projeto' | 'organizacao';
    de: string;
    ate: string;
  } | null>(null);

  let busca = $state('');
  let marcados = $state<string[]>([]);
  let dataNumeros = $state(agoraLocal().slice(0, 10));

  $effect(() => salvar($state.snapshot(dados)));

  const pastas = $derived([...new Set(['DEV', ...(dados.projetos ?? []), dados.prefixo || 'DEV', ...dados.registros.map((r) => r.pasta), ...dados.fotos.map((f) => f.pasta).filter((p): p is string => !!p), ...(dados.pessoas.flatMap((p) => p.pastas ?? [])), pastaAtual])].filter(Boolean));
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
  const unido = $derived(unirCapturas($state.snapshot(capturas) as CapturaLida[], { motivo }));
  const comentados = $derived(capturas.filter((c) => c.comentario?.trim()).length);
  const podeSalvar = $derived(capturas.length > 0 || !!motivo.trim() || !!textoFinal.trim());
  const pessoasDaPasta = $derived(pessoasDoProjeto(dados.pessoas, [...cardsLidos, ...(fotoBase?.cards ?? [])], pastaAtual));
  const cardsOrdenadosResumo = $derived(ordenarCardsResumidos(cardsLidos, ordenacaoTarefas));
  const cardSelecionado = $derived(cardsLidos.find((c) => c.codigo === cardSelecionadoCodigo) ?? null);
  const indiceCapturaModal = $derived(capturas.findIndex((c) => c.id === capturaModalId));
  const metricasEnvio = $derived(calcularMetricasAutomaticasDosCards(cardsLidos, totaisLidos, dados.pessoas));
  const metricasPastaDia = $derived(calcularMetricasAutomaticasDosCards(fotoNumeros.cards, fotoNumeros.totais, dados.pessoas));

  const semanaRegistro = $derived(segundaDaSemana(dataRegistro));
  const analiseEnvio = $derived(
    analisarTimeNoProjeto({
      pessoas: dados.pessoas,
      fotos: [...fotosDaPasta.filter((f) => f.data < dataRegistro), { data: dataRegistro, pasta: pastaAtual, totais: metricasEnvio.totais, cards: cardsLidos }],
      planos: dados.planos,
      pasta: pastaAtual,
      semanaInicio: semanaRegistro,
      semanaFim: somarDias(semanaRegistro, 6),
      hoje: dataRegistro,
    }),
  );

  $effect(() =>
  {
    if (!editouTexto) textoFinal = unido.texto;
  });

  function adicionarPessoaNaPasta(nomeForcado?: string)
  {
    const nome = (nomeForcado ?? novaPessoaNome).trim();
    if (!nome) return;
    const id = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || idCurto();
    const existente = dados.pessoas.find((p) => p.id === id || p.nome.toLowerCase() === nome.toLowerCase());
    if (existente)
    {
      const pastasAtuais = existente.pastas ?? ['DEV'];
      if (!pastasAtuais.includes(pastaAtual)) existente.pastas = [...pastasAtuais, pastaAtual];
      existente.removidaDaOrganizacao = false;
      if (existente.pastasRemovidas)
      {
        existente.pastasRemovidas = existente.pastasRemovidas.filter((pr) => pr.toUpperCase() !== pastaAtual.toUpperCase());
      }
      dados.pessoas = [...dados.pessoas];
    }
    else
    {
      dados.pessoas = [...dados.pessoas, { id, nome, capacidadeHorasSemana: 40, pastas: [pastaAtual] }];
    }
    salvar($state.snapshot(dados));
    novaPessoaNome = '';
    recalcular();
  }

  function solicitarRemocaoPessoa(pessoa: Pessoa, escopo: 'projeto' | 'organizacao')
  {
    const periodo = calcularPeriodoHistoricoPessoa(pessoa, dados.fotos, dados.registros, dataRegistro);
    confirmacaoRemoverPessoa = {
      pessoa,
      escopo,
      de: periodo.de,
      ate: periodo.ate,
    };
  }

  function confirmarRemocaoPessoa()
  {
    if (!confirmacaoRemoverPessoa) return;
    const { pessoa, escopo, de, ate } = confirmacaoRemoverPessoa;
    const pastaUpper = pastaAtual.toUpperCase();

    const jaCadastrada = dados.pessoas.some((p) => p.id === pessoa.id);
    const listaBase = jaCadastrada ? dados.pessoas : [...dados.pessoas, pessoa];

    dados.pessoas = listaBase.map((p) =>
    {
      if (p.id !== pessoa.id) return p;
      const pastasRem = new Set([...(p.pastasRemovidas ?? []), pastaUpper]);
      const novasPastas = (p.pastas ?? ['DEV']).filter((x) => x.toUpperCase() !== pastaUpper);
      return {
        ...p,
        pastas: novasPastas,
        pastasRemovidas: [...pastasRem],
        ...(escopo === 'organizacao' ? { removidaDaOrganizacao: true } : {}),
        historicoDe: de,
        historicoAte: ate,
      };
    });

    salvar($state.snapshot(dados));
    aviso = `${pessoa.nome} removido(a) ${escopo === 'organizacao' ? 'da organização' : `do projeto ${pastaAtual}`}. Mantido apenas o histórico de ${dataCurta(de)} a ${dataCurta(ate)}.`;
    confirmacaoRemoverPessoa = null;
  }

  function atualizarCapacidadePessoa(pessoaId: string, valor: string)
  {
    const num = Number(valor);
    if (Number.isNaN(num) || num < 4 || num > 120) return;
    dados.pessoas = dados.pessoas.map((p) => (p.id === pessoaId ? { ...p, capacidadeHorasSemana: num } : p));
    salvar($state.snapshot(dados));
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
    const cardsConsolidados = consolidarArvoreDeCards(m.cards);
    const auto = calcularMetricasAutomaticasDosCards(cardsConsolidados, m.totais, dados.pessoas);
    return { totais: auto.totais, cards: cardsConsolidados };
  }

  function sincronizarTotaisAutomaticos()
  {
    cardsLidos = calcularRelacoesEImpactoSemana(cardsLidos.map(enriquecerCard));
    totaisLidos = calcularMetricasAutomaticasDosCards(cardsLidos, totaisLidos, dados.pessoas).totais;
  }

  function registrarCaptura(conteudo: string, nome: string, imagemDataUrl?: string)
  {
    const previas = $state.snapshot(capturas) as CapturaLida[];
    const a = analisar(conteudo, undefined, [...cardsLidos, ...(fotoBase?.cards ?? [])], previas);
    const j = juntar($state.snapshot(totaisLidos), $state.snapshot(cardsLidos), a.totais, a.cards);
    totaisLidos = j.totais;
    cardsLidos = j.cards;
    if (a.ondas.length) ondasLidas = a.ondas;
    capturas = [
      ...capturas,
      {
        id: idCurto(), nome: `${nome} · ${nomesOrigem[a.origem]}`, origem: a.origem, texto: conteudo, ...(imagemDataUrl ? { imagemDataUrl } : {}),
        totais: Object.keys(j.totais) as ChaveTotal[], cards: a.cards.map((c) => c.codigo), ondas: a.ondas.length, avisos: a.avisos, sugestoes: a.sugestoes,
        comentario: '', naoReconhecido: a.naoReconhecido, repetidos: a.repetidos, novos: a.novos, porPessoa: a.porPessoa,
        ...(a.cardPaiVinculado ? { cardPaiVinculado: a.cardPaiVinculado } : {}),
        ...(a.confiancaVinculoPct !== undefined ? { confiancaVinculoPct: a.confiancaVinculoPct } : {}),
        ...(a.motivoVinculo ? { motivoVinculo: a.motivoVinculo } : {}),
      },
    ];
    if (!cardSelecionadoCodigo && j.cards.length > 0)
    {
      cardSelecionadoCodigo = j.cards[0]!.codigo;
    }
  }

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
        totais: Object.keys(j.totais) as ChaveTotal[],
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
    sincronizarTotaisAutomaticos();
  }

  function atualizarCampoCard(codigo: string, parcial: Partial<CardSnapshot>)
  {
    cardsLidos = cardsLidos.map((c) => (c.codigo === codigo ? { ...c, ...parcial } : c));
    sincronizarTotaisAutomaticos();
  }

  function alternarEtapaCard(codigo: string, ordemEtapa: number, naFotoDia = false)
  {
    const atualizarLista = (lista: CardSnapshot[]) =>
      lista.map((c) =>
      {
        if (c.codigo !== codigo) return c;
        const etapasAtuais = c.etapas ?? enriquecerCard(c).etapas ?? [];
        const novasEtapas: EtapaCard[] = etapasAtuais.map((et) =>
          et.ordem === ordemEtapa
            ? { ...et, situacao: et.situacao === 'concluida' ? 'nao_iniciada' : 'concluida', origemEtapa: 'manual' }
            : et,
        );
        const concluidas = novasEtapas.filter((e) => e.situacao === 'concluida').length;
        const todasFeitas = novasEtapas.length > 0 && concluidas === novasEtapas.length;
        return {
          ...c,
          etapas: novasEtapas,
          etapasConcluidas: concluidas,
          etapasTotal: novasEtapas.length,
          situacao: todasFeitas ? 'concluido' : concluidas > 0 ? 'em_execucao' : c.situacao,
          statusCard: todasFeitas ? 'Resolvido' : concluidas > 0 ? 'Em andamento' : c.statusCard,
        };
      });

    if (naFotoDia && indiceFotoNumeros >= 0)
    {
      const cardsAtualizados = atualizarLista(dados.fotos[indiceFotoNumeros]!.cards);
      const auto = calcularMetricasAutomaticasDosCards(cardsAtualizados, dados.fotos[indiceFotoNumeros]!.totais, dados.pessoas);
      dados.fotos[indiceFotoNumeros] = {
        ...dados.fotos[indiceFotoNumeros]!,
        cards: cardsAtualizados,
        totais: auto.totais,
      };
      dados.fotos = [...dados.fotos];
      salvar($state.snapshot(dados));
    }
    else
    {
      cardsLidos = atualizarLista(cardsLidos);
      sincronizarTotaisAutomaticos();
    }
  }

  function atualizarSituacaoEtapa(codigo: string, ordemEtapa: number, situacao: EtapaCard['situacao'])
  {
    cardsLidos = cardsLidos.map((c) =>
    {
      if (c.codigo !== codigo) return c;
      const etapasAtuais = c.etapas ?? enriquecerCard(c).etapas ?? [];
      const novasEtapas: EtapaCard[] = etapasAtuais.map((et) =>
        et.ordem === ordemEtapa ? { ...et, situacao, origemEtapa: 'manual' } : et,
      );
      const concluidas = novasEtapas.filter((e) => e.situacao === 'concluida').length;
      const todasFeitas = novasEtapas.length > 0 && concluidas === novasEtapas.length;
      return {
        ...c,
        etapas: novasEtapas,
        etapasConcluidas: concluidas,
        etapasTotal: novasEtapas.length,
        situacao: todasFeitas ? 'concluido' : novasEtapas.some((e) => e.situacao === 'rodando') ? 'em_execucao' : c.situacao,
      };
    });
    sincronizarTotaisAutomaticos();
  }

  function atualizarDescricaoEtapa(codigo: string, ordemEtapa: number, descricao: string, naFotoDia = false)
  {
    const atualizarLista = (lista: CardSnapshot[]) =>
      lista.map((c) =>
      {
        if (c.codigo !== codigo) return c;
        const etapasAtuais = c.etapas ?? enriquecerCard(c).etapas ?? [];
        return {
          ...c,
          etapas: etapasAtuais.map((et) => (et.ordem === ordemEtapa ? { ...et, descricao, origemEtapa: 'manual' } : et)),
        };
      });

    if (naFotoDia && indiceFotoNumeros >= 0)
    {
      dados.fotos[indiceFotoNumeros]!.cards = atualizarLista(dados.fotos[indiceFotoNumeros]!.cards);
      dados.fotos = [...dados.fotos];
      salvar($state.snapshot(dados));
    }
    else
    {
      cardsLidos = atualizarLista(cardsLidos);
    }
  }

  function adicionarEtapaManual(codigo: string, nome: string, desc: string)
  {
    cardsLidos = cardsLidos.map((c) =>
    {
      if (c.codigo !== codigo) return c;
      const atuais = c.etapas ?? [];
      const novaOrdem = atuais.length + 1;
      const novas: EtapaCard[] = [
        ...atuais,
        {
          ordem: novaOrdem,
          nome,
          descricao: desc || `Executar etapa: ${nome}`,
          pessoa: c.responsavelEtapaAtual ?? c.responsaveis[0],
          situacao: 'nao_iniciada',
          horasEstimadas: 1.5,
          origemEtapa: 'manual',
        },
      ];
      return { ...c, etapas: novas, etapasTotal: novas.length };
    });
    sincronizarTotaisAutomaticos();
  }

  function removerEtapaCard(codigo: string, ordemEtapa: number)
  {
    cardsLidos = cardsLidos.map((c) =>
    {
      if (c.codigo !== codigo) return c;
      const filtradas = (c.etapas ?? []).filter((e) => e.ordem !== ordemEtapa).map((e, i) => ({ ...e, ordem: i + 1 }));
      return {
        ...c,
        etapas: filtradas,
        etapasTotal: filtradas.length,
        etapasConcluidas: filtradas.filter((e) => e.situacao === 'concluida').length,
      };
    });
    sincronizarTotaisAutomaticos();
  }

  function vincularCardRelacionado(codigo: string, outroCodigo: string)
  {
    if (!outroCodigo || codigo === outroCodigo) return;
    cardsLidos = cardsLidos.map((c) =>
    {
      if (c.codigo === codigo)
      {
        const rel = [...new Set([...(c.cardsRelacionados ?? []), outroCodigo])];
        return { ...c, cardsRelacionados: rel };
      }
      if (c.codigo === outroCodigo)
      {
        const rel = [...new Set([...(c.cardsRelacionados ?? []), codigo])];
        return { ...c, cardsRelacionados: rel };
      }
      return c;
    });
    sincronizarTotaisAutomaticos();
  }

  function desvincularCardRelacionado(codigo: string, outroCodigo: string)
  {
    cardsLidos = cardsLidos.map((c) =>
    {
      if (c.codigo !== codigo) return c;
      return { ...c, cardsRelacionados: (c.cardsRelacionados ?? []).filter((x) => x !== outroCodigo) };
    });
  }

  function removerCaptura(id: string)
  {
    capturas = capturas.filter((c) => c.id !== id);
    if (capturaModalId === id) capturaModalId = null;
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
        const [texto, miniatura] = await Promise.all([lerImagem(imagem, (p) => (progresso = p), pastaAtual || dados.prefixo), miniaturaDataUrl(imagem).catch(() => undefined)]);
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
    cardSelecionadoCodigo = null;
  }

  function salvarRegistro(emitir = false)
  {
    const descobertas = pessoasDoProjeto(dados.pessoas, cardsLidos, pastaAtual);
    for (const p of descobertas)
    {
      if (!dados.pessoas.some((x) => x.id === p.id))
      {
        dados.pessoas = [...dados.pessoas, p];
      }
    }

    if (!dados.projetos) dados.projetos = ['DEV'];
    if (!dados.projetos.includes(pastaAtual)) dados.projetos = [...dados.projetos, pastaAtual];

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
      const nova = mesclarNaFoto(foto, $state.snapshot(metricasEnvio.totais), $state.snapshot(cardsLidos), $state.snapshot(ondasLidas), { pasta: pastaAtual });
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
    const atuais = dados.projetos ?? ['DEV'];
    if (!atuais.includes(nome))
    {
      dados.projetos = [...atuais, nome];
    }
    pastaAtual = nome;
    novaPasta = '';
    salvar($state.snapshot(dados));
    aviso = `Projeto ${nome} criado e salvo na organização.`;
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
      <span class="pilula pilula-pessoa-item">
        <button
          type="button"
          class="btn-nome-pilula"
          onclick={() => (pessoaExpandidaEnvio = pessoaExpandidaEnvio === p.id ? null : p.id)}
          title="Clique para focar ou expandir esta pessoa"
        >
          {p.nome}
        </button>
        <button
          type="button"
          class="btn-remover-pilula"
          onclick={() => solicitarRemocaoPessoa(p, 'projeto')}
          title={`Remover ${p.nome} do projeto ${pastaAtual} (mantendo histórico)`}
        >
          ×
        </button>
      </span>
    {/each}
    <div class="add-pessoa-inline">
      <input bind:value={novaPessoaNome} placeholder="Adicionar pessoa ao projeto" onkeydown={(e) => e.key === 'Enter' && adicionarPessoaNaPasta()} />
      <button onclick={() => adicionarPessoaNaPasta()} disabled={!novaPessoaNome.trim()}>+ Pessoa</button>
      <button type="button" class="btn-gerenciar-org" onclick={() => (modalGerenciarPessoas = true)}>
        Gerenciar equipe e rendimento
      </button>
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
        <p class="dica">Clique em qualquer tarefa para abrir as etapas ticáveis, anotações e impacto à direita (ou ampliar em modal). Clique no print para ampliar a imagem.</p>

        {#if cardsLidos.length}
          <div class="grade-arvore-envio" class:com-painel-direito={!!cardSelecionado}>
            <div class="caixa-arvore">
              <div class="linha-entre topo-caixa-arvore">
                <span class="etiqueta">Resumo das tarefas identificadas ({cardsLidos.length})</span>
                <label class="organizador-select">
                  <span>Organizar:</span>
                  <select bind:value={ordenacaoTarefas}>
                    <option value="prioridade_maior">Prioridade e tempo (maior → menor)</option>
                    <option value="card_maior">Card {pastaAtual}-xxx (maior → menor)</option>
                    <option value="card_menor">Card {pastaAtual}-xxx (menor → maior)</option>
                    <option value="nomes_parecidos">Assuntos / nomes parecidos</option>
                    <option value="datas_proximas">Datas próximas</option>
                  </select>
                </label>
              </div>
              <div class="lista-tarefas-resumo">
                {#each cardsOrdenadosResumo as card (card.codigo)}
                  {@const selecionado = cardSelecionadoCodigo === card.codigo}
                  <button
                    type="button"
                    class="item-tarefa-resumo"
                    class:selecionado
                    onclick={() => (cardSelecionadoCodigo = card.codigo)}
                  >
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
                    {#if card.cardsRelacionados?.length}
                      <div class="mini-relacoes-resumo">
                        Relação na semana: {card.cardsRelacionados.slice(0, 3).join(', ')}
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <div class="caixa-arvore">
              <span class="etiqueta">Pessoas na semana (clique para expandir tarefas e etapas)</span>
              <div class="lista-pessoas-arvore">
                {#each analiseEnvio.filter((p) => p.total > 0) as p (p.pessoa.id)}
                  {@const aberta = pessoaExpandidaEnvio === p.pessoa.id}
                  <div class="pessoa-no-arvore" class:aberta>
                    <button
                      type="button"
                      class="cabecalho-pessoa-arvore"
                      onclick={() => (pessoaExpandidaEnvio = aberta ? null : p.pessoa.id)}
                    >
                      <span class="nome-pessoa-arvore-bloco">
                        <span class="seta-arvore">{aberta ? '▾' : '▸'}</span>
                        <b>{p.pessoa.nome}</b>
                        <small>({p.total} {p.total === 1 ? 'tarefa' : 'tarefas'})</small>
                        {#if p.estagioCritico}
                          <span class="pilula perigo-sobrecarga" title={p.motivoEstagioCritico}>[Sobrecarga crítica]</span>
                        {/if}
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
                          <div class="card-filho-arvore" class:selecionado={cardSelecionadoCodigo === tar.codigo}>
                            <div class="linha-entre">
                              <button
                                type="button"
                                class="btn-titulo-card-filho"
                                onclick={() => (cardSelecionadoCodigo = tar.codigo)}
                              >
                                <b class="maquina">{tar.codigo}</b> {tar.assunto}
                                {#if tar.prioridadeCard}<span class="badge-status-card">{tar.prioridadeCard}</span>{/if}
                              </button>
                              <div class="acoes-card-filho">
                                <label class="mini">Tempo (h)
                                  <input
                                    type="number"
                                    step="0.5"
                                    class="input-horas-curto"
                                    value={tar.horasEstimadas}
                                    onchange={(e) => atualizarHorasCard(tar.codigo, e.currentTarget.value)}
                                  />
                                </label>
                                <button
                                  type="button"
                                  class="btn-abrir-direita"
                                  onclick={() => (cardSelecionadoCodigo = tar.codigo)}
                                >
                                  Detalhes / Etapas &rarr;
                                </button>
                              </div>
                            </div>
                            {#if tar.descricaoCompleta}
                              <p class="pedido-completo"><b>O que foi pedido:</b> {tar.descricaoCompleta}</p>
                            {/if}
                            {#if tar.etapas?.length}
                              <div class="bloco-etapas-filhas">
                                <span class="etiqueta-micro">Etapas e o que vai fazer (marque o que já foi ou será feito):</span>
                                <ul class="etapas-filhas-interativas">
                                  {#each tar.etapas as et (et.ordem)}
                                    <li class:etapa-concluida={et.situacao === 'concluida'}>
                                      <label class="check-etapa-linha">
                                        <input
                                          type="checkbox"
                                          checked={et.situacao === 'concluida'}
                                          onchange={() => alternarEtapaCard(tar.codigo, et.ordem)}
                                        />
                                        <span>
                                          <b>{et.ordem}. {et.nome}</b>
                                          <small class="status-etapa-tag">
                                            [{et.situacao.replace('_', ' ')}{et.tempoRodandoHoras !== undefined ? ` · ${et.tempoRodandoHoras}h rodando` : et.horasEstimadas ? ` · ~${et.horasEstimadas}h` : ''}]
                                          </small>
                                        </span>
                                      </label>
                                      {#if et.descricao}
                                        <div class="desc-etapa-fazer">{et.descricao}</div>
                                      {/if}
                                    </li>
                                  {/each}
                                </ul>
                              </div>
                            {/if}
                            {#if tar.impactoSemana}
                              <div class="impacto-card-filho">
                                <b>Impacto e correlação na semana:</b> {tar.impactoSemana}
                              </div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            {#if cardSelecionado}
              <aside class="painel-detalhe-direita">
                <InspetorTarefaCard
                  card={cardSelecionado}
                  todosCards={cardsLidos}
                  pessoas={pessoasDaPasta}
                  {pastaAtual}
                  modo="lateral"
                  aoAtualizarCampo={atualizarCampoCard}
                  aoAtualizarHoras={atualizarHorasCard}
                  aoAlternarEtapa={(cod, ord) => alternarEtapaCard(cod, ord)}
                  aoAtualizarSituacaoEtapa={atualizarSituacaoEtapa}
                  aoAtualizarDescricaoEtapa={(cod, ord, desc) => atualizarDescricaoEtapa(cod, ord, desc)}
                  aoAdicionarEtapa={adicionarEtapaManual}
                  aoRemoverEtapa={removerEtapaCard}
                  aoVincularRelacionado={vincularCardRelacionado}
                  aoDesvincularRelacionado={desvincularCardRelacionado}
                  aoSelecionarOutroCard={(cod) => (cardSelecionadoCodigo = cod)}
                  aoAmpliarModal={() => (modalCardAberto = true)}
                  aoFechar={() => (cardSelecionadoCodigo = null)}
                />
              </aside>
            {/if}
          </div>
        {/if}

        {#each capturas as cap, idx (cap.id)}
          <article class="captura">
            <button
              type="button"
              class="img btn-img-modal"
              onclick={() => (capturaModalId = cap.id)}
              title="Clique para ampliar a imagem e ver todas as informações em modal"
            >
              {#if cap.imagemDataUrl}
                <img src={cap.imagemDataUrl} alt={cap.nome} />
                <span class="selo-ampliar-img">Clique para ampliar em modal</span>
              {:else}
                <div class="sem-img">texto / CSV (clique para abrir em modal)</div>
              {/if}
            </button>
            <div class="conteudo">
              <div class="linha-entre">
                <b>#{idx + 1} {cap.nome.split(' · ')[0]}</b>
                <span class="linha linha-acoes-captura">
                  <button
                    type="button"
                    class="btn-ampliar-captura"
                    onclick={() => (capturaModalId = cap.id)}
                  >
                    Ver em modal
                  </button>
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
                <span class="pilula">{cap.cards.length} demandas{cap.cards.length ? `: ${cap.cards.slice(0, 6).join(', ')}${cap.cards.length > 6 ? '...' : ''}` : ''}</span>
                <span class="pilula">{cap.totais.length} indicadores calculados</span>
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

        <details class="conferir painel-inteligencia-auto">
          <summary>
            Indicadores calculados, prioridades, gargalos, gráfico em linha e checklist de etapas ({cardsLidos.length} demandas · {metricasEnvio.etapasConcluidasCount}/{metricasEnvio.etapasTotalCount} etapas concluídas · {metricasEnvio.totais.ritmoEmRisco ?? 0} em risco)
          </summary>

          <PainelMetricasAutomaticas
            metricas={metricasEnvio}
            aoSelecionarCard={(cod) => (cardSelecionadoCodigo = cod)}
          />

          {#if cardsLidos.length}
            <TabelaCards bind:cards={cardsLidos} pessoas={pessoasDaPasta} />
          {/if}
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

    <details class="cartao avancado" open>
      <summary>Números automáticos, etapas ticáveis, prioridades, gráfico em linha e cards da pasta ({pastaAtual})</summary>
      <p class="dica">O sistema calcula automaticamente o em risco, a média, o tempo e as etapas conforme você acrescenta prints ou marca etapas concluídas abaixo.</p>
      <label>Dia <select bind:value={dataNumeros}>
        {#each [...new Set([dataNumeros, ...fotosDaPasta.map((f) => f.data)])].sort().reverse() as d (d)}<option value={d}>{dataMedia(d)}</option>{/each}
      </select></label>

      {#if metricasPastaDia.serieGraficoLinha.length > 0}
        <PainelMetricasAutomaticas
          metricas={metricasPastaDia}
          tituloGrafico={`Gráfico em linha (${dataMedia(dataNumeros)}): Tempo estipulado vs Tempo rodando/realizado`}
        />

        <h3>Checklist automático de etapas por demanda ({metricasPastaDia.cardsPorPrioridade.length})</h3>
        <div class="grade-checklist-dia">
          {#each metricasPastaDia.cardsPorPrioridade as c (c.codigo)}
            <div class="card-checklist-dia">
              <div class="linha-entre">
                <span>
                  <b class="maquina">{c.codigo}</b>
                  {#if c.prioridadeCard}<span class="pilula prio-{c.prioridadeCard.toLowerCase()}">{c.prioridadeCard}</span>{/if}
                  <span class="badge-status-card">{c.statusCard ?? c.situacao ?? 'Ativo'}</span>
                </span>
                <span class="fontes-vetor">~{c.horasEstimadas ?? 4}h · {c.etapasConcluidas ?? 0}/{c.etapas?.length ?? 3} feitas</span>
              </div>
              <div class="assunto-tarefa">{c.assunto || c.titulo}</div>
              <ul class="etapas-filhas-interativas">
                {#each c.etapas ?? [] as et (et.ordem)}
                  <li class:etapa-concluida={et.situacao === 'concluida'}>
                    <label class="check-etapa-linha">
                      <input
                        type="checkbox"
                        checked={et.situacao === 'concluida'}
                        onchange={() => alternarEtapaCard(c.codigo, et.ordem, true)}
                      />
                      <span><b>{et.ordem}. {et.nome}</b></span>
                    </label>
                    {#if et.descricao}
                      <input
                        class="input-desc-etapa"
                        value={et.descricao}
                        onchange={(e) => atualizarDescricaoEtapa(c.codigo, et.ordem, e.currentTarget.value, true)}
                      />
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}

      {#each gruposTotais as g (g.titulo)}
        <fieldset class:secundario={g.secundario}>
          <legend>{g.titulo}</legend>
          <div class="grade">
            {#each g.chaves as chave (chave)}
              <label>{nomesTotais[chave]} <input type="number" class="curto" value={fotoNumeros.totais[chave] ?? metricasPastaDia.totais[chave] ?? ''} onchange={(e) => digitarTotal(chave, e.currentTarget.value)} /></label>
            {/each}
          </div>
        </fieldset>
      {/each}
      {#if indiceFotoNumeros >= 0 && fotoNumeros.cards.length}
        <h3>Tabela completa de cards deste dia ({fotoNumeros.cards.length})</h3>
        <TabelaCards bind:cards={dados.fotos[indiceFotoNumeros]!.cards} pessoas={dados.pessoas} />
      {/if}
      <div class="linha">
        <label>Prefixo dos cards <input class="curto" bind:value={dados.prefixo} /></label>
        <button onclick={() => exportarJson($state.snapshot(dados))}>Exportar JSON</button>
        <label class="botao">Importar JSON <input type="file" accept="application/json" onchange={aoImportar} hidden /></label>
      </div>
    </details>
  {/if}

  {#if indiceCapturaModal >= 0 && capturas[indiceCapturaModal]}
    <ModalCapturaAmpliada
      bind:captura={capturas[indiceCapturaModal]!}
      aoFechar={() => (capturaModalId = null)}
      aoReprocessar={recalcular}
      aoInspecionarCard={(cod) => {
        cardSelecionadoCodigo = cod;
        capturaModalId = null;
        modalCardAberto = true;
      }}
    />
  {/if}

  {#if modalCardAberto && cardSelecionado}
    <div class="modal-backdrop" role="presentation" onclick={() => (modalCardAberto = false)}>
      <div
        class="modal-janela modal-medio"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.key === 'Escape' && (modalCardAberto = false)}
      >
        <InspetorTarefaCard
          card={cardSelecionado}
          todosCards={cardsLidos}
          pessoas={pessoasDaPasta}
          {pastaAtual}
          modo="modal"
          aoAtualizarCampo={atualizarCampoCard}
          aoAtualizarHoras={atualizarHorasCard}
          aoAlternarEtapa={(cod, ord) => alternarEtapaCard(cod, ord)}
          aoAtualizarSituacaoEtapa={atualizarSituacaoEtapa}
          aoAtualizarDescricaoEtapa={(cod, ord, desc) => atualizarDescricaoEtapa(cod, ord, desc)}
          aoAdicionarEtapa={adicionarEtapaManual}
          aoRemoverEtapa={removerEtapaCard}
          aoVincularRelacionado={vincularCardRelacionado}
          aoDesvincularRelacionado={desvincularCardRelacionado}
          aoSelecionarOutroCard={(cod) => (cardSelecionadoCodigo = cod)}
          aoFechar={() => (modalCardAberto = false)}
        />
      </div>
    </div>
  {/if}

  <ModalGerenciarEquipe
    {pastaAtual}
    {dataRegistro}
    {analiseEnvio}
    todasPessoas={dados.pessoas}
    fotos={dados.fotos}
    registros={dados.registros}
    modalGerenciarAberto={modalGerenciarPessoas}
    confirmacaoRemover={confirmacaoRemoverPessoa}
    aoFecharGerenciar={() => (modalGerenciarPessoas = false)}
    aoAtualizarCapacidade={atualizarCapacidadePessoa}
    aoSolicitarRemocao={solicitarRemocaoPessoa}
    aoConfirmarRemocao={confirmarRemocaoPessoa}
    aoCancelarRemocao={() => (confirmacaoRemoverPessoa = null)}
    aoReativarPessoa={(nome) => adicionarPessoaNaPasta(nome)}
  />
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

  .linha-acoes-captura { display: flex; align-items: center; gap: 6px; }
  .btn-adicionar-opcao { padding: 1px 7px; font-size: 0.85rem; font-weight: 700; background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: 4px; color: var(--marca); cursor: pointer; line-height: 1.3; }
  .btn-adicionar-opcao:hover { border-color: var(--marca); background: var(--marca-clara); }
  .linha-nova-opcao { display: flex; align-items: center; gap: 6px; background: var(--superficie); padding: 3px 6px; border: 1px solid var(--marca); border-radius: 4px; }
  .input-nova-opcao { font-size: 0.78rem; padding: 3px 6px; border: 1px solid var(--borda); border-radius: 3px; min-width: 150px; background: var(--fundo); color: var(--texto); }
  .btn-salvar-opcao { font-size: 0.74rem; padding: 3px 8px; background: var(--marca); color: var(--sobre-marca); border: none; border-radius: 3px; cursor: pointer; font-weight: 600; }

  .barra-equipe-projeto { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 12px; background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); }
  .pilula-pessoa-item { display: inline-flex; align-items: center; gap: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--texto); padding: 2px 8px; }
  .btn-nome-pilula { border: none; background: none; color: var(--texto); padding: 0; font-size: 0.8rem; cursor: pointer; }
  .btn-nome-pilula:hover { color: var(--marca); }
  .btn-remover-pilula { border: none; background: none; color: var(--suave); padding: 0 2px; font-size: 0.9rem; line-height: 1; cursor: pointer; }
  .btn-remover-pilula:hover { color: var(--vermelho); }
  .add-pessoa-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
  .add-pessoa-inline input { font-size: 0.8rem; padding: 3px 8px; width: 190px; }
  .add-pessoa-inline button { font-size: 0.78rem; padding: 3px 8px; }
  .btn-gerenciar-org { background: var(--superficie-2); border: 1px solid var(--marca); color: var(--marca); font-weight: 600; }

  .grade-arvore-envio { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; margin: 12px 0; align-items: start; }
  .grade-arvore-envio.com-painel-direito { grid-template-columns: minmax(290px, 1fr) minmax(320px, 1.1fr) minmax(350px, 1.25fr); }
  .caixa-arvore { background: var(--superficie-2); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .topo-caixa-arvore { gap: 8px; }
  .organizador-select { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--suave); }
  .organizador-select select { font-size: 0.75rem; padding: 2px 6px; max-width: 210px; }

  .lista-tarefas-resumo, .lista-pessoas-arvore {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 440px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--borda-forte) var(--superficie);
  }
  .lista-tarefas-resumo::-webkit-scrollbar, .lista-pessoas-arvore::-webkit-scrollbar {
    width: 6px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-track, .lista-pessoas-arvore::-webkit-scrollbar-track {
    background: var(--superficie);
    border-radius: 4px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-thumb, .lista-pessoas-arvore::-webkit-scrollbar-thumb {
    background: var(--borda-forte);
    border-radius: 4px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-thumb:hover, .lista-pessoas-arvore::-webkit-scrollbar-thumb:hover {
    background: var(--marca);
  }
  .pilula.perigo-sobrecarga {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
    border: 1px solid var(--vermelho);
    font-weight: 700;
    font-size: 0.7rem;
  }
  .item-tarefa-resumo { flex-shrink: 0; width: 100%; text-align: left; background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--cor-barra); border-radius: 6px; padding: 9px 12px; font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .item-tarefa-resumo:hover, .item-tarefa-resumo.selecionado { border-color: var(--marca); border-left-color: var(--marca); background: var(--marca-clara); }
  .assunto-tarefa { color: var(--texto); line-height: 1.35; font-weight: 500; }
  .mini-relacoes-resumo { font-size: 0.72rem; color: var(--marca); font-family: var(--fonte-maquina); }
  .fontes-vetor { font-family: var(--fonte-maquina); font-size: 0.72rem; color: var(--suave); }
  .badge-status-card { font-family: var(--fonte-maquina); font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--suave); margin-left: 4px; }
  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }

  .pessoa-no-arvore { flex-shrink: 0; background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; margin-bottom: 2px; }
  .pessoa-no-arvore.aberta { border-color: var(--marca); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12); }
  .cabecalho-pessoa-arvore { width: 100%; min-height: 46px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; background: none; border: none; text-align: left; color: var(--texto); font-family: inherit; cursor: pointer; }
  .nome-pessoa-arvore-bloco { display: flex; align-items: center; gap: 6px; font-size: 0.92rem; }
  .seta-arvore { color: var(--marca); font-family: var(--fonte-maquina); }
  .metricas-pessoa-arvore { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .corpo-pessoa-arvore { border-top: 1px solid var(--borda); padding: 12px; background: var(--superficie-2); display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; }
  .resumo-probabilistico { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px; background: var(--superficie); border-radius: 6px; border: 1px solid var(--borda); font-size: 0.78rem; color: var(--suave); }
  .resumo-probabilistico b { color: var(--texto); }
  .card-filho-arvore { flex-shrink: 0; background: var(--superficie); border: 1px solid var(--borda); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .card-filho-arvore.selecionado { border-color: var(--marca); }
  .btn-titulo-card-filho { border: none; background: none; padding: 0; text-align: left; color: var(--texto); font-size: 0.84rem; cursor: pointer; }
  .btn-titulo-card-filho:hover { color: var(--marca); }
  .acoes-card-filho { display: flex; align-items: center; gap: 8px; }
  .btn-abrir-direita { font-size: 0.74rem; padding: 2px 8px; background: var(--superficie-2); border: 1px solid var(--borda-forte); color: var(--marca); border-radius: 4px; cursor: pointer; }
  .input-horas-curto { width: 64px; font-size: 0.78rem; padding: 2px 5px; }
  .pedido-completo { margin: 2px 0 0; font-size: 0.78rem; line-height: 1.4; color: var(--suave); white-space: pre-line; background: var(--superficie-2); padding: 6px 8px; border-radius: 4px; }
  .bloco-etapas-filhas { background: var(--superficie-2); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--borda); }
  .etiqueta-micro { display: block; font-size: 0.72rem; color: var(--suave); margin-bottom: 4px; font-weight: 600; }
  .etapas-filhas-interativas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; }
  .etapas-filhas-interativas li { padding: 4px 6px; border-radius: 4px; background: var(--superficie); border: 1px solid var(--borda); }
  .etapas-filhas-interativas li.etapa-concluida { opacity: 0.75; border-left: 3px solid var(--verde); }
  .check-etapa-linha { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .status-etapa-tag { color: var(--suave); margin-left: 4px; font-family: var(--fonte-maquina); }
  .desc-etapa-fazer { margin: 3px 0 0 22px; font-size: 0.75rem; color: var(--suave); line-height: 1.3; }
  .impacto-card-filho { font-size: 0.75rem; color: var(--suave); padding: 5px 8px; background: var(--superficie-2); border-left: 2px solid var(--marca); border-radius: 4px; }
  .input-desc-etapa { width: 100%; font-size: 0.78rem; padding: 4px 6px; margin-top: 4px; }

  .painel-detalhe-direita { background: var(--superficie); border: 1.5px solid var(--marca); border-radius: var(--raio); padding: 14px; position: sticky; top: 14px; max-height: 85vh; overflow-y: auto; }

  .btn-img-modal { position: relative; border: none; background: none; padding: 0; cursor: pointer; display: block; text-align: left; }
  .selo-ampliar-img { display: block; margin-top: 4px; font-size: 0.74rem; color: var(--marca); text-align: center; font-weight: 600; }
  .btn-ampliar-captura { font-size: 0.76rem; padding: 3px 8px; background: var(--superficie); border: 1px solid var(--marca); color: var(--marca); border-radius: 4px; cursor: pointer; }

  .grade-checklist-dia { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; margin: 10px 0; }
  .card-checklist-dia { background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(8, 12, 20, 0.76); backdrop-filter: blur(3px); z-index: 900; display: grid; place-items: center; padding: 18px; overflow-y: auto; }
  .modal-janela { background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: var(--raio); padding: 18px; width: 100%; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); }
  .modal-medio { max-width: 780px; }

  .vinculo-arvore-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; padding: 6px 10px; background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--marca); border-radius: 4px; }
  .vinculo-arvore-barra select { font-size: 0.78rem; padding: 2px 6px; max-width: 280px; }
  .por-pessoa-print { display: flex; flex-direction: column; gap: 3px; margin: 6px 0; padding: 6px 10px; background: var(--superficie); border-radius: 4px; border: 1px solid var(--borda); font-size: 0.82rem; }
  .item-pessoa-print { color: var(--texto); }

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
  @media (max-width: 1024px) { .grade-arvore-envio.com-painel-direito { grid-template-columns: 1fr; } }
  @media (max-width: 800px) { .captura, .duas { grid-template-columns: 1fr; } }
</style>
