import { agoraLocal, novoCodigo, type Publicacao, type RelatorioInterativo, type RespostaInterativa } from '@supervisao/core';
import { esperarUsuario, firebaseServicos, nuvem } from './nuvem.svelte.ts';

// documentos no Firestore:
//   publicados/{codigo}                    o relatório publicado (dono, ativo, conteudo)
//   publicados/{codigo}/respostas/{id}     marcas e comentários de quem recebeu o link
// o código é o segredo do link; as regras estão em firestore.rules

export const linkDe = (codigo: string) => `${location.origin}/ler?c=${codigo}`;
export const nuvemLigada = () => nuvem.estado !== 'desligada';

async function donoAtual(): Promise<string>
{
  const uid = await esperarUsuario();
  if (!uid) throw new Error('Entre na sua conta para publicar links.');
  return uid;
}

export async function publicar(conteudo: RelatorioInterativo): Promise<string>
{
  const dono = await donoAtual();
  const { fs, banco } = await firebaseServicos();
  const codigo = novoCodigo();
  const agora = agoraLocal();
  const publicacao: Publicacao = { dono, ativo: true, criadoEm: agora, atualizadoEm: agora, conteudo };
  await fs.setDoc(fs.doc(banco, 'publicados', codigo), publicacao);
  return codigo;
}

// mesmo link, conteúdo novo: as respostas já recebidas continuam valendo
export async function atualizarConteudo(codigo: string, conteudo: RelatorioInterativo): Promise<void>
{
  const { fs, banco } = await firebaseServicos();
  await fs.updateDoc(fs.doc(banco, 'publicados', codigo), { conteudo, atualizadoEm: agoraLocal() });
}

export async function mudarAtivo(codigo: string, ativo: boolean): Promise<void>
{
  const { fs, banco } = await firebaseServicos();
  await fs.updateDoc(fs.doc(banco, 'publicados', codigo), { ativo });
}

export async function minhasPublicacoes(): Promise<({ codigo: string } & Publicacao)[]>
{
  const dono = await donoAtual();
  const { fs, banco } = await firebaseServicos();
  const r = await fs.getDocs(fs.query(fs.collection(banco, 'publicados'), fs.where('dono', '==', dono)));
  return r.docs.map((d) => ({ codigo: d.id, ...(d.data() as Publicacao) })).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function excluirPublicacao(codigo: string): Promise<void>
{
  const { fs, banco } = await firebaseServicos();
  const respostas = await fs.getDocs(fs.collection(banco, 'publicados', codigo, 'respostas'));
  // lotes de até 400 operações
  for (let i = 0; i < respostas.docs.length; i += 400)
  {
    const lote = fs.writeBatch(banco);
    for (const d of respostas.docs.slice(i, i + 400)) lote.delete(d.ref);
    await lote.commit();
  }
  await fs.deleteDoc(fs.doc(banco, 'publicados', codigo));
}

export async function apagarResposta(codigo: string, id: string): Promise<void>
{
  const { fs, banco } = await firebaseServicos();
  await fs.deleteDoc(fs.doc(banco, 'publicados', codigo, 'respostas', id));
}

// ao vivo: a lista chega de novo a cada resposta nova; devolve a função que para de ouvir
export async function ouvirRespostas(codigo: string, aoMudar: (r: RespostaInterativa[]) => void, aoErro: (e: unknown) => void): Promise<() => void>
{
  const { fs, banco } = await firebaseServicos();
  return fs.onSnapshot(
    fs.collection(banco, 'publicados', codigo, 'respostas'),
    (s) => aoMudar(s.docs.map((d) => ({ ...(d.data() as RespostaInterativa), id: d.id })).sort((a, b) => b.em.localeCompare(a.em))),
    aoErro,
  );
}

// lado de quem recebe o link: não precisa de conta
export async function lerPublicacao(codigo: string): Promise<Publicacao | undefined>
{
  const { fs, banco } = await firebaseServicos();
  const d = await fs.getDoc(fs.doc(banco, 'publicados', codigo));
  return d.exists() ? (d.data() as Publicacao) : undefined;
}

export async function enviarResposta(codigo: string, resposta: Omit<RespostaInterativa, 'id'>): Promise<void>
{
  const { fs, banco } = await firebaseServicos();
  await fs.addDoc(fs.collection(banco, 'publicados', codigo, 'respostas'), resposta);
}
