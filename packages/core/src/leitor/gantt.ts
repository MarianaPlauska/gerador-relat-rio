import { somarDias } from '../datas';
import type { ResumoPessoaProjeto, TarefaPessoaSemana } from './equipe-analise';
import { semAcento } from './normalizar';

const DIAS_UTEIS = 5;
const nomesDias = ['seg', 'ter', 'qua', 'qui', 'sex'];

// pedaço de uma tarefa dentro de um dia: horas de uso dentro da jornada daquele dia
export interface SegmentoGantt
{
  dia: number;
  de: number;
  ate: number;
}

export interface BarraGantt
{
  codigo: string;
  assunto: string;
  prioridade?: string | undefined;
  horas: number;
  segmentos: SegmentoGantt[];
  // tarefa da mesma pessoa que precisa terminar antes para esta começar
  iniciaApos?: string | undefined;
  emAndamento: boolean;
  critica: boolean;
  prazo?: string | undefined;
  estouraPrazo: boolean;
  // parte (ou tudo) que não cabe na semana
  horasAlemDaSemana: number;
  terminaNoDia?: number | undefined;
}

export interface LinhaGantt
{
  pessoaId: string;
  pessoa: string;
  horasDia: number;
  barras: BarraGantt[];
  // por dia da semana: sem expediente por feriado ou por ausência da pessoa
  semExpediente: ('feriado' | 'ausencia' | null)[];
  // primeiro instante livre da semana (dia e hora dentro do dia); vazio se a semana toda está ocupada
  livreAPartirDe?: { dia: number; hora: number } | undefined;
  horasLivresSemana: number;
  horasAlemDaSemana: number;
  sobrecarga: boolean;
}

export interface DependenciaGantt
{
  de: string;
  para: string;
  motivo: 'mesma_pessoa' | 'relacionada';
  // relacionadas rodando ao mesmo tempo em pessoas diferentes pedem alinhamento
  conflito: boolean;
}

export interface DiaGantt
{
  iso: string;
  rotulo: string;
  passado: boolean;
  hoje: boolean;
  feriado: boolean;
}

export interface GanttSemana
{
  dias: DiaGantt[];
  linhas: LinhaGantt[];
  dependencias: DependenciaGantt[];
}

function pesoPrioridade(t: TarefaPessoaSemana): number
{
  const p = semAcento(t.prioridadeCard ?? '').toLowerCase();
  if (p === 'critica' || p === 'urgente') return 4;
  if (p === 'alta') return 3;
  if (p === 'baixa') return 1;
  return 2;
}

const numeroDoCodigo = (codigo: string): number => Number(codigo.match(/(\d+)/)?.[1] ?? 0);

const aberta = (t: TarefaPessoaSemana): boolean =>
  t.situacao !== 'concluido' && semAcento(t.statusCard ?? '').toLowerCase() !== 'resolvido' && t.horasEstimadas > 0;

const emAndamento = (t: TarefaPessoaSemana): boolean =>
  t.situacao === 'em_execucao' || semAcento(t.statusCard ?? '').toLowerCase() === 'em andamento' || !!t.etapas?.some((e) => e.situacao === 'rodando');

function arredondar(v: number): number
{
  return Math.round(v * 100) / 100;
}

// distribui as tarefas abertas de cada pessoa em fila (a ordem escolhida à mão primeiro; depois em andamento, prioridade e prazo),
// dia útil por dia útil, dentro da jornada dela: mostra quando cada uma termina e quando a pessoa fica livre.
// Feriados e ausências da pessoa (férias, atestado, folga) são dias sem expediente.
export interface OpcoesGantt
{
  semanaInicio: string;
  hoje: string;
  feriados?: string[];
  // pessoaId -> códigos na ordem escolhida (os que não estiverem na lista vêm depois, na ordem automática)
  ordemManual?: Record<string, string[]>;
}

export function montarGanttSemana(resumo: ResumoPessoaProjeto[], opcoes: OpcoesGantt): GanttSemana
{
  const { semanaInicio, hoje } = opcoes;
  const feriados = opcoes.feriados ?? [];
  const dias: DiaGantt[] = Array.from({ length: DIAS_UTEIS }, (_, i) =>
  {
    const iso = somarDias(semanaInicio, i);
    const [, m, d] = iso.split('-');
    return { iso, rotulo: `${nomesDias[i]} ${d}/${m}`, passado: iso < hoje, hoje: iso === hoje, feriado: feriados.includes(iso) };
  });
  // semana ainda por vir ou já passada: a fila começa na segunda; no meio dela, começa em hoje
  const indiceHoje = dias.findIndex((d) => d.iso >= hoje);
  const diaInicial = indiceHoje === -1 ? 0 : indiceHoje;

  const linhas: LinhaGantt[] = [];
  const posicaoPorCodigo = new Map<string, { pessoaId: string; barra: BarraGantt }>();
  const dependencias: DependenciaGantt[] = [];

  for (const r of resumo)
  {
    const horasDia = Math.max(1, (r.capacidadeHorasSemana || 40) / DIAS_UTEIS);
    // dia sem expediente: feriado para todos, ausência (férias, atestado, folga) só para a pessoa
    const semExpediente = dias.map((d): 'feriado' | 'ausencia' | null =>
      d.feriado ? 'feriado' : (r.pessoa.ausencias ?? []).some((a) => a.de <= d.iso && d.iso <= a.ate) ? 'ausencia' : null);
    const capacidadeDoDia = (i: number) => (semExpediente[i] ? 0 : horasDia);

    const posicaoManual = new Map((opcoes.ordemManual?.[r.pessoa.id] ?? []).map((codigo, i) => [codigo, i] as const));
    const fila = r.tarefas
      .filter(aberta)
      .sort((a, b) =>
        (posicaoManual.get(a.codigo) ?? Infinity) - (posicaoManual.get(b.codigo) ?? Infinity)
        || Number(emAndamento(b)) - Number(emAndamento(a))
        || pesoPrioridade(b) - pesoPrioridade(a)
        || (a.previsao ?? a.vencimento ?? '9999').localeCompare(b.previsao ?? b.vencimento ?? '9999')
        || numeroDoCodigo(a.codigo) - numeroDoCodigo(b.codigo));

    let dia = diaInicial;
    let usado = 0;
    const pularSemExpediente = () =>
    {
      while (dia < DIAS_UTEIS && capacidadeDoDia(dia) === 0)
      {
        dia++;
        usado = 0;
      }
    };
    pularSemExpediente();
    const barras: BarraGantt[] = [];
    let anterior: BarraGantt | undefined;

    for (const t of fila)
    {
      let restante = t.horasEstimadas;
      const segmentos: SegmentoGantt[] = [];
      let alem = 0;
      while (restante > 0.001)
      {
        if (dia >= DIAS_UTEIS)
        {
          alem = restante;
          break;
        }
        const livre = horasDia - usado;
        const pega = Math.min(livre, restante);
        segmentos.push({ dia, de: arredondar(usado), ate: arredondar(usado + pega) });
        usado += pega;
        restante -= pega;
        if (horasDia - usado < 0.01)
        {
          dia++;
          usado = 0;
          pularSemExpediente();
        }
      }
      const ultimo = segmentos.at(-1);
      const prazo = t.previsao ?? t.vencimento;
      const terminaIso = ultimo ? dias[ultimo.dia]?.iso : undefined;
      const barra: BarraGantt = {
        codigo: t.codigo,
        assunto: t.assunto,
        prioridade: t.prioridadeCard,
        horas: arredondar(t.horasEstimadas),
        segmentos,
        iniciaApos: anterior?.codigo,
        emAndamento: emAndamento(t),
        critica: pesoPrioridade(t) >= 4,
        prazo,
        estouraPrazo: !!prazo && ((alem > 0 && prazo <= dias.at(-1)!.iso) || (!!terminaIso && terminaIso > prazo)),
        horasAlemDaSemana: arredondar(alem),
        terminaNoDia: alem > 0 ? undefined : ultimo?.dia,
      };
      if (anterior) dependencias.push({ de: anterior.codigo, para: barra.codigo, motivo: 'mesma_pessoa', conflito: false });
      barras.push(barra);
      posicaoPorCodigo.set(barra.codigo, { pessoaId: r.pessoa.id, barra });
      anterior = barra;
    }

    const ocupadas = barras.reduce((acc, b) => acc + b.segmentos.reduce((s, g) => s + (g.ate - g.de), 0), 0);
    const disponivel = dias.reduce((acc, _, i) => acc + (i >= diaInicial ? capacidadeDoDia(i) : 0), 0);
    const horasAlem = arredondar(barras.reduce((acc, b) => acc + b.horasAlemDaSemana, 0));
    linhas.push({
      pessoaId: r.pessoa.id,
      pessoa: r.pessoa.nome,
      horasDia: arredondar(horasDia),
      barras,
      semExpediente,
      livreAPartirDe: dia < DIAS_UTEIS ? { dia, hora: arredondar(usado) } : undefined,
      horasLivresSemana: arredondar(Math.max(0, disponivel - ocupadas)),
      horasAlemDaSemana: horasAlem,
      sobrecarga: horasAlem > 0 || !!r.estagioCritico,
    });
  }

  // tarefas relacionadas de pessoas diferentes: se as janelas se cruzam, é conflito de alinhamento
  const vistos = new Set<string>();
  for (const r of resumo)
  {
    for (const t of r.tarefas)
    {
      const a = posicaoPorCodigo.get(t.codigo);
      if (!a) continue;
      for (const rel of t.cardsRelacionados ?? [])
      {
        const b = posicaoPorCodigo.get(rel);
        if (!b || b.pessoaId === a.pessoaId) continue;
        const chave = [t.codigo, rel].sort().join('|');
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        const inicioDe = (x: BarraGantt) => (x.segmentos[0] ? x.segmentos[0].dia * 100 + x.segmentos[0].de : 9999);
        const fimDe = (x: BarraGantt) => (x.segmentos.at(-1) ? x.segmentos.at(-1)!.dia * 100 + x.segmentos.at(-1)!.ate : 9999);
        const [primeira, segunda] = inicioDe(a.barra) <= inicioDe(b.barra) ? [a.barra, b.barra] : [b.barra, a.barra];
        dependencias.push({ de: primeira.codigo, para: segunda.codigo, motivo: 'relacionada', conflito: inicioDe(segunda) < fimDe(primeira) });
      }
    }
  }

  return { dias, linhas, dependencias };
}
