<script lang="ts">
  import
  {
    adicionarEtapaAjustada, adicionarRegrasDescarte, agruparPorPessoa, agoraLocal, ajustarCampos, ajustarEtapa, ajustarHoras, analisarTimeNoProjeto, aplicarAjustes, aplicarRegrasDescarte, aplicarRelacionados,
    aprenderEstimativas, calcularMetricasAutomaticasDosCards, calcularPeriodoHistoricoPessoa, calcularRelacoesEImpactoSemana, chaveDaEtapa,
    compararComAnteriores, consolidarArvoreDeCards, correlacionarLote, definicoesPadrao, desvincularAjustado,
    detectarOrigem, ehCsvDeDemandas, enriquecerCard, fotoVazia, idCurto, lerCards, lerCsvDemandas, lerOndas, lerTotais,
    coberturaDaLeitura, linhasNaoReconhecidas, mesclarNaFoto, montarGanttSemana, nomesTotais, pessoasDoProjeto, removerCardAjustado, removerEtapaAjustada, removerRegraDescarte, segundaDaSemana, somarDias, sugerirDaCaptura, unirCapturas, vincularAjustado,
    type Ajustes, type AjusteEtapa, type Ausencia, type CapturaLida, type CardSnapshot, type EtapaCard, type Onda, type OrigemLeitura, type Pessoa, type RegistroPainel, type SaidaCapturaLote, type Snapshot, type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, hidratarImagens, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerColagem } from '#lib/colagem.ts';
  import { guardarOrdem, ordemManualDoProjeto } from '#lib/fila.ts';
  import { lerImagem, miniaturaDataUrl } from '#lib/ocr.ts';
  import ArvoreEnvio from '#lib/painel/ArvoreEnvio.svelte';
  import CapturaItem from '#lib/painel/CapturaItem.svelte';
  import CapturaUmClique from '#lib/painel/CapturaUmClique.svelte';
  import EstadoNuvem from '#lib/EstadoNuvem.svelte';
  import type { AcoesCards } from '#lib/painel/acoes.ts';
  import InspetorTarefaCard from '#lib/painel/InspetorTarefaCard.svelte';
  import ModalCapturaAmpliada from '#lib/painel/ModalCapturaAmpliada.svelte';
  import ModalGerenciarEquipe from '#lib/painel/ModalGerenciarEquipe.svelte';
  import PainelMetricasAutomaticas from '#lib/painel/PainelMetricasAutomaticas.svelte';
  import RegrasDescartePainel from '#lib/painel/RegrasDescartePainel.svelte';
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

  // opção de classificação criada pela pessoa ("Entendi como"): fica guardada e já vale para este print
  function criarOpcaoOrigem(capId: string, nome: string)
  {
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
  }

  let dados = $state<Dados>(carregar());
  let aba = $state<'novo' | 'diario'>('novo');
  let pastaAtual = $state('DEV');
  let inicializouPasta = $state(false);
  let novaPasta = $state('');
  // vindo da Semana: "/painel?pessoa=...&semana=AAAA-MM-DD" marca os prints colados como daquela pessoa e daquela semana
  const pedidoUrl = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  const pessoaDaSemana = pedidoUrl.get('pessoa') ?? undefined;
  const semanaPedida = pedidoUrl.get('semana') ?? undefined;
  const hojeIso = agoraLocal().slice(0, 10);
  let dataRegistro = $state(semanaPedida && (hojeIso < semanaPedida || hojeIso > somarDias(semanaPedida, 4)) ? semanaPedida : hojeIso);
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
  // cards como saíram dos prints (sem ajustes) e o que foi corrigido à mão por cima deles
  let cardsBase = $state<CardSnapshot[]>([]);
  let ajustes = $state<Ajustes>({});
  let ondasLidas = $state<Onda[]>([]);
  let motivo = $state('');
  let textoFinal = $state('');
  let editouTexto = $state(false);
  let novaPessoaNome = $state('');
  let pessoaExpandidaEnvio = $state<string | null>(null);
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
  // imagens dos registros guardados ficam na nuvem: aqui elas voltam para a tela
  $effect(() =>
  {
    hidratarImagens(dados);
  });

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
  // quanto tempo cada tipo de demanda realmente levou nas demandas já concluídas deste projeto
  const modeloEstimativa = $derived(aprenderEstimativas(fotosDaPasta));
  const indiceFotoNumeros = $derived(dados.fotos.findIndex((f) => f.data === dataNumeros && (f.pasta ?? dados.prefixo) === pastaAtual));
  const fotoNumeros = $derived<Snapshot>(dados.fotos[indiceFotoNumeros] ?? { ...fotoVazia(dataNumeros), pasta: pastaAtual });
  const chavesLidas = $derived(Object.keys(totaisLidos) as ChaveTotal[]);
  const unido = $derived(unirCapturas($state.snapshot(capturas) as CapturaLida[], { motivo }));
  const comentados = $derived(capturas.filter((c) => c.comentario?.trim()).length);
  const podeSalvar = $derived(capturas.length > 0 || !!motivo.trim() || !!textoFinal.trim());
  const pessoasDaPasta = $derived(pessoasDoProjeto(dados.pessoas, [...cardsLidos, ...(fotoBase?.cards ?? [])], pastaAtual));
  const cardSelecionado = $derived(cardsLidos.find((c) => c.codigo === cardSelecionadoCodigo) ?? null);
  const indiceCapturaModal = $derived(capturas.findIndex((c) => c.id === capturaModalId));
  const metricasEnvio = $derived(calcularMetricasAutomaticasDosCards(cardsLidos, totaisLidos, dados.pessoas, modeloEstimativa));
  const metricasPastaDia = $derived(calcularMetricasAutomaticasDosCards(fotoNumeros.cards, fotoNumeros.totais, dados.pessoas, modeloEstimativa));

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
      modelo: modeloEstimativa,
    }),
  );
  const ganttEnvio = $derived(montarGanttSemana(
    analiseEnvio.filter((p) => p.total > 0),
    { semanaInicio: semanaRegistro, hoje: dataRegistro, feriados: definicoesPadrao.feriados, ordemManual: ordemManualDoProjeto(dados.filaManual, pastaAtual) },
  ));

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

  // férias, atestado e folga: a pessoa descoberta nos prints entra no cadastro junto com a ausência
  function atualizarAusencias(pessoa: Pessoa, ausencias: Ausencia[])
  {
    const lista = dados.pessoas.some((p) => p.id === pessoa.id) ? dados.pessoas : [...dados.pessoas, pessoa];
    dados.pessoas = lista.map((p) => (p.id === pessoa.id ? { ...p, ausencias } : p));
    salvar($state.snapshot(dados));
  }

  function atualizarCapacidadePessoa(pessoaId: string, valor: string)
  {
    const num = Number(valor);
    if (Number.isNaN(num) || num < 4 || num > 120) return;
    dados.pessoas = dados.pessoas.map((p) => (p.id === pessoaId ? { ...p, capacidadeHorasSemana: num } : p));
    salvar($state.snapshot(dados));
  }

  // lê o texto de um print (CSV de demandas ou texto de imagem) sem correlacionar: a ligação entre prints é feita no lote todo
  // códigos já vistos: corrigem leituras do OCR como DEV-8061 -> DEV-061
  const codigosConhecidos = $derived([...new Set(dados.fotos.flatMap((f) => f.cards.map((c) => c.codigo)))]);

  function lerConteudo(conteudo: string, origem: OrigemLeitura, pessoaId?: string)
  {
    const csv = ehCsvDeDemandas(conteudo) ? lerCsvDemandas(conteudo, { prefixo: pastaAtual, pessoas: dados.pessoas }) : undefined;
    return {
      totais: csv ? {} : lerTotais(conteudo),
      cards: (csv ? csv.cards : lerCards(conteudo, { prefixo: pastaAtual, pessoas: dados.pessoas, origem, hoje: dataRegistro, regrasDescarte: dados.regrasDescarte, codigosConhecidos }))
        // print de uma pessoa: tudo nele é dela
        .map((c) => (pessoaId ? { ...c, responsaveis: [pessoaId], responsavelEtapaAtual: pessoaId } : c)),
    };
  }

  function analisar(
    conteudo: string,
    origem: OrigemLeitura,
    totais: TotaisPainel,
    anteriores: CardSnapshot[],
    correlacionado: SaidaCapturaLote,
  )
  {
    const cards = correlacionado.cards.filter((c) => c.codigo !== '__ORFAO__');
    const ondas = lerOndas(conteudo);
    const comp = compararComAnteriores(cards, anteriores);
    const { avisos, sugestoes } = sugerirDaCaptura({ origem, totais, cards, ondas });
    if (correlacionado.pendentes > 0)
    {
      avisos.push('Este print não mostra o código do card e ainda não achei o card dele. A ordem de envio não importa: envie o print que mostra o código ou escolha o card ao lado.');
    }
    const porPessoa = agruparPorPessoa(cards, dados.pessoas).map(({ pessoa, tarefas }) => ({ pessoa, tarefas }));
    return {
      origem,
      totais,
      cards,
      ondas,
      avisos,
      sugestoes,
      naoReconhecido: linhasNaoReconhecidas(conteudo, pastaAtual, dados.regrasDescarte, cards, dados.pessoas),
      coberturaPct: coberturaDaLeitura(conteudo, pastaAtual, dados.regrasDescarte, cards, dados.pessoas).pct,
      repetidos: comp.repetidos,
      novos: comp.novos,
      porPessoa,
      cardPaiVinculado: correlacionado.cardPaiVinculado,
      confiancaVinculoPct: correlacionado.confiancaVinculoPct,
      motivoVinculo: correlacionado.motivoVinculo,
    };
  }

  function juntar(t: TotaisPainel, c: CardSnapshot[], novoT: TotaisPainel, novoC: CardSnapshot[])
  {
    const m = mesclarNaFoto({ data: dataRegistro, totais: t, cards: c }, novoT, novoC);
    const cardsConsolidados = consolidarArvoreDeCards(m.cards, modeloEstimativa);
    const auto = calcularMetricasAutomaticasDosCards(cardsConsolidados, m.totais, dados.pessoas, modeloEstimativa);
    return { totais: auto.totais, cards: cardsConsolidados };
  }

  // refaz os cards a partir do que foi lido (cardsBase), põe os ajustes manuais por cima e recalcula tempos, relações e totais
  function sincronizarTotaisAutomaticos()
  {
    const aplicados = aplicarAjustes(cardsBase, ajustes).map((c) => enriquecerCard(c, modeloEstimativa));
    cardsLidos = aplicarRelacionados(calcularRelacoesEImpactoSemana(aplicados), ajustes);
    totaisLidos = calcularMetricasAutomaticasDosCards(cardsLidos, totaisLidos, dados.pessoas, modeloEstimativa).totais;
  }

  function adicionarRegras(novas: string[])
  {
    const atualizadas = adicionarRegrasDescarte(dados.regrasDescarte, novas);
    dados.regrasDescarte = atualizadas;
    capturas = capturas.map((cap) => ({
      ...cap,
      texto: aplicarRegrasDescarte(cap.texto, atualizadas),
    }));
    salvar($state.snapshot(dados));
    if (capturas.length) recalcular();
  }

  function removerRegra(regra: string)
  {
    dados.regrasDescarte = removerRegraDescarte(dados.regrasDescarte, regra);
    salvar($state.snapshot(dados));
    if (capturas.length) recalcular();
  }

  function limparRegras()
  {
    dados.regrasDescarte = [];
    salvar($state.snapshot(dados));
    if (capturas.length) recalcular();
  }

  // o print entra na lista e tudo é refeito: assim a ordem de envio não muda o resultado
  function registrarCaptura(conteudo: string, nome: string, imagemDataUrl?: string)
  {
    const origem = detectarOrigem(conteudo);
    const textoLimpo = aplicarRegrasDescarte(conteudo, dados.regrasDescarte);
    capturas = [
      ...capturas,
      {
        id: idCurto(), nome: `${nome} · ${nomesOrigem[origem]}`, origem, texto: textoLimpo, ...(imagemDataUrl ? { imagemDataUrl } : {}), ...(pessoaDaSemana ? { pessoaId: pessoaDaSemana } : {}),
        totais: [], cards: [], ondas: 0, avisos: [], sugestoes: [], comentario: '',
      },
    ];
    recalcular();
    if (!cardSelecionadoCodigo && cardsLidos.length > 0)
    {
      cardSelecionadoCodigo = cardsLidos[0]!.codigo;
    }
  }

  function recalcular()
  {
    let t: TotaisPainel = {};
    let c: CardSnapshot[] = [];
    let o: Onda[] = [];
    const base = fotoBase?.cards ?? [];
    const leituras = new Map(capturas.map((cap) => [cap.id, lerConteudo(cap.texto, cap.origem, cap.pessoaId)]));
    const lote = correlacionarLote(
      capturas.map((cap) => ({ id: cap.id, origem: cap.origem, cards: leituras.get(cap.id)!.cards, cardPaiForcado: cap.cardPaiManual })),
      base,
      dados.pessoas,
      modeloEstimativa,
    );
    const atualizadas = new Map<string, CapturaLida>();
    for (const id of lote.ordemProcessamento)
    {
      const cap = capturas.find((x) => x.id === id)!;
      const a = analisar(cap.texto, cap.origem, leituras.get(id)!.totais, [...c, ...base], lote.porCaptura.get(id)!);
      const j = juntar(t, c, a.totais, a.cards);
      t = j.totais;
      c = j.cards;
      if (a.ondas.length) o = a.ondas;
      const { cardPaiVinculado: _antigo, confiancaVinculoPct: _conf, motivoVinculo: _motivo, ...semVinculo } = cap;
      atualizadas.set(id, {
        ...semVinculo,
        totais: Object.keys(j.totais) as ChaveTotal[],
        cards: a.cards.map((x) => x.codigo),
        ondas: a.ondas.length,
        avisos: a.avisos,
        sugestoes: a.sugestoes,
        naoReconhecido: a.naoReconhecido,
        coberturaPct: a.coberturaPct,
        repetidos: a.repetidos,
        novos: a.novos,
        porPessoa: a.porPessoa,
        ...(a.cardPaiVinculado ? { cardPaiVinculado: a.cardPaiVinculado } : {}),
        ...(a.confiancaVinculoPct !== undefined ? { confiancaVinculoPct: a.confiancaVinculoPct } : {}),
        ...(a.motivoVinculo ? { motivoVinculo: a.motivoVinculo } : {}),
      });
    }
    capturas = capturas.map((cap) => atualizadas.get(cap.id) ?? cap);
    totaisLidos = t;
    cardsBase = c;
    ondasLidas = o;
    sincronizarTotaisAutomaticos();
  }

  // tudo que a pessoa corrige à mão vai para a camada de ajustes, que sobrevive quando os prints são lidos de novo
  function aplicarAjuste(novos: Ajustes)
  {
    ajustes = novos;
    sincronizarTotaisAutomaticos();
  }

  function atualizarHorasCard(codigo: string, valor: string)
  {
    const num = Number(valor);
    if (Number.isNaN(num) || num < 0) return;
    aplicarAjuste(ajustarHoras(ajustes, codigo, num));
  }

  function atualizarCampoCard(codigo: string, parcial: Partial<CardSnapshot>)
  {
    // código corrigido à mão: a seleção acompanha o card
    if (parcial.codigo && cardSelecionadoCodigo === codigo) cardSelecionadoCodigo = parcial.codigo;
    aplicarAjuste(ajustarCampos(ajustes, codigo, parcial));
  }

  function removerCardDaLista(codigo: string)
  {
    if (cardSelecionadoCodigo === codigo) cardSelecionadoCodigo = null;
    aplicarAjuste(removerCardAjustado(ajustes, codigo));
  }

  // edição direta nos cards já guardados na foto do dia (não passam pela leitura dos prints)
  function editarCardDaFoto(codigo: string, mudar: (c: CardSnapshot) => CardSnapshot)
  {
    if (indiceFotoNumeros < 0) return;
    const foto = dados.fotos[indiceFotoNumeros]!;
    const cards = foto.cards.map((c) => (c.codigo === codigo ? mudar(c) : c));
    dados.fotos[indiceFotoNumeros] = { ...foto, cards, totais: calcularMetricasAutomaticasDosCards(cards, foto.totais, dados.pessoas, modeloEstimativa).totais };
    dados.fotos = [...dados.fotos];
    salvar($state.snapshot(dados));
  }

  function mudarEtapa(codigo: string, ordemEtapa: number, patchDe: (et: EtapaCard) => AjusteEtapa, naFotoDia = false)
  {
    if (naFotoDia && indiceFotoNumeros >= 0)
    {
      editarCardDaFoto(codigo, (c) =>
      {
        const comEtapas = c.etapas ? c : enriquecerCard(c, modeloEstimativa);
        const et = comEtapas.etapas?.find((e) => e.ordem === ordemEtapa);
        return et ? aplicarAjustes([comEtapas], ajustarEtapa({}, codigo, chaveDaEtapa(et, comEtapas.etapas!), patchDe(et)))[0]! : c;
      });
      return;
    }
    const card = cardsLidos.find((c) => c.codigo === codigo);
    const et = card?.etapas?.find((e) => e.ordem === ordemEtapa);
    if (!card || !et) return;
    aplicarAjuste(ajustarEtapa(ajustes, codigo, chaveDaEtapa(et, card.etapas!), patchDe(et)));
  }

  function alternarEtapaCard(codigo: string, ordemEtapa: number, naFotoDia = false)
  {
    mudarEtapa(codigo, ordemEtapa, (et) => ({ situacao: et.situacao === 'concluida' ? 'nao_iniciada' : 'concluida' }), naFotoDia);
  }

  function atualizarSituacaoEtapa(codigo: string, ordemEtapa: number, situacao: EtapaCard['situacao'])
  {
    mudarEtapa(codigo, ordemEtapa, () => ({ situacao }));
  }

  function atualizarDescricaoEtapa(codigo: string, ordemEtapa: number, descricao: string, naFotoDia = false)
  {
    mudarEtapa(codigo, ordemEtapa, () => ({ descricao }), naFotoDia);
  }

  function adicionarEtapaManual(codigo: string, nome: string, desc: string)
  {
    const card = cardsLidos.find((c) => c.codigo === codigo);
    if (!card) return;
    const nova: EtapaCard = {
      ordem: (card.etapas?.length ?? 0) + 1,
      nome,
      descricao: desc || `Executar etapa: ${nome}`,
      pessoa: card.responsavelEtapaAtual ?? card.responsaveis[0],
      situacao: 'nao_iniciada',
      horasEstimadas: 1.5,
      origemEtapa: 'manual',
    };
    aplicarAjuste(adicionarEtapaAjustada(ajustes, codigo, nova));
  }

  function removerEtapaCard(codigo: string, ordemEtapa: number)
  {
    const card = cardsLidos.find((c) => c.codigo === codigo);
    const et = card?.etapas?.find((e) => e.ordem === ordemEtapa);
    if (!card || !et) return;
    aplicarAjuste(removerEtapaAjustada(ajustes, codigo, et, card.etapas!));
  }

  function vincularCardRelacionado(codigo: string, outroCodigo: string)
  {
    if (!outroCodigo || codigo === outroCodigo) return;
    aplicarAjuste(vincularAjustado(vincularAjustado(ajustes, codigo, outroCodigo), outroCodigo, codigo));
  }

  function desvincularCardRelacionado(codigo: string, outroCodigo: string)
  {
    aplicarAjuste(desvincularAjustado(desvincularAjustado(ajustes, codigo, outroCodigo), outroCodigo, codigo));
  }

  // a ordem da fila de uma pessoa no cronograma, escolhida arrastando as barras
  function reordenarFila(pessoaId: string, codigos: string[])
  {
    dados.filaManual = guardarOrdem(dados.filaManual, pastaAtual, pessoaId, codigos);
    salvar($state.snapshot(dados));
  }

  // a árvore de tarefas e o inspetor pedem as mudanças por aqui
  const acoesCards: AcoesCards = {
    atualizarHoras: atualizarHorasCard,
    atualizarCampo: atualizarCampoCard,
    alternarEtapa: (codigo, ordem) => alternarEtapaCard(codigo, ordem),
    atualizarSituacaoEtapa,
    atualizarDescricaoEtapa: (codigo, ordem, descricao) => atualizarDescricaoEtapa(codigo, ordem, descricao),
    adicionarEtapa: adicionarEtapaManual,
    removerEtapa: removerEtapaCard,
    vincular: vincularCardRelacionado,
    desvincular: desvincularCardRelacionado,
    reordenarFila,
  };

  // roda o OCR outra vez sobre a imagem guardada, sem precisar enviar de novo
  async function relerImagem(id: string)
  {
    const cap = capturas.find((c) => c.id === id);
    if (!cap?.imagemDataUrl) return;
    aviso = 'Lendo a imagem de novo...';
    progresso = 0;
    try
    {
      const blob = await (await fetch(cap.imagemDataUrl)).blob();
      const texto = await lerImagem(blob, (p) => (progresso = p), pastaAtual || dados.prefixo);
      cap.texto = aplicarRegrasDescarte(texto, dados.regrasDescarte);
      cap.origem = detectarOrigem(texto);
      capturas = [...capturas];
      recalcular();
      aviso = 'Imagem lida de novo. Confira abaixo.';
    }
    catch (erro)
    {
      aviso = `Não consegui ler a imagem de novo: ${String(erro)}`;
    }
    finally
    {
      progresso = null;
    }
  }

  function removerCaptura(id: string)
  {
    const saindo = capturas.find((c) => c.id === id);
    if (saindo && cardSelecionadoCodigo && saindo.cards.includes(cardSelecionadoCodigo)) cardSelecionadoCodigo = null;
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
    cardsBase = [];
    cardsLidos = [];
    ajustes = {};
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

  <div class="nuvem-painel"><EstadoNuvem /></div>
  {#if pessoaDaSemana}
    <p class="aviso">Os prints que você colar agora são de <b>{dados.pessoas.find((p) => p.id === pessoaDaSemana)?.nome ?? pessoaDaSemana}</b> e entram no registro de {dataRegistro.split('-').reverse().join('/')}{semanaPedida ? `, na semana de ${semanaPedida.split('-').reverse().join('/')}` : ''}. Escreva o que a pessoa vai fazer e por quê em cada print e salve o registro.</p>
  {/if}
  {#if aviso}<p class="aviso">{aviso}</p>{/if}

  <CapturaUmClique receber={(texto, url) => { aba = 'novo'; registrarCaptura(texto, 'Painel em 1 clique'); aviso = `Página do painel recebida (${url}). Confira a leitura e salve o registro.`; }} />

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
          <label class="botao mini">Escolher imagens <input type="file" accept="image/*" multiple hidden onchange={(e) => { const arquivos = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ''; lerImagens(arquivos); }} /></label>
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
              <label class="botao mini">＋ Imagens <input type="file" accept="image/*" multiple hidden onchange={(e) => { const arquivos = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ''; lerImagens(arquivos); }} /></label>
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

    <RegrasDescartePainel
      regras={dados.regrasDescarte ?? []}
      prefixo={pastaAtual}
      aoAdicionarRegras={adicionarRegras}
      aoRemoverRegra={removerRegra}
      aoLimparRegras={limparRegras}
    />

    {#if capturas.length}
      <section class="cartao passo" class:feito={comentados > 0}>
        <h2><span class="num">{comentados ? '✓' : '2'}</span> Árvore de correlação e conferência dos prints <small>({comentados}/{capturas.length} comentados)</small></h2>
        <p class="dica">Clique em qualquer tarefa para abrir as etapas ticáveis, anotações e impacto à direita (ou ampliar em modal). Clique no print para ampliar a imagem.</p>

        {#if cardsLidos.length}
          <ArvoreEnvio {cardsLidos} {pessoasDaPasta} {pastaAtual} {analiseEnvio} gantt={ganttEnvio} acoes={acoesCards} bind:selecionadoCodigo={cardSelecionadoCodigo} bind:pessoaExpandidaEnvio aoAmpliarModal={() => (modalCardAberto = true)} />
        {/if}

        {#each capturas as cap, idx (cap.id)}
          <CapturaItem {cap} indice={idx} {cardsLidos} {nomesOrigemPadrao} origensPersonalizadas={dados.origensPersonalizadas} {obterNomeOrigem} aoAmpliar={() => (capturaModalId = cap.id)} aoRecalcular={recalcular} aoRemover={() => removerCaptura(cap.id)} aoCriarOpcao={(nome) => criarOpcaoOrigem(cap.id, nome)} aoDescartarTexto={(l) => adicionarRegras([l])} pessoas={dados.pessoas} aoRelerImagem={() => relerImagem(cap.id)} />
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
            <TabelaCards cards={cardsLidos} pessoas={pessoasDaPasta} aoEditar={atualizarCampoCard} aoRemover={removerCardDaLista} />
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
    aoAtualizarAusencias={atualizarAusencias}
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


  .barra-equipe-projeto { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 12px; background: var(--superficie); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); }
  .pilula-pessoa-item { display: inline-flex; align-items: center; gap: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--texto); padding: 2px 8px; }
  .btn-nome-pilula { border: none; background: none; color: var(--texto); padding: 0; font-size: 0.8rem; cursor: var(--cursor-clique); }
  .btn-nome-pilula:hover { color: var(--marca); }
  .btn-remover-pilula { border: none; background: none; color: var(--suave); padding: 0 2px; font-size: 0.9rem; line-height: 1; cursor: var(--cursor-clique); }
  .btn-remover-pilula:hover { color: var(--vermelho); }
  .add-pessoa-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
  .add-pessoa-inline input { font-size: 0.8rem; padding: 3px 8px; width: 190px; }
  .add-pessoa-inline button { font-size: 0.78rem; padding: 3px 8px; }
  .btn-gerenciar-org { background: var(--superficie-2); border: 1px solid var(--marca); color: var(--marca); font-weight: 600; }



  .grade-checklist-dia { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; margin: 10px 0; }
  .card-checklist-dia { background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .assunto-tarefa { color: var(--texto); line-height: 1.35; font-weight: 500; }
  .fontes-vetor { font-family: var(--fonte-maquina); font-size: 0.72rem; color: var(--suave); }
  .badge-status-card { font-family: var(--fonte-maquina); font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--suave); margin-left: 4px; }
  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }
  .etapas-filhas-interativas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; }
  .etapas-filhas-interativas li { padding: 4px 6px; border-radius: 4px; background: var(--superficie); border: 1px solid var(--borda); }
  .etapas-filhas-interativas li.etapa-concluida { opacity: 0.75; border-left: 3px solid var(--verde); }
  .check-etapa-linha { display: flex; align-items: center; gap: 6px; cursor: var(--cursor-clique); }
  .input-desc-etapa { width: calc(100% - 22px); margin: 3px 0 0 22px; font-size: 0.74rem; padding: 2px 6px; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(8, 12, 20, 0.76); backdrop-filter: blur(3px); z-index: 900; display: grid; place-items: center; padding: 18px; overflow-y: auto; }
  .modal-janela { background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: var(--raio); padding: 18px; width: 100%; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); }
  .modal-medio { max-width: 780px; }


  .acoes-guardar { gap: 12px; }
  .botao-pdf-destaque { background: var(--marca-clara); border: 1.5px solid var(--marca); color: var(--marca); font-weight: 700; padding: var(--size-2) var(--size-4); cursor: var(--cursor-clique); }
  .botao-pdf-destaque:hover:not(:disabled) { background: var(--marca); color: var(--sobre-marca); }
  .mini { font-size: 0.78rem; display: flex; gap: 6px; align-items: center; }
  .chips { margin: 8px 0; }
  .pilula.novo { background: var(--verde-fundo); color: var(--verde); }
  .pilula.repetido { background: var(--amarelo-fundo); color: var(--amarelo); }
  .alerta { color: var(--vermelho); font-size: 0.86rem; margin: 4px 0; }
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
  @media (max-width: 800px) { .duas { grid-template-columns: 1fr; } }
</style>
