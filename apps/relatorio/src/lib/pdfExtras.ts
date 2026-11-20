import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import
{
  nomesQuadrante,
  nomesSituacaoCombinado,
  nomesSituacaoIniciativa,
  nomesTipoAta,
  proximaPautaSugerida,
  ranquearIniciativas,
  resumoAutomaticoDaAta,
  type Ata,
  type MatrizPriorizacao,
} from '@supervisao/core';
import maquina400 from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url';
import maquina700 from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url';
import texto400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import texto400i from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?url';
import texto600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url';
import { cores } from './graficos.ts';

let fontesProntas: Promise<void> | undefined;

async function base64(url: string): Promise<string>
{
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

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

const layoutTabela: CustomTableLayout = {
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.4),
  vLineWidth: () => 0,
  hLineColor: (i, node) => (i === 0 || i === node.table.body.length ? cores.tinta : cores.grade),
  fillColor: (i) => (i === 0 ? cores.tinta : i % 2 === 0 ? '#f4f6f5' : null),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

const dataBr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documento';

export async function baixarPdfAta(ata: Ata): Promise<void>
{
  await prepararFontes();
  const resumo = ata.resumoExecutivo.trim() || resumoAutomaticoDaAta(ata);
  const proxima = ata.proximaPauta.length ? ata.proximaPauta : proximaPautaSugerida(ata);

  const conteudo: Content[] = [
    { text: 'ORBISOS · ATA DE REUNIÃO', font: 'Maquina', fontSize: 9, color: cores.verde, bold: true },
    { text: ata.titulo, font: 'Maquina', fontSize: 18, bold: true, color: cores.tinta, margin: [0, 2, 0, 6] },
    {
      text: `${nomesTipoAta[ata.tipo]}  ·  ${dataBr(ata.data)}${ata.horario ? ` às ${ata.horario}` : ''}${ata.participantes.length ? `  ·  Participantes: ${ata.participantes.join(', ')}` : ''}`,
      fontSize: 9.5,
      color: cores.suave,
      margin: [0, 0, 0, 12],
    },
    { text: 'RESUMO EXECUTIVO', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 4, 0, 4] },
    { text: resumo, fontSize: 10, margin: [0, 0, 0, 12] },
  ];

  if (ata.decisoes.length)
  {
    conteudo.push({ text: 'DECISÕES TOMADAS', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 4, 0, 4] });
    conteudo.push({
      ul: ata.decisoes.map((d) =>
      {
        const extra = [d.responsavel ? `Resp.: ${d.responsavel}` : '', d.impacto ? `Impacto: ${d.impacto}` : ''].filter(Boolean).join(' · ');
        return `${d.texto}${extra ? ` (${extra})` : ''}`;
      }),
      fontSize: 9.5,
      margin: [0, 0, 0, 12],
    });
  }

  if (ata.combinados.length)
  {
    conteudo.push({ text: 'COMBINADOS E ENCAMINHAMENTOS', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 4, 0, 6] });
    const linhas: TableCell[][] = [
      [
        { text: 'Tarefa', bold: true, color: '#ffffff' },
        { text: 'Responsável', bold: true, color: '#ffffff' },
        { text: 'Prazo', bold: true, color: '#ffffff' },
        { text: 'Situação', bold: true, color: '#ffffff' },
      ],
      ...ata.combinados.map((c): TableCell[] => [
        { text: c.tarefa },
        { text: c.responsavel },
        { text: dataBr(c.prazo) },
        { text: nomesSituacaoCombinado[c.situacao], bold: c.situacao === 'bloqueado', color: c.situacao === 'concluido' ? cores.verde : c.situacao === 'bloqueado' ? cores.vermelho : cores.tinta },
      ]),
    ];
    conteudo.push({
      table: { headerRows: 1, widths: ['*', 95, 65, 75], body: linhas },
      layout: layoutTabela,
      fontSize: 9,
      margin: [0, 0, 0, 12],
    });
  }

  if (ata.pontosAbertos.length)
  {
    conteudo.push({ text: 'PONTOS EM ABERTO', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 4, 0, 4] });
    conteudo.push({
      ul: ata.pontosAbertos.map((p) => `${p.texto}${p.dono ? ` (${p.dono})` : ''}`),
      fontSize: 9.5,
      margin: [0, 0, 0, 12],
    });
  }

  if (proxima.length)
  {
    conteudo.push({ text: 'PAUTA SUGERIDA PARA A PRÓXIMA REUNIÃO', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 4, 0, 4] });
    conteudo.push({ ul: proxima, fontSize: 9.5 });
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 42],
    defaultStyle: { font: 'Texto', fontSize: 10, color: cores.tinta },
    content: conteudo,
    footer: (atual, total) => ({
      text: `OrbisOS · Ata de reunião · Página ${atual} de ${total}`,
      alignment: 'right',
      fontSize: 8,
      color: cores.suave,
      margin: [40, 0, 40, 0],
    }),
  };

  pdfMake.createPdf(doc).download(`ata-${ata.data}-${slug(ata.titulo)}.pdf`);
}

export async function baixarPdfPriorizacao(matriz: MatrizPriorizacao): Promise<void>
{
  await prepararFontes();
  const resumo = ranquearIniciativas(matriz);
  const metodo = matriz.modo === 'rice' ? 'RICE (Alcance × Impacto × Confiança ÷ Esforço)' : 'Impacto × Esforço';

  const linhas: TableCell[][] = [
    [
      { text: '#', bold: true, color: '#ffffff' },
      { text: 'Iniciativa', bold: true, color: '#ffffff' },
      { text: 'Quadrante', bold: true, color: '#ffffff' },
      { text: 'Imp / Esf', bold: true, color: '#ffffff' },
      { text: 'Nota', bold: true, color: '#ffffff' },
      { text: 'Situação', bold: true, color: '#ffffff' },
    ],
    ...resumo.ranqueadas.map((r): TableCell[] => [
      { text: String(r.posicao), bold: true },
      { text: `${r.item.titulo}${r.item.dono ? ` (${r.item.dono})` : ''}` },
      { text: nomesQuadrante[r.quadrante] },
      { text: `${r.item.impacto} / ${r.item.esforco}` },
      { text: String(r.pontuacao), bold: true },
      { text: nomesSituacaoIniciativa[r.item.situacao] },
    ]),
  ];

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 42],
    defaultStyle: { font: 'Texto', fontSize: 10, color: cores.tinta },
    content: [
      { text: 'ORBISOS · MATRIZ DE PRIORIZAÇÃO', font: 'Maquina', fontSize: 9, color: cores.verde, bold: true },
      { text: matriz.nome, font: 'Maquina', fontSize: 18, bold: true, color: cores.tinta, margin: [0, 2, 0, 4] },
      { text: `Método: ${metodo}${matriz.descricao ? `  ·  ${matriz.descricao}` : ''}`, fontSize: 9.5, color: cores.suave, margin: [0, 0, 0, 10] },
      { text: 'LEITURA EXECUTIVA', font: 'Maquina', fontSize: 10, bold: true, color: cores.tinta, margin: [0, 2, 0, 4] },
      { text: resumo.recomendacao, fontSize: 10, margin: [0, 0, 0, 12] },
      {
        table: { headerRows: 1, widths: [22, '*', 105, 48, 38, 68], body: linhas },
        layout: layoutTabela,
        fontSize: 9,
      },
    ],
    footer: (atual, total) => ({
      text: `OrbisOS · Priorização · Página ${atual} de ${total}`,
      alignment: 'right',
      fontSize: 8,
      color: cores.suave,
      margin: [40, 0, 40, 0],
    }),
  };

  pdfMake.createPdf(doc).download(`priorizacao-${slug(matriz.nome)}.pdf`);
}
