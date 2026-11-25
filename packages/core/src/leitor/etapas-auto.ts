import type { CardSnapshot, EtapaCard, Ritmo } from '../tipos';
import { amostraParaCard, AMOSTRAS_CONFIANCA_TOTAL, descreverChave, type ModeloEstimativa } from './estimativa';
import { semAcento } from './normalizar';
import { extrairAssunto, similaridadeCosseno } from './vetor';

export interface DetalheEstimativa
{
  horas: number;
  origem: 'manual' | 'regra' | 'historico';
  nota?: string | undefined;
}

// Estima o tempo em horas de uma demanda: o que foi digitado vale; senão, regra por prioridade e condições do pedido,
// misturada com a mediana das demandas parecidas já concluídas quando o histórico tem amostras suficientes
export function detalharEstimativa(card: CardSnapshot, modelo?: ModeloEstimativa): DetalheEstimativa
{
  if (card.horasEstimadas !== undefined && card.horasEstimadas > 0) return { horas: card.horasEstimadas, origem: card.origemHoras ?? 'manual', nota: card.notaHoras };
  if (card.situacao === 'concluido' || semAcento(card.statusCard ?? '').toLowerCase() === 'resolvido')
  {
    return { horas: 0, origem: 'regra' };
  }

  let base = 4;
  const prio = semAcento(card.prioridadeCard ?? '').toLowerCase();
  if (card.criticidade === 3 || prio === 'critica' || prio === 'urgente') base = 7.5;
  else if (card.criticidade === 2 || prio === 'alta') base = 5.5;
  else if (prio === 'baixa') base = 2.5;

  const textoRegras = card.descricaoCompleta || card.titulo || '';
  const condicoes = textoRegras.match(/\bse\s+[a-zà-ÿ0-9\s/]+,\s*ent[aã]o\b/gi)?.length ?? 0;
  base += Math.min(3.5, condicoes * 0.8);

  let origem: DetalheEstimativa['origem'] = 'regra';
  let nota: string | undefined;
  const aprendida = amostraParaCard(modelo, card);
  if (aprendida)
  {
    const peso = Math.min(1, aprendida.amostras / AMOSTRAS_CONFIANCA_TOTAL);
    base = peso * aprendida.mediana + (1 - peso) * base;
    origem = 'historico';
    nota = `Mediana de ${aprendida.mediana.toString().replace('.', ',')} h em ${aprendida.amostras} ${descreverChave(aprendida.chave)} (peso ${Math.round(peso * 100)}%).`;
  }

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
        if (restantes === 0) return { horas: 0, origem };
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

  return { horas: Math.round(base * 2) / 2, origem, nota };
}

export function estimarHorasCard(card: CardSnapshot, modelo?: ModeloEstimativa): number
{
  return detalharEstimativa(card, modelo).horas;
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

export function enriquecerCard(card: CardSnapshot, modelo?: ModeloEstimativa): CardSnapshot
{
  const assunto = card.assunto ?? extrairAssunto(card);
  // o tempo digitado (ou de origem desconhecida, como nos dados antigos) fica; o calculado acompanha o histórico mais novo
  const fixo = card.horasEstimadas !== undefined && card.horasEstimadas > 0 && (card.origemHoras === undefined || card.origemHoras === 'manual');
  const detalhe = fixo ? undefined : detalharEstimativa({ ...card, horasEstimadas: undefined }, modelo);
  const horasEstimadas = fixo ? card.horasEstimadas! : (detalhe?.horas ?? 0);
  const comHoras: CardSnapshot = {
    ...card,
    assunto,
    horasEstimadas,
    origemHoras: fixo ? (card.origemHoras ?? 'manual') : detalhe!.origem,
    notaHoras: fixo ? card.notaHoras : detalhe?.nota,
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

export type CriterioOrdenacaoCards = 'prioridade_maior' | 'card_maior' | 'card_menor' | 'nomes_parecidos' | 'datas_proximas' | 'datas_distantes';

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
  if (criterio === 'datas_proximas' || criterio === 'datas_distantes')
  {
    const dataDe = (c: CardSnapshot) => c.vencimento ?? c.previsao ?? c.planejadoPara ?? c.abertura ?? '9999-12-31';
    // sem prazo nenhum o card fica no fim nas duas ordens: a lista começa pelo que tem data
    const semData = (c: CardSnapshot) => (c.vencimento ?? c.previsao ?? c.planejadoPara ?? c.abertura ? 0 : 1);
    const ordem = criterio === 'datas_proximas' ? 1 : -1;
    return copia.sort((a, b) =>
      semData(a) - semData(b)
      || ordem * dataDe(a).localeCompare(dataDe(b))
      || extrairNumeroCodigo(b.codigo) - extrairNumeroCodigo(a.codigo));
  }
  if (criterio === 'nomes_parecidos')
  {
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
  return copia.sort((a, b) =>
  {
    const diffPrio = pesoPrioridade(b) - pesoPrioridade(a);
    if (diffPrio !== 0) return diffPrio;
    const diffHoras = (b.horasEstimadas ?? 0) - (a.horasEstimadas ?? 0);
    if (diffHoras !== 0) return diffHoras;
    return extrairNumeroCodigo(b.codigo) - extrairNumeroCodigo(a.codigo);
  });
}
