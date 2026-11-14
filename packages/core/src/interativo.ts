import type { LigacaoFluxo, NoFluxo } from './fluxograma';

// relatório publicado como link: quem recebe lê, marca em cada ponto e comenta; a supervisora vê tudo em Retornos

export type MarcaInterativa = 'ciente' | 'concordo' | 'duvida';

export const nomesMarca: Record<MarcaInterativa, string> = {
  ciente: 'Ciente',
  concordo: 'Concordo',
  duvida: 'Tenho dúvida',
};

export interface ItemInterativo
{
  id: string;
  texto: string;
  detalhe?: string | undefined;
  nivel?: 'alto' | 'medio' | 'baixo' | undefined;
}

export type SecaoInterativa =
  | { id: string; tipo: 'texto'; titulo: string; paragrafos: string[] }
  // cada item pode receber uma marca e um comentário
  | { id: string; tipo: 'itens'; titulo: string; intro?: string | undefined; itens: ItemInterativo[] }
  // linhas como objetos: o Firestore não guarda lista dentro de lista
  | { id: string; tipo: 'tabela'; titulo: string; colunas: string[]; linhas: { celulas: string[] }[] }
  | { id: string; tipo: 'grafico'; titulo: string; pontos: { rotulo: string; valor: number }[]; meta?: number | undefined; sufixo?: string | undefined }
  | { id: string; tipo: 'fluxo'; titulo: string; nos: NoFluxo[]; ligacoes: LigacaoFluxo[] };

export interface RelatorioInterativo
{
  titulo: string;
  subtitulo: string;
  periodo: string;
  situacao?: string | undefined;
  autor?: string | undefined;
  geradoEm: string;
  secoes: SecaoInterativa[];
}

// o que o documento "publicados/{codigo}" guarda; "dono" é o uid de quem publicou
export interface Publicacao
{
  dono: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  conteudo: RelatorioInterativo;
}

// uma resposta é um documento só, sem edição: marcar de novo cria outra, e vale a mais recente
export interface RespostaInterativa
{
  id?: string | undefined;
  secaoId: string;
  itemId?: string | undefined;
  marca?: MarcaInterativa | undefined;
  texto: string;
  nome: string;
  em: string;
}

// código do link: 24 letras e números, sem caracteres parecidos; não dá para adivinhar
export function novoCodigo(): string
{
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

export const codigoValido = (c: string | null | undefined): c is string => !!c && /^[a-z0-9]{20,40}$/.test(c);

// ids dos pontos marcáveis do relatório, na ordem em que aparecem
export function pontosDoRelatorio(r: RelatorioInterativo): { secaoId: string; itemId?: string | undefined; rotulo: string }[]
{
  return r.secoes.flatMap((s) => s.tipo === 'itens'
    ? s.itens.map((i) => ({ secaoId: s.id, itemId: i.id, rotulo: `${s.titulo}: ${i.texto}` }))
    : [{ secaoId: s.id, rotulo: s.titulo }]);
}

const mesmaChave = (r: RespostaInterativa) => `${r.nome.trim().toLowerCase()}|${r.secaoId}|${r.itemId ?? ''}`;

// a marca mais recente de cada pessoa em cada ponto
export function marcasAtuais(respostas: RespostaInterativa[]): RespostaInterativa[]
{
  const porChave = new Map<string, RespostaInterativa>();
  for (const r of [...respostas].filter((x) => x.marca).sort((a, b) => a.em.localeCompare(b.em))) porChave.set(mesmaChave(r), r);
  return [...porChave.values()];
}

export interface ResumoDosRetornos
{
  pessoas: string[];
  comentarios: number;
  marcas: Record<MarcaInterativa, number>;
  // pontos com dúvida, para a supervisora responder primeiro
  duvidas: RespostaInterativa[];
  novas: number;
}

// "desde": ISO da última vez que a supervisora olhou; o que veio depois conta como novo
export function resumirRetornos(respostas: RespostaInterativa[], desde = ''): ResumoDosRetornos
{
  const atuais = marcasAtuais(respostas);
  const marcas: Record<MarcaInterativa, number> = { ciente: 0, concordo: 0, duvida: 0 };
  for (const m of atuais) marcas[m.marca!]++;
  return {
    pessoas: [...new Set(respostas.map((r) => r.nome.trim()))].sort((a, b) => a.localeCompare(b)),
    comentarios: respostas.filter((r) => r.texto.trim()).length,
    marcas,
    duvidas: atuais.filter((m) => m.marca === 'duvida'),
    novas: respostas.filter((r) => r.em > desde).length,
  };
}
