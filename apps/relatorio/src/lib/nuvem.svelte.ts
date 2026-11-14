import type { Snapshot } from '@supervisao/core';
import type { Dados } from './armazenamento.ts';
import { firebaseConfig } from './firebaseConfig.ts';

// no Firestore: usuarios/{uid}/geral/dados (tudo menos as fotos) e usuarios/{uid}/fotos/{data}, uma foto por documento
// para não bater no limite de 1 MB por documento. O navegador continua sendo a cópia de trabalho;
// a nuvem recebe cada mudança 2 s depois e, ao abrir, a versão mais nova vence.

export const nuvem = $state<{ estado: 'desligada' | 'sem_login' | 'sincronizando' | 'ok' | 'erro'; email?: string | undefined; nome?: string | undefined; ultimoEnvio?: string | undefined; erro?: string | undefined }>({
  estado: firebaseConfig.apiKey ? 'sem_login' : 'desligada',
});

const CHAVE_QUANDO = 'orbisos-atualizado-em';
// conta que já sincronizou neste navegador; sem isso a nuvem vence, para um navegador novo não apagar os dados de lá
const CHAVE_CONTA = 'orbisos-nuvem-conta';
export const quandoLocal = () => localStorage.getItem(CHAVE_QUANDO) ?? '';
export const marcarLocal = (quando = new Date().toISOString()) => localStorage.setItem(CHAVE_QUANDO, quando);

type Servicos = Awaited<ReturnType<typeof abrir>>;
let servicos: Promise<Servicos> | undefined;
let uid: string | undefined;
// o que já está na nuvem, por data da foto, para mandar só as fotos que mudaram
let fotosNaNuvem = new Map<string, string>();
let espera: ReturnType<typeof setTimeout> | undefined;
// só envia depois da primeira sincronização desta sessão
let pronto = false;

async function abrir()
{
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(firebaseConfig);
  return { auth, fs, autenticacao: auth.getAuth(app), banco: fs.initializeFirestore(app, { ignoreUndefinedProperties: true }) };
}

const servico = () => (servicos ??= abrir());

export function iniciarNuvem(aoReceber: (dados: Dados, quando: string, primeiraVez: boolean) => void, local: () => Dados): void
{
  if (nuvem.estado === 'desligada' || servicos) return;
  servico().then(({ auth, autenticacao }) =>
  {
    auth.onAuthStateChanged(autenticacao, async (usuario) =>
    {
      uid = usuario?.uid;
      pronto = false;
      nuvem.email = usuario?.email ?? undefined;
      nuvem.nome = usuario?.displayName ?? undefined;
      if (!uid)
      {
        nuvem.estado = 'sem_login';
        return;
      }
      await executar(async () =>
      {
        const remoto = await baixar();
        const primeiraVez = localStorage.getItem(CHAVE_CONTA) !== uid;
        localStorage.setItem(CHAVE_CONTA, uid!);
        pronto = true;
        if (remoto && (primeiraVez || remoto.quando > quandoLocal())) aoReceber(remoto.dados, remoto.quando, primeiraVez);
        else await enviar(local());
      });
    });
  });
}

async function executar(tarefa: () => Promise<void>)
{
  nuvem.estado = 'sincronizando';
  try
  {
    await tarefa();
    nuvem.estado = 'ok';
    nuvem.erro = undefined;
  }
  catch (e)
  {
    nuvem.estado = 'erro';
    nuvem.erro = String(e);
  }
}

async function baixar(): Promise<{ dados: Dados; quando: string } | undefined>
{
  const { fs, banco } = await servico();
  const geral = await fs.getDoc(fs.doc(banco, 'usuarios', uid!, 'geral', 'dados'));
  const fotos = await fs.getDocs(fs.collection(banco, 'usuarios', uid!, 'fotos'));
  fotosNaNuvem = new Map(fotos.docs.map((d) => [d.id, JSON.stringify(d.data())]));
  if (!geral.exists()) return undefined;
  const { atualizadoEm, ...resto } = geral.data() as Omit<Dados, 'fotos'> & { atualizadoEm: string };
  const lista = fotos.docs.map((d) => d.data() as Snapshot).sort((a, b) => a.data.localeCompare(b.data));
  return { dados: { ...resto, fotos: lista }, quando: atualizadoEm };
}

async function enviar(dados: Dados)
{
  const { fs, banco } = await servico();
  const lote = fs.writeBatch(banco);
  const { fotos, ...resto } = dados;
  const quando = quandoLocal() || new Date().toISOString();
  lote.set(fs.doc(banco, 'usuarios', uid!, 'geral', 'dados'), { ...resto, atualizadoEm: quando });
  const agora = new Map(fotos.map((f) => [f.data, JSON.stringify(f)]));
  for (const [data, json] of agora)
  {
    if (fotosNaNuvem.get(data) !== json) lote.set(fs.doc(banco, 'usuarios', uid!, 'fotos', data), JSON.parse(json));
  }
  for (const data of fotosNaNuvem.keys())
  {
    if (!agora.has(data)) lote.delete(fs.doc(banco, 'usuarios', uid!, 'fotos', data));
  }
  await lote.commit();
  fotosNaNuvem = agora;
  nuvem.ultimoEnvio = new Date().toISOString();
}

export function agendarEnvio(dados: Dados): void
{
  if (!uid || !pronto) return;
  clearTimeout(espera);
  espera = setTimeout(() => executar(() => enviar(dados)), 2000);
}

// o Firebase Auth traz o código do erro; aqui vira uma frase para a tela
export function textoDoErro(e: unknown): string
{
  const codigo = String((e as { code?: string })?.code ?? e);
  const frases: Record<string, string> = {
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use Entrar.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de fazer isso.',
    'auth/operation-not-allowed': 'Login por e-mail e senha ainda não foi ativado no Firebase.',
  };
  return frases[codigo] ?? `Não deu certo (${codigo}).`;
}

// manter = continua conectada depois de fechar o navegador
async function persistencia(manter: boolean)
{
  const { auth, autenticacao } = await servico();
  await auth.setPersistence(autenticacao, manter ? auth.browserLocalPersistence : auth.browserSessionPersistence);
  return { auth, autenticacao };
}

export async function criarConta(nome: string, email: string, senha: string, manter: boolean): Promise<void>
{
  const { auth, autenticacao } = await persistencia(manter);
  const { user } = await auth.createUserWithEmailAndPassword(autenticacao, email, senha);
  await auth.updateProfile(user, { displayName: nome });
  nuvem.nome = nome;
}

export async function entrarComEmail(email: string, senha: string, manter: boolean): Promise<void>
{
  const { auth, autenticacao } = await persistencia(manter);
  await auth.signInWithEmailAndPassword(autenticacao, email, senha);
}

export async function recuperarSenha(email: string): Promise<void>
{
  const { auth, autenticacao } = await servico();
  await auth.sendPasswordResetEmail(autenticacao, email);
}

export async function trocarSenha(senhaAtual: string, nova: string): Promise<void>
{
  const { auth, autenticacao } = await servico();
  const usuario = autenticacao.currentUser;
  if (!usuario?.email) throw new Error('sem conta');
  await auth.reauthenticateWithCredential(usuario, auth.EmailAuthProvider.credential(usuario.email, senhaAtual));
  await auth.updatePassword(usuario, nova);
}

export async function trocarNomeDaConta(nome: string): Promise<void>
{
  const { auth, autenticacao } = await servico();
  if (autenticacao.currentUser) await auth.updateProfile(autenticacao.currentUser, { displayName: nome });
  nuvem.nome = nome;
}

export async function sairDaNuvem(): Promise<void>
{
  if (nuvem.estado === 'desligada') return;
  const { auth, autenticacao } = await servico();
  await auth.signOut(autenticacao);
}

// para quem precisa falar com o Firestore (links publicados): os mesmos serviços e o usuário atual
export const firebaseServicos = servico;
export const uidAtual = () => uid;
// espera o Firebase dizer se há alguém conectado; devolve o uid ou undefined
export async function esperarUsuario(): Promise<string | undefined>
{
  const { auth, autenticacao } = await servico();
  await autenticacao.authStateReady();
  return autenticacao.currentUser?.uid ?? undefined;
}
