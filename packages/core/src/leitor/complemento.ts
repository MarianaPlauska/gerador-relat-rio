import type { CapturaLida, CardSnapshot, Pessoa, PlanoSemana, RegistroPainel, Ritmo, Situacao, Snapshot } from '../tipos';
import { nomesTotais } from './totais';
import { semAcento } from './normalizar';

const nomesOrigem: Record<string, string> = {
  em_execucao: 'quem está cuidando de quê',
  fila: 'fila de demandas a iniciar',
  cronograma: 'cronograma',
  demandas: 'lista de demandas',
  card: 'card aberto (etapas)',
};

const rotulosTotais = Object.values(nomesTotais).map((n) => semAcento(n));
const RE_DATA = /\d{2}\/\d{2}\/\d{2,4}/;

// linhas do texto lido que não viraram card nem total: o "restante" do print para a supervisora revisar
export function linhasNaoReconhecidas(texto: string, prefixo: string): string[]
{
  const re = new RegExp(`\\b${prefixo} ?-? ?[0-9A-Z]{2,4}\\b`, 'i');
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const bruta of texto.split(/\r?\n/))
  {
    const linha = bruta.replace(/\s+/g, ' ').trim();
    if (linha.length < 8 || re.test(linha) || RE_DATA.test(linha)) continue;
    const n = semAcento(linha);
    if (rotulosTotais.some((r) => n.includes(r))) continue;
    // linha quase só de símbolos ou números é ruído da imagem
    if ((linha.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0) < 5) continue;
    if (vistas.has(n)) continue;
    vistas.add(n);
    saida.push(linha);
  }
  return saida.slice(0, 15);
}

const campos: [keyof CardSnapshot, string][] = [
  ['etapaAtual', 'etapa'],
  ['responsavelEtapaAtual', 'responsável'],
  ['ritmoPainel', 'ritmo'],
  ['previsao', 'previsão'],
  ['vencimento', 'vencimento'],
  ['situacao', 'situação'],
  ['etapasConcluidas', 'etapas feitas'],
  ['etapasTotal', 'total de etapas'],
];

// o que é novo e o que já tinha aparecido (no mesmo envio ou em registros anteriores), com o que mudou
export function compararComAnteriores(cards: CardSnapshot[], anteriores: CardSnapshot[]): { novos: string[]; repetidos: { codigo: string; mudou: string[] }[] }
{
  const antes = new Map(anteriores.map((c) => [c.codigo, c]));
  const novos: string[] = [];
  const repetidos: { codigo: string; mudou: string[] }[] = [];
  for (const c of cards)
  {
    const a = antes.get(c.codigo);
    if (!a)
    {
      novos.push(c.codigo);
      continue;
    }
    const mudou = campos
      .filter(([k]) => c[k] !== undefined && a[k] !== undefined && c[k] !== a[k])
      .map(([k, nome]) => `${nome}: ${String(a[k])} → ${String(c[k])}`);
    repetidos.push({ codigo: c.codigo, mudou });
  }
  return { novos, repetidos };
}

// junta o que a imagem mostrou e o que a supervisora comentou em um texto só, na ordem dos prints
export function unirCapturas(capturas: CapturaLida[], opcoes: { motivo?: string; observacao?: string } = {}): { resumo: string; texto: string }
{
  const partes: string[] = [];
  if (opcoes.motivo?.trim()) partes.push(`Motivo: ${opcoes.motivo.trim()}.`);
  if (opcoes.observacao?.trim()) partes.push(opcoes.observacao.trim());

  capturas.forEach((c, i) =>
  {
    const o = nomesOrigem[c.origem] ?? c.origem;
    const lido = [
      c.cards.length && `${c.cards.length} ${c.cards.length === 1 ? 'card' : 'cards'} (${c.cards.slice(0, 6).join(', ')}${c.cards.length > 6 ? '...' : ''})`,
      c.totais.length && `${c.totais.length} ${c.totais.length === 1 ? 'indicador' : 'indicadores'}`,
      c.ondas && `${c.ondas} ${c.ondas === 1 ? 'onda' : 'ondas'}`,
    ].filter(Boolean).join(', ');
    const linhas = [`${i + 1}) ${c.nome.split(' · ')[0]} (${o})${lido ? `: ${lido}` : ''}.`];
    if (c.porPessoa?.length)
    {
      linhas.push(`Divisão por pessoa: ${c.porPessoa.map((p) => `${p.pessoa} -> ${p.tarefas.join(', ')}`).join(' | ')}.`);
    }
    if (c.repetidos?.length)
    {
      const mudaram = c.repetidos.filter((r) => r.mudou.length);
      if (mudaram.length) linhas.push(`Mudou desde antes: ${mudaram.slice(0, 5).map((r) => `${r.codigo} (${r.mudou.join('; ')})`).join(' | ')}.`);
      else linhas.push(`Sem mudança desde o último registro: ${c.repetidos.slice(0, 6).map((r) => r.codigo).join(', ')}.`);
    }
    if (c.comentario?.trim()) linhas.push(`Leitura: ${c.comentario.trim()}`);
    partes.push(linhas.join(' '));
  });

  const comentados = capturas.filter((c) => c.comentario?.trim());
  const resumo = [
    opcoes.motivo?.trim(),
    `${capturas.length} ${capturas.length === 1 ? 'print' : 'prints'}`,
    comentados.length ? `${comentados.length} com comentário` : '',
  ].filter(Boolean).join(' · ');
  return { resumo, texto: partes.join('\n\n') };
}

// registros que valem para o relatório: por pasta, por ids escolhidos, por dia ou pelo período
export function filtrarRegistros(registros: RegistroPainel[], opcoes: { pasta?: string | undefined; ids?: string[] | undefined; data?: string | undefined; de?: string | undefined; ate?: string | undefined }): RegistroPainel[]
{
  return registros
    .filter((r) =>
      (!opcoes.pasta || r.pasta === opcoes.pasta) &&
      (!opcoes.ids?.length || opcoes.ids.includes(r.id)) &&
      (!opcoes.data || r.data === opcoes.data) &&
      (opcoes.ids?.length || opcoes.data || ((!opcoes.de || r.data >= opcoes.de) && (!opcoes.ate || r.data <= opcoes.ate))),
    )
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));
}

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

// retorna os colaboradores do projeto (pasta): tanto os cadastrados nesse projeto quanto novos nomes descobertos nos cards
export function pessoasDoProjeto(pessoas: Pessoa[], cards: CardSnapshot[], pasta: string): Pessoa[]
{
  const pastaNorm = (pasta || 'DEV').trim().toUpperCase();
  const base = pessoas.filter((p) =>
  {
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
        if (!porId.has(existente.id)) porId.set(existente.id, existente);
      }
      else
      {
        const id = slugPessoa(bruto);
        if (!porId.has(id))
        {
          porId.set(id, { id, nome: bruto.trim(), capacidadeHorasSemana: 40, pastas: [pastaNorm] });
        }
      }
    }
  }
  return [...porId.values()];
}

export interface TarefaPessoaSemana
{
  codigo: string;
  titulo: string;
  etapa?: string | undefined;
  frente?: string | undefined;
  ritmo?: Ritmo | undefined;
  situacao?: Situacao | undefined;
  previsao?: string | undefined;
  vencimento?: string | undefined;
  comentario?: string | undefined;
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

  // descobre todas as pessoas que participaram do projeto até hoje
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

  // 1) Pontuação na semana atual por pessoa (para o percentual de rendimento na semana em relação à equipe)
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
    const feitosPlano = itensPlano.filter((i) => i.feito || (i.cardCodigo && todosMeus.some((c) => c.codigo === i.cardCodigo && (c.situacao === 'concluido' || !!c.concluidoEm)))).length;

    const pts = noRitmo * 2 + concluidos * 2.5 + feitosPlano * 2 + emRisco * 1 + (meus.length > 0 ? 0.5 : 0);
    pontosSemanaPorPessoa.set(p.id, pts);
    somaPontosSemanaEquipe += pts;
  }

  // 2) Acumulado histórico ao longo de todas as semanas registradas no projeto
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
      const feitos = pp.itens.filter((i) => i.feito).length;
      reg.entregasNoPrazo += feitos;
      const pts = feitos * 2 + pp.itens.length * 0.5;
      reg.pontos += pts;
      somaPontosHistoricoEquipe += pts;
    }
  }

  // 3) Monta os dados base de cada pessoa
  const parciais = equipe.map((p) =>
  {
    const meus = baseCards.filter((c) => pertenceAPessoa(c, p));
    const todosMeus = cardsAtuais.filter((c) => pertenceAPessoa(c, p));
    const concluidos = todosMeus.filter((c) => c.situacao === 'concluido' || !!c.concluidoEm).length;
    const noRitmo = meus.filter((c) => c.ritmoPainel === 'no_ritmo').length;
    const emRisco = meus.filter((c) => c.ritmoPainel === 'em_risco').length;
    const atrasado = meus.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length;

    const tarefas: TarefaPessoaSemana[] = meus.map((c) => ({
      codigo: c.codigo,
      titulo: c.titulo ?? 'Demanda em acompanhamento',
      etapa: c.etapaAtual,
      frente: c.sistema ?? pastaNorm,
      ritmo: c.ritmoPainel,
      situacao: c.situacao,
      previsao: c.previsao,
      vencimento: c.vencimento,
      comentario: c.comentario,
    }));

    // também inclui itens do plano da semana se não houver cards lidos para ela
    if (tarefas.length === 0 && planoSemana)
    {
      const itensPlano = planoSemana.pessoas.find((pp) => pp.pessoaId === p.id)?.itens ?? [];
      for (const item of itensPlano)
      {
        tarefas.push({
          codigo: item.cardCodigo ?? 'PLANO',
          titulo: item.descricao,
          etapa: item.feito ? 'Concluído' : 'Planejado na semana',
          frente: pastaNorm,
          ritmo: item.feito ? 'no_ritmo' : undefined,
          previsao: item.ate,
        });
      }
    }

    const etapasEmAndamento = [...new Set(
      tarefas.map((t) => t.etapa).filter((e): e is string => !!e && e.trim().length > 0),
    )];

    const frentes = [...new Set(
      tarefas.map((t) => t.frente).filter((f): f is string => !!f && f.trim().length > 0),
    )];

    // Calcula quando ficará livre na semana
    const datasPendentes = tarefas
      .filter((t) => t.situacao !== 'concluido')
      .map((t) => t.previsao ?? t.vencimento)
      .filter((d): d is string => !!d)
      .sort();

    let quandoLivre = 'Livre agora (sem tarefas ativas na semana)';
    let livreCedo = false;

    if (tarefas.length === 0)
    {
      quandoLivre = 'Livre na semana (disponível para novas frentes)';
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
        quandoLivre = `Alocado(a) até ${formatarDiaCurto(ultimaData)} (${tarefas.length} ${tarefas.length === 1 ? 'demanda' : 'demandas'})`;
        livreCedo = false;
      }
    }
    else if (tarefas.length <= 2 && atrasado === 0)
    {
      quandoLivre = `Previsão de agenda livre a partir de quinta (${tarefas.length} ${tarefas.length === 1 ? 'demanda ativa' : 'demandas ativas'})`;
      livreCedo = true;
    }
    else
    {
      quandoLivre = `Alocado(a) durante a semana (${tarefas.length} demandas em andamento)`;
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
      acumuladoSemanas: {
        semanasAtivas: Math.max(hist.semanas.size, tarefas.length > 0 ? 1 : 0),
        totalDemandas: Math.max(hist.totalDemandas, tarefas.length),
        entregasNoPrazo: Math.max(hist.entregasNoPrazo, noRitmo + concluidos),
      },
    };
  });

  // 4) Sugestões cruzadas de apoio entre colegas do projeto
  const filaSemDono = cardsAtuais.filter((c) => c.origens.includes('fila') || (!c.responsavelEtapaAtual && c.responsaveis.length === 0));

  for (const item of parciais)
  {
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
