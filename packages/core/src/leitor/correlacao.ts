import type { CapturaLida, CardSnapshot, EtapaCard, Pessoa, Ritmo, TotaisPainel } from '../tipos';
import { juntarCard } from './cards';
import { semAcento } from './normalizar';

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem',
  'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'as', 'os', 'que', 'se', 'entao', 'como', 'mais',
  'menos', 'muito', 'ja', 'esta', 'estao', 'ser', 'foi', 'sao', 'ter', 'tem', 'ou', 'e', 'o', 'a',
  'ali', 'isso', 'essa', 'esse', 'pelo', 'pela', 'dentro', 'quando', 'onde',
]);

// Transforma um texto em vetor esparso de termos e radicais (resistente a truncamento e pequenos ruídos de OCR)
export function vetorizarTexto(texto: string): Map<string, number>
{
  const limpo = semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const vetor = new Map<string, number>();
  if (!limpo) return vetor;

  for (const palavra of limpo.split(' '))
  {
    if (palavra.length < 2 || STOPWORDS.has(palavra)) continue;
    vetor.set(palavra, (vetor.get(palavra) ?? 0) + 1);
    // radical de 5 letras para casar variações ("validacao" / "validacoes", "credenciada" / "credenciadas")
    if (palavra.length >= 5)
    {
      const rad = `#${palavra.slice(0, 5)}`;
      vetor.set(rad, (vetor.get(rad) ?? 0) + 0.6);
    }
  }
  return vetor;
}

// Similaridade de cosseno entre dois vetores de texto (0 a 1)
export function similaridadeCosseno(textoA: string, textoB: string): number
{
  const va = vetorizarTexto(textoA);
  const vb = vetorizarTexto(textoB);
  if (!va.size || !vb.size) return 0;

  let prod = 0;
  let normA = 0;
  let normB = 0;

  for (const [k, v] of va)
  {
    normA += v * v;
    const b = vb.get(k);
    if (b !== undefined) prod += v * b;
  }
  for (const v of vb.values()) normB += v * v;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? prod / denom : 0;
}

// Combina similaridade de cosseno com verificação de prefixo truncado (ex.: Imagem 1 com "..." vs Imagem 2 completa)
export function similaridadeTextos(curtoOuTruncado: string, longoOuCompleto: string): number
{
  const a = semAcento(curtoOuTruncado).toLowerCase().replace(/\.{2,}$/, '').replace(/\s+/g, ' ').trim();
  const b = semAcento(longoOuCompleto).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!a || !b) return 0;

  // Se o início do texto completo contém o texto truncado da tabela
  const prefixo = a.slice(0, Math.min(a.length, 45));
  if (prefixo.length >= 15 && b.includes(prefixo))
  {
    return 0.95;
  }
  return similaridadeCosseno(a, b);
}

// Extrai um resumo curto do assunto principal da tarefa sem reticências desnecessárias
export function extrairAssunto(card: Pick<CardSnapshot, 'titulo' | 'descricaoCompleta' | 'sistema'>): string
{
  const base = (card.descricaoCompleta || card.titulo || '').trim();
  if (!base) return card.sistema || 'Demanda do painel';

  const primeiraLinha = base.split(/\r?\n/)[0]!.trim();
  // Se começa com "Assunto: detalhe", destaca o assunto e o complemento principal
  const atePonto = primeiraLinha.split(/(?<=[.!?;])\s+/)[0] ?? primeiraLinha;
  const limpo = atePonto.replace(/\.{2,}$/, '').trim();
  return limpo.length > 78 ? `${limpo.slice(0, 75).trim()}...` : limpo;
}

// Estima o tempo em horas de uma demanda com base em prioridade, regras do pedido e etapas (quando não definido manualmente)
export function estimarHorasCard(card: CardSnapshot): number
{
  if (card.horasEstimadas !== undefined && card.horasEstimadas > 0) return card.horasEstimadas;
  if (card.situacao === 'concluido' || semAcento(card.statusCard ?? '').toLowerCase() === 'resolvido')
  {
    return 0;
  }

  // Base pela criticidade / prioridade
  let base = 4;
  const prio = semAcento(card.prioridadeCard ?? '').toLowerCase();
  if (card.criticidade === 3 || prio === 'critica' || prio === 'urgente') base = 7.5;
  else if (card.criticidade === 2 || prio === 'alta') base = 5.5;
  else if (prio === 'baixa') base = 2.5;

  // Bônus por regras condicionais ("se ... então ...") presentes na descrição completa da Imagem 2
  const textoRegras = card.descricaoCompleta || card.titulo || '';
  const condicoes = textoRegras.match(/\bse\s+[a-zà-ÿ0-9\s/]+,\s*ent[aã]o\b/gi)?.length ?? 0;
  base += Math.min(3.5, condicoes * 0.8);

  // Ajuste pelas etapas da Imagem 3 (ou etapas ticadas pela supervisora)
  if (card.etapas && card.etapas.length > 0)
  {
    const temAlgumaConcluida = card.etapas.some((e) => e.situacao === 'concluida');
    const ehDoPrint = card.etapas.some((e) => e.origemEtapa === 'print');
    if (temAlgumaConcluida || ehDoPrint)
    {
      const restantes = card.etapas.filter((e) => e.situacao !== 'concluida').length;
      const total = card.etapas.length;
      if (total > 0)
      {
        if (restantes === 0) return 0;
        const proporcaoRestante = restantes / total;
        base = Math.max(1.5, base * proporcaoRestante);
      }
    }
  }
  else if (card.etapasTotal && card.etapasConcluidas !== undefined && card.etapasTotal > 0)
  {
    const restantes = Math.max(0, card.etapasTotal - card.etapasConcluidas);
    base = Math.max(1.5, base * (restantes / card.etapasTotal));
  }

  return Math.round(base * 2) / 2;
}

// Gera ou enriquece as etapas do card descrevendo automaticamente o que a pessoa vai fazer em cada etapa
export function gerarEtapasAutomaticasCard(card: CardSnapshot): EtapaCard[]
{
  const textoBase = (card.descricaoCompleta || card.titulo || card.sistema || 'Demanda do painel').trim();
  const partes = textoBase
    .split(/(?:;\s*|\r?\n|\.\s+)/)
    .map((p) => p.replace(/\.{2,}$/, '').trim())
    .filter((p) => p.length > 3);

  const dono = card.responsavelEtapaAtual ?? card.responsaveis[0];
  const stNorm = semAcento(card.statusCard ?? '').toLowerCase();
  const concluido = card.situacao === 'concluido' || stNorm === 'resolvido';
  const emAndamento = card.situacao === 'em_execucao' || stNorm === 'em andamento';

  // Se já tem etapas (ex.: vindas da Imagem 3 ou adicionadas manualmente), preenche a descrição ("o que vai fazer") se estiver vazia
  if (card.etapas && card.etapas.length > 0)
  {
    const horasTotal = card.horasEstimadas ?? 4;
    const hPorEtapa = Math.max(0.5, Math.round((horasTotal / card.etapas.length) * 2) / 2);
    return card.etapas.map((et, idx) =>
    {
      if (et.descricao?.trim()) return { ...et, horasEstimadas: et.horasEstimadas ?? hPorEtapa };
      let descAuto = '';
      if (idx === 0)
      {
        descAuto = partes[0]
          ? `Validar escopo e regras iniciais: ${partes[0]}`
          : `Analisar requisitos de ${card.codigo} (${et.nome}).`;
      }
      else if (idx === card.etapas!.length - 1 && card.etapas!.length > 1)
      {
        const ultimaParte = partes.length > 2 ? partes.slice(2).join('; ') : '';
        descAuto = ultimaParte
          ? `Validar entrega final (${ultimaParte}) e concluir card no painel.`
          : `Revisar funcionamento em ${card.sistema || 'sistema'} e concluir entrega.`;
      }
      else
      {
        const meio = partes.length > 1 ? partes.slice(1, Math.max(2, partes.length - (card.etapas!.length > 2 ? 1 : 0))).join('; ') : partes[0] ?? textoBase;
        descAuto = `Executar ${et.nome.toLowerCase()}: ${meio}`;
      }
      return {
        ...et,
        descricao: descAuto,
        horasEstimadas: et.horasEstimadas ?? hPorEtapa,
        origemEtapa: et.origemEtapa ?? 'print',
      };
    });
  }

  // Se o card veio apenas da Lista (Imagem 1) ou Pedido (Imagem 2), cria as etapas automaticamente com descrição detalhada
  const horasCard = card.horasEstimadas ?? 4;
  const h1 = Math.max(0.5, Math.round(horasCard * 0.25 * 2) / 2);
  const h2 = Math.max(1, Math.round(horasCard * 0.5 * 2) / 2);
  const h3 = Math.max(0.5, Math.round(Math.max(0.5, horasCard - h1 - h2) * 2) / 2);

  const desc1 = partes[0]
    ? `Levantamento e validação: ${partes[0]}`
    : `Mapear requisito de ${textoBase.slice(0, 70)}`;
  const desc2 = partes.length > 1
    ? `Implementar regras: ${partes.slice(1).join('; ')}`
    : `Desenvolver e aplicar ajuste: ${textoBase}`;
  const desc3 = `Testar comportamento em ${card.sistema || 'Kitu Sistema'} e homologar conclusão na semana.`;

  return [
    {
      ordem: 1,
      nome: 'Validação dos requisitos',
      descricao: desc1,
      pessoa: dono,
      situacao: concluido ? 'concluida' : emAndamento ? 'rodando' : 'nao_iniciada',
      horasEstimadas: h1,
      origemEtapa: 'automatica',
    },
    {
      ordem: 2,
      nome: 'Implementação',
      descricao: desc2,
      pessoa: dono,
      situacao: concluido ? 'concluida' : 'nao_iniciada',
      horasEstimadas: h2,
      origemEtapa: 'automatica',
    },
    {
      ordem: 3,
      nome: 'Validação final e conclusão',
      descricao: desc3,
      pessoa: dono,
      situacao: concluido ? 'concluida' : 'nao_iniciada',
      horasEstimadas: h3,
      origemEtapa: 'automatica',
    },
  ];
}

// Deriva o ritmo do card automaticamente quando o print não traz coluna explícita de ritmo
export function derivarRitmoCard(card: CardSnapshot): Ritmo
{
  if (card.ritmoPainel) return card.ritmoPainel;
  const stNorm = semAcento(card.statusCard ?? '').toLowerCase();
  if (card.situacao === 'concluido' || stNorm === 'resolvido') return 'no_ritmo';
  if (card.situacao === 'atrasado') return 'atrasado';

  const maxRodando = Math.max(0, ...(card.etapas?.map((e) => e.tempoRodandoHoras ?? 0) ?? [0]));
  const prioNorm = semAcento(card.prioridadeCard ?? '').toLowerCase();

  if (maxRodando >= 15 || ((prioNorm === 'critica' || prioNorm === 'urgente') && stNorm === 'novo'))
  {
    return 'atrasado';
  }
  if (maxRodando >= 8 || prioNorm === 'alta' || prioNorm === 'critica' || (card.horasEstimadas ?? 0) >= 5.5)
  {
    return 'em_risco';
  }
  return 'no_ritmo';
}

export function enriquecerCard(card: CardSnapshot): CardSnapshot
{
  const assunto = card.assunto ?? extrairAssunto(card);
  const horasEstimadas = card.horasEstimadas ?? estimarHorasCard(card);
  const comHoras: CardSnapshot = {
    ...card,
    assunto,
    horasEstimadas,
  };
  const etapas = gerarEtapasAutomaticasCard(comHoras);
  const etapasConcluidas = etapas.filter((e) => e.situacao === 'concluida').length;
  const etapasTotal = etapas.length;
  const ritmoPainel = derivarRitmoCard({ ...comHoras, etapas });

  return {
    ...comHoras,
    etapas,
    etapasConcluidas,
    etapasTotal,
    ritmoPainel,
  };
}

export interface ResultadoCorrelacao
{
  cards: CardSnapshot[];
  cardPaiVinculado?: string | undefined;
  confiancaVinculoPct?: number | undefined;
  motivoVinculo?: string | undefined;
}

function normalizarPessoaId(idOuNome: string | undefined, pessoas: Pessoa[]): string | undefined
{
  if (!idOuNome) return undefined;
  const p = pessoas.find((x) => x.id === idOuNome || semAcento(x.nome).toLowerCase() === semAcento(idOuNome).toLowerCase());
  return p ? p.id : semAcento(idOuNome).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Correlaciona os cards de um print recém-enviado (ex.: Imagem 2 ou Imagem 3) com a árvore de cards existentes (ex.: Imagem 1)
export function correlacionarCapturaComArvore(
  cardsDaCaptura: CardSnapshot[],
  cardsExistentes: CardSnapshot[],
  capturasAnteriores: CapturaLida[],
  pessoas: Pessoa[],
  cardPaiForcado?: string,
): ResultadoCorrelacao
{
  if (!cardsDaCaptura.length || !cardsExistentes.length)
  {
    return { cards: cardsDaCaptura.map(enriquecerCard) };
  }

  let cardPaiVinculado: string | undefined;
  let confiancaVinculoPct: number | undefined;
  let motivoVinculo: string | undefined;

  const resultado: CardSnapshot[] = [];

  for (const card of cardsDaCaptura)
  {
    // Se o usuário escolheu manualmente o card pai para este print
    if (cardPaiForcado && (card.codigo === '__ORFAO__' || cardsDaCaptura.length === 1))
    {
      const paiManual = cardsExistentes.find((c) => c.codigo === cardPaiForcado);
      if (paiManual)
      {
        cardPaiVinculado = paiManual.codigo;
        confiancaVinculoPct = 100;
        motivoVinculo = `Vinculado a ${paiManual.codigo}`;
        resultado.push(enriquecerCard({ ...card, codigo: paiManual.codigo }));
        continue;
      }
    }

    // Caso 1: O print já traz o código explícito (ex.: DEV-274 na Imagem 2) e ele existe na lista pai (Imagem 1)
    if (card.codigo !== '__ORFAO__')
    {
      const paiDireto = cardsExistentes.find((c) => c.codigo === card.codigo);
      if (paiDireto && cardsDaCaptura.length === 1)
      {
        cardPaiVinculado = paiDireto.codigo;
        confiancaVinculoPct = 99;
        const partes = [
          card.descricaoCompleta ? 'descrição completa do pedido' : '',
          card.etapas?.length ? `${card.etapas.length} etapas` : '',
        ].filter(Boolean).join(' e ');
        motivoVinculo = `Código ${paiDireto.codigo} identificado (${partes || 'detalhes mesclados'})`;
      }
      resultado.push(enriquecerCard(card));
      continue;
    }

    // Caso 2: Print órfão (ex.: Imagem 3 de Etapas sem o código DEV-274 no recorte, ou recorte só do texto do pedido)
    const respOrfao = normalizarPessoaId(card.responsavelEtapaAtual ?? card.responsaveis[0], pessoas);
    const temEtapaRodando = card.etapas?.some((e) => e.situacao === 'rodando') ?? false;
    const textoOrfao = card.descricaoCompleta || card.titulo || '';

    // Verifica qual foi o último card único aberto nas capturas anteriores (contexto sequencial da árvore)
    const ultimaCapturaCard = [...capturasAnteriores].reverse().find((cap) => cap.cards.length === 1 || cap.cardPaiVinculado);
    const codigoUltimoCardSequencia = ultimaCapturaCard?.cardPaiVinculado ?? ultimaCapturaCard?.cards[0];

    let melhorPai: CardSnapshot | undefined;
    let melhorScore = -999;
    let motivosMelhor: string[] = [];

    for (const candidato of cardsExistentes)
    {
      if (candidato.codigo === '__ORFAO__') continue;
      let score = 0;
      const motivos: string[] = [];

      // 1) Similaridade vetorial de texto (se o órfão tiver texto de pedido)
      if (textoOrfao && (candidato.titulo || candidato.descricaoCompleta))
      {
        const sim = similaridadeTextos(candidato.titulo ?? '', textoOrfao);
        if (sim >= 0.35)
        {
          score += sim * 75;
          motivos.push(`similaridade de texto (${Math.round(sim * 100)}%)`);
        }
      }

      // 2) Sequência imediata na árvore de upload (Vetor A -> Vetor B1 -> Vetor B2)
      if (codigoUltimoCardSequencia && candidato.codigo === codigoUltimoCardSequencia)
      {
        score += 42;
        motivos.push(`sequência direta de ${candidato.codigo}`);
      }

      // 3) Compatibilidade de responsável
      const respCand = normalizarPessoaId(candidato.responsavelEtapaAtual ?? candidato.responsaveis[0], pessoas);
      if (respOrfao && respCand)
      {
        if (respOrfao === respCand)
        {
          score += 36;
          const nomeP = pessoas.find((p) => p.id === respCand)?.nome ?? respCand;
          motivos.push(`mesmo responsável (${nomeP})`);
        }
        else
        {
          score -= 45;
        }
      }

      // 4) Consistência de status (Etapas rodando -> Card "Em andamento", nunca "Resolvido")
      const statusCandNorm = semAcento(candidato.statusCard ?? '').toLowerCase();
      if (temEtapaRodando)
      {
        if (statusCandNorm === 'em andamento' || candidato.situacao === 'em_execucao')
        {
          score += 28;
          motivos.push('status Em andamento compatível com etapas rodando');
        }
        else if (statusCandNorm === 'resolvido' || candidato.situacao === 'concluido')
        {
          score -= 60;
        }
      }

      if (score > melhorScore)
      {
        melhorScore = score;
        melhorPai = candidato;
        motivosMelhor = motivos;
      }
    }

    if (melhorPai && melhorScore >= 25)
    {
      cardPaiVinculado = melhorPai.codigo;
      confiancaVinculoPct = Math.min(98, Math.max(62, Math.round(melhorScore)));
      motivoVinculo = `Correlacionado a ${melhorPai.codigo}: ${motivosMelhor.join(', ')}`;
      resultado.push(enriquecerCard({ ...card, codigo: melhorPai.codigo }));
    }
    else
    {
      resultado.push(enriquecerCard(card));
    }
  }

  return {
    cards: resultado,
    ...(cardPaiVinculado ? { cardPaiVinculado } : {}),
    ...(confiancaVinculoPct !== undefined ? { confiancaVinculoPct } : {}),
    ...(motivoVinculo ? { motivoVinculo } : {}),
  };
}

// Calcula relações entre tarefas da semana (mesmo assunto/frente ou sequência do mesmo responsável) e o impacto entre etapas futuras
export function calcularRelacoesEImpactoSemana(cards: CardSnapshot[]): CardSnapshot[]
{
  return cards.map((card) =>
  {
    const textoA = `${card.assunto ?? ''} ${card.descricaoCompleta ?? card.titulo ?? ''}`.trim();
    const donoA = card.responsavelEtapaAtual ?? card.responsaveis[0];
    const relacionadosAuto = new Set<string>(card.cardsRelacionados ?? []);
    const motivosRelacao: string[] = [];

    for (const outro of cards)
    {
      if (outro.codigo === card.codigo || outro.codigo === '__ORFAO__') continue;
      const textoB = `${outro.assunto ?? ''} ${outro.descricaoCompleta ?? outro.titulo ?? ''}`.trim();
      const sim = similaridadeCosseno(textoA, textoB);
      if (sim >= 0.22)
      {
        relacionadosAuto.add(outro.codigo);
        motivosRelacao.push(`${outro.codigo} (assunto semelhante: ${Math.round(sim * 100)}%)`);
      }
    }

    // Fila do mesmo responsável na semana: verifica quantas demandas futuras dependem da conclusão desta
    const filaMesmoDono = donoA
      ? cards.filter((c) => c.codigo !== card.codigo && (c.responsavelEtapaAtual ?? c.responsaveis[0]) === donoA && c.situacao !== 'concluido')
      : [];

    if (relacionadosAuto.size === 0 && filaMesmoDono.length > 0)
    {
      relacionadosAuto.add(filaMesmoDono[0]!.codigo);
    }

    const horasRestantes = card.situacao === 'concluido' ? 0 : (card.horasEstimadas ?? 4);
    const etapasRestantes = card.etapas?.filter((e) => e.situacao !== 'concluida').length ?? 0;

    let impacto = card.impactoSemana;
    if (!impacto)
    {
      if (card.situacao === 'concluido' || semAcento(card.statusCard ?? '').toLowerCase() === 'resolvido')
      {
        impacto = `Concluído. Libera janela na semana para ${filaMesmoDono.length ? filaMesmoDono.slice(0, 2).map((c) => c.codigo).join(', ') : 'novas demandas'}.`;
      }
      else if (motivosRelacao.length > 0)
      {
        impacto = `Compartilha contexto técnico com ${motivosRelacao.slice(0, 2).join(' e ')}. Atraso nas ${etapasRestantes} etapas (~${horasRestantes}h) impacta diretamente essas entregas na semana.`;
      }
      else if (filaMesmoDono.length > 0)
      {
        const codigosFila = filaMesmoDono.slice(0, 3).map((c) => c.codigo).join(', ');
        impacto = `Possui ${etapasRestantes} etapa(s) ativa(s) (~${horasRestantes}h). Qualquer demora desloca o início de ${codigosFila} (${filaMesmoDono.length} na fila da pessoa).`;
      }
      else
      {
        impacto = `Demanda isolada na semana (~${horasRestantes}h em ${etapasRestantes} etapas), sem bloqueio direto sobre outros cards.`;
      }
    }

    return {
      ...card,
      cardsRelacionados: [...relacionadosAuto],
      impactoSemana: impacto,
    };
  });
}

// Consolida uma lista de cards mesclando pais e filhos pelo código e enriquecendo assunto, etapas, relações e horas estimadas
export function consolidarArvoreDeCards(cards: CardSnapshot[]): CardSnapshot[]
{
  const mapa = new Map<string, CardSnapshot>();
  for (const c of cards)
  {
    if (c.codigo === '__ORFAO__') continue;
    const existente = mapa.get(c.codigo);
    const unido = existente ? juntarCard(existente, c) : c;
    mapa.set(c.codigo, enriquecerCard(unido));
  }
  return calcularRelacoesEImpactoSemana([...mapa.values()]);
}

export type CriterioOrdenacaoCards = 'prioridade_maior' | 'card_maior' | 'card_menor' | 'nomes_parecidos' | 'datas_proximas';

function extrairNumeroCodigo(codigo: string): number
{
  const m = codigo.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pesoPrioridade(card: CardSnapshot): number
{
  if (card.situacao === 'concluido' || semAcento(card.statusCard ?? '').toLowerCase() === 'resolvido') return 0;
  const p = semAcento(card.prioridadeCard ?? '').toLowerCase();
  if (card.criticidade === 3 || p === 'critica' || p === 'urgente') return 4;
  if (card.criticidade === 2 || p === 'alta') return 3;
  if (p === 'media') return 2;
  if (p === 'baixa') return 1;
  return 2;
}

// Organiza os cards por prioridade (maior -> menor), código (DEV-xxx próximo), assuntos parecidos ou datas próximas
export function ordenarCardsResumidos(cards: CardSnapshot[], criterio: CriterioOrdenacaoCards): CardSnapshot[]
{
  const copia = [...cards];
  if (criterio === 'card_maior')
  {
    return copia.sort((a, b) => extrairNumeroCodigo(b.codigo) - extrairNumeroCodigo(a.codigo));
  }
  if (criterio === 'card_menor')
  {
    return copia.sort((a, b) => extrairNumeroCodigo(a.codigo) - extrairNumeroCodigo(b.codigo));
  }
  if (criterio === 'datas_proximas')
  {
    const dataDe = (c: CardSnapshot) => c.vencimento ?? c.previsao ?? c.planejadoPara ?? c.abertura ?? '9999-12-31';
    return copia.sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || extrairNumeroCodigo(b.codigo) - extrairNumeroCodigo(a.codigo));
  }
  if (criterio === 'nomes_parecidos')
  {
    // Agrupa guloso por similaridade de cosseno do assunto/título para deixar nomes e temas parecidos lado a lado
    const restantes = [...copia].sort((a, b) => (a.assunto ?? a.titulo ?? '').localeCompare(b.assunto ?? b.titulo ?? ''));
    const resultado: CardSnapshot[] = [];
    while (restantes.length > 0)
    {
      const atual = restantes.shift()!;
      resultado.push(atual);
      const txtAtual = `${atual.assunto ?? ''} ${atual.descricaoCompleta ?? atual.titulo ?? ''}`;
      restantes.sort((a, b) =>
      {
        const simA = similaridadeCosseno(txtAtual, `${a.assunto ?? ''} ${a.descricaoCompleta ?? a.titulo ?? ''}`);
        const simB = similaridadeCosseno(txtAtual, `${b.assunto ?? ''} ${b.descricaoCompleta ?? b.titulo ?? ''}`);
        return simB - simA;
      });
    }
    return resultado;
  }
  // 'prioridade_maior' (padrão: do maior para o menor em prioridade, risco e horas estipuladas)
  return copia.sort((a, b) =>
  {
    const diffPrio = pesoPrioridade(b) - pesoPrioridade(a);
    if (diffPrio !== 0) return diffPrio;
    const diffHoras = (b.horasEstimadas ?? 0) - (a.horasEstimadas ?? 0);
    if (diffHoras !== 0) return diffHoras;
    return extrairNumeroCodigo(b.codigo) - extrairNumeroCodigo(a.codigo);
  });
}

export interface PontoGraficoLinhaCard
{
  codigo: string;
  assunto: string;
  prioridade: string;
  horasEstimadas: number;
  horasRodando: number;
  progressoEtapasPct: number;
  ritmo: Ritmo;
  destaqueDemora: boolean;
}

export interface GargaloDemoraCard
{
  codigo: string;
  assunto: string;
  responsavel?: string | undefined;
  etapaCritica: string;
  horas: number;
  motivo: string;
  prioridade: string;
}

export interface MetricasAutomaticasPasta
{
  totais: TotaisPainel;
  mediaHorasPorCard: number;
  totalHorasEstipuladas: number;
  totalHorasRodando: number;
  etapasConcluidasCount: number;
  etapasTotalCount: number;
  cardsPorPrioridade: CardSnapshot[];
  gargalosDemora: GargaloDemoraCard[];
  pontosDeAtencao: string[];
  serieGraficoLinha: PontoGraficoLinhaCard[];
}

// Calcula automaticamente todos os indicadores (em risco, média, tempo, etapas), gargalos de demora e série para gráfico em linha
export function calcularMetricasAutomaticasDosCards(
  cardsBrutos: CardSnapshot[],
  totaisManuais: TotaisPainel = {},
  pessoas: Pessoa[] = [],
): MetricasAutomaticasPasta
{
  const cards = cardsBrutos.map(enriquecerCard);
  const total = cards.length;

  const concluidos = cards.filter(
    (c) =>
      c.situacao === 'concluido' ||
      semAcento(c.statusCard ?? '').toLowerCase() === 'resolvido' ||
      (c.etapas && c.etapas.length > 0 && c.etapas.every((e) => e.situacao === 'concluida')),
  ).length;

  const emAndamento = cards.filter(
    (c) =>
      c.situacao !== 'concluido' &&
      (c.situacao === 'em_execucao' ||
        semAcento(c.statusCard ?? '').toLowerCase() === 'em andamento' ||
        c.etapas?.some((e) => e.situacao === 'rodando')),
  ).length;

  const aindaPlanejado = Math.max(0, total - concluidos - emAndamento);
  const comEtapaRodando = cards.filter((c) => c.etapas?.some((e) => e.situacao === 'rodando')).length;

  const ativos = cards.filter((c) => c.situacao !== 'concluido' && semAcento(c.statusCard ?? '').toLowerCase() !== 'resolvido');
  const ritmoAtrasadas = ativos.filter((c) => derivarRitmoCard(c) === 'atrasado').length;
  const ritmoEmRisco = ativos.filter((c) => derivarRitmoCard(c) === 'em_risco').length;
  const ritmoNoRitmo = Math.max(0, ativos.length - ritmoAtrasadas - ritmoEmRisco);

  let etapasConcluidasCount = 0;
  let etapasTotalCount = 0;
  const temposEtapasMin: number[] = [];
  let totalHorasEstipuladas = 0;
  let totalHorasRodando = 0;

  for (const c of cards)
  {
    const hEst = c.horasEstimadas ?? estimarHorasCard(c);
    totalHorasEstipuladas += hEst;
    const etapas = c.etapas ?? [];
    etapasTotalCount += etapas.length;
    etapasConcluidasCount += etapas.filter((e) => e.situacao === 'concluida').length;

    for (const et of etapas)
    {
      if (et.tempoRodandoHoras !== undefined && et.tempoRodandoHoras > 0)
      {
        totalHorasRodando += et.tempoRodandoHoras;
        temposEtapasMin.push(Math.round(et.tempoRodandoHoras * 60));
      }
      else if (et.horasEstimadas !== undefined && et.horasEstimadas > 0)
      {
        temposEtapasMin.push(Math.round(et.horasEstimadas * 60));
      }
    }
  }

  temposEtapasMin.sort((a, b) => a - b);
  const tempoMedianoEtapaMin = temposEtapasMin.length
    ? temposEtapasMin[Math.floor(temposEtapasMin.length / 2)]!
    : 90;

  const mediaHorasPorCard = total > 0 ? Math.round((totalHorasEstipuladas / total) * 10) / 10 : 0;
  const concluidosPct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const dentroDoPrazoPct = total > 0 ? Math.round(((total - ritmoAtrasadas) / total) * 100) : 100;

  const totais: TotaisPainel = {
    itensCronograma: total,
    concluidos,
    concluidosPct,
    aindaPlanejado,
    emExecucao: emAndamento,
    demandasEmAndamento: emAndamento,
    etapaRodando: comEtapaRodando,
    ritmoNoRitmo,
    ritmoEmRisco,
    ritmoAtrasadas,
    dentroDoPrazoPct,
    metaPct: totaisManuais.metaPct ?? 85,
    concluidasNoPeriodo: concluidos,
    etapasConcluidas: etapasConcluidasCount,
    tempoMedianoEtapaMin,
    tempoLimpoMedianaH: mediaHorasPorCard,
    tempoLimpoMediaDias: Math.round((mediaHorasPorCard / 8) * 10) / 10,
    emAbertoAgora: total - concluidos,
    foraDoPrazo: ritmoAtrasadas,
    ...Object.fromEntries(Object.entries(totaisManuais).filter(([, v]) => v !== undefined)),
  };

  const cardsPorPrioridade = ordenarCardsResumidos(cards, 'prioridade_maior');

  const resolverNome = (idOuNome?: string) =>
  {
    if (!idOuNome) return undefined;
    return pessoas.find((p) => p.id === idOuNome || semAcento(p.nome).toLowerCase() === semAcento(idOuNome).toLowerCase())?.nome ?? idOuNome;
  };

  // Identifica onde está demorando mais (gargalos de tempo rodando ou maior carga crítica)
  const gargalosDemora: GargaloDemoraCard[] = cardsPorPrioridade
    .filter((c) => c.situacao !== 'concluido' && semAcento(c.statusCard ?? '').toLowerCase() !== 'resolvido')
    .map((c) =>
    {
      const etapaMaisLenta = [...(c.etapas ?? [])].sort((a, b) => (b.tempoRodandoHoras ?? b.horasEstimadas ?? 0) - (a.tempoRodandoHoras ?? a.horasEstimadas ?? 0))[0];
      const maxRodando = Math.max(0, ...(c.etapas?.map((e) => e.tempoRodandoHoras ?? 0) ?? [0]));
      const horas = maxRodando > 0 ? maxRodando : (c.horasEstimadas ?? 4);
      const prio = c.prioridadeCard ?? (c.criticidade === 3 ? 'Crítica' : c.criticidade === 2 ? 'Alta' : 'Normal');
      const motivo = maxRodando > 0
        ? `Etapa "${etapaMaisLenta?.nome ?? 'Atual'}" rodando há ${maxRodando}h`
        : `${prio} com ~${horas}h estipuladas (${c.etapasConcluidas ?? 0}/${c.etapasTotal ?? 3} etapas concluídas)`;
      return {
        codigo: c.codigo,
        assunto: c.assunto ?? c.titulo ?? 'Demanda',
        responsavel: resolverNome(c.responsavelEtapaAtual ?? c.responsaveis[0]),
        etapaCritica: etapaMaisLenta?.nome ?? c.etapaAtual ?? 'Validação dos requisitos',
        horas,
        motivo,
        prioridade: prio,
      };
    })
    .sort((a, b) => b.horas - a.horas);

  // Pontos de atenção automáticos
  const pontosDeAtencao: string[] = [];
  if (gargalosDemora.length > 0)
  {
    const top = gargalosDemora[0]!;
    pontosDeAtencao.push(
      `Maior concentração de tempo em ${top.codigo}${top.responsavel ? ` (${top.responsavel})` : ''}: ${top.motivo}.`,
    );
  }
  const criticasAbertas = cardsPorPrioridade.filter((c) => (c.prioridadeCard === 'Crítica' || c.prioridadeCard === 'Alta') && c.situacao !== 'concluido');
  if (criticasAbertas.length > 0)
  {
    pontosDeAtencao.push(
      `${criticasAbertas.length} demanda(s) de prioridade Alta/Crítica ativa(s): ${criticasAbertas.map((c) => `${c.codigo} (${c.prioridadeCard})`).join(', ')}.`,
    );
  }
  if (ritmoEmRisco > 0 || ritmoAtrasadas > 0)
  {
    pontosDeAtencao.push(
      `Termômetro de risco: ${ritmoAtrasadas} atrasada(s) e ${ritmoEmRisco} em risco de um total de ${total} demandas (média de ${mediaHorasPorCard}h por card).`,
    );
  }
  if (pontosDeAtencao.length === 0 && total > 0)
  {
    pontosDeAtencao.push(`Fluxo estável: ${concluidos}/${total} demandas concluídas e nenhuma etapa crítica travada.`);
  }

  // Série para o Gráfico em Linha (ordenada por código ou prioridade para visualizar a curva de tempo e avanço)
  const serieGraficoLinha: PontoGraficoLinhaCard[] = cardsPorPrioridade.map((c) =>
  {
    const horasRodando = Math.round((c.etapas?.reduce((acc, e) => acc + (e.tempoRodandoHoras ?? (e.situacao === 'concluida' ? (e.horasEstimadas ?? 1) : 0)), 0) ?? 0) * 10) / 10;
    const totalEt = c.etapas?.length || 3;
    const feitasEt = c.etapas?.filter((e) => e.situacao === 'concluida').length ?? 0;
    const progressoEtapasPct = Math.round((feitasEt / totalEt) * 100);
    const ritmo = derivarRitmoCard(c);
    return {
      codigo: c.codigo,
      assunto: c.assunto ?? c.titulo ?? c.codigo,
      prioridade: c.prioridadeCard ?? 'Normal',
      horasEstimadas: c.horasEstimadas ?? 4,
      horasRodando,
      progressoEtapasPct,
      ritmo,
      destaqueDemora: ritmo === 'atrasado' || ritmo === 'em_risco' || horasRodando >= 8,
    };
  });

  return {
    totais,
    mediaHorasPorCard,
    totalHorasEstipuladas: Math.round(totalHorasEstipuladas * 10) / 10,
    totalHorasRodando: Math.round(totalHorasRodando * 10) / 10,
    etapasConcluidasCount,
    etapasTotalCount,
    cardsPorPrioridade,
    gargalosDemora,
    pontosDeAtencao,
    serieGraficoLinha,
  };
}
