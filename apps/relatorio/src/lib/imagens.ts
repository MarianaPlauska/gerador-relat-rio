import type { CapturaLida } from '@supervisao/core';
import type { Dados } from './armazenamento.ts';

// As imagens dos prints ficam fora dos documentos de dados: cada uma é um documento próprio na nuvem
// (usuarios/{uid}/imagens/{id}) e, nos dados, a captura guarda só o `imagemId`. Assim os registros ficam leves
// e nenhum documento chega perto do limite de 1 MB do Firestore.

function mapearCapturas<T extends { capturas?: CapturaLida[] | undefined }>(item: T, trocar: (c: CapturaLida) => CapturaLida): T
{
  return item.capturas?.length ? { ...item, capturas: item.capturas.map(trocar) } : item;
}

// devolve uma cópia dos dados sem as imagens embutidas, mais as imagens que foram vistas, por id.
// `podeTirar` deixa a imagem embutida enquanto ela ainda não está confirmada na nuvem (não se perde se a aba fechar antes de subir)
export function separarImagens(dados: Dados, podeTirar: (id: string) => boolean = () => true): { leve: Dados; imagens: Map<string, string> }
{
  const imagens = new Map<string, string>();
  const tirar = (c: CapturaLida): CapturaLida =>
  {
    if (!c.imagemDataUrl) return c;
    imagens.set(c.id, c.imagemDataUrl);
    if (!podeTirar(c.id)) return c;
    const { imagemDataUrl: _imagem, ...resto } = c;
    return { ...resto, imagemId: c.id };
  };
  return {
    leve: {
      ...dados,
      registros: dados.registros.map((r) => mapearCapturas(r, tirar)),
      fotos: dados.fotos.map((f) => mapearCapturas(f, tirar)),
    },
    imagens,
  };
}

// ids de imagem que os dados ainda usam (embutidas ou na nuvem)
export function idsDeImagemUsados(dados: Dados): Set<string>
{
  const ids = new Set<string>();
  const ver = (c: CapturaLida) =>
  {
    if (c.imagemDataUrl || c.imagemId) ids.add(c.imagemId ?? c.id);
  };
  for (const r of dados.registros) r.capturas.forEach(ver);
  for (const f of dados.fotos) f.capturas?.forEach(ver);
  return ids;
}

// capturas que apontam para uma imagem da nuvem e ainda não a têm na memória
export function capturasSemImagem(dados: Dados): CapturaLida[]
{
  const lista: CapturaLida[] = [];
  const ver = (c: CapturaLida) =>
  {
    if (c.imagemId && !c.imagemDataUrl) lista.push(c);
  };
  for (const r of dados.registros) r.capturas.forEach(ver);
  for (const f of dados.fotos) f.capturas?.forEach(ver);
  return lista;
}

// quantos caracteres de imagem cabem no link publicado (o documento todo precisa ficar abaixo de 1 MB)
export function imagensQueCabem<T extends { dataUrl: string }>(imagens: T[], tetoCaracteres = 700_000): T[]
{
  const escolhidas: T[] = [];
  let usado = 0;
  for (const i of imagens)
  {
    if (usado + i.dataUrl.length > tetoCaracteres) continue;
    usado += i.dataUrl.length;
    escolhidas.push(i);
  }
  return escolhidas;
}
