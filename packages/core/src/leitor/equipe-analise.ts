import type { CardSnapshot, EtapaCard, Pessoa, PlanoSemana, RegistroPainel, Ritmo, Situacao, Snapshot } from '../tipos';
import { calcularCalibracaoPessoa, calibrarProbabilidade, type CalibracaoPessoa } from './calibracao';
import { enriquecerCard, estimarHorasCard, extrairAssunto, type ModeloEstimativa } from './correlacao';
import { semAcento } from './normalizar';

function slugPessoa(nome: string): string
{
  return semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pessoa';
}

// agrupa os cards lidos por pessoa responsável para evitar repetição de nomes: "Mariana -> DEV-101, DEV-104..."
export function agruparPorPessoa(cards: CardSnapshot[], pessoas: Pessoa[]): { pessoaId: string; pessoa: string; tarefas: string[] }[]
{
  const mapa = new Map<string, { pessoaId: string; pessoa: string; tarefas: string[] }>();
  const resolver = (idOuNome: string): { id: string; nome: string } =>
  {
    const achada = pessoas.find((p) => p.id === idOuNome || semAcento(p.nome) === semAcento(idOuNome));
    if (achada) return { id: achada.id, nome: achada.nome };
    return { id: slugPessoa(idOuNome), nome: idOuNome };
  };

  for (const c of cards)
  {
    const donos = c.responsavelEtapaAtual
      ? [c.responsavelEtapaAtual]
      : c.responsaveis.length
        ? c.responsaveis
        : (c.etapas?.map((e) => e.pessoa).filter((p): p is string => !!p) ?? []);

    for (const bruto of new Set(donos))
    {
      const { id, nome } = resolver(bruto);
      const grupo = mapa.get(id) ?? { pessoaId: id, pessoa: nome, tarefas: [] };
      const resumoTarefa = `${c.codigo}${c.titulo ? ` (${c.titulo.slice(0, 32)}${c.titulo.length > 32 ? '...' : ''})` : c.etapaAtual ? ` [${c.etapaAtual}]` : ''}`;
      if (!grupo.tarefas.includes(resumoTarefa)) grupo.tarefas.push(resumoTarefa);
      mapa.set(id, grupo);
    }
  }
  return [...mapa.values()];
}

// retorna os colaboradores ativos do projeto (pasta): tanto os cadastrados nesse projeto quanto novos nomes descobertos nos cards (respeitando pessoas removidas)
export function pessoasDoProjeto(pessoas: Pessoa[], cards: CardSnapshot[], pasta: string): Pessoa[]
{
  const pastaNorm = (pasta || 'DEV').trim().toUpperCase();
  const foiRemovida = (p: Pessoa) =>
    !!p.removidaDaOrganizacao || (p.pastasRemovidas?.map((x) => x.toUpperCase()).includes(pastaNorm) ?? false);

  const base = pessoas.filter((p) =>
  {
    if (foiRemovida(p)) return false;
    if (p.pastas && p.pastas.length > 0) return p.pastas.map((x) => x.toUpperCase()).includes(pastaNorm);
    return pastaNorm === 'DEV';
  });

  const porId = new Map<string, Pessoa>(base.map((p) => [p.id, p]));
  for (const c of cards)
  {
    const nomes = [
      c.responsavelEtapaAtual,
      ...c.responsaveis,
      ...(c.etapas?.map((e) => e.pessoa) ?? []),
    ].filter((n): n is string => !!n && n.trim().length > 0);

    for (const bruto of nomes)
    {
      const existente = pessoas.find((p) => p.id === bruto || semAcento(p.nome) === semAcento(bruto));
      if (existente)
      {
        if (foiRemovida(existente)) continue;
        if (!porId.has(existente.id)) porId.set(existente.id, existente);
      }
      else
      {
        const id = slugPessoa(bruto);
        const jaRemovidaPorSlug = pessoas.find((p) => slugPessoa(p.nome) === id && foiRemovida(p));
        if (jaRemovidaPorSlug) continue;
        if (!porId.has(id))
        {
          porId.set(id, { id, nome: bruto.trim(), capacidadeHorasSemana: 40, pastas: [pastaNorm] });
        }
      }
    }
  }
  return [...porId.values()];
}

// Calcula o intervalo de datas (Dia X ao Dia Y) em que a pessoa teve registros ou cards no histórico
export function calcularPeriodoHistoricoPessoa(
  pessoa: Pessoa,
  fotos: Snapshot[],
  registros: RegistroPainel[],
  hoje: string,
): { de: string; ate: string }
{
  const datas: string[] = [];
  const idSub = slugPessoa(pessoa.nome);
  const nomeNorm = semAcento(pessoa.nome).toLowerCase();

  for (const f of fotos)
  {
    const temCard = f.cards.some(
      (c) =>
        c.responsavelEtapaAtual === pessoa.id ||
        (c.responsavelEtapaAtual && slugPessoa(c.responsavelEtapaAtual) === idSub) ||
        c.responsaveis.some((r) => r === pessoa.id || slugPessoa(r) === idSub),
    );
    if (temCard) datas.push(f.data);
  }

  for (const r of registros)
  {
    const temNoRegistro =
      semAcento(r.texto).toLowerCase().includes(nomeNorm) ||
      r.capturas.some((cap) => cap.porPessoa?.some((gp) => semAcento(gp.pessoa).toLowerCase() === nomeNorm));
    if (temNoRegistro) datas.push(r.data);
  }

  if (pessoa.historicoDe) datas.push(pessoa.historicoDe);
  if (pessoa.historicoAte) datas.push(pessoa.historicoAte);

  datas.sort();
  return {
    de: datas[0] ?? hoje,
    ate: datas.at(-1) ?? hoje,
  };
}

export interface TarefaPessoaSemana
{
  codigo: string;
  titulo: string;
  assunto: string;
  descricaoCompleta?: string | undefined;
  prioridadeCard?: string | undefined;
  statusCard?: string | undefined;
  horasEstimadas: number;
  etapa?: string | undefined;
  etapas?: EtapaCard[] | undefined;
  etapasConcluidas?: number | undefined;
  etapasTotal?: number | undefined;
  frente?: string | undefined;
  ritmo?: Ritmo | undefined;
  situacao?: Situacao | undefined;
  previsao?: string | undefined;
  vencimento?: string | undefined;
  comentario?: string | undefined;
  fontesCorrelacionadas?: string[] | undefined;
  cardsRelacionados?: string[] | undefined;
  impactoSemana?: string | undefined;
}

export interface ResumoPessoaProjeto
{
  pessoa: Pessoa;
  total: number;
  noRitmo: number;
  emRisco: number;
  atrasado: number;
  concluidos: number;
  tarefas: TarefaPessoaSemana[];
  etapasEmAndamento: string[];
  frentes: string[];
  quandoLivre: string;
  livreCedo: boolean;
  sugestoesAjuda: string[];
  rendimentoSemanaPct: number;
  rendimentoAcumuladoPct: number;
  horasEstipuladasSemana: number;
  capacidadeHorasSemana: number;
  horasLivresEstimadas: number;
  nivelEntregaPct: number;
  nivelDemora: 'baixo' | 'moderado' | 'alto';
  motivoDemora: string;
  horasRodandoMax: number;
  estagioCritico?: boolean;
  motivoEstagioCritico?: string;
  // probabilidade final (calibrada pelo histórico) e a base só pela folga da semana
  probabilidadeMaisServicosPct: number;
  probabilidadeBasePct: number;
  horasLivresCalibradas: number;
  calibracao: CalibracaoPessoa;
  servicosExtrasSugeridos: number;
  acumuladoSemanas: {
    semanasAtivas: number;
    totalDemandas: number;
    entregasNoPrazo: number;
  };
}

const diasSemanaNomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function formatarDiaCurto(iso: string): string
{
  const [, m, d] = iso.split('-');
  return m && d ? `${d}/${m}` : iso;
}

function proximoDiaUtilNome(iso: string): string
{
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return formatarDiaCurto(iso);
  dt.setDate(dt.getDate() + 1);
  if (dt.getDay() === 6) dt.setDate(dt.getDate() + 2);
  if (dt.getDay() === 0) dt.setDate(dt.getDate() + 1);
  const nome = diasSemanaNomes[dt.getDay()] ?? 'dia útil';
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return `${nome} (${d}/${m})`;
}

// calcula a visão detalhada de cada pessoa do projeto na semana + rendimento comparativo e acumulado entre semanas
export function analisarTimeNoProjeto(opcoes: {
  pessoas: Pessoa[];
  fotos: Snapshot[];
  planos: PlanoSemana[];
  pasta: string;
  semanaInicio: string;
  semanaFim: string;
  hoje: string;
  // tempos aprendidos com o histórico do projeto; sem isso vale só a regra fixa
  modelo?: ModeloEstimativa;
}): ResumoPessoaProjeto[]
{
  const pastaNorm = (opcoes.pasta || 'DEV').trim().toUpperCase();
  const fotosProjeto = opcoes.fotos
    .filter((f) => (f.pasta ?? 'DEV').toUpperCase() === pastaNorm && f.data <= opcoes.semanaFim)
    .sort((a, b) => a.data.localeCompare(b.data));

  const fotoAtual = fotosProjeto.at(-1);
  const cardsAtuais = fotoAtual?.cards ?? [];
  const baseCards = cardsAtuais.filter((c) => c.origens.includes('em_execucao')).length
    ? cardsAtuais.filter((c) => c.origens.includes('em_execucao'))
    : cardsAtuais;

  const todosCardsHistorico = fotosProjeto.flatMap((f) => f.cards);
  const equipe = pessoasDoProjeto(opcoes.pessoas, [...cardsAtuais, ...todosCardsHistorico], pastaNorm);

  const pertenceAPessoa = (c: CardSnapshot, p: Pessoa): boolean =>
  {
    const idSub = slugPessoa(p.nome);
    if (c.responsavelEtapaAtual)
    {
      return (
        c.responsavelEtapaAtual === p.id ||
        slugPessoa(c.responsavelEtapaAtual) === idSub ||
        semAcento(c.responsavelEtapaAtual) === semAcento(p.nome)
      );
    }
    return c.responsaveis.some(
      (r) => r === p.id || slugPessoa(r) === idSub || semAcento(r) === semAcento(p.nome),
    );
  };

  const planoSemana = opcoes.planos.find((pl) => pl.inicio === opcoes.semanaInicio);

  const pontosSemanaPorPessoa = new Map<string, number>();
  let somaPontosSemanaEquipe = 0;

  for (const p of equipe)
  {
    const meus = baseCards.filter((c) => pertenceAPessoa(c, p));
    const todosMeus = cardsAtuais.filter((c) => pertenceAPessoa(c, p));
    const concluidos = todosMeus.filter((c) => c.situacao === 'concluido' || !!c.concluidoEm).length;
    const noRitmo = meus.filter((c) => c.ritmoPainel === 'no_ritmo').length;
    const emRisco = meus.filter((c) => c.ritmoPainel === 'em_risco').length;
    const itensPlano = planoSemana?.pessoas.find((pp) => pp.pessoaId === p.id)?.itens ?? [];
    const feitosPlano = itensPlano.filter((i) => i.status === 'feito' || (i as { feito?: boolean }).feito || (i.cardCodigo && todosMeus.some((c) => c.codigo === i.cardCodigo && (c.situacao === 'concluido' || !!c.concluidoEm)))).length;

    const pts = noRitmo * 2 + concluidos * 2.5 + feitosPlano * 2 + emRisco * 1 + (meus.length > 0 ? 0.5 : 0);
    pontosSemanaPorPessoa.set(p.id, pts);
    somaPontosSemanaEquipe += pts;
  }

  const acumuladoMapa = new Map<string, { semanas: Set<string>; totalDemandas: number; entregasNoPrazo: number; pontos: number }>();
  for (const p of equipe)
  {
    acumuladoMapa.set(p.id, { semanas: new Set(), totalDemandas: 0, entregasNoPrazo: 0, pontos: 0 });
  }

  let somaPontosHistoricoEquipe = 0;
  for (const f of fotosProjeto)
  {
    const chaveSemana = f.data.slice(0, 7) + '-' + String(Math.floor(Number(f.data.slice(8, 10)) / 7));
    for (const p of equipe)
    {
      const cartoesFoto = f.cards.filter((c) => pertenceAPessoa(c, p));
      if (!cartoesFoto.length) continue;
      const reg = acumuladoMapa.get(p.id)!;
      reg.semanas.add(chaveSemana);
      reg.totalDemandas += cartoesFoto.length;
      const ok = cartoesFoto.filter((c) => c.ritmoPainel === 'no_ritmo' || c.situacao === 'concluido' || !!c.concluidoEm).length;
      reg.entregasNoPrazo += ok;
      const pts = ok * 2 + (cartoesFoto.length - ok) * 0.5;
      reg.pontos += pts;
      somaPontosHistoricoEquipe += pts;
    }
  }

  for (const pl of opcoes.planos.filter((x) => x.inicio <= opcoes.semanaInicio))
  {
    for (const p of equipe)
    {
      const pp = pl.pessoas.find((x) => x.pessoaId === p.id);
      if (!pp || !pp.itens.length) continue;
      const reg = acumuladoMapa.get(p.id)!;
      reg.semanas.add(pl.inicio);
      reg.totalDemandas += pp.itens.length;
      const feitos = pp.itens.filter((i) => i.status === 'feito' || (i as { feito?: boolean }).feito).length;
      reg.entregasNoPrazo += feitos;
      const pts = feitos * 2 + pp.itens.length * 0.5;
      reg.pontos += pts;
      somaPontosHistoricoEquipe += pts;
    }
  }

  const parciais = equipe.map((p) =>
  {
    const meus = baseCards.filter((c) => pertenceAPessoa(c, p));
    const todosMeus = cardsAtuais.filter((c) => pertenceAPessoa(c, p));
    const concluidos = todosMeus.filter((c) => c.situacao === 'concluido' || !!c.concluidoEm || semAcento(c.statusCard ?? '').toLowerCase() === 'resolvido').length;
    const noRitmo = meus.filter((c) => c.ritmoPainel === 'no_ritmo').length;
    const emRisco = meus.filter((c) => c.ritmoPainel === 'em_risco').length;
    const atrasado = meus.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length;

    const listaBase = todosMeus.length > meus.length ? todosMeus : meus;

    const tarefas: TarefaPessoaSemana[] = listaBase.map((bruto) =>
    {
      const c = enriquecerCard(bruto, opcoes.modelo);
      return {
        codigo: c.codigo,
        titulo: c.titulo ?? 'Demanda em acompanhamento',
        assunto: c.assunto ?? extrairAssunto(c),
        descricaoCompleta: c.descricaoCompleta,
        prioridadeCard: c.prioridadeCard,
        statusCard: c.statusCard,
        horasEstimadas: estimarHorasCard(c),
        etapa: c.etapaAtual,
        etapas: c.etapas,
        etapasConcluidas: c.etapasConcluidas,
        etapasTotal: c.etapasTotal,
        frente: c.sistema ?? pastaNorm,
        ritmo: c.ritmoPainel,
        situacao: c.situacao,
        previsao: c.previsao,
        vencimento: c.vencimento,
        comentario: c.comentario,
        fontesCorrelacionadas: c.fontesCorrelacionadas,
        cardsRelacionados: c.cardsRelacionados,
        impactoSemana: c.impactoSemana,
      };
    });

    if (tarefas.length === 0 && planoSemana)
    {
      const itensPlano = planoSemana.pessoas.find((pp) => pp.pessoaId === p.id)?.itens ?? [];
      for (const item of itensPlano)
      {
        const feito = item.status === 'feito';
        tarefas.push({
          codigo: item.cardCodigo ?? 'PLANO',
          titulo: item.descricao,
          assunto: item.descricao,
          horasEstimadas: feito ? 0 : (item.horasEstimadas ?? 4),
          etapa: feito ? 'Concluído' : 'Planejado na semana',
          frente: pastaNorm,
          ritmo: feito ? 'no_ritmo' : undefined,
          situacao: feito ? 'concluido' : 'em_execucao',
          previsao: item.ate,
        });
      }
    }

    const etapasEmAndamento = [...new Set(
      tarefas
        .flatMap((t) => [t.etapa, ...(t.etapas?.filter((e) => e.situacao === 'rodando').map((e) => e.nome) ?? [])])
        .filter((e): e is string => !!e && e.trim().length > 0),
    )];

    const frentes = [...new Set(
      tarefas.map((t) => t.frente).filter((f): f is string => !!f && f.trim().length > 0),
    )];

    const capacidadeHorasSemana = p.capacidadeHorasSemana || 40;
    const horasEstipuladasSemana = Math.round(tarefas.reduce((acc, t) => acc + t.horasEstimadas, 0) * 10) / 10;
    const horasLivresEstimadas = Math.max(0, Math.round((capacidadeHorasSemana - horasEstipuladasSemana) * 10) / 10);

    let horasRodandoMax = 0;
    let cardComDemora = '';
    for (const t of tarefas)
    {
      for (const et of t.etapas ?? [])
      {
        if (et.tempoRodandoHoras !== undefined && et.tempoRodandoHoras > horasRodandoMax)
        {
          horasRodandoMax = et.tempoRodandoHoras;
          cardComDemora = `${t.codigo} (${et.nome}: ${et.tempoRodandoHoras}h rodando)`;
        }
      }
    }

    let nivelDemora: 'baixo' | 'moderado' | 'alto' = 'baixo';
    let motivoDemora = 'Fluxo sem gargalo de tempo registrado nas etapas.';
    if (atrasado > 0 || horasRodandoMax >= 14)
    {
      nivelDemora = 'alto';
      motivoDemora = cardComDemora
        ? `Etapa em execução prolongada em ${cardComDemora}.`
        : `${atrasado} ${atrasado === 1 ? 'demanda com atraso' : 'demandas com atraso'} na semana.`;
    }
    else if (emRisco > 0 || horasRodandoMax >= 8 || tarefas.filter((t) => t.situacao !== 'concluido').length >= 6)
    {
      nivelDemora = 'moderado';
      motivoDemora = cardComDemora
        ? `Atenção ao tempo em aberto em ${cardComDemora}.`
        : `Fila com ${tarefas.filter((t) => t.situacao !== 'concluido').length} itens pendentes para a semana.`;
    }

    const totalTarefas = tarefas.length;
    const avancandoOuConcluidas = concluidos + noRitmo + tarefas.filter((t) => (t.etapasConcluidas ?? 0) > 0 || t.statusCard === 'Em andamento').length * 0.6;
    const nivelEntregaPct = totalTarefas === 0
      ? 100
      : Math.min(100, Math.max(15, Math.round((avancandoOuConcluidas / totalTarefas) * 100 - atrasado * 12)));

    const folgaRatio = Math.max(0, (capacidadeHorasSemana - horasEstipuladasSemana) / capacidadeHorasSemana);
    const criticasPendentes = tarefas.filter((t) => t.situacao !== 'concluido' && (t.prioridadeCard === 'Crítica' || t.prioridadeCard === 'Alta')).length;
    const tarefasAntigasOuLongas = tarefas.filter((t) => (t.horasEstimadas && t.horasEstimadas >= 10) || (t.etapas?.some((e) => (e.tempoRodandoHoras ?? 0) >= 12)));
    const estagioCritico = criticasPendentes >= 2 || atrasado >= 2 || horasRodandoMax >= 14 || horasEstipuladasSemana > capacidadeHorasSemana || (criticasPendentes >= 1 && (horasRodandoMax >= 8 || tarefas.length >= 5));
    let motivoEstagioCritico: string | undefined;
    if (estagioCritico)
    {
      const motivos: string[] = [];
      if (criticasPendentes >= 2) motivos.push(`${criticasPendentes} demandas críticas simultâneas`);
      else if (criticasPendentes === 1) motivos.push('demanda crítica em execução');
      if (horasRodandoMax >= 14) motivos.push(`etapa rodando há ${horasRodandoMax}h`);
      if (atrasado >= 2) motivos.push(`${atrasado} demandas em atraso`);
      if (horasEstipuladasSemana > capacidadeHorasSemana) motivos.push(`${horasEstipuladasSemana}h estipuladas vs ${capacidadeHorasSemana}h capacidade`);
      if (tarefasAntigasOuLongas.length >= 2) motivos.push(`${tarefasAntigasOuLongas.length} tarefas acumuladas`);
      motivoEstagioCritico = `Sobrecarga crítica: ${motivos.join(', ')}.`;
    }

    const penalidadeFila = atrasado * 18 + criticasPendentes * 10 + (horasRodandoMax >= 12 ? 8 : 0);
    const bonusResolvidos = concluidos * 8;
    const probabilidadeBasePct = Math.min(
      98,
      Math.max(5, Math.round(folgaRatio * 90 + bonusResolvidos - penalidadeFila)),
    );
    // o histórico de entregas reais (horas fechadas por semana) corrige a folga teórica da jornada
    const calibracao = calcularCalibracaoPessoa(fotosProjeto, (c) => pertenceAPessoa(c, p));
    const calibrada = calibrarProbabilidade({ probabilidadeBasePct, cargaHoras: horasEstipuladasSemana, capacidadeHoras: capacidadeHorasSemana, calibracao });
    const probabilidadeMaisServicosPct = calibrada.probabilidadePct;
    const horasLivresCalibradas = calibrada.horasLivresCalibradas;
    const servicosExtrasSugeridos = Math.max(0, Math.floor((horasLivresCalibradas * (probabilidadeMaisServicosPct / 100)) / 4));

    const datasPendentes = tarefas
      .filter((t) => t.situacao !== 'concluido')
      .map((t) => t.previsao ?? t.vencimento)
      .filter((d): d is string => !!d)
      .sort();

    let quandoLivre = 'Livre agora (sem tarefas ativas na semana)';
    let livreCedo = false;

    const ativasCount = tarefas.filter((t) => t.situacao !== 'concluido').length;
    if (ativasCount === 0)
    {
      quandoLivre = 'Livre na semana (disponível para novas demandas)';
      livreCedo = true;
    }
    else if (datasPendentes.length > 0)
    {
      const ultimaData = datasPendentes.at(-1)!;
      if (ultimaData <= opcoes.hoje)
      {
        quandoLivre = `Livre a partir de hoje (entregas previstas até ${formatarDiaCurto(ultimaData)})`;
        livreCedo = true;
      }
      else if (ultimaData < opcoes.semanaFim)
      {
        quandoLivre = `Fica livre a partir de ${proximoDiaUtilNome(ultimaData)}`;
        livreCedo = true;
      }
      else
      {
        quandoLivre = `Alocado(a) até ${formatarDiaCurto(ultimaData)} (${horasEstipuladasSemana}h estipuladas)`;
        livreCedo = false;
      }
    }
    else if (horasEstipuladasSemana <= 20 && atrasado === 0)
    {
      const diasUteis = Math.max(1, Math.ceil(horasEstipuladasSemana / 8));
      quandoLivre = `Estipulado ~${horasEstipuladasSemana}h (${diasUteis}d úteis) · livre em ${horasLivresEstimadas}h na semana`;
      livreCedo = true;
    }
    else
    {
      quandoLivre = `Carga estipulada de ${horasEstipuladasSemana}h (${ativasCount} demandas ativas)`;
      livreCedo = false;
    }

    const ptsSemana = pontosSemanaPorPessoa.get(p.id) ?? 0;
    const rendimentoSemanaPct = somaPontosSemanaEquipe > 0
      ? Math.round((ptsSemana / somaPontosSemanaEquipe) * 100)
      : 0;

    const hist = acumuladoMapa.get(p.id)!;
    const rendimentoAcumuladoPct = somaPontosHistoricoEquipe > 0
      ? Math.round((hist.pontos / somaPontosHistoricoEquipe) * 100)
      : rendimentoSemanaPct;

    return {
      pessoa: p,
      total: tarefas.length,
      noRitmo,
      emRisco,
      atrasado,
      concluidos,
      tarefas,
      etapasEmAndamento,
      frentes,
      quandoLivre,
      livreCedo,
      sugestoesAjuda: [] as string[],
      rendimentoSemanaPct,
      rendimentoAcumuladoPct,
      horasEstipuladasSemana,
      capacidadeHorasSemana,
      horasLivresEstimadas,
      nivelEntregaPct,
      nivelDemora,
      motivoDemora,
      horasRodandoMax,
      estagioCritico,
      motivoEstagioCritico,
      probabilidadeMaisServicosPct,
      probabilidadeBasePct,
      horasLivresCalibradas,
      calibracao,
      servicosExtrasSugeridos,
      acumuladoSemanas: {
        semanasAtivas: Math.max(hist.semanas.size, tarefas.length > 0 ? 1 : 0),
        totalDemandas: Math.max(hist.totalDemandas, tarefas.length),
        entregasNoPrazo: Math.max(hist.entregasNoPrazo, noRitmo + concluidos),
      },
    };
  });

  const filaSemDono = cardsAtuais.filter((c) => c.origens.includes('fila') || (!c.responsavelEtapaAtual && c.responsaveis.length === 0));

  for (const item of parciais)
  {
    if (item.estagioCritico)
    {
      item.sugestoesAjuda.unshift(
        `Alerta de sobrecarga crítica: ${item.motivoEstagioCritico || 'demanda crítica/tempo excessivo'}. Recomendado redistribuir ou parear para destravar entregas.`,
      );
    }

    const colegasComAtraso = parciais.filter((o) => o.pessoa.id !== item.pessoa.id && (o.atrasado > 0 || o.emRisco > 0));
    const colegasSobrecarregados = parciais.filter((o) => o.pessoa.id !== item.pessoa.id && o.total > item.total + 1);

    if (item.atrasado > 0)
    {
      const cardAtrasado = item.tarefas.find((t) => t.ritmo === 'atrasado' || t.situacao === 'atrasado');
      item.sugestoesAjuda.push(
        `Priorizar regularização de ${cardAtrasado ? `${cardAtrasado.codigo} (${cardAtrasado.etapa ?? 'em atraso'})` : 'demandas atrasadas'} antes de puxar novas frentes.`,
      );
      const colegaLivre = parciais.find((o) => o.pessoa.id !== item.pessoa.id && o.livreCedo && o.atrasado === 0);
      if (colegaLivre)
      {
        item.sugestoesAjuda.push(`${colegaLivre.pessoa.nome} tem janela livre na semana e pode apoiar no destravamento.`);
      }
    }

    if (item.livreCedo || item.atrasado === 0)
    {
      for (const col of colegasComAtraso.slice(0, 2))
      {
        const critico = col.tarefas.find((t) => t.ritmo === 'atrasado' || t.ritmo === 'em_risco');
        item.sugestoesAjuda.push(
          `Pode apoiar ${col.pessoa.nome} em ${critico ? `${critico.codigo}${critico.etapa ? ` (${critico.etapa})` : ''}` : `${col.atrasado + col.emRisco} demanda(s) crítica(s)`}.`,
        );
      }
      for (const col of colegasSobrecarregados.slice(0, 1))
      {
        if (!colegasComAtraso.includes(col))
        {
          item.sugestoesAjuda.push(
            `Pode redistribuir 1 demanda de ${col.pessoa.nome} (${col.total} itens ativos na semana).`,
          );
        }
      }
      if (filaSemDono.length > 0)
      {
        item.sugestoesAjuda.push(
          `Disponível para puxar ${filaSemDono[0]!.codigo} da fila de demandas a iniciar.`,
        );
      }
      if (item.sugestoesAjuda.length === 0)
      {
        item.sugestoesAjuda.push('Ritmo equilibrado. Disponível para revisão cruzada, testes ou apoio em novas demandas do projeto.');
      }
    }
  }

  return parciais;
}
