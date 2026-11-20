import { agoraLocal, idCurto } from './checklist';

export type ModoPriorizacao = 'impacto_esforco' | 'rice';
export type QuadrantePriorizacao = 'ganho_rapido' | 'projeto_estrategico' | 'preenchimento' | 'evitar';
export type SituacaoIniciativa = 'avaliando' | 'agora' | 'depois' | 'descartado';

export interface IniciativaPriorizacao
{
  id: string;
  titulo: string;
  area?: string | undefined;
  dono?: string | undefined;
  impacto: number;    // 1 a 5
  esforco: number;    // 1 a 5
  urgencia: number;   // 1 a 5
  alcance: number;    // 1 a 10 (usado no RICE)
  confianca: number;  // 0.5 | 0.8 | 1.0 (usado no RICE)
  situacao: SituacaoIniciativa;
  notas?: string | undefined;
}

export interface MatrizPriorizacao
{
  id: string;
  nome: string;
  descricao?: string | undefined;
  modo: ModoPriorizacao;
  itens: IniciativaPriorizacao[];
  criadaEm: string;
  atualizadaEm: string;
}

export interface IniciativaRanqueada
{
  item: IniciativaPriorizacao;
  pontuacao: number;
  quadrante: QuadrantePriorizacao;
  posicao: number;
}

export interface ResumoPriorizacao
{
  ranqueadas: IniciativaRanqueada[];
  contagem: Record<QuadrantePriorizacao, number>;
  recomendacao: string;
}

export const nomesQuadrante: Record<QuadrantePriorizacao, string> = {
  ganho_rapido: 'Ganhos rápidos',
  projeto_estrategico: 'Projetos estratégicos',
  preenchimento: 'Se sobrar tempo',
  evitar: 'Não fazer agora',
};

export const dicasQuadrante: Record<QuadrantePriorizacao, string> = {
  ganho_rapido: 'Alto impacto e baixo esforço — atacar primeiro',
  projeto_estrategico: 'Alto impacto e alto esforço — fatiar e planejar',
  preenchimento: 'Baixo impacto e baixo esforço — encaixar em folgas',
  evitar: 'Baixo impacto e alto esforço — negociar ou descartar',
};

export const nomesSituacaoIniciativa: Record<SituacaoIniciativa, string> = {
  avaliando: 'Avaliando',
  agora: 'Entra agora',
  depois: 'Próximo ciclo',
  descartado: 'Descartado',
};

function limitar(valor: number, min: number, max: number, padrao: number): number
{
  if (!Number.isFinite(valor)) return padrao;
  return Math.min(max, Math.max(min, valor));
}

export function criarIniciativa(parcial?: Partial<IniciativaPriorizacao>): IniciativaPriorizacao
{
  return {
    id: parcial?.id ?? idCurto(),
    titulo: parcial?.titulo?.trim() || 'Nova iniciativa',
    area: parcial?.area?.trim() || undefined,
    dono: parcial?.dono?.trim() || undefined,
    impacto: limitar(Number(parcial?.impacto ?? 3), 1, 5, 3),
    esforco: limitar(Number(parcial?.esforco ?? 3), 1, 5, 3),
    urgencia: limitar(Number(parcial?.urgencia ?? 3), 1, 5, 3),
    alcance: limitar(Number(parcial?.alcance ?? 5), 1, 10, 5),
    confianca: parcial?.confianca === 0.5 || parcial?.confianca === 1 ? parcial.confianca : 0.8,
    situacao: parcial?.situacao === 'agora' || parcial?.situacao === 'depois' || parcial?.situacao === 'descartado' ? parcial.situacao : 'avaliando',
    notas: parcial?.notas?.trim() || undefined,
  };
}

export function criarMatriz(parcial?: Partial<MatrizPriorizacao>): MatrizPriorizacao
{
  const agora = agoraLocal();
  return {
    id: parcial?.id ?? idCurto(),
    nome: parcial?.nome?.trim() || 'Nova matriz de priorização',
    descricao: parcial?.descricao?.trim() || undefined,
    modo: parcial?.modo === 'rice' ? 'rice' : 'impacto_esforco',
    itens: (parcial?.itens ?? []).map((i) => criarIniciativa(i)),
    criadaEm: parcial?.criadaEm ?? agora,
    atualizadaEm: parcial?.atualizadaEm ?? agora,
  };
}

export function migrarMatriz(bruta: Partial<MatrizPriorizacao>): MatrizPriorizacao
{
  return criarMatriz(bruta);
}

/** Classifica no quadrante clássico Impacto (1-5) × Esforço (1-5). */
export function classificarQuadrante(impacto: number, esforco: number): QuadrantePriorizacao
{
  const altoImpacto = impacto >= 3;
  const baixoEsforco = esforco <= 2.5;
  if (altoImpacto && baixoEsforco) return 'ganho_rapido';
  if (altoImpacto) return 'projeto_estrategico';
  if (baixoEsforco) return 'preenchimento';
  return 'evitar';
}

/** Calcula a pontuação de prioridade conforme o modo escolhido. */
export function calcularPontuacao(item: IniciativaPriorizacao, modo: ModoPriorizacao): number
{
  const esforco = Math.max(1, item.esforco);
  if (modo === 'rice')
  {
    const rice = (item.alcance * item.impacto * item.confianca) / esforco;
    return Math.round(rice * 10) / 10;
  }
  const score = (item.impacto * 2 + item.urgencia) / esforco;
  return Math.round(score * 10) / 10;
}

/** Ordena as iniciativas por pontuação, calcula quadrantes e monta recomendação executiva. */
export function ranquearIniciativas(matriz: MatrizPriorizacao): ResumoPriorizacao
{
  const contagem: Record<QuadrantePriorizacao, number> = {
    ganho_rapido: 0,
    projeto_estrategico: 0,
    preenchimento: 0,
    evitar: 0,
  };

  const ordenadas = matriz.itens
    .map((item) =>
    {
      const quadrante = classificarQuadrante(item.impacto, item.esforco);
      if (item.situacao !== 'descartado') contagem[quadrante]++;
      return {
        item,
        pontuacao: calcularPontuacao(item, matriz.modo),
        quadrante,
      };
    })
    .sort((a, b) =>
    {
      if (a.item.situacao === 'descartado' && b.item.situacao !== 'descartado') return 1;
      if (b.item.situacao === 'descartado' && a.item.situacao !== 'descartado') return -1;
      return b.pontuacao - a.pontuacao || b.item.impacto - a.item.impacto || a.item.esforco - b.item.esforco;
    })
    .map((r, idx) => ({ ...r, posicao: idx + 1 }));

  let recomendacao = 'Adicione iniciativas para visualizar o ranking e o quadrante.';
  if (ordenadas.length)
  {
    const top = ordenadas.find((x) => x.item.situacao !== 'descartado');
    const partes: string[] = [];
    if (contagem.ganho_rapido > 0) partes.push(`${contagem.ganho_rapido} ganho(s) rápido(s) para atacar já`);
    if (contagem.projeto_estrategico > 0) partes.push(`${contagem.projeto_estrategico} projeto(s) estratégico(s) para fatiar`);
    if (contagem.evitar > 0) partes.push(`${contagem.evitar} item(ns) de baixo retorno para segurar/descartar`);
    recomendacao = `${partes.join(' · ')}.${top ? ` Foco nº 1 sugerido: "${top.item.titulo}" (nota ${top.pontuacao}).` : ''}`;
  }

  return { ranqueadas: ordenadas, contagem, recomendacao };
}

/** Gera resumo pronto para compartilhar no Teams com a diretoria. */
export function resumoPriorizacaoTeams(matriz: MatrizPriorizacao): string
{
  const resumo = ranquearIniciativas(matriz);
  const metodo = matriz.modo === 'rice' ? 'RICE (Alcance × Impacto × Confiança ÷ Esforço)' : 'Impacto × Esforço';
  const linhas: string[] = [
    `**PRIORIZAÇÃO — ${matriz.nome}**`,
    `Método: ${metodo} · ${matriz.itens.length} iniciativa(s)`,
    '',
    `**Leitura executiva:** ${resumo.recomendacao}`,
    '',
    '**Ranking de prioridades**',
  ];

  for (const r of resumo.ranqueadas)
  {
    const tag = r.item.situacao === 'descartado' ? ' [DESCARTADO]' : '';
    const dono = r.item.dono ? ` · ${r.item.dono}` : '';
    linhas.push(`${r.posicao}. **${r.item.titulo}**${tag} — Nota **${r.pontuacao}** (${nomesQuadrante[r.quadrante]}${dono})`);
  }

  return linhas.join('\n');
}

/** Exemplo pronto para demonstração ou primeiro uso. */
export function matrizExemploDiretoria(): MatrizPriorizacao
{
  return criarMatriz({
    nome: 'Prioridades do trimestre — Diretoria',
    descricao: 'Comparativo de demandas da diretoria e áreas parceiras para definir o foco imediato.',
    modo: 'impacto_esforco',
    itens: [
      criarIniciativa({ titulo: 'Automatizar envio de relatório semanal', area: 'Operações', dono: 'Mariana', impacto: 5, esforco: 2, urgencia: 4, alcance: 9, confianca: 1, situacao: 'agora', notas: 'Economiza ~4h toda sexta-feira.' }),
      criarIniciativa({ titulo: 'Novo portal de acompanhamento para clientes', area: 'Produto', dono: 'Squad Dev', impacto: 5, esforco: 5, urgencia: 3, alcance: 10, confianca: 0.8, situacao: 'depois', notas: 'Alto valor, precisa fatiar em 2 fases.' }),
      criarIniciativa({ titulo: 'Padronizar atas e radar de combinados', area: 'Diretoria', dono: 'Gestão', impacto: 4, esforco: 1, urgencia: 5, alcance: 8, confianca: 1, situacao: 'agora', notas: 'Resolve perda de combinados entre reuniões.' }),
      criarIniciativa({ titulo: 'Ajuste visual de filtros secundários', area: 'UX', dono: 'Front-end', impacto: 2, esforco: 2, urgencia: 2, alcance: 4, confianca: 0.8, situacao: 'avaliando' }),
      criarIniciativa({ titulo: 'Migração completa de legado sem dor ativa', area: 'Infra', dono: 'Arquitetura', impacto: 2, esforco: 5, urgencia: 1, alcance: 3, confianca: 0.5, situacao: 'descartado', notas: 'Alto custo e pouco retorno no trimestre.' }),
    ],
  });
}

/** Prompt para IA gratuita estruturar uma lista bagunçada de pedidos em JSON de Matriz. */
export function pedidoDePriorizacaoParaIa(material: string, modo: ModoPriorizacao = 'impacto_esforco'): string
{
  return [
    'Você é um consultor de gestão e priorização. Transforme a lista de demandas/pedidos abaixo em um JSON válido para matriz de priorização, sem texto fora do JSON.',
    '',
    'Regras:',
    '- impacto, esforco e urgencia são inteiros de 1 (baixo) a 5 (alto).',
    '- alcance é inteiro de 1 a 10. confianca deve ser 0.5, 0.8 ou 1.',
    '- situacao deve ser "avaliando", "agora", "depois" ou "descartado".',
    `- modo deve ser "${modo}".`,
    '',
    'Formato exato:',
    '```json',
    JSON.stringify({
      nome: 'Título da matriz',
      descricao: 'Contexto breve',
      modo,
      itens: [
        {
          titulo: 'Nome da iniciativa',
          area: 'Área',
          dono: 'Responsável',
          impacto: 4,
          esforco: 2,
          urgencia: 4,
          alcance: 7,
          confianca: 0.8,
          situacao: 'avaliando',
          notas: 'Justificativa curta das notas',
        },
      ],
    }, null, 2),
    '```',
    '',
    'Lista de demandas:',
    '---',
    material.trim(),
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

export function validarMatrizImportada(jsonTexto: string): { matriz?: MatrizPriorizacao; erros: string[] }
{
  let objeto: unknown;
  try
  {
    objeto = JSON.parse(extrairJson(jsonTexto));
  }
  catch
  {
    return { erros: ['Não consegui ler o JSON. Confira se você colou a resposta completa da IA.'] };
  }
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto))
  {
    return { erros: ['O JSON precisa ser um objeto com nome e itens.'] };
  }
  const bruta = objeto as Partial<MatrizPriorizacao>;
  if (!Array.isArray(bruta.itens) || !bruta.itens.length)
  {
    return { erros: ['O JSON não trouxe nenhum item na lista "itens".'] };
  }
  return { matriz: migrarMatriz(bruta), erros: [] };
}
