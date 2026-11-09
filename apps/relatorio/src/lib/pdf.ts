import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import
{
  aplicarControle, definicoesPadrao, historico, mapaDeDores, mapaDeFrentes, nomesTotais, ritmoPorPessoa, semaforoPrazo,
  type CorSemaforo, type ItemPlano, type Ritmo, type Tendencia, type TotaisPainel,
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
  comparativo: 'Esta semana x semana anterior',
  analise: 'O que mudou na semana',
  time: 'Ritmo e carga do time',
  frentes: 'Frentes e dores',
  plano: 'Plano por pessoa',
  fechamento: 'Fechamento: o que não saiu',
  atencao: 'Pontos de atenção',
  riscos: 'Riscos e plano B',
  compromissos: 'Compromissos com a gestão',
  notas: 'Destaques, decisões e próximos passos',
} as const;
export type Secao = keyof typeof secoesRelatorio;

const LARGURA = 515;
const corTom = { positivo: cores.verde, atencao: cores.amarelo, neutro: cores.cinza };
const corTendencia: Record<Tendencia, string> = { melhorou: cores.verde, piorou: cores.vermelho, igual: cores.suave, neutra: cores.suave };
const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'NO CAMINHO', amarelo: 'ATENÇÃO', vermelho: 'FORA DA META' };
const corSemaforo: Record<CorSemaforo, string> = { verde: cores.verde, amarelo: cores.amarelo, vermelho: cores.vermelho };
const nomesRitmo: Record<Ritmo, string> = { no_ritmo: 'no ritmo', em_risco: 'em risco', atrasado: 'atrasado' };
const corRitmo: Record<Ritmo, string> = { no_ritmo: cores.verde, em_risco: cores.amarelo, atrasado: cores.vermelho };
const nomesStatus: Record<ItemPlano['status'], string> = { a_fazer: 'a fazer', fazendo: 'fazendo', feito: 'feito', bloqueado: 'bloqueado', adiado: 'adiado' };
const corStatus = (s: ItemPlano['status']) => (s === 'feito' ? cores.verde : s === 'bloqueado' || s === 'adiado' ? cores.vermelho : cores.suave);
const nomesCausa: Record<NonNullable<ItemPlano['causa']>, string> = {
  requisito_mudou: 'requisito mudou', dependencia_externa: 'dependência externa', estimativa_errada: 'estimativa errada',
  bloqueio: 'bloqueio', urgencia: 'entrou urgência', outro: 'outro',
};

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

const layoutLinhas: CustomTableLayout = {
  hLineWidth: (i, node) => (i === 0 ? 0 : i === 1 || i === node.table.body.length ? 1 : 0.5),
  vLineWidth: () => 0,
  hLineColor: (i) => (i === 1 ? cores.tinta : cores.grade),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

const layoutCartoes: CustomTableLayout = {
  hLineWidth: () => 0,
  vLineWidth: (i) => (i % 2 === 0 ? 0 : 0),
  paddingLeft: () => 10,
  paddingRight: () => 10,
  paddingTop: () => 8,
  paddingBottom: () => 8,
};

function tabela(cabecalho: string[], linhas: TableCell[][], larguras: (number | string)[]): Content
{
  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: larguras,
      body: [cabecalho.map((h) => ({ text: h.toUpperCase(), style: 'th' })), ...linhas],
    },
    layout: layoutLinhas,
    margin: [0, 2, 0, 8],
  };
}

const pequeno = (texto: string | undefined, cor: string = cores.suave): Content => ({ text: texto ?? '', fontSize: 7.5, color: cor });
const etiqueta = (texto: string, cor: string = cores.suave): Content => ({ text: texto.toUpperCase(), font: 'Maquina', fontSize: 7.5, color: cor, characterSpacing: 0.6 });
const marcador = (texto: string, cor: string): Content => ({ text: texto, font: 'Maquina', bold: true, fontSize: 8, color: cor });

function sinal(d: number | undefined, sufixo = ''): string
{
  if (d === undefined) return '';
  if (d === 0) return '=';
  return `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')}${sufixo}`;
}

function tendencia(d: number | undefined, melhorSeSobe: boolean): Tendencia
{
  if (d === undefined) return 'neutra';
  if (d === 0) return 'igual';
  return d > 0 === melhorSeSobe ? 'melhorou' : 'piorou';
}

function cartaoKpi(rotulo: string, valor: string, detalhe: string, delta?: { texto: string; tendencia: Tendencia }): TableCell
{
  return {
    stack: [
      etiqueta(rotulo),
      { text: valor, font: 'Maquina', bold: true, fontSize: 21, margin: [0, 3, 0, 1] },
      pequeno(detalhe),
      delta?.texto ? { text: delta.texto, font: 'Maquina', bold: true, fontSize: 8, color: corTendencia[delta.tendencia], margin: [0, 3, 0, 0] } : '',
    ],
    fillColor: '#f6f5f2',
  };
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
  const conteudo: Content[] = [];
  let numero = 0;

  const titulo = (texto: string): Content =>
  {
    numero++;
    return {
      stack: [
        { columns: [{ text: String(numero).padStart(2, '0'), width: 26, font: 'Maquina', bold: true, fontSize: 13, color: cores.marca }, { text: texto, font: 'Maquina', bold: true, fontSize: 13 }] },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: LARGURA, y2: 4, lineWidth: 0.8, lineColor: cores.grade }] },
      ],
      margin: [0, 16, 0, 8],
    };
  };
  const secao = (s: Secao) => !ocultas.has(s);

  // capa
  conteudo.push(
    { text: 'RELATÓRIO DE ACOMPANHAMENTO SEMANAL', font: 'Maquina', bold: true, fontSize: 9, color: cores.marca, characterSpacing: 1 },
    { text: `Desenvolvimento (${dados.prefixo})`, font: 'Maquina', bold: true, fontSize: 26, margin: [0, 4, 0, 2] },
    {
      columns: [
        {
          stack: [
            { text: `Semana de ${dataMedia(atual.inicio)} a ${dataMedia(ctx.sexta)}`, fontSize: 10.5 },
            pequeno(`Foto do painel: ${dataMedia(atual.foto?.data)}${anterior ? `  ·  comparado com a semana de ${dataMedia(anterior.inicio)}` : ''}  ·  gerado em ${new Date().toLocaleDateString('pt-BR')}`),
          ],
        },
        semaforo
          ? {
            width: 'auto',
            table: { body: [[{ text: nomesSemaforo[semaforo], font: 'Maquina', bold: true, fontSize: 9, color: '#fff', fillColor: corSemaforo[semaforo], margin: [6, 2, 6, 2] }]] },
            layout: 'noBorders',
          }
          : { text: '', width: 'auto' },
      ],
    },
    { canvas: [{ type: 'rect', x: 0, y: 8, w: LARGURA, h: 3, color: cores.marca }], margin: [0, 0, 0, 6] },
  );

  // resumo e kpis
  const kp = comp.planoAtual;
  const kpa = comp.planoAnterior;
  conteudo.push(titulo('Resumo executivo'));
  if (resumo.trim()) conteudo.push({ text: resumo, fontSize: 10.5, lineHeight: 1.35, margin: [0, 0, 0, 10] });
  const dPrazo = t.dentroDoPrazoPct !== undefined && ta.dentroDoPrazoPct !== undefined ? t.dentroDoPrazoPct - ta.dentroDoPrazoPct : undefined;
  const dConcl = t.concluidos !== undefined && ta.concluidos !== undefined ? t.concluidos - ta.concluidos : undefined;
  const dEfic = t.eficiencia !== undefined && ta.eficiencia !== undefined ? t.eficiencia - ta.eficiencia : undefined;
  const dFeitos = kp?.pctFeitos !== undefined && kpa?.pctFeitos !== undefined ? kp.pctFeitos - kpa.pctFeitos : undefined;
  const dAlter = kp && kpa ? kp.alterados - kpa.alterados : undefined;
  const dCont = kp?.pctDentroDoCronograma !== undefined && kpa?.pctDentroDoCronograma !== undefined ? kp.pctDentroDoCronograma - kpa.pctDentroDoCronograma : undefined;
  const vsAnterior = (d: number | undefined, sobe: boolean, sufixo = '') => (d === undefined ? undefined : { texto: `${sinal(d, sufixo)} vs semana anterior`, tendencia: tendencia(d, sobe) });
  conteudo.push({
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          cartaoKpi('Dentro do prazo', t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}%` : '-', ctx.meta !== undefined ? `meta do painel: ${ctx.meta}%` : '', vsAnterior(dPrazo, true, ' pp')),
          cartaoKpi('Concluídos no cronograma', t.concluidos !== undefined ? String(t.concluidos) : '-', t.itensCronograma !== undefined ? `de ${t.itensCronograma} itens${t.concluidosPct !== undefined ? ` (${t.concluidosPct}%)` : ''}` : '', vsAnterior(dConcl, true)),
          cartaoKpi('Eficiência da área', t.eficiencia !== undefined ? String(t.eficiencia) : '-', t.eficienciaPrazo !== undefined ? `prazo ${t.eficienciaPrazo} · vazão ${t.eficienciaVazao ?? '-'} · qualidade ${t.eficienciaQualidade ?? '-'}` : '', vsAnterior(dEfic, true)),
        ],
        [
          cartaoKpi('Itens feitos (plano)', kp ? `${kp.feitos}/${kp.planejados}` : '-', kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% do planejado${kp.naoPlanejadosFeitos ? ` · +${kp.naoPlanejadosFeitos} não planejados` : ''}` : 'sem plano', vsAnterior(dFeitos, true, ' pp')),
          cartaoKpi('Itens alterados', kp ? String(kp.alterados) : '-', 'data mudada ou adiados', vsAnterior(dAlter, false)),
          cartaoKpi('Continuidade no cronograma', kp?.pctDentroDoCronograma !== undefined ? `${kp.pctDentroDoCronograma}%` : '-', kp?.feitosComLimite ? `${kp.dentroDoCronograma} de ${kp.feitosComLimite} entregas na previsão do card` : 'sem entregas ainda', vsAnterior(dCont, true, ' pp')),
        ],
      ],
    },
    layout: { ...layoutCartoes, hLineWidth: () => 4, vLineWidth: () => 4, hLineColor: () => '#fff', vLineColor: () => '#fff' },
  });

  // comparativo
  if (secao('comparativo'))
  {
    conteudo.push(titulo(secoesRelatorio.comparativo));
    const linhas: TableCell[][] = [];
    const principais: (keyof TotaisPainel)[] = [
      'dentroDoPrazoPct', 'metaPct', 'concluidos', 'concluidosPct', 'concluidasNoPeriodo', 'demandasEmAndamento', 'ritmoNoRitmo', 'ritmoEmRisco',
      'ritmoAtrasadas', 'atrasadosVencimento', 'vencem15Dias', 'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade',
    ];
    const porChave = new Map(comp.totais.map((l) => [l.chave, l]));
    const pct = (c: string) => (c.endsWith('Pct') ? '%' : '');
    for (const chave of principais)
    {
      const l = porChave.get(chave);
      if (!l || (l.atual === undefined && l.anterior === undefined)) continue;
      linhas.push([
        nomesTotais[chave],
        { text: l.anterior !== undefined ? `${l.anterior}${pct(chave)}` : '-', alignment: 'right', color: cores.suave },
        { text: l.atual !== undefined ? `${l.atual}${pct(chave)}` : '-', alignment: 'right', bold: true },
        { text: sinal(l.diferenca, pct(chave) ? ' pp' : ''), alignment: 'right', font: 'Maquina', bold: true, color: corTendencia[l.tendencia] },
      ]);
    }
    const linhaPlano = (rotulo: string, antes: number | undefined, agora: number | undefined, sobe: boolean, sufixo = '') =>
    {
      if (antes === undefined && agora === undefined) return;
      const d = antes !== undefined && agora !== undefined ? agora - antes : undefined;
      linhas.push([
        { text: rotulo, color: cores.tinta },
        { text: antes !== undefined ? `${antes}${sufixo}` : '-', alignment: 'right', color: cores.suave },
        { text: agora !== undefined ? `${agora}${sufixo}` : '-', alignment: 'right', bold: true },
        { text: sinal(d, sufixo ? ' pp' : ''), alignment: 'right', font: 'Maquina', bold: true, color: corTendencia[tendencia(d, sobe)] },
      ]);
    };
    linhaPlano('Plano: itens planejados', kpa?.planejados, kp?.planejados, true);
    linhaPlano('Plano: itens feitos', kpa?.feitos, kp?.feitos, true);
    linhaPlano('Plano: % feito', kpa?.pctFeitos, kp?.pctFeitos, true, '%');
    linhaPlano('Plano: itens alterados', kpa?.alterados, kp?.alterados, false);
    linhaPlano('Plano: continuidade no cronograma', kpa?.pctDentroDoCronograma, kp?.pctDentroDoCronograma, true, '%');
    linhaPlano('Plano: não planejados feitos', kpa?.naoPlanejadosFeitos, kp?.naoPlanejadosFeitos, false);
    if (linhas.length)
    {
      conteudo.push(tabela(['Indicador', anterior ? `Semana ${dataCurta(anterior.inicio)}` : 'Anterior', `Semana ${dataCurta(atual.inicio)}`, 'Variação'], linhas, ['*', 80, 80, 70]));
    }
    else
    {
      conteudo.push(pequeno('Sem números do painel nem plano para comparar.'));
    }

    const fotosAte = dados.fotos.filter((f) => f.data <= ctx.sexta);
    const seriePrazo = historico(fotosAte, 'dentroDoPrazoPct').slice(-8);
    const graficos: Content[] = [];
    if (seriePrazo.length >= 2)
    {
      graficos.push({
        stack: [
          etiqueta('Dentro do prazo por foto do painel'),
          { font: 'Texto', svg: svgLinha(seriePrazo.map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { largura: 250, altura: 150, meta: ctx.meta, sufixo: '%', fonte: 'Texto' }), width: 250 },
        ],
      });
    }
    const pessoasComPlano = comp.pessoas.filter((p) => p.atual.planejados > 0);
    if (pessoasComPlano.length)
    {
      graficos.push({
        stack: [
          etiqueta('% do plano feito por pessoa'),
          {
            font: 'Texto',
            svg: svgBarrasComparadas(pessoasComPlano.map((p) => ({ rotulo: p.pessoa.nome, antes: p.anterior?.pctFeitos, agora: p.atual.pctFeitos ?? 0 })), { largura: 250, fonte: 'Texto' }),
            width: 250,
          },
        ],
      });
    }
    if (graficos.length) conteudo.push({ columns: graficos, columnGap: 15, margin: [0, 6, 0, 0] });
  }

  // análise por regras
  const frases = ctx.frases.filter((f) => !frasesOcultas.has(f.texto));
  if (secao('analise') && frases.length)
  {
    conteudo.push(titulo(secoesRelatorio.analise));
    conteudo.push({
      table: {
        dontBreakRows: true,
        widths: [8, '*'],
        body: frases.map((f) => [
          { canvas: [{ type: 'rect', x: 0, y: 3, w: 6, h: 6, r: 1, color: corTom[f.tom] }] },
          { text: f.texto, fontSize: 9.5 },
        ]),
      },
      layout: { ...layoutLinhas, hLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 },
    });
  }

  // ritmo e carga
  if (secao('time'))
  {
    const emExec = cards.filter((c) => c.origens.includes('em_execucao')).map((c) => aplicarControle(c, atual.foto!.data, dados.controle[c.codigo]));
    const ritmo = ritmoPorPessoa(emExec, dados.pessoas).filter((r) => r.contagem.total > 0);
    const comCarga = comp.pessoas.filter((p) => p.atual.planejados > 0 || p.horas > 0);
    if (ritmo.length || comCarga.length)
    {
      conteudo.push(titulo(secoesRelatorio.time));
      if (ritmo.length)
      {
        conteudo.push(etiqueta('Demandas em execução por ritmo (responsável pela etapa atual)'));
        conteudo.push({
          font: 'Texto',
          svg: svgBarrasEmpilhadas(ritmo.map((r) => ({
            rotulo: r.pessoa.nome,
            partes: [
              { valor: r.contagem.no_ritmo, cor: cores.verde },
              { valor: r.contagem.em_risco, cor: cores.amarelo },
              { valor: r.contagem.atrasado, cor: cores.vermelho },
              { valor: r.contagem.semRitmo, cor: cores.cinza },
            ],
          })), { largura: LARGURA, fonte: 'Texto' }),
          width: LARGURA,
          margin: [0, 4, 0, 2],
        });
        conteudo.push({
          text: [
            { text: '• ', color: cores.verde, fontSize: 12 }, 'no ritmo    ',
            { text: '• ', color: cores.amarelo, fontSize: 12 }, 'em risco    ',
            { text: '• ', color: cores.vermelho, fontSize: 12 }, 'atrasado',
          ],
          fontSize: 7.5,
          color: cores.suave,
          margin: [0, 0, 0, 8],
        });
      }
      if (comCarga.length)
      {
        conteudo.push(tabela(['Pessoa', 'Feitos', 'Horas', 'Alertas', 'Maior dificuldade'], comCarga.map((p) =>
        {
          const pp = atual.plano?.pessoas.find((x) => x.pessoaId === p.pessoa.id);
          const estourou = p.horas > p.pessoa.capacidadeHorasSemana;
          return [
            { text: p.pessoa.nome, bold: true },
            { text: `${p.atual.feitos}/${p.atual.planejados}`, font: 'Maquina' },
            { text: `${p.horas}h / ${p.pessoa.capacidadeHorasSemana}h`, font: 'Maquina', color: estourou ? cores.vermelho : cores.tinta, bold: estourou },
            { text: String(p.alertas), font: 'Maquina', color: p.alertas ? cores.vermelho : cores.suave },
            { text: pp?.dificuldade ?? '-', fontSize: 8.5 },
          ];
        }), [100, 40, 65, 38, '*']));
      }
    }
  }

  // frentes e dores
  if (secao('frentes') && atual.plano)
  {
    const frentes = mapaDeFrentes(atual.plano);
    const dores = mapaDeDores(atual.plano);
    const pessoas = dados.pessoas.filter((p) => frentes.some((f) => f.porPessoa[p.id]));
    if (frentes.length)
    {
      conteudo.push(titulo(secoesRelatorio.frentes));
      conteudo.push(tabela(['Frente', ...pessoas.map((p) => p.nome)], frentes.map((f) => [
        { text: f.frente, font: 'Maquina', bold: true },
        ...pessoas.map((p): TableCell => ({
          stack: (f.porPessoa[p.id] ?? []).map((i) => ({
            text: [{ text: `${i.cardCodigo ?? 'sem card'} `, bold: true, color: corStatus(i.status) }, i.descricao],
            fontSize: 8,
            margin: [0, 0, 0, 2],
          })),
        })),
      ]), [90, ...pessoas.map(() => '*')]));
      if (dores.length)
      {
        conteudo.push(etiqueta('Dores que estamos atacando'));
        conteudo.push(tabela(['Dor', 'Quem e onde'], dores.map((d) => [
          { text: d.dor, bold: true },
          d.itens.map(({ pessoaId, item }) => `${item.cardCodigo ?? 'sem card'} (${primeiroNome(pessoaId)})`).join(', '),
        ]), [200, '*']));
      }
    }
  }

  // plano por pessoa
  if (secao('plano') && atual.plano)
  {
    const comItens = atual.plano.pessoas.filter((pp) => pp.itens.length);
    if (comItens.length)
    {
      conteudo.push(titulo(secoesRelatorio.plano));
      for (const pp of comItens)
      {
        const k = comp.pessoas.find((p) => p.pessoa.id === pp.pessoaId)?.atual;
        conteudo.push({
          stack: [
            {
              columns: [
                { text: nomePessoa(pp.pessoaId), font: 'Maquina', bold: true, fontSize: 11, width: 'auto' },
                { text: k ? `${k.feitos} de ${k.planejados} feitos${k.alterados ? ` · ${k.alterados} ${k.alterados === 1 ? 'alterado' : 'alterados'}` : ''}` : '', fontSize: 8.5, color: cores.suave, margin: [8, 2, 0, 0] },
              ],
            },
            pp.dificuldade ? { text: [{ text: 'Maior dificuldade: ', bold: true }, pp.dificuldade], fontSize: 8.5, color: '#7a2e0e', margin: [0, 3, 0, 0] } : '',
            tabela(['Card', 'O que', 'Para quê', 'Até', 'Status'], pp.itens.map((i) =>
            {
              const c = i.cardCodigo ? porCodigo.get(i.cardCodigo) : undefined;
              const alerta = ctx.alertas.some((a) => a.itemId === i.id);
              return [
                { stack: [{ text: i.cardCodigo ?? 'sem card', bold: true, font: 'Maquina' }, pequeno(c?.titulo)] },
                { stack: [i.descricao, i.tipo === 'nao_planejado' ? pequeno('não planejado', cores.marca) : '', i.frente ? pequeno(`frente: ${i.frente}`) : ''] },
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
            }), [120, '*', 110, 52, 50]),
          ],
          unbreakable: pp.itens.length <= 6,
          margin: [0, 4, 0, 4],
        });
      }
    }
  }

  // fechamento
  const naoSaiu = atual.plano?.pessoas.flatMap((pp) => pp.itens.filter((i) => i.status !== 'feito' && (atual.plano?.fechadoEm || i.motivoNaoFeito || i.status === 'adiado' || i.status === 'bloqueado')).map((item) => ({ pessoaId: pp.pessoaId, item }))) ?? [];
  if (secao('fechamento') && naoSaiu.length)
  {
    conteudo.push(titulo(secoesRelatorio.fechamento));
    conteudo.push(tabela(['Quem', 'Item', 'Status', 'Causa', 'Motivo'], naoSaiu.map(({ pessoaId, item }) => [
      primeiroNome(pessoaId),
      { text: [{ text: `${item.cardCodigo ?? 'sem card'} `, bold: true }, item.descricao] },
      marcador(nomesStatus[item.status], corStatus(item.status)),
      item.causa ? nomesCausa[item.causa] : '-',
      item.motivoNaoFeito ?? '-',
    ]), [60, '*', 52, 80, 120]));
  }

  // atenção
  if (secao('atencao'))
  {
    const emRisco = cards
      .filter((c) => c.origens.includes('em_execucao') && (c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || (c.previsao ?? '9999') < atual.inicio))
      .sort((a, b) => (a.previsao ?? '').localeCompare(b.previsao ?? ''));
    const movimento = comp.cards.filter((c) => c.etapasAntes !== c.etapasDepois || c.ritmoAntes !== c.ritmoDepois || c.previsaoAntes !== c.previsaoDepois);
    if (ctx.alertas.length || emRisco.length || movimento.length)
    {
      conteudo.push(titulo(secoesRelatorio.atencao));
      if (ctx.alertas.length)
      {
        conteudo.push(etiqueta('O plano passa do que o painel espera'));
        conteudo.push({
          ul: ctx.alertas.map((a) => ({ text: a.texto, color: a.nivel === 'alto' ? cores.vermelho : cores.amarelo })),
          fontSize: 9,
          margin: [0, 3, 0, 8],
        });
      }
      if (emRisco.length)
      {
        conteudo.push(etiqueta('Demandas em risco, atrasadas ou com previsão vencida'));
        conteudo.push(tabela(['Card', 'Etapa atual · quem', 'Etapas', 'Previsão', 'Ritmo'], emRisco.map((c) => [
          { stack: [{ text: c.codigo, bold: true, font: 'Maquina' }, pequeno(c.titulo)] },
          { stack: [c.etapaAtual ?? '-', pequeno(nomePessoa(c.responsavelEtapaAtual))] },
          { text: `${c.etapasConcluidas ?? '?'}/${c.etapasTotal ?? '?'}`, font: 'Maquina' },
          { text: dataMedia(c.previsao), font: 'Maquina', color: (c.previsao ?? '9999') < atual.inicio ? cores.vermelho : cores.tinta },
          c.ritmoPainel ? marcador(nomesRitmo[c.ritmoPainel], corRitmo[c.ritmoPainel]) : '',
        ]), ['*', 120, 40, 52, 55]));
      }
      if (movimento.length)
      {
        conteudo.push(etiqueta(`Movimento dos cards desde a semana de ${dataMedia(anterior?.inicio)}`));
        conteudo.push(tabela(['Card', 'Etapas', 'Ritmo', 'Previsão'], movimento.map((c) => [
          { stack: [{ text: c.codigo, bold: true, font: 'Maquina' }, pequeno(c.titulo)] },
          { text: `${c.etapasAntes ?? '?'} » ${c.etapasDepois ?? '?'}${c.etapasTotal ? ` de ${c.etapasTotal}` : ''}`, font: 'Maquina', color: (c.etapasDepois ?? 0) > (c.etapasAntes ?? 0) ? cores.verde : cores.tinta },
          { text: `${c.ritmoAntes ? nomesRitmo[c.ritmoAntes] : '-'} » ${c.ritmoDepois ? nomesRitmo[c.ritmoDepois] : '-'}`, fontSize: 8.5 },
          { text: c.previsaoAntes === c.previsaoDepois ? dataMedia(c.previsaoDepois) : `${dataCurta(c.previsaoAntes)} » ${dataCurta(c.previsaoDepois)}`, font: 'Maquina', color: c.previsaoAntes !== c.previsaoDepois ? cores.vermelho : cores.tinta },
        ]), ['*', 80, 120, 80]));
        if (comp.entraram.length || comp.sairam.length)
        {
          conteudo.push(pequeno(`${comp.entraram.length ? `Entraram em execução: ${comp.entraram.join(', ')}. ` : ''}${comp.sairam.length ? `Saíram da execução: ${comp.sairam.join(', ')}.` : ''}`));
        }
      }
    }
  }

  // riscos
  const riscos = dados.riscos.filter((r) => r.status === 'aberto' || (r.sinalizadoEm >= atual.inicio && r.sinalizadoEm <= ctx.sexta));
  if (secao('riscos') && riscos.length)
  {
    conteudo.push(titulo(secoesRelatorio.riscos));
    conteudo.push(tabela(['Risco', 'Chance · impacto', 'Plano B', 'Decisão necessária'], riscos.map((r) => [
      { stack: [{ text: r.descricao, bold: true }, pequeno([r.cardCodigo, r.pessoaId && nomePessoa(r.pessoaId), r.gatilho && `gatilho: ${r.gatilho}`].filter(Boolean).join(' · '))] },
      marcador(`${r.probabilidade} · ${r.impacto}`, r.impacto === 'alto' || r.probabilidade === 'alta' ? cores.vermelho : cores.amarelo),
      r.planoB,
      { stack: [r.decisaoNecessaria ?? '-', r.prazoDecisao ? pequeno(`até ${dataMedia(r.prazoDecisao)}`, cores.marca) : ''] },
    ]), ['*', 70, 150, 100]));
  }

  // compromissos
  const promessas = [...ctx.promessasAnteriores, ...dados.promessas.filter((p) => p.semana === atual.inicio)];
  if (secao('compromissos') && promessas.length)
  {
    conteudo.push(titulo(secoesRelatorio.compromissos));
    conteudo.push(tabela(['Semana', 'Compromisso', 'Situação'], promessas.map((p) => [
      { text: dataCurta(p.semana), font: 'Maquina' },
      { stack: [p.texto, p.justificativa ? pequeno(p.justificativa) : ''] },
      marcador(p.cumprida === true ? 'cumprido' : p.cumprida === false ? 'não cumprido' : 'em aberto', p.cumprida === true ? cores.verde : p.cumprida === false ? cores.vermelho : cores.suave),
    ]), [55, '*', 75]));
  }

  // notas
  const notasTexto: [string, string | undefined][] = [['Destaques da semana', notas.destaques], ['Decisões e apoio necessários', notas.decisoes], ['Próximos passos', notas.proximosPassos]];
  if (secao('notas') && notasTexto.some(([, v]) => v?.trim()))
  {
    conteudo.push(titulo(secoesRelatorio.notas));
    for (const [rotulo, valor] of notasTexto.filter(([, v]) => v?.trim()))
    {
      conteudo.push(etiqueta(rotulo, cores.marca));
      conteudo.push({ text: valor!, fontSize: 9.5, margin: [0, 2, 0, 8] });
    }
  }

  conteudo.push({ text: 'Fonte: painel do gestor. Os números do painel são usados como estão, sem recálculo; o plano, o fechamento e os riscos são da supervisão.', fontSize: 7, color: cores.suave, margin: [0, 18, 0, 0] });

  return {
    pageSize: 'A4',
    pageMargins: [40, 46, 40, 46],
    info: { title: `Relatório semanal ${dados.prefixo} ${atual.inicio}`, author: 'Supervisão de desenvolvimento' },
    defaultStyle: { font: 'Texto', fontSize: 9, color: cores.tinta, lineHeight: 1.2 },
    styles: { th: { font: 'Maquina', bold: true, fontSize: 7.5, color: cores.suave } },
    header: (pagina) => (pagina === 1 ? '' : {
      columns: [
        { text: [{ text: 'supervisão', bold: true }, { text: '_dev', bold: true, color: cores.marca }], font: 'Maquina', fontSize: 8 },
        { text: `Relatório semanal · ${dataMedia(atual.inicio)} a ${dataMedia(ctx.sexta)}`, alignment: 'right', fontSize: 7.5, color: cores.suave },
      ],
      margin: [40, 20, 40, 0],
    }),
    footer: (pagina, total) => ({
      columns: [
        { text: `Desenvolvimento (${dados.prefixo})`, fontSize: 7, color: cores.suave },
        { text: `${pagina} / ${total}`, alignment: 'right', font: 'Maquina', fontSize: 8, color: cores.suave },
      ],
      margin: [40, 16, 40, 0],
    }),
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
  await pdfMake.createPdf(montarDocumento(entrada)).download(`relatorio-semanal-${entrada.dados.prefixo}-${entrada.ctx.atual.inicio}.pdf`);
}
