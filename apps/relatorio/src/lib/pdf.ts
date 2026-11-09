import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import
{
  aplicarControle, definicoesPadrao, estatisticasDoPlano, kpisDosItens, mapaDeDores, mapaDeFrentes, nomesTotais, posicaoNaFaixa,
  resumirSerie, ritmoPorPessoa, semaforoPrazo, semanaDoAno, serieSemanal, somarDias,
  type CorSemaforo, type ItemPlano, type ResumoSerie, type Ritmo, type Tendencia, type TotaisPainel,
} from '@supervisao/core';
import maquina400 from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url';
import maquina700 from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url';
import texto400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import texto400i from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?url';
import texto600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url';
import type { Dados, NotasRelatorio } from './armazenamento.ts';
import { cores, svgBarrasComparadas, svgBarrasEmpilhadas, svgLinha } from './graficos.ts';
import { dataCurta, dataMedia, type contextoDaSemana } from './semana.ts';

type Contexto = ReturnType<typeof contextoDaSemana>;

export const secoesRelatorio = {
  apresentacao: 'Apresentação e metodologia',
  comparativo: 'Indicadores do painel',
  estatistica: 'Análise estatística',
  execucao: 'Execução do plano da semana',
  time: 'Desempenho por pessoa',
  analise: 'Constatações da semana',
  frentes: 'Frentes de trabalho e dores',
  atencao: 'Pontos de atenção',
  riscos: 'Riscos e plano B',
  compromissos: 'Compromissos com a gestão',
  notas: 'Conclusões e encaminhamentos',
  plano: 'Anexo: plano detalhado',
  movimento: 'Anexo: movimento dos cards',
  glossario: 'Anexo: glossário',
} as const;
export type Secao = keyof typeof secoesRelatorio;

const LARGURA = 515;
const corTendencia: Record<Tendencia, string> = { melhorou: cores.verde, piorou: cores.vermelho, igual: cores.suave, neutra: cores.suave };
const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'NO CAMINHO', amarelo: 'ATENÇÃO', vermelho: 'FORA DA META' };
const corSemaforo: Record<CorSemaforo, string> = { verde: cores.verde, amarelo: cores.amarelo, vermelho: cores.vermelho };
const nomesRitmo: Record<Ritmo, string> = { no_ritmo: 'no ritmo', em_risco: 'em risco', atrasado: 'atrasado' };
const corRitmo: Record<Ritmo, string> = { no_ritmo: cores.verde, em_risco: cores.amarelo, atrasado: cores.vermelho };
const nomesStatus: Record<ItemPlano['status'], string> = { a_fazer: 'a fazer', fazendo: 'fazendo', feito: 'feito', bloqueado: 'bloqueado', adiado: 'adiado' };
const corStatus = (s: ItemPlano['status']) => (s === 'feito' ? cores.verde : s === 'bloqueado' || s === 'adiado' ? cores.vermelho : cores.suave);
const nomesCausa: Record<string, string> = {
  requisito_mudou: 'Requisito mudou', dependencia_externa: 'Dependência externa', estimativa_errada: 'Estimativa errada',
  bloqueio: 'Bloqueio', urgencia: 'Entrou urgência', outro: 'Outro',
};

const glossario: [string, string][] = [
  ['Dentro do prazo (%)', 'Percentual das entregas concluídas no período que saíram até o vencimento, como calculado pelo painel do gestor.'],
  ['Meta do painel (%)', 'Meta de entregas dentro do prazo definida no painel para o mês.'],
  ['Concluídos', 'Itens do cronograma já concluídos, contados pelo painel.'],
  ['Concluídas no período', 'Entregas concluídas na janela de tempo que o painel considera.'],
  ['Demandas em andamento', 'Demandas com alguma etapa aberta no momento da foto do painel.'],
  ['Ritmo', 'Classificação do painel para cada demanda em execução: no ritmo, em risco ou atrasada.'],
  ['Atrasados (vencimento passou)', 'Itens ainda abertos cujo vencimento já passou.'],
  ['Eficiência da área', 'Índice do painel composto por prazo, vazão e qualidade.'],
  ['Itens feitos (plano)', 'Itens planejados pela supervisão para a semana que foram marcados como feitos.'],
  ['Itens alterados', 'Itens do plano que foram adiados ou tiveram a data combinada mudada depois da confirmação.'],
  ['Continuidade no cronograma', 'Das entregas feitas, quantas saíram até a previsão ou o vencimento do card no painel.'],
  ['Desvio de entrega', 'Dias úteis entre a data combinada no plano e a entrega. Negativo significa entrega antecipada.'],
  ['Utilização da capacidade', 'Horas planejadas divididas pela capacidade semanal das pessoas com plano.'],
  ['n', 'Quantidade de semanas com o indicador registrado (uma foto por semana: a mais recente).'],
  ['Média e mediana', 'Valor médio da série e valor central quando os valores são ordenados.'],
  ['Desvio-padrão (DP)', 'Quanto os valores variam em torno da média (amostral). Faixa usual = média mais ou menos um DP.'],
  ['Tendência por semana', 'Inclinação da reta de mínimos quadrados: quanto o indicador sobe ou desce, em média, a cada semana.'],
];

let fontesProntas: Promise<void> | undefined;

async function base64(url: string): Promise<string>
{
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// carrega as mesmas fontes da tela dentro do pdf
function prepararFontes(): Promise<void>
{
  fontesProntas ??= (async () =>
  {
    const [m4, m7, t4, t4i, t6] = await Promise.all([maquina400, maquina700, texto400, texto400i, texto600].map(base64));
    pdfMake.addVirtualFileSystem({ 'm4.woff': m4!, 'm7.woff': m7!, 't4.woff': t4!, 't4i.woff': t4i!, 't6.woff': t6! });
    pdfMake.addFonts({
      Maquina: { normal: 'm4.woff', bold: 'm7.woff', italics: 'm4.woff', bolditalics: 'm7.woff' },
      Texto: { normal: 't4.woff', bold: 't6.woff', italics: 't4i.woff', bolditalics: 't6.woff' },
    });
  })();
  return fontesProntas;
}

// tabela com cabeçalho escuro e linhas zebradas
const layoutOficial: CustomTableLayout = {
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.4),
  vLineWidth: () => 0,
  hLineColor: (i, node) => (i === 0 || i === node.table.body.length ? cores.tinta : cores.grade),
  fillColor: (i) => (i === 0 ? cores.tinta : i % 2 === 0 ? '#f4f6f5' : null),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

const layoutFicha: CustomTableLayout = {
  hLineWidth: () => 0.4,
  vLineWidth: () => 0.4,
  hLineColor: () => cores.grade,
  vLineColor: () => cores.grade,
  fillColor: (_i, _n, coluna) => (coluna === 0 ? '#f4f6f5' : null),
  paddingLeft: () => 7,
  paddingRight: () => 7,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

const pequeno = (texto: string | undefined, cor: string = cores.suave): Content => ({ text: texto ?? '', fontSize: 7.5, color: cor });
const marcador = (texto: string, cor: string): Content => ({ text: texto, font: 'Maquina', bold: true, fontSize: 8, color: cor });
const num = (n: number | undefined, sufixo = '') => (n === undefined ? '-' : `${n.toLocaleString('pt-BR')}${sufixo}`);
const direita = (texto: string, extra: Record<string, unknown> = {}): TableCell => ({ text: texto, alignment: 'right', ...extra });

// tira os '' dos stacks das células, que viram linhas em branco
const semVazios = (c: TableCell): TableCell => (c && typeof c === 'object' && 'stack' in c && Array.isArray(c.stack) ? ({ ...c, stack: c.stack.filter((x) => x !== '') } as TableCell) : c);

function sinal(d: number | undefined, sufixo = ''): string
{
  if (d === undefined) return '-';
  if (d === 0) return '=';
  return `${d > 0 ? '+' : ''}${(Math.round(d * 10) / 10).toLocaleString('pt-BR')}${sufixo}`;
}

function tendencia(d: number | undefined, melhorSeSobe: boolean): Tendencia
{
  if (d === undefined) return 'neutra';
  if (d === 0) return 'igual';
  return d > 0 === melhorSeSobe ? 'melhorou' : 'piorou';
}

export interface EntradaPdf
{
  dados: Dados;
  ctx: Contexto;
  notas: NotasRelatorio;
  resumo: string;
}

export function semaforoDoRelatorio(ctx: Contexto, notas: NotasRelatorio): CorSemaforo | undefined
{
  return notas.semaforo ?? semaforoPrazo(ctx.atual.foto?.totais.dentroDoPrazoPct, ctx.meta, definicoesPadrao.semaforo.amareloAte);
}

export const numeroDoRelatorio = (prefixo: string, inicio: string) => `RS-${prefixo}-${inicio.slice(0, 4)}-S${String(semanaDoAno(inicio)).padStart(2, '0')}`;

export function montarDocumento({ dados, ctx, notas, resumo }: EntradaPdf): TDocumentDefinitions
{
  const { atual, anterior, comp } = ctx;
  const t: TotaisPainel = atual.foto?.totais ?? {};
  const ta: TotaisPainel = anterior?.foto?.totais ?? {};
  const cards = atual.foto?.cards ?? [];
  const porCodigo = new Map(cards.map((c) => [c.codigo, c]));
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '-';
  const primeiroNome = (id?: string) => nomePessoa(id).split(' ')[0] ?? '';
  const ocultas = new Set(notas.secoesOcultas ?? []);
  const frasesOcultas = new Set(notas.frasesOcultas ?? []);
  const semaforo = semaforoDoRelatorio(ctx, notas);
  const ident = dados.identificacao;
  const numero = numeroDoRelatorio(dados.prefixo, atual.inicio);
  const emissao = new Date().toLocaleDateString('pt-BR');
  const periodo = `${dataMedia(atual.inicio)} a ${dataMedia(ctx.sexta)}`;
  const kp = comp.planoAtual;
  const kpa = comp.planoAnterior;
  const conteudo: Content[] = [];
  const secao = (s: Secao) => !ocultas.has(s);

  let nSecao = 0;
  let nSub = 0;
  let nTabela = 0;
  let nFigura = 0;
  let nAnexo = 0;

  const h1 = (texto: string): Content =>
  {
    nSecao++;
    nSub = 0;
    return {
      stack: [
        { text: `${nSecao}. ${texto.toUpperCase()}`, style: 'h1', tocItem: true, tocStyle: { bold: true }, tocMargin: [0, 4, 0, 0], headlineLevel: 1 },
        { canvas: [{ type: 'line', x1: 0, y1: 3, x2: LARGURA, y2: 3, lineWidth: 1.2, lineColor: cores.marca }] },
      ],
      margin: [0, 18, 0, 8],
    };
  };
  const anexo = (texto: string): Content =>
  {
    const letra = String.fromCharCode(65 + nAnexo++);
    return {
      stack: [
        { text: `ANEXO ${letra} - ${texto.toUpperCase()}`, style: 'h1', tocItem: true, tocStyle: { bold: true }, tocMargin: [0, 4, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 3, x2: LARGURA, y2: 3, lineWidth: 1.2, lineColor: cores.marca }] },
      ],
      margin: [0, 0, 0, 8],
      pageBreak: 'before',
    };
  };
  const h2 = (texto: string): Content =>
  {
    nSub++;
    return { text: `${nSecao}.${nSub} ${texto}`, style: 'h2', tocItem: true, tocMargin: [14, 1, 0, 0], headlineLevel: 2 };
  };
  const p = (texto: string): Content => ({ text: texto, style: 'p' });
  const fonte = (texto = 'painel do gestor'): Content => ({ text: `Fonte: ${texto}.`, fontSize: 7, color: cores.suave, italics: true, margin: [0, -4, 0, 10] });
  const legendaTabela = (texto: string): Content => ({ text: `Tabela ${++nTabela} - ${texto}`, style: 'legenda', headlineLevel: 3 });
  const legendaFigura = (texto: string): Content => ({ text: `Figura ${++nFigura} - ${texto}`, style: 'legenda', headlineLevel: 3 });

  function tabela(legenda: string, cabecalho: string[], linhas: TableCell[][], larguras: (number | string)[], origem?: string): Content
  {
    return {
      unbreakable: linhas.length <= 12,
      stack: [
        legendaTabela(legenda),
        {
          table: {
            headerRows: 1,
            keepWithHeaderRows: 1,
            dontBreakRows: true,
            widths: larguras,
            body: [cabecalho.map((h, i) => ({ text: h, style: 'th', alignment: i === 0 ? 'left' : 'center' })), ...linhas.map((l) => l.map(semVazios))],
          },
          layout: layoutOficial,
          margin: [0, 0, 0, 6],
        },
        fonte(origem),
      ],
    };
  }

  function figura(legenda: string, svg: string, largura: number, origem?: string): Content
  {
    return { stack: [legendaFigura(legenda), { svg, font: 'Texto', width: largura, alignment: 'center', margin: [0, 2, 0, 6] }, fonte(origem)], unbreakable: true };
  }

  // capa
  conteudo.push(
    { text: 'RELATÓRIO TÉCNICO', font: 'Maquina', bold: true, fontSize: 10, color: cores.marca, characterSpacing: 2, absolutePosition: { x: 50, y: 80 } },
    { text: 'Acompanhamento Semanal', font: 'Maquina', bold: true, fontSize: 30, color: '#ffffff', absolutePosition: { x: 50, y: 100 } },
    { text: `${ident.area} (${dados.prefixo})`, font: 'Maquina', fontSize: 16, color: '#cfd8d3', absolutePosition: { x: 50, y: 142 } },
    { text: `Semana de ${periodo}`, fontSize: 11, color: '#ffffff', absolutePosition: { x: 50, y: 190 } },
    { text: `Nº ${numero}`, font: 'Maquina', fontSize: 10, color: cores.marca, absolutePosition: { x: 50, y: 210 } },
    {
      absolutePosition: { x: 50, y: 320 },
      stack: [
        { text: 'IDENTIFICAÇÃO DO DOCUMENTO', font: 'Maquina', bold: true, fontSize: 9, color: cores.tinta, characterSpacing: 1, margin: [0, 0, 0, 6] },
        {
          table: {
            widths: [150, 345],
            body: [
              ['Documento', { text: numero, font: 'Maquina', bold: true }],
              ['Área', `${ident.area} (${dados.prefixo})`],
              ['Período de referência', periodo],
              ['Foto do painel utilizada', atual.foto ? dataMedia(atual.foto.data) : 'sem foto nesta semana'],
              ['Comparado com', anterior ? `semana de ${dataMedia(anterior.inicio)} a ${dataMedia(somarDias(anterior.inicio, 4))}` : 'sem semana anterior registrada'],
              ['Elaborado por', [ident.elaboradoPor, ident.cargo].filter(Boolean).join(' - ') || '-'],
              ['Destinatário', ident.destinatario || '-'],
              ['Data de emissão', emissao],
              ['Classificação', 'Uso interno'],
              [
                'Situação geral',
                semaforo
                  ? { text: nomesSemaforo[semaforo], font: 'Maquina', bold: true, color: corSemaforo[semaforo] }
                  : { text: 'não definida', color: cores.suave },
              ],
            ].map(([a, b]) => [{ text: a as string, bold: true, fontSize: 8.5 }, typeof b === 'string' ? { text: b, fontSize: 8.5 } : (b as TableCell)]),
          },
          layout: layoutFicha,
        },
      ],
    },
    { text: '', pageBreak: 'after' },
  );

  // sumário
  conteudo.push({
    toc: {
      title: { text: 'SUMÁRIO', style: 'h1', margin: [0, 0, 0, 14] },
      textStyle: { fontSize: 9.5 },
      numberStyle: { font: 'Maquina', fontSize: 9.5 },
    },
  });
  conteudo.push({ text: '', pageBreak: 'after' });

  // 1 sumário executivo
  conteudo.push(h1('Sumário executivo'));
  if (semaforo)
  {
    conteudo.push({
      table: {
        widths: ['auto', '*'],
        body: [[
          { text: nomesSemaforo[semaforo], font: 'Maquina', bold: true, color: '#fff', fillColor: corSemaforo[semaforo], margin: [6, 3, 6, 3] },
          { text: `Situação geral da semana${ctx.meta !== undefined && t.dentroDoPrazoPct !== undefined ? `: ${t.dentroDoPrazoPct}% dentro do prazo para uma meta de ${ctx.meta}%` : ''}.`, margin: [6, 4, 0, 0] },
        ]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8],
    });
  }
  if (resumo.trim()) conteudo.push(p(resumo));
  const vs = (d: number | undefined, sobe: boolean, suf = ''): TableCell => direita(sinal(d, suf), { font: 'Maquina', bold: true, color: corTendencia[tendencia(d, sobe)] });
  const dif = (a?: number, b?: number) => (a !== undefined && b !== undefined ? b - a : undefined);
  conteudo.push(tabela('Quadro-resumo dos indicadores-chave', ['Indicador', 'Semana anterior', 'Esta semana', 'Variação'], [
    ['Dentro do prazo', direita(num(ta.dentroDoPrazoPct, '%')), direita(num(t.dentroDoPrazoPct, '%'), { bold: true }), vs(dif(ta.dentroDoPrazoPct, t.dentroDoPrazoPct), true, ' pp')],
    ['Concluídos no cronograma', direita(num(ta.concluidos)), direita(num(t.concluidos), { bold: true }), vs(dif(ta.concluidos, t.concluidos), true)],
    ['Eficiência da área', direita(num(ta.eficiencia)), direita(num(t.eficiencia), { bold: true }), vs(dif(ta.eficiencia, t.eficiencia), true)],
    ['Itens do plano feitos', direita(kpa ? `${kpa.feitos}/${kpa.planejados}` : '-'), direita(kp ? `${kp.feitos}/${kp.planejados}` : '-', { bold: true }), vs(dif(kpa?.pctFeitos, kp?.pctFeitos), true, ' pp')],
    ['Itens alterados', direita(num(kpa?.alterados)), direita(num(kp?.alterados), { bold: true }), vs(dif(kpa?.alterados, kp?.alterados), false)],
    ['Continuidade no cronograma', direita(num(kpa?.pctDentroDoCronograma, '%')), direita(num(kp?.pctDentroDoCronograma, '%'), { bold: true }), vs(dif(kpa?.pctDentroDoCronograma, kp?.pctDentroDoCronograma), true, ' pp')],
  ], ['*', 85, 85, 70], 'painel do gestor e plano da supervisão'));
  const frases = ctx.frases.filter((f) => !frasesOcultas.has(f.texto));
  const principais = [...frases.filter((f) => f.tom === 'atencao'), ...frases.filter((f) => f.tom === 'positivo')].slice(0, 5);
  if (principais.length)
  {
    conteudo.push({ text: 'Principais constatações', style: 'h3', headlineLevel: 3 });
    conteudo.push({ ol: principais.map((f) => f.texto), style: 'p', margin: [0, 0, 0, 6] });
  }

  // 2 apresentação
  if (secao('apresentacao'))
  {
    conteudo.push(h1(secoesRelatorio.apresentacao));
    conteudo.push(h2('Objetivo'));
    conteudo.push(p(`Este relatório registra o acompanhamento semanal da área de ${ident.area} (${dados.prefixo}) no período de ${periodo}: a situação dos indicadores do painel do gestor, a execução do plano da semana, os riscos e os compromissos assumidos com a gestão, comparando com a semana anterior e com o histórico disponível.`));
    conteudo.push(h2('Fontes de dados'));
    conteudo.push({
      ul: [
        `Painel do gestor: foto de ${atual.foto ? dataMedia(atual.foto.data) : '(sem foto nesta semana)'}, com ${cards.length} cards e ${Object.keys(t).length} indicadores lidos.`,
        `Plano da semana da supervisão: ${atual.plano ? `${kp?.planejados ?? 0} itens planejados${atual.plano.confirmadoEm ? `, confirmado em ${dataMedia(atual.plano.confirmadoEm)}` : ''}${atual.plano.fechadoEm ? `, fechado em ${dataMedia(atual.plano.fechadoEm)}` : ', ainda não fechado'}` : 'não registrado'}.`,
        `Histórico: ${new Set(dados.fotos.map((f) => f.data)).size} fotos do painel e ${dados.planos.length} planos semanais registrados.`,
      ],
      style: 'p',
    });
    conteudo.push(h2('Metodologia'));
    conteudo.push({
      ul: [
        'Os números do painel são usados exatamente como aparecem, sem recálculo.',
        'Para séries históricas é usada uma foto por semana: a mais recente da semana.',
        'As estatísticas são descritivas (média, mediana, desvio-padrão amostral, mínimo e máximo); a tendência é a inclinação da reta de mínimos quadrados por semana.',
        'Faixa usual de um indicador = média mais ou menos um desvio-padrão; só é avaliada com três semanas ou mais.',
        'Prazos do plano são comparados com a previsão e o vencimento do card no painel; desvios de entrega são contados em dias úteis.',
      ],
      style: 'p',
    });
  }

  // 3 indicadores do painel
  const fotosAte = dados.fotos.filter((f) => f.data <= ctx.sexta);
  if (secao('comparativo') && Object.keys(t).length)
  {
    conteudo.push(h1(secoesRelatorio.comparativo));
    conteudo.push(h2('Comparativo com a semana anterior'));
    const chaves: (keyof TotaisPainel)[] = [
      'dentroDoPrazoPct', 'metaPct', 'itensCronograma', 'concluidos', 'concluidosPct', 'concluidasNoPeriodo', 'demandasEmAndamento', 'ritmoNoRitmo',
      'ritmoEmRisco', 'ritmoAtrasadas', 'atrasadosVencimento', 'vencem15Dias', 'previsaoVencida', 'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade',
    ];
    const porChave = new Map(comp.totais.map((l) => [l.chave, l]));
    const linhas: TableCell[][] = [];
    for (const chave of chaves)
    {
      const l = porChave.get(chave);
      if (!l || l.atual === undefined) continue;
      const ehPct = chave.endsWith('Pct');
      const varPct = !ehPct && l.diferenca !== undefined && l.anterior ? (l.diferenca / l.anterior) * 100 : undefined;
      linhas.push([
        nomesTotais[chave],
        direita(num(l.anterior, ehPct ? '%' : ''), { color: cores.suave }),
        direita(num(l.atual, ehPct ? '%' : ''), { bold: true }),
        direita(sinal(l.diferenca, ehPct ? ' pp' : ''), { font: 'Maquina', bold: true, color: corTendencia[l.tendencia] }),
        direita(varPct === undefined ? '-' : sinal(varPct, '%'), { font: 'Maquina', color: corTendencia[l.tendencia] }),
      ]);
    }
    conteudo.push(tabela(
      `Indicadores do painel: semana de ${dataCurta(anterior?.inicio)} x semana de ${dataCurta(atual.inicio)}`,
      ['Indicador', 'Anterior', 'Atual', 'Variação', 'Var. %'],
      linhas,
      ['*', 62, 62, 62, 55],
    ));

    const seriePrazo = serieSemanal(fotosAte, 'dentroDoPrazoPct', atual.inicio).slice(-10);
    const serieConcl = serieSemanal(fotosAte, 'concluidos', atual.inicio).slice(-10);
    if (seriePrazo.length >= 2 || serieConcl.length >= 2)
    {
      conteudo.push(h2('Evolução semanal'));
      if (seriePrazo.length >= 2)
      {
        conteudo.push(figura('Dentro do prazo (%) por semana, com a meta do painel', svgLinha(seriePrazo.map((x) => ({ rotulo: dataCurta(x.semana), valor: x.valor })), { largura: LARGURA, altura: 170, meta: ctx.meta, sufixo: '%', fonte: 'Texto' }), LARGURA));
      }
      if (serieConcl.length >= 2)
      {
        conteudo.push(figura('Itens concluídos no cronograma por semana', svgLinha(serieConcl.map((x) => ({ rotulo: dataCurta(x.semana), valor: x.valor })), { largura: LARGURA, altura: 150, fonte: 'Texto', cor: cores.tinta }), LARGURA));
      }
    }

    const totalRitmo = (t.ritmoNoRitmo ?? 0) + (t.ritmoEmRisco ?? 0) + (t.ritmoAtrasadas ?? 0);
    if (totalRitmo)
    {
      conteudo.push(h2('Distribuição do ritmo das demandas'));
      const pct = (v?: number) => `${(Math.round(((v ?? 0) / totalRitmo) * 1000) / 10).toLocaleString('pt-BR')}%`;
      conteudo.push(tabela('Demandas em andamento por ritmo', ['Ritmo', 'Quantidade', 'Participação'], [
        [marcador('no ritmo', cores.verde), direita(num(t.ritmoNoRitmo)), direita(pct(t.ritmoNoRitmo))],
        [marcador('em risco', cores.amarelo), direita(num(t.ritmoEmRisco)), direita(pct(t.ritmoEmRisco))],
        [marcador('atrasadas', cores.vermelho), direita(num(t.ritmoAtrasadas)), direita(pct(t.ritmoAtrasadas))],
        [{ text: 'Total', bold: true }, direita(num(totalRitmo), { bold: true }), direita('100%', { bold: true })],
      ], ['*', 90, 90]));
    }
  }

  // 4 estatística
  if (secao('estatistica'))
  {
    const indicadores: { chave: keyof TotaisPainel; sobe: boolean }[] = [
      { chave: 'dentroDoPrazoPct', sobe: true }, { chave: 'concluidos', sobe: true }, { chave: 'concluidasNoPeriodo', sobe: true },
      { chave: 'demandasEmAndamento', sobe: false }, { chave: 'ritmoNoRitmo', sobe: true }, { chave: 'ritmoEmRisco', sobe: false },
      { chave: 'ritmoAtrasadas', sobe: false }, { chave: 'atrasadosVencimento', sobe: false }, { chave: 'eficiencia', sobe: true },
    ];
    const resumos = indicadores
      .map((i) => ({ ...i, r: resumirSerie(serieSemanal(fotosAte, i.chave, atual.inicio).map((x) => x.valor)) }))
      .filter((i): i is typeof i & { r: ResumoSerie } => !!i.r);
    const planosAte = dados.planos.filter((pl) => pl.inicio <= atual.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const seriePlano = planosAte
      .map((pl) => kpisDosItens(pl.pessoas.flatMap((pp) => pp.itens), dados.fotos.find((f) => f.data >= pl.inicio && f.data <= ctx.sexta)?.cards ?? []).pctFeitos)
      .filter((v): v is number => v !== undefined);
    const rPlano = resumirSerie(seriePlano);
    if (resumos.length || rPlano)
    {
      conteudo.push(h1(secoesRelatorio.estatistica));
      conteudo.push(h2('Estatística descritiva da série histórica'));
      const n = Math.max(...resumos.map((x) => x.r.n), rPlano?.n ?? 0);
      conteudo.push(p(`Série de ${n} ${n === 1 ? 'semana' : 'semanas'} até a semana de ${dataMedia(atual.inicio)}.${n < 3 ? ' Com menos de três semanas, as estatísticas servem só como referência inicial; a faixa usual ainda não é avaliada.' : ''}`));
      const linhaEst = (rotulo: string, r: ResumoSerie, sobe: boolean, suf = ''): TableCell[] =>
      {
        const corTend = r.n < 2 || r.inclinacao === 0 ? cores.suave : (r.inclinacao > 0) === sobe ? cores.verde : cores.vermelho;
        const pos = posicaoNaFaixa(r);
        return [
          rotulo,
          direita(String(r.n)),
          direita(num(r.media, suf)),
          direita(num(r.mediana, suf)),
          direita(num(r.desvio)),
          direita(`${num(r.minimo)} / ${num(r.maximo)}`),
          direita(r.n < 2 ? '-' : sinal(r.inclinacao), { font: 'Maquina', bold: true, color: corTend }),
          direita(`${num(r.ultimo, suf)}${pos === 'acima' || pos === 'abaixo' ? ` (${pos})` : ''}`, { bold: true, color: pos === 'acima' || pos === 'abaixo' ? cores.amarelo : cores.tinta }),
        ];
      };
      const linhas = resumos.map((x) => linhaEst(nomesTotais[x.chave], x.r, x.sobe, x.chave.endsWith('Pct') ? '%' : ''));
      if (rPlano) linhas.push(linhaEst('Plano: % de itens feitos', rPlano, true, '%'));
      conteudo.push(tabela('Estatísticas descritivas por indicador', ['Indicador', 'n', 'Média', 'Mediana', 'DP', 'Mín / Máx', 'Tend./sem', 'Atual'], linhas, ['*', 20, 46, 46, 34, 58, 48, 58], 'painel do gestor (uma foto por semana) e planos da supervisão'));
      const leituras: string[] = [];
      for (const x of resumos)
      {
        const pos = posicaoNaFaixa(x.r);
        const suf = x.chave.endsWith('Pct') ? '%' : '';
        const partes: string[] = [];
        if (pos === 'acima' || pos === 'abaixo')
        {
          partes.push(`o valor atual (${num(x.r.ultimo, suf)}) está ${pos} da faixa usual (${num(Math.round((x.r.media - x.r.desvio) * 10) / 10, suf)} a ${num(Math.round((x.r.media + x.r.desvio) * 10) / 10, suf)})`);
        }
        if (x.r.n >= 3 && Math.abs(x.r.inclinacao) >= 0.5)
        {
          const bom = (x.r.inclinacao > 0) === x.sobe;
          partes.push(`tendência de ${x.r.inclinacao > 0 ? 'alta' : 'queda'} de ${num(Math.abs(x.r.inclinacao), suf ? ' pp' : '')} por semana (${bom ? 'favorável' : 'desfavorável'})`);
        }
        if (partes.length) leituras.push(`${nomesTotais[x.chave]}: ${partes.join('; ')}.`);
      }
      if (leituras.length)
      {
        conteudo.push({ text: 'Leitura dos resultados', style: 'h3', headlineLevel: 3 });
        conteudo.push({ ul: leituras, style: 'p' });
      }
    }
  }

  // 5 execução do plano
  if (secao('execucao') && atual.plano)
  {
    const e = estatisticasDoPlano(atual.plano, dados.pessoas);
    if (e.total)
    {
      conteudo.push(h1(secoesRelatorio.execucao));
      conteudo.push(h2('Situação dos itens'));
      const pct = (v: number) => `${(Math.round((v / e.total) * 1000) / 10).toLocaleString('pt-BR')}%`;
      conteudo.push(tabela('Itens do plano por situação', ['Situação', 'Itens', 'Participação'], [
        ...(Object.keys(e.porStatus) as ItemPlano['status'][]).filter((s) => e.porStatus[s]).map((s) => [marcador(nomesStatus[s], corStatus(s)), direita(String(e.porStatus[s])), direita(pct(e.porStatus[s]))]),
        [{ text: 'Total', bold: true }, direita(String(e.total), { bold: true }), direita('100%', { bold: true })],
      ], ['*', 80, 80], 'plano da supervisão'));

      conteudo.push(h2('Prazo das entregas e capacidade'));
      const d = e.desvioEntrega;
      conteudo.push(tabela('Indicadores de execução', ['Indicador', 'Valor'], [
        ['Entregas no prazo combinado', direita(e.entregasComData ? `${e.entregasNoCombinado} de ${e.entregasComData} (${Math.round((e.entregasNoCombinado / e.entregasComData) * 100)}%)` : '-')],
        ['Desvio médio de entrega (dias úteis)', direita(d ? (d.media ? sinal(d.media) : '0') : '-')],
        ['Desvio mediano de entrega (dias úteis)', direita(d ? (d.mediana ? sinal(d.mediana) : '0') : '-')],
        ['Maior atraso de entrega (dias úteis)', direita(d && d.maximo > 0 ? `${d.maximo}` : '0')],
        ['Continuidade no cronograma do painel', direita(kp?.feitosComLimite ? `${kp.dentroDoCronograma} de ${kp.feitosComLimite} (${kp.pctDentroDoCronograma}%)` : '-')],
        ['Itens não planejados feitos', direita(String(kp?.naoPlanejadosFeitos ?? 0))],
        ['Horas planejadas / capacidade', direita(e.capacidade ? `${e.horasPlanejadas}h / ${e.capacidade}h (${e.utilizacaoPct}%)` : '-')],
      ], ['*', 160], 'plano da supervisão e painel do gestor'));

      if (e.causas.length)
      {
        conteudo.push(h2('Causas dos itens não concluídos (Pareto)'));
        conteudo.push(tabela('Causas por frequência', ['Causa', 'Itens', '%', '% acumulado'], e.causas.map((c) => [
          nomesCausa[c.rotulo] ?? c.rotulo, direita(String(c.qtd)), direita(num(c.pct, '%')), direita(num(c.pctAcumulado, '%')),
        ]), ['*', 50, 60, 75], 'fechamento do plano'));
      }

      const naoSaiu = atual.plano.pessoas.flatMap((pp) => pp.itens.filter((i) => i.status !== 'feito' && (atual.plano?.fechadoEm || i.motivoNaoFeito || i.status === 'adiado' || i.status === 'bloqueado')).map((item) => ({ pessoaId: pp.pessoaId, item })));
      if (naoSaiu.length)
      {
        conteudo.push(h2('Itens não concluídos'));
        conteudo.push(tabela('Itens que não saíram e motivo', ['Responsável', 'Item', 'Situação', 'Causa', 'Motivo'], naoSaiu.map(({ pessoaId, item }) => [
          primeiroNome(pessoaId),
          { text: [{ text: `${item.cardCodigo ?? 'sem card'} `, bold: true }, item.descricao] },
          marcador(nomesStatus[item.status], corStatus(item.status)),
          item.causa ? nomesCausa[item.causa] ?? item.causa : '-',
          item.motivoNaoFeito ?? '-',
        ]), [60, '*', 52, 80, 120], 'fechamento do plano'));
      }
    }
  }

  // 6 por pessoa
  if (secao('time'))
  {
    const comCarga = comp.pessoas.filter((x) => x.atual.planejados > 0 || x.horas > 0);
    const emExec = cards.filter((c) => c.origens.includes('em_execucao')).map((c) => aplicarControle(c, atual.foto!.data, dados.controle[c.codigo]));
    const ritmo = ritmoPorPessoa(emExec, dados.pessoas).filter((r) => r.contagem.total > 0);
    if (comCarga.length || ritmo.length)
    {
      conteudo.push(h1(secoesRelatorio.time));
      if (comCarga.length)
      {
        conteudo.push(h2('Resultado individual'));
        conteudo.push(tabela('Plano, entregas e carga por pessoa', ['Pessoa', 'Feitos', '% feito', 'Anterior', 'Alterados', 'Horas / cap.', 'Utiliz.', 'Alertas'], comCarga.map((x) =>
        {
          const util = x.pessoa.capacidadeHorasSemana ? Math.round((x.horas / x.pessoa.capacidadeHorasSemana) * 100) : undefined;
          return [
            { text: x.pessoa.nome, bold: true },
            direita(`${x.atual.feitos}/${x.atual.planejados}`),
            direita(num(x.atual.pctFeitos, '%'), { bold: true }),
            direita(num(x.anterior?.pctFeitos, '%'), { color: cores.suave }),
            direita(String(x.atual.alterados)),
            direita(`${x.horas}h / ${x.pessoa.capacidadeHorasSemana}h`),
            direita(num(util, '%'), { color: (util ?? 0) > 100 ? cores.vermelho : cores.tinta, bold: (util ?? 0) > 100 }),
            direita(String(x.alertas), { color: x.alertas ? cores.vermelho : cores.suave }),
          ];
        }), ['*', 40, 42, 44, 46, 70, 40, 38], 'plano da supervisão'));
        const comPlano = comCarga.filter((x) => x.atual.planejados > 0);
        if (comPlano.length)
        {
          conteudo.push(figura('% do plano feito por pessoa: semana anterior x esta semana', svgBarrasComparadas(comPlano.map((x) => ({ rotulo: x.pessoa.nome, antes: x.anterior?.pctFeitos, agora: x.atual.pctFeitos ?? 0 })), { largura: LARGURA, fonte: 'Texto' }), LARGURA, 'plano da supervisão'));
        }
      }
      if (ritmo.length)
      {
        conteudo.push(h2('Ritmo das demandas por responsável'));
        conteudo.push(figura('Demandas em execução por ritmo (verde: no ritmo; amarelo: em risco; vermelho: atrasado; cinza: sem ritmo)', svgBarrasEmpilhadas(ritmo.map((r) => ({
          rotulo: r.pessoa.nome,
          partes: [
            { valor: r.contagem.no_ritmo, cor: cores.verde },
            { valor: r.contagem.em_risco, cor: cores.amarelo },
            { valor: r.contagem.atrasado, cor: cores.vermelho },
            { valor: r.contagem.semRitmo, cor: cores.cinza },
          ],
        })), { largura: LARGURA, fonte: 'Texto' }), LARGURA));
      }
      const dificuldades = atual.plano?.pessoas.filter((pp) => pp.dificuldade?.trim()) ?? [];
      if (dificuldades.length)
      {
        conteudo.push(h2('Maior dificuldade relatada'));
        conteudo.push(tabela('Dificuldades por pessoa', ['Pessoa', 'Dificuldade'], dificuldades.map((pp) => [{ text: nomePessoa(pp.pessoaId), bold: true }, pp.dificuldade!]), [110, '*'], 'plano da supervisão'));
      }
    }
  }

  // 7 constatações
  if (secao('analise') && frases.length)
  {
    conteudo.push(h1(secoesRelatorio.analise));
    conteudo.push(p('Constatações geradas por regras a partir dos números do painel e do plano, comparando com a semana anterior.'));
    const grupos: [string, typeof frases][] = [
      ['Pontos que pedem atenção', frases.filter((f) => f.tom === 'atencao')],
      ['Pontos positivos', frases.filter((f) => f.tom === 'positivo')],
      ['Outras observações', frases.filter((f) => f.tom === 'neutro')],
    ];
    for (const [rotulo, lista] of grupos.filter(([, l]) => l.length))
    {
      conteudo.push({ text: rotulo, style: 'h3', headlineLevel: 3 });
      conteudo.push({ ul: lista.map((f) => f.texto), style: 'p' });
    }
  }

  // 8 frentes e dores
  if (secao('frentes') && atual.plano)
  {
    const frentes = mapaDeFrentes(atual.plano);
    const dores = mapaDeDores(atual.plano);
    const pessoas = dados.pessoas.filter((x) => frentes.some((f) => f.porPessoa[x.id]));
    if (frentes.length)
    {
      conteudo.push(h1(secoesRelatorio.frentes));
      conteudo.push(tabela('Matriz de frentes por pessoa', ['Frente', ...pessoas.map((x) => x.nome.split(' ')[0]!)], frentes.map((f) => [
        { text: f.frente, bold: true },
        ...pessoas.map((x): TableCell => ({
          stack: (f.porPessoa[x.id] ?? []).map((i) => ({ text: [{ text: `${i.cardCodigo ?? 'sem card'} `, bold: true, color: corStatus(i.status) }, i.descricao], fontSize: 8, margin: [0, 0, 0, 2] })),
        })),
      ]), [90, ...pessoas.map(() => '*')], 'plano da supervisão'));
      if (dores.length)
      {
        conteudo.push(tabela('Dores atacadas na semana', ['Dor', 'Onde e quem'], dores.map((d) => [
          { text: d.dor, bold: true },
          d.itens.map(({ pessoaId, item }) => `${item.cardCodigo ?? 'sem card'} (${primeiroNome(pessoaId)})`).join(', '),
        ]), [200, '*'], 'plano da supervisão'));
      }
    }
  }

  // 9 atenção
  if (secao('atencao'))
  {
    const emRisco = cards
      .filter((c) => c.origens.includes('em_execucao') && (c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || (c.previsao ?? '9999') < atual.inicio))
      .sort((a, b) => (a.previsao ?? '').localeCompare(b.previsao ?? ''));
    if (ctx.alertas.length || emRisco.length)
    {
      conteudo.push(h1(secoesRelatorio.atencao));
      if (ctx.alertas.length)
      {
        conteudo.push(h2('Plano além do que o painel espera'));
        conteudo.push(tabela('Alertas do plano', ['Nível', 'Descrição'], ctx.alertas.map((a) => [
          marcador(a.nivel === 'alto' ? 'alto' : 'médio', a.nivel === 'alto' ? cores.vermelho : cores.amarelo),
          a.texto,
        ]), [50, '*'], 'plano da supervisão comparado ao painel'));
      }
      if (emRisco.length)
      {
        conteudo.push(h2('Demandas em risco, atrasadas ou com previsão vencida'));
        conteudo.push(tabela('Demandas que pedem acompanhamento', ['Card', 'Etapa atual / responsável', 'Etapas', 'Previsão', 'Ritmo'], emRisco.map((c) => [
          { stack: [{ text: c.codigo, bold: true, font: 'Maquina' }, pequeno(c.titulo)] },
          { stack: [c.etapaAtual ?? '-', pequeno(nomePessoa(c.responsavelEtapaAtual))] },
          direita(`${c.etapasConcluidas ?? '?'}/${c.etapasTotal ?? '?'}`),
          direita(dataMedia(c.previsao), { color: (c.previsao ?? '9999') < atual.inicio ? cores.vermelho : cores.tinta }),
          c.ritmoPainel ? marcador(nomesRitmo[c.ritmoPainel], corRitmo[c.ritmoPainel]) : '',
        ]), ['*', 120, 40, 52, 55]));
      }
    }
  }

  // 10 riscos
  const riscos = dados.riscos.filter((r) => r.status === 'aberto' || (r.sinalizadoEm >= atual.inicio && r.sinalizadoEm <= ctx.sexta));
  if (secao('riscos') && riscos.length)
  {
    conteudo.push(h1(secoesRelatorio.riscos));
    conteudo.push(tabela('Registro de riscos', ['Risco', 'Prob. / impacto', 'Plano B', 'Decisão necessária'], riscos.map((r) => [
      { stack: [{ text: r.descricao, bold: true }, pequeno([r.cardCodigo, r.pessoaId && nomePessoa(r.pessoaId), r.gatilho && `gatilho: ${r.gatilho}`].filter(Boolean).join(' - '))] },
      marcador(`${r.probabilidade} / ${r.impacto}`, r.impacto === 'alto' || r.probabilidade === 'alta' ? cores.vermelho : cores.amarelo),
      r.planoB,
      { stack: [r.decisaoNecessaria ?? '-', r.prazoDecisao ? pequeno(`até ${dataMedia(r.prazoDecisao)}`, cores.vermelho) : ''] },
    ]), ['*', 65, 150, 100], 'supervisão'));
  }

  // 11 compromissos
  const promessas = [...ctx.promessasAnteriores, ...dados.promessas.filter((x) => x.semana === atual.inicio)];
  if (secao('compromissos') && promessas.length)
  {
    conteudo.push(h1(secoesRelatorio.compromissos));
    const anteriores = ctx.promessasAnteriores;
    const cumpridas = anteriores.filter((x) => x.cumprida === true).length;
    if (anteriores.length) conteudo.push(p(`Dos ${anteriores.length} compromissos da semana anterior, ${cumpridas} ${cumpridas === 1 ? 'foi cumprido' : 'foram cumpridos'} (${Math.round((cumpridas / anteriores.length) * 100)}%).`));
    conteudo.push(tabela('Compromissos assumidos', ['Semana', 'Compromisso', 'Situação'], promessas.map((x) => [
      { text: dataCurta(x.semana), font: 'Maquina' },
      { stack: [x.texto, x.justificativa ? pequeno(x.justificativa) : ''] },
      marcador(x.cumprida === true ? 'cumprido' : x.cumprida === false ? 'não cumprido' : 'em aberto', x.cumprida === true ? cores.verde : x.cumprida === false ? cores.vermelho : cores.suave),
    ]), [55, '*', 75], 'supervisão'));
  }

  // 12 conclusões
  if (secao('notas'))
  {
    conteudo.push(h1(secoesRelatorio.notas));
    const blocos: [string, string | undefined][] = [['Destaques da semana', notas.destaques], ['Decisões e apoio necessários da gestão', notas.decisoes], ['Próximos passos', notas.proximosPassos]];
    const escritos = blocos.filter(([, v]) => v?.trim());
    for (const [rotulo, valor] of escritos)
    {
      conteudo.push(h2(rotulo));
      conteudo.push({ ul: valor!.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean), style: 'p' });
    }
    if (!escritos.length)
    {
      conteudo.push(p(resumo.trim() || 'Sem conclusões registradas pela supervisão para esta semana.'));
    }
    conteudo.push({
      unbreakable: true,
      margin: [0, 24, 0, 0],
      stack: [
        { text: 'APROVAÇÃO', font: 'Maquina', bold: true, fontSize: 9, characterSpacing: 1, margin: [0, 0, 0, 6] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [{ text: 'Elaborado por', bold: true, fontSize: 8 }, { text: 'Ciente', bold: true, fontSize: 8 }],
              [
                { stack: [{ text: '\n\n_______________________________', color: cores.suave }, ident.elaboradoPor || ' ', pequeno(ident.cargo)], margin: [0, 4, 0, 4] },
                { stack: [{ text: '\n\n_______________________________', color: cores.suave }, ident.destinatario || ' ', pequeno('')], margin: [0, 4, 0, 4] },
              ],
              [{ text: 'Data: ____/____/______', fontSize: 8 }, { text: 'Data: ____/____/______', fontSize: 8 }],
            ],
          },
          layout: layoutFicha,
        },
      ],
    });
  }

  // anexos
  if (secao('plano') && atual.plano)
  {
    const comItens = atual.plano.pessoas.filter((pp) => pp.itens.length);
    if (comItens.length)
    {
      conteudo.push(anexo('Plano detalhado da semana'));
      for (const pp of comItens)
      {
        conteudo.push(tabela(`Plano de ${nomePessoa(pp.pessoaId)}`, ['Card', 'O que', 'Para quê', 'Até', 'Situação'], pp.itens.map((i) =>
        {
          const c = i.cardCodigo ? porCodigo.get(i.cardCodigo) : undefined;
          const alerta = ctx.alertas.some((a) => a.itemId === i.id);
          return [
            { stack: [{ text: i.cardCodigo ?? 'sem card', bold: true, font: 'Maquina' }, pequeno(c?.titulo)] },
            { stack: [i.descricao, i.tipo === 'nao_planejado' ? pequeno('não planejado', cores.amarelo) : '', i.frente ? pequeno(`frente: ${i.frente}`) : ''] },
            { text: i.objetivo ?? '', fontSize: 8.5 },
            {
              stack: [
                { text: dataCurta(i.ate), font: 'Maquina' },
                i.ateOriginal && i.ate !== i.ateOriginal ? pequeno(`era ${dataCurta(i.ateOriginal)}`) : '',
                alerta ? pequeno('passa do painel', cores.vermelho) : '',
              ],
            },
            marcador(nomesStatus[i.status], corStatus(i.status)),
          ];
        }), [110, '*', 110, 50, 50], 'plano da supervisão'));
      }
    }
  }

  const movimento = comp.cards.filter((c) => c.etapasAntes !== c.etapasDepois || c.ritmoAntes !== c.ritmoDepois || c.previsaoAntes !== c.previsaoDepois);
  if (secao('movimento') && (movimento.length || comp.entraram.length || comp.sairam.length))
  {
    conteudo.push(anexo('Movimento dos cards'));
    if (movimento.length)
    {
      conteudo.push(tabela(`Cards que mudaram desde a semana de ${dataMedia(anterior?.inicio)}`, ['Card', 'Etapas', 'Ritmo', 'Previsão'], movimento.map((c) => [
        { stack: [{ text: c.codigo, bold: true, font: 'Maquina' }, pequeno(c.titulo)] },
        { text: `${c.etapasAntes ?? '?'} > ${c.etapasDepois ?? '?'}${c.etapasTotal ? ` de ${c.etapasTotal}` : ''}`, font: 'Maquina', color: (c.etapasDepois ?? 0) > (c.etapasAntes ?? 0) ? cores.verde : cores.tinta },
        { text: `${c.ritmoAntes ? nomesRitmo[c.ritmoAntes] : '-'} > ${c.ritmoDepois ? nomesRitmo[c.ritmoDepois] : '-'}`, fontSize: 8.5 },
        { text: c.previsaoAntes === c.previsaoDepois ? dataMedia(c.previsaoDepois) : `${dataCurta(c.previsaoAntes)} > ${dataCurta(c.previsaoDepois)}`, font: 'Maquina', color: c.previsaoAntes !== c.previsaoDepois ? cores.vermelho : cores.tinta },
      ]), ['*', 80, 120, 80]));
    }
    if (comp.entraram.length) conteudo.push(p(`Entraram em execução: ${comp.entraram.join(', ')}.`));
    if (comp.sairam.length) conteudo.push(p(`Saíram da execução (concluídos ou pausados): ${comp.sairam.join(', ')}.`));
  }

  if (secao('glossario'))
  {
    conteudo.push(anexo('Glossário dos indicadores'));
    conteudo.push(tabela('Definições', ['Termo', 'Definição'], glossario.map(([a, b]) => [{ text: a, bold: true }, b]), [140, '*'], 'supervisão'));
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 54],
    info: { title: `Relatório ${numero}`, author: ident.elaboradoPor || ident.cargo, subject: `Acompanhamento semanal ${periodo}` },
    defaultStyle: { font: 'Texto', fontSize: 9, color: cores.tinta, lineHeight: 1.2 },
    styles: {
      th: { font: 'Maquina', bold: true, fontSize: 7.5, color: '#ffffff' },
      h1: { font: 'Maquina', bold: true, fontSize: 13, color: cores.tinta },
      h2: { font: 'Maquina', bold: true, fontSize: 10.5, color: cores.tinta, margin: [0, 10, 0, 5] },
      h3: { bold: true, fontSize: 9.5, margin: [0, 6, 0, 3] },
      p: { fontSize: 9.5, lineHeight: 1.35, alignment: 'justify', margin: [0, 0, 0, 6] },
      legenda: { font: 'Maquina', bold: true, fontSize: 8, color: cores.tinta, margin: [0, 4, 0, 3] },
    },
    background: (pagina) => (pagina === 1
      ? {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 595.28, h: 270, color: '#0e1311' },
          { type: 'rect', x: 0, y: 270, w: 595.28, h: 5, color: cores.marca },
          { type: 'rect', x: 0, y: 816, w: 595.28, h: 25, color: '#0e1311' },
        ],
      }
      : null),
    header: (pagina) => (pagina === 1 ? null : {
      margin: [40, 24, 40, 0],
      stack: [
        {
          columns: [
            { text: [{ text: 'RELATÓRIO DE ACOMPANHAMENTO SEMANAL  ', bold: true }, { text: numero, color: cores.suave }], font: 'Maquina', fontSize: 7.5 },
            { text: 'USO INTERNO', alignment: 'right', font: 'Maquina', bold: true, fontSize: 7.5, color: cores.marca },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: LARGURA, y2: 5, lineWidth: 0.5, lineColor: cores.grade }] },
      ],
    }),
    footer: (pagina, total) => (pagina === 1 ? null : {
      margin: [40, 18, 40, 0],
      columns: [
        { text: `${ident.area} (${dados.prefixo}) - semana de ${periodo}`, fontSize: 7, color: cores.suave },
        { text: `Página ${pagina} de ${total}`, alignment: 'right', font: 'Maquina', fontSize: 8, color: cores.suave },
      ],
    }),
    // título ou legenda no fim da página vai para a próxima junto com o conteúdo
    pageBreakBefore: (no) => !!no.headlineLevel && no.startPosition.verticalRatio > (no.headlineLevel === 1 ? 0.7 : 0.82),
    content: conteudo,
  };
}

export async function gerarPdf(entrada: EntradaPdf): Promise<Blob>
{
  await prepararFontes();
  return pdfMake.createPdf(montarDocumento(entrada)).getBlob();
}

export async function baixarPdf(entrada: EntradaPdf): Promise<void>
{
  await prepararFontes();
  await pdfMake.createPdf(montarDocumento(entrada)).download(`${numeroDoRelatorio(entrada.dados.prefixo, entrada.ctx.atual.inicio)}.pdf`);
}
