import { agoraLocal, idCurto } from './checklist';
import { somarDias } from './datas';

export type TipoAta = 'diretoria' | 'alinhamento' | 'acompanhamento' | '1on1' | 'cliente' | 'outro';
export type SituacaoCombinado = 'pendente' | 'andamento' | 'concluido' | 'bloqueado';
export type PrioridadeCombinado = 'alta' | 'media' | 'baixa';

export interface DecisaoAta
{
  id: string;
  texto: string;
  impacto?: string | undefined;
  responsavel?: string | undefined;
}

export interface CombinadoAta
{
  id: string;
  tarefa: string;
  responsavel: string;
  prazo?: string | undefined;
  situacao: SituacaoCombinado;
  prioridade: PrioridadeCombinado;
}

export interface PontoAbertoAta
{
  id: string;
  texto: string;
  dono?: string | undefined;
}

export interface Ata
{
  id: string;
  titulo: string;
  data: string;
  horario?: string | undefined;
  tipo: TipoAta;
  participantes: string[];
  pauta: string[];
  resumoExecutivo: string;
  decisoes: DecisaoAta[];
  combinados: CombinadoAta[];
  pontosAbertos: PontoAbertoAta[];
  proximaPauta: string[];
  notasBrutas?: string | undefined;
  criadaEm: string;
  atualizadaEm: string;
}

export interface ItemRadarCombinado
{
  ataId: string;
  ataTitulo: string;
  ataData: string;
  combinado: CombinadoAta;
  statusPrazo: 'atrasado' | 'vencendo' | 'no_prazo' | 'sem_prazo' | 'concluido';
}

export interface RadarCombinados
{
  atrasados: ItemRadarCombinado[];
  vencendo: ItemRadarCombinado[];
  emAberto: ItemRadarCombinado[];
  bloqueados: ItemRadarCombinado[];
  concluidos: ItemRadarCombinado[];
  porResponsavel: { responsavel: string; abertos: number; atrasados: number; concluidos: number }[];
}

export interface EventoIntegracaoRotina
{
  origem: 'orbisos';
  versao: 1;
  tipo: 'combinado_ata';
  idExterno: string;
  titulo: string;
  responsavel: string;
  prazo?: string | undefined;
  prioridade: PrioridadeCombinado;
  situacao: SituacaoCombinado;
  contexto: string;
  ataId: string;
  ataData: string;
}

export const nomesTipoAta: Record<TipoAta, string> = {
  diretoria: 'Diretoria',
  alinhamento: 'Alinhamento',
  acompanhamento: 'Acompanhamento',
  '1on1': '1:1',
  cliente: 'Cliente / Parceiro',
  outro: 'Outro',
};

export const nomesSituacaoCombinado: Record<SituacaoCombinado, string> = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
};

export function criarAta(parcial?: Partial<Ata>): Ata
{
  const agora = agoraLocal();
  return {
    id: parcial?.id ?? idCurto(),
    titulo: parcial?.titulo?.trim() || 'Nova reunião',
    data: parcial?.data || agora.slice(0, 10),
    horario: parcial?.horario,
    tipo: parcial?.tipo ?? 'diretoria',
    participantes: parcial?.participantes ?? [],
    pauta: parcial?.pauta ?? [],
    resumoExecutivo: parcial?.resumoExecutivo ?? '',
    decisoes: parcial?.decisoes ?? [],
    combinados: parcial?.combinados ?? [],
    pontosAbertos: parcial?.pontosAbertos ?? [],
    proximaPauta: parcial?.proximaPauta ?? [],
    notasBrutas: parcial?.notasBrutas,
    criadaEm: parcial?.criadaEm ?? agora,
    atualizadaEm: parcial?.atualizadaEm ?? agora,
  };
}

export function migrarAta(bruta: Partial<Ata>): Ata
{
  const base = criarAta(bruta);
  return {
    ...base,
    participantes: Array.isArray(bruta.participantes) ? bruta.participantes.map((x) => String(x).trim()).filter(Boolean) : [],
    pauta: Array.isArray(bruta.pauta) ? bruta.pauta.map((x) => String(x).trim()).filter(Boolean) : [],
    proximaPauta: Array.isArray(bruta.proximaPauta) ? bruta.proximaPauta.map((x) => String(x).trim()).filter(Boolean) : [],
    decisoes: Array.isArray(bruta.decisoes)
      ? bruta.decisoes.map((d) => ({
          id: d?.id || idCurto(),
          texto: String(d?.texto ?? '').trim(),
          impacto: d?.impacto ? String(d.impacto).trim() : undefined,
          responsavel: d?.responsavel ? String(d.responsavel).trim() : undefined,
        })).filter((d) => d.texto)
      : [],
    combinados: Array.isArray(bruta.combinados)
      ? bruta.combinados.map((c): CombinadoAta => ({
          id: c?.id || idCurto(),
          tarefa: String(c?.tarefa ?? '').trim(),
          responsavel: String(c?.responsavel ?? '').trim() || 'A definir',
          prazo: c?.prazo && /^\d{4}-\d{2}-\d{2}$/.test(c.prazo) ? c.prazo : undefined,
          situacao: c?.situacao === 'andamento' || c?.situacao === 'concluido' || c?.situacao === 'bloqueado' ? c.situacao : 'pendente',
          prioridade: c?.prioridade === 'alta' || c?.prioridade === 'baixa' ? c.prioridade : 'media',
        })).filter((c) => c.tarefa)
      : [],
    pontosAbertos: Array.isArray(bruta.pontosAbertos)
      ? bruta.pontosAbertos.map((p) => ({
          id: p?.id || idCurto(),
          texto: String(p?.texto ?? '').trim(),
          dono: p?.dono ? String(p.dono).trim() : undefined,
        })).filter((p) => p.texto)
      : [],
  };
}

function dataBr(iso?: string): string
{
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Gera um resumo executivo estruturado a partir dos elementos preenchidos na ata. */
export function resumoAutomaticoDaAta(ata: Ata, hoje = agoraLocal().slice(0, 10)): string
{
  const partes: string[] = [];
  const tipo = nomesTipoAta[ata.tipo];
  const quem = ata.participantes.length ? ` com ${ata.participantes.join(', ')}` : '';
  partes.push(`Reunião de ${tipo.toLowerCase()} ("${ata.titulo}") realizada em ${dataBr(ata.data)}${quem}.`);

  if (ata.decisoes.length)
  {
    const principais = ata.decisoes.slice(0, 3).map((d) => d.texto).join('; ');
    const extra = ata.decisoes.length > 3 ? ` (+${ata.decisoes.length - 3} decisões)` : '';
    partes.push(`Principais decisões (${ata.decisoes.length}): ${principais}${extra}.`);
  }

  const abertos = ata.combinados.filter((c) => c.situacao !== 'concluido');
  const atrasados = abertos.filter((c) => c.prazo && c.prazo < hoje);
  const concluidos = ata.combinados.length - abertos.length;

  if (ata.combinados.length)
  {
    const detalheAtraso = atrasados.length ? `, sendo ${atrasados.length} com prazo vencido` : '';
    partes.push(`Foram registrados ${ata.combinados.length} combinados (${concluidos} concluídos, ${abertos.length} em aberto${detalheAtraso}).`);
  }

  if (ata.pontosAbertos.length)
  {
    partes.push(`Ficam ${ata.pontosAbertos.length} ponto(s) em aberto para a próxima rodada.`);
  }

  return partes.join(' ');
}

/** Sugere os tópicos da próxima reunião puxando pontos em aberto e combinados pendentes/bloqueados. */
export function proximaPautaSugerida(ata: Ata): string[]
{
  const itens: string[] = [];
  for (const p of ata.pontosAbertos)
  {
    const dono = p.dono ? ` (${p.dono})` : '';
    itens.push(`Destravar: ${p.texto}${dono}`);
  }
  for (const c of ata.combinados)
  {
    if (c.situacao === 'bloqueado')
    {
      itens.push(`Bloqueio: ${c.tarefa} — ${c.responsavel}`);
    }
    else if (c.situacao !== 'concluido' && c.prioridade === 'alta')
    {
      const prazo = c.prazo ? ` até ${dataBr(c.prazo)}` : '';
      itens.push(`Acompanhar: ${c.tarefa} (${c.responsavel}${prazo})`);
    }
  }
  return [...new Set(itens)];
}

/** Cria a próxima ata da série herdando participantes e pauta sugerida dos pontos em aberto. */
export function gerarProximaAta(ataAnterior: Ata, novaData = somarDias(ataAnterior.data, 7)): Ata
{
  const pautaHerdada = ataAnterior.proximaPauta.length ? [...ataAnterior.proximaPauta] : proximaPautaSugerida(ataAnterior);
  return criarAta({
    titulo: ataAnterior.titulo,
    data: novaData,
    horario: ataAnterior.horario,
    tipo: ataAnterior.tipo,
    participantes: [...ataAnterior.participantes],
    pauta: pautaHerdada,
  });
}

/** Consolida todos os combinados de todas as atas em um radar executivo. */
export function radarDeCombinados(atas: Ata[], hoje = agoraLocal().slice(0, 10)): RadarCombinados
{
  const limiteVencendo = somarDias(hoje, 3);
  const atrasados: ItemRadarCombinado[] = [];
  const vencendo: ItemRadarCombinado[] = [];
  const emAberto: ItemRadarCombinado[] = [];
  const bloqueados: ItemRadarCombinado[] = [];
  const concluidos: ItemRadarCombinado[] = [];
  const mapaResp = new Map<string, { responsavel: string; abertos: number; atrasados: number; concluidos: number }>();

  for (const ata of atas)
  {
    for (const c of ata.combinados)
    {
      const resp = c.responsavel.trim() || 'A definir';
      const chaveResp = resp.toLowerCase();
      const contagem = mapaResp.get(chaveResp) ?? { responsavel: resp, abertos: 0, atrasados: 0, concluidos: 0 };

      let statusPrazo: ItemRadarCombinado['statusPrazo'];
      if (c.situacao === 'concluido')
      {
        statusPrazo = 'concluido';
        contagem.concluidos++;
      }
      else
      {
        contagem.abertos++;
        if (!c.prazo) statusPrazo = 'sem_prazo';
        else if (c.prazo < hoje)
        {
          statusPrazo = 'atrasado';
          contagem.atrasados++;
        }
        else if (c.prazo <= limiteVencendo) statusPrazo = 'vencendo';
        else statusPrazo = 'no_prazo';
      }

      mapaResp.set(chaveResp, contagem);
      const item: ItemRadarCombinado = {
        ataId: ata.id,
        ataTitulo: ata.titulo,
        ataData: ata.data,
        combinado: c,
        statusPrazo,
      };

      if (c.situacao === 'concluido') concluidos.push(item);
      else
      {
        emAberto.push(item);
        if (c.situacao === 'bloqueado') bloqueados.push(item);
        if (statusPrazo === 'atrasado') atrasados.push(item);
        else if (statusPrazo === 'vencendo') vencendo.push(item);
      }
    }
  }

  const ordenarPrazo = (a: ItemRadarCombinado, b: ItemRadarCombinado) =>
    (a.combinado.prazo ?? '9999-12-31').localeCompare(b.combinado.prazo ?? '9999-12-31');

  atrasados.sort(ordenarPrazo);
  vencendo.sort(ordenarPrazo);
  emAberto.sort(ordenarPrazo);
  bloqueados.sort(ordenarPrazo);

  const porResponsavel = [...mapaResp.values()].sort((a, b) => b.atrasados - a.atrasados || b.abertos - a.abertos || a.responsavel.localeCompare(b.responsavel));

  return { atrasados, vencendo, emAberto, bloqueados, concluidos, porResponsavel };
}

/** Mensagem enxuta e estruturada para colar no Teams, WhatsApp ou e-mail. */
export function mensagemTeamsDaAta(ata: Ata): string
{
  const linhas: string[] = [];
  linhas.push(`**ATA — ${ata.titulo}** (${nomesTipoAta[ata.tipo]} · ${dataBr(ata.data)}${ata.horario ? ` às ${ata.horario}` : ''})`);
  if (ata.participantes.length) linhas.push(`**Participantes:** ${ata.participantes.join(', ')}`);
  const resumo = ata.resumoExecutivo.trim() || resumoAutomaticoDaAta(ata);
  linhas.push('', '**Resumo executivo**', resumo);

  if (ata.decisoes.length)
  {
    linhas.push('', '**Decisões tomadas**');
    for (const d of ata.decisoes)
    {
      const extra = [d.responsavel ? `Resp.: ${d.responsavel}` : '', d.impacto ? `Impacto: ${d.impacto}` : ''].filter(Boolean).join(' · ');
      linhas.push(`- ${d.texto}${extra ? ` (${extra})` : ''}`);
    }
  }

  if (ata.combinados.length)
  {
    linhas.push('', '**Combinados e encaminhamentos**');
    for (const c of ata.combinados)
    {
      const check = c.situacao === 'concluido' ? '[x]' : '[ ]';
      const prazo = c.prazo ? ` · prazo ${dataBr(c.prazo)}` : '';
      const status = c.situacao === 'bloqueado' ? ' · BLOQUEADO' : '';
      linhas.push(`- ${check} **${c.responsavel}:** ${c.tarefa}${prazo}${status}`);
    }
  }

  if (ata.pontosAbertos.length)
  {
    linhas.push('', '**Pontos em aberto**');
    for (const p of ata.pontosAbertos)
    {
      linhas.push(`- ${p.texto}${p.dono ? ` (${p.dono})` : ''}`);
    }
  }

  const proxima = ata.proximaPauta.length ? ata.proximaPauta : proximaPautaSugerida(ata);
  if (proxima.length)
  {
    linhas.push('', '**Pauta sugerida para a próxima reunião**');
    for (const item of proxima) linhas.push(`- ${item}`);
  }

  return linhas.join('\n');
}

/** Exporta combinados em formato JSON padronizado para integração com app externo de rotinas. */
export function exportarCombinadosParaIntegracao(atas: Ata[], apenasAbertos = true): EventoIntegracaoRotina[]
{
  const eventos: EventoIntegracaoRotina[] = [];
  for (const ata of atas)
  {
    for (const c of ata.combinados)
    {
      if (apenasAbertos && c.situacao === 'concluido') continue;
      eventos.push({
        origem: 'orbisos',
        versao: 1,
        tipo: 'combinado_ata',
        idExterno: `ata:${ata.id}:${c.id}`,
        titulo: c.tarefa,
        responsavel: c.responsavel,
        prazo: c.prazo,
        prioridade: c.prioridade,
        situacao: c.situacao,
        contexto: `${nomesTipoAta[ata.tipo]} — ${ata.titulo}`,
        ataId: ata.id,
        ataData: ata.data,
      });
    }
  }
  return eventos;
}

/** Monta o prompt para colar em uma IA gratuita e estruturar uma transcrição ou anotações soltas em JSON de Ata. */
export function pedidoDeAtaParaIa(textoBruto: string, contexto?: { titulo?: string; tipo?: TipoAta; data?: string }): string
{
  const dataRef = contexto?.data || agoraLocal().slice(0, 10);
  const tipoRef = contexto?.tipo ?? 'diretoria';
  const tituloRef = contexto?.titulo?.trim() || '';

  return [
    'Você é um assistente executivo de diretoria. Leia o material da reunião abaixo (transcrição ou anotações soltas) e devolva APENAS um JSON válido, sem texto fora do JSON e sem inventar fatos.',
    '',
    'Regras:',
    '- Escreva um resumoExecutivo objetivo em 2 a 4 frases, focado em quem não pôde participar.',
    '- Separe claramente o que foi DECISÃO tomada (decisoes) do que é TAREFA com dono (combinados) e do que ficou sem resposta (pontosAbertos).',
    '- Datas devem estar em formato YYYY-MM-DD (use a data de referência se houver prazo relativo como "sexta-feira"). Se não houver prazo claro, omita o campo prazo.',
    '- prioridade deve ser "alta", "media" ou "baixa". situacao deve ser "pendente", "andamento", "concluido" ou "bloqueado".',
    '- tipo deve ser um de: "diretoria", "alinhamento", "acompanhamento", "1on1", "cliente", "outro".',
    '',
    'Formato exato do JSON:',
    '```json',
    JSON.stringify({
      titulo: tituloRef || 'Título objetivo da reunião',
      data: dataRef,
      horario: '14:00',
      tipo: tipoRef,
      participantes: ['Nome 1', 'Nome 2'],
      pauta: ['Tópico 1', 'Tópico 2'],
      resumoExecutivo: 'Resumo direto dos principais resultados e direcionamentos da reunião.',
      decisoes: [{ texto: 'Decisão tomada', impacto: 'Impacto principal', responsavel: 'Nome' }],
      combinados: [{ tarefa: 'Ação combinada', responsavel: 'Nome', prazo: dataRef, prioridade: 'alta', situacao: 'pendente' }],
      pontosAbertos: [{ texto: 'Dúvida ou tema sem definição', dono: 'Nome' }],
      proximaPauta: ['Tópico para a próxima reunião'],
    }, null, 2),
    '```',
    '',
    'Material da reunião:',
    '---',
    textoBruto.trim(),
    '---',
  ].join('\n');
}

function extrairJson(texto: string): string
{
  const limpo = texto.trim();
  const bloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloco?.[1]) return bloco[1].trim();
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio >= 0 && fim > inicio) return limpo.slice(inicio, fim + 1);
  return limpo;
}

export function validarAtaImportada(jsonTexto: string, notasBrutas?: string): { ata?: Ata; avisos: string[]; erros: string[] }
{
  const avisos: string[] = [];
  const erros: string[] = [];
  let objeto: unknown;
  try
  {
    objeto = JSON.parse(extrairJson(jsonTexto));
  }
  catch
  {
    return { avisos, erros: ['Não consegui ler o JSON. Confira se você colou a resposta completa da IA.'] };
  }

  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto))
  {
    return { avisos, erros: ['O JSON precisa ser um objeto com os campos da ata.'] };
  }

  const bruto = objeto as Partial<Ata>;
  const tiposValidos: TipoAta[] = ['diretoria', 'alinhamento', 'acompanhamento', '1on1', 'cliente', 'outro'];
  if (bruto.tipo && !tiposValidos.includes(bruto.tipo))
  {
    avisos.push(`Tipo "${String(bruto.tipo)}" não reconhecido; ajustado para "diretoria".`);
    bruto.tipo = 'diretoria';
  }

  const ata = migrarAta({ ...bruto, notasBrutas: notasBrutas?.trim() || bruto.notasBrutas });

  if (!ata.resumoExecutivo.trim())
  {
    ata.resumoExecutivo = resumoAutomaticoDaAta(ata);
    avisos.push('A IA não enviou resumo executivo; gerei um resumo automático.');
  }
  if (!ata.decisoes.length && !ata.combinados.length)
  {
    avisos.push('Nenhuma decisão ou combinado foi extraído — revise o texto antes de salvar.');
  }
  if (!ata.proximaPauta.length)
  {
    ata.proximaPauta = proximaPautaSugerida(ata);
  }

  return { ata, avisos, erros };
}
