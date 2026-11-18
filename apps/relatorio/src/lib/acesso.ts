import { aceitarConvite, criarConvite, idDoConvite, normalizarEmail, revogar, type Convite, type Membro, type PapelConvidado } from '@supervisao/core';
import { esperarUsuario, espacoAtual, firebaseServicos, nuvem, trocarDeEspaco } from './nuvem.svelte.ts';

// Convites e membros no Firestore (as regras estão em firestore.rules):
//   convites/{email__donoUid}              convite feito pelo dono; o convidado lê pelo próprio e-mail
//   usuarios/{donoUid}/membros/{membroUid} quem já entrou no espaço do dono, com papel e projetos liberados
// A lógica de decidir (validar, duplicar, aceitar) fica no core; aqui só se lê e grava.


async function conta(): Promise<{ uid: string; email: string; nome?: string | undefined }>
{
  const uid = await esperarUsuario();
  if (!uid || !nuvem.email) throw new Error('Entre na sua conta para usar convites.');
  return { uid, email: normalizarEmail(nuvem.email), nome: nuvem.nome };
}

// um espaço ao qual a pessoa tem acesso por convite aceito
export interface EspacoCompartilhado
{
  donoUid: string;
  donoNome?: string | undefined;
  donoEmail?: string | undefined;
  papel: PapelConvidado;
  pastas: string[];
}

// membros do espaço próprio; só o dono pode listar (num espaço compartilhado a lista vem vazia)
export async function listarMembros(): Promise<Membro[]>
{
  if (espacoAtual()) return [];
  const { uid } = await conta();
  const { fs, banco } = await firebaseServicos();
  const r = await fs.getDocs(fs.collection(banco, 'usuarios', uid, 'membros'));
  return r.docs.map((d) => d.data() as Membro).sort((a, b) => a.email.localeCompare(b.email));
}

// convites que o dono fez (pendentes, aceitos e revogados)
export async function listarConvitesEnviados(): Promise<Convite[]>
{
  const { uid } = await conta();
  const { fs, banco } = await firebaseServicos();
  const r = await fs.getDocs(fs.query(fs.collection(banco, 'convites'), fs.where('donoUid', '==', uid)));
  return r.docs.map((d) => d.data() as Convite).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function convidar(email: string, papel: string, pastas: string[]): Promise<Convite>
{
  const dono = await conta();
  const [enviados, membros] = await Promise.all([listarConvitesEnviados(), listarMembros()]);
  // convite aceito de quem já saiu do espaço não conta mais: dá para convidar de novo
  const existentes = enviados.map((c) => (c.status === 'aceito' && !membros.some((m) => normalizarEmail(m.email) === c.email) ? revogar(c) : c));
  const r = criarConvite({ email, donoUid: dono.uid, papel, pastas, criadoEm: new Date().toISOString(), emailDoDono: dono.email, nomeDoDono: dono.nome }, existentes);
  if (!r.ok) throw new Error(r.erro);
  const { fs, banco } = await firebaseServicos();
  await fs.setDoc(fs.doc(banco, 'convites', idDoConvite(r.valor.email, dono.uid)), r.valor);
  return r.valor;
}

// tira o acesso de um e-mail: marca o convite como revogado e apaga o documento de membro, se a pessoa já entrou
export async function revogarAcesso(email: string): Promise<void>
{
  const dono = await conta();
  const { fs, banco } = await firebaseServicos();
  const alvo = normalizarEmail(email);
  const lote = fs.writeBatch(banco);
  const refConvite = fs.doc(banco, 'convites', idDoConvite(alvo, dono.uid));
  const convite = await fs.getDoc(refConvite);
  if (convite.exists()) lote.update(refConvite, { status: revogar(convite.data() as Convite).status });
  const membros = await fs.getDocs(fs.collection(banco, 'usuarios', dono.uid, 'membros'));
  for (const m of membros.docs) if (normalizarEmail((m.data() as Membro).email) === alvo) lote.delete(m.ref);
  await lote.commit();
}

// convites feitos para o e-mail de quem está logado (qualquer status)
export async function convitesRecebidos(): Promise<Convite[]>
{
  const { email } = await conta();
  const { fs, banco } = await firebaseServicos();
  const r = await fs.getDocs(fs.query(fs.collection(banco, 'convites'), fs.where('email', '==', email)));
  return r.docs.map((d) => d.data() as Convite).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

// aceitar entra no espaço (cria o documento de membro) e marca o convite como aceito, num lote só
export async function aceitar(convite: Convite): Promise<void>
{
  const eu = await conta();
  const r = aceitarConvite(convite, eu);
  if (!r.ok) throw new Error(r.erro);
  const { fs, banco } = await firebaseServicos();
  const lote = fs.writeBatch(banco);
  lote.set(fs.doc(banco, 'usuarios', convite.donoUid, 'membros', eu.uid), r.valor.membro);
  lote.update(fs.doc(banco, 'convites', idDoConvite(convite.email, convite.donoUid)), { status: r.valor.convite.status });
  await lote.commit();
}

// espaços de outras pessoas que a pessoa pode abrir: convites aceitos cujo documento de membro ainda existe
export async function espacosCompartilhados(): Promise<EspacoCompartilhado[]>
{
  const { uid } = await conta();
  const aceitos = (await convitesRecebidos()).filter((c) => c.status === 'aceito');
  const { fs, banco } = await firebaseServicos();
  const espacos: EspacoCompartilhado[] = [];
  for (const c of aceitos)
  {
    const m = await fs.getDoc(fs.doc(banco, 'usuarios', c.donoUid, 'membros', uid));
    if (!m.exists()) continue;
    const membro = m.data() as Membro;
    if (membro.papel !== 'supervisor' && membro.papel !== 'leitor') continue;
    espacos.push({ donoUid: c.donoUid, donoNome: c.donoNome, donoEmail: c.donoEmail, papel: membro.papel, pastas: membro.pastas ?? [] });
  }
  return espacos;
}

// o membro sai do espaço apagando o próprio documento; o convite aceito fica no histórico do dono
export async function sairDoEspaco(donoUid: string): Promise<void>
{
  const { uid } = await conta();
  const { fs, banco } = await firebaseServicos();
  await fs.deleteDoc(fs.doc(banco, 'usuarios', donoUid, 'membros', uid));
  // saiu do espaço que estava aberto: volta para o próprio
  if (espacoAtual() === donoUid) trocarDeEspaco(undefined);
}
