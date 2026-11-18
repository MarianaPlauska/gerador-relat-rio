import { permissoes, type Papel, type RegistroPainel, type Snapshot } from '@supervisao/core';
import type { Dados } from './armazenamento.ts';
import { firebaseConfig } from './firebaseConfig.ts';
import { idsDeImagemUsados, separarImagens } from './imagens.ts';

// no Firestore:
//   usuarios/{uid}/geral/dados      tudo menos fotos e registros (configurações, pessoas, planos, listas...)
//   usuarios/{uid}/fotos/{id}       uma foto do painel por documento (id = data, ou PASTA__data fora do DEV)
//   usuarios/{uid}/registros/{id}   um registro do diário por documento
//   usuarios/{uid}/imagens/{id}     uma imagem de print por documento (JPEG em data URL, abaixo de 1 MB)
//   usuarios/{uid}/membros/{uid2}   quem foi convidado para este espaço (papel e projetos liberados)
//   convites/{email__uid}           convites enviados pelo dono (ver acesso.ts)
// Cada documento fica longe do limite de 1 MB. O navegador continua sendo a cópia de trabalho;
// a nuvem recebe cada mudança 2 s depois e, ao abrir, a versão mais nova vence.
// O cache local do próprio Firestore (IndexedDB) guarda o que já foi baixado, inclusive as imagens, e envia o que ficou pendente offline.
//
// ESPAÇO: os dados ficam em usuarios/{dono}. Quase sempre o dono é quem está logado; quem foi convidado pode escolher
// o espaço de outra pessoa (guardado em localStorage, 'orbisos-espaco'). Sem valor, vale o espaço próprio e as chaves
// do navegador continuam as de sempre; num espaço compartilhado elas ganham o sufixo `--{dono}` para não misturar donos.

export const nuvem = $state<{ estado: 'desligada' | 'sem_login' | 'sincronizando' | 'ok' | 'erro'; email?: string | undefined; nome?: string | undefined; ultimoEnvio?: string | undefined; erro?: string | undefined }>({
  estado: firebaseConfig.apiKey ? 'sem_login' : 'desligada',
});

const CHAVE_ESPACO = 'orbisos-espaco';

function lerEspaco(): string | undefined
{
  // sem Firebase não há espaço compartilhado; no pré-render não existe localStorage
  if (!firebaseConfig.apiKey) return undefined;
  try
  {
    return localStorage.getItem(CHAVE_ESPACO) || undefined;
  }
  catch
  {
    return undefined;
  }
}

// dono do espaço escolhido (undefined = espaço próprio); só muda recarregando a página
const espacoSalvo = lerEspaco();
// o que a pessoa logada pode fazer neste espaço; enquanto o papel não é confirmado no Firestore, vale o mais restrito
const espaco = $state<{ papel: Papel; pastas: string[] }>({ papel: espacoSalvo ? 'leitor' : 'dono', pastas: [] });
export const papelNoEspaco = (): Papel => espaco.papel;
export const somenteLeitura = (): boolean => !permissoes(espaco.papel).editar;
// projetos liberados no convite (vazio = todos); quem usa a lista decide como filtrar (podeVerPasta no core)
export const pastasDoEspaco = (): string[] => espaco.pastas;
// uid do dono do espaço compartilhado escolhido, ou undefined no espaço próprio
export const espacoAtual = (): string | undefined => espacoSalvo;
const sufixoDoEspaco = (): string => (espacoSalvo ? `--${espacoSalvo}` : '');
// chave do navegador separada por espaço (o espaço próprio mantém o nome antigo)
export const chaveDoEspaco = (base: string): string => `${base}${sufixoDoEspaco()}`;

export function trocarDeEspaco(donoUid: string | undefined): void
{
  if (donoUid && donoUid !== uid) localStorage.setItem(CHAVE_ESPACO, donoUid);
  else localStorage.removeItem(CHAVE_ESPACO);
  location.reload();
}

const CHAVE_QUANDO = 'orbisos-atualizado-em';
// conta que já sincronizou neste navegador; sem isso a nuvem vence, para um navegador novo não apagar os dados de lá
const CHAVE_CONTA = 'orbisos-nuvem-conta';
const CHAVE_IMAGENS = 'orbisos-imagens-nuvem';
export const quandoLocal = () => localStorage.getItem(chaveDoEspaco(CHAVE_QUANDO)) ?? '';
export const marcarLocal = (quando = new Date().toISOString()) => localStorage.setItem(chaveDoEspaco(CHAVE_QUANDO), quando);

type Servicos = Awaited<ReturnType<typeof abrir>>;
let servicos: Promise<Servicos> | undefined;
let uid: string | undefined;
// raiz dos dados no Firestore: o espaço escolhido, ou a própria conta
const raiz = (): string => (espacoSalvo && espacoSalvo !== uid ? espacoSalvo : uid!);

// o que já está na nuvem, por id do documento, para mandar só o que mudou
let fotosNaNuvem = new Map<string, string>();
let registrosNaNuvem = new Map<string, string>();
// imagens que já subiram para esta conta (guardado no navegador) e as que ainda esperam para subir
let imagensNaNuvem = new Set<string>();
const imagensPendentes = new Map<string, string>();
let espera: ReturnType<typeof setTimeout> | undefined;
// só envia depois da primeira sincronização desta sessão
let pronto = false;

async function abrir()
{
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(firebaseConfig);
  const comCache = typeof indexedDB !== 'undefined';
  const banco = fs.initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    ...(comCache ? { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) } : {}),
  });
  return { auth, fs, autenticacao: auth.getAuth(app), banco };
}

const servico = () => (servicos ??= abrir());

// a nuvem já está conectada e sincronizada nesta sessão: só então as imagens saem de dentro dos dados locais
export const nuvemPronta = (): boolean => !!uid && pronto;
// a imagem já foi gravada na nuvem desta conta
export const imagemConfirmada = (id: string): boolean => imagensNaNuvem.has(id);

function lerImagensEnviadas(conta: string): Set<string>
{
  try
  {
    return new Set(JSON.parse(localStorage.getItem(`${CHAVE_IMAGENS}-${conta}`) ?? '[]') as string[]);
  }
  catch
  {
    return new Set();
  }
}

function guardarImagensEnviadas(): void
{
  if (uid) localStorage.setItem(`${CHAVE_IMAGENS}-${raiz()}`, JSON.stringify([...imagensNaNuvem]));
}

// confere no Firestore o papel da pessoa no espaço escolhido; sem convite aceito (ou revogado) volta para o espaço próprio
async function confirmarPapel(): Promise<boolean>
{
  if (!espacoSalvo || espacoSalvo === uid)
  {
    if (espacoSalvo)
    {
      localStorage.removeItem(CHAVE_ESPACO);
      location.reload();
      return false;
    }
    espaco.papel = 'dono';
    espaco.pastas = [];
    return true;
  }
  const { fs, banco } = await servico();
  const doc = await fs.getDoc(fs.doc(banco, 'usuarios', espacoSalvo, 'membros', uid!));
  const membro = doc.exists() ? (doc.data() as { papel?: string; pastas?: string[] }) : undefined;
  if (membro?.papel !== 'supervisor' && membro?.papel !== 'leitor')
  {
    localStorage.removeItem(CHAVE_ESPACO);
    location.reload();
    return false;
  }
  espaco.papel = membro.papel;
  espaco.pastas = membro.pastas ?? [];
  return true;
}

// foto de outro projeto no mesmo dia não pode sobrescrever a do DEV: o DEV mantém o id antigo (a data)
const idDaFoto = (f: Snapshot): string => (f.pasta && f.pasta.toUpperCase() !== 'DEV' ? `${f.pasta.replace(/[/\\]/g, '_')}__${f.data}` : f.data);

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
      imagensNaNuvem = lerImagensEnviadas(raiz());
      await executar(async () =>
      {
        if (!(await confirmarPapel())) return;
        const remoto = await baixar();
        const chaveConta = chaveDoEspaco(CHAVE_CONTA);
        const primeiraVez = localStorage.getItem(chaveConta) !== uid;
        localStorage.setItem(chaveConta, uid!);
        pronto = true;
        // leitor nunca envia: a nuvem sempre vence, e o que ele mexer na tela não volta para o dono
        if (remoto && (primeiraVez || somenteLeitura() || remoto.quando > quandoLocal())) aoReceber(remoto.dados, remoto.quando, primeiraVez);
        else if (!somenteLeitura()) await enviar(local());
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
  const [geral, fotos, registros] = await Promise.all([
    fs.getDoc(fs.doc(banco, 'usuarios', raiz(), 'geral', 'dados')),
    fs.getDocs(fs.collection(banco, 'usuarios', raiz(), 'fotos')),
    fs.getDocs(fs.collection(banco, 'usuarios', raiz(), 'registros')),
  ]);
  fotosNaNuvem = new Map(fotos.docs.map((d) => [d.id, JSON.stringify(d.data())]));
  registrosNaNuvem = new Map(registros.docs.map((d) => [d.id, JSON.stringify(d.data())]));
  if (!geral.exists()) return undefined;
  const { atualizadoEm, ...resto } = geral.data() as Omit<Dados, 'fotos'> & { atualizadoEm: string };
  const listaFotos = fotos.docs.map((d) => d.data() as Snapshot).sort((a, b) => a.data.localeCompare(b.data));
  // contas antigas ainda têm os registros dentro do documento geral; a coleção nova vale quando existe
  const listaRegistros = registros.size
    ? registros.docs.map((d) => d.data() as RegistroPainel).sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
    : (resto.registros ?? []);
  const dados: Dados = { ...resto, fotos: listaFotos, registros: listaRegistros };
  // tudo que veio com imagemId já está na nuvem
  for (const id of idsDeImagemUsados(dados)) imagensNaNuvem.add(id);
  guardarImagensEnviadas();
  return { dados, quando: atualizadoEm };
}

async function enviarImagens(imagens: Map<string, string>, usadas: Set<string>)
{
  const { fs, banco } = await servico();
  for (const [id, dataUrl] of imagens)
  {
    if (imagensNaNuvem.has(id)) continue;
    await fs.setDoc(fs.doc(banco, 'usuarios', raiz(), 'imagens', id), { dataUrl, em: new Date().toISOString() });
    imagensNaNuvem.add(id);
    imagensPendentes.delete(id);
  }
  // imagem que nenhum registro usa mais sai da nuvem
  for (const id of [...imagensNaNuvem])
  {
    if (usadas.has(id)) continue;
    await fs.deleteDoc(fs.doc(banco, 'usuarios', raiz(), 'imagens', id));
    imagensNaNuvem.delete(id);
  }
  guardarImagensEnviadas();
}

async function enviar(dadosCompletos: Dados)
{
  const { fs, banco } = await servico();
  // as imagens embutidas saem dos dados e vão para documentos próprios
  const { leve, imagens } = separarImagens(dadosCompletos);
  for (const [id, url] of imagensPendentes) if (!imagens.has(id)) imagens.set(id, url);
  await enviarImagens(imagens, idsDeImagemUsados(leve));

  const { fotos, registros, ...resto } = leve;
  const quando = quandoLocal() || new Date().toISOString();
  const operacoes: ((lote: ReturnType<typeof fs.writeBatch>) => void)[] = [
    (lote) => lote.set(fs.doc(banco, 'usuarios', raiz(), 'geral', 'dados'), { ...resto, atualizadoEm: quando }),
  ];

  const fotosAgora = new Map(fotos.map((f) => [idDaFoto(f), JSON.stringify(f)]));
  for (const [id, json] of fotosAgora)
  {
    if (fotosNaNuvem.get(id) !== json) operacoes.push((lote) => lote.set(fs.doc(banco, 'usuarios', raiz(), 'fotos', id), JSON.parse(json)));
  }
  for (const id of fotosNaNuvem.keys())
  {
    if (!fotosAgora.has(id)) operacoes.push((lote) => lote.delete(fs.doc(banco, 'usuarios', raiz(), 'fotos', id)));
  }

  const registrosAgora = new Map(registros.map((r) => [r.id, JSON.stringify(r)]));
  for (const [id, json] of registrosAgora)
  {
    if (registrosNaNuvem.get(id) !== json) operacoes.push((lote) => lote.set(fs.doc(banco, 'usuarios', raiz(), 'registros', id), JSON.parse(json)));
  }
  for (const id of registrosNaNuvem.keys())
  {
    if (!registrosAgora.has(id)) operacoes.push((lote) => lote.delete(fs.doc(banco, 'usuarios', raiz(), 'registros', id)));
  }

  // o Firestore aceita até 500 operações por lote
  for (let i = 0; i < operacoes.length; i += 400)
  {
    const lote = fs.writeBatch(banco);
    for (const operacao of operacoes.slice(i, i + 400)) operacao(lote);
    await lote.commit();
  }
  fotosNaNuvem = fotosAgora;
  registrosNaNuvem = registrosAgora;
  nuvem.ultimoEnvio = new Date().toISOString();
}

export function agendarEnvio(dados: Dados, imagens: Map<string, string> = new Map()): void
{
  // leitor não grava nada no espaço do dono (as regras do Firestore também recusam)
  if (!uid || !pronto || somenteLeitura()) return;
  for (const [id, url] of imagens) imagensPendentes.set(id, url);
  clearTimeout(espera);
  espera = setTimeout(() => executar(() => enviar(dados)), 2000);
}

// uma imagem de print guardada na nuvem; o cache do Firestore evita baixar de novo
export async function baixarImagem(id: string): Promise<string | undefined>
{
  if (nuvem.estado === 'desligada') return undefined;
  const conta = await esperarUsuario();
  if (!conta) return undefined;
  const { fs, banco } = await servico();
  const doc = await fs.getDoc(fs.doc(banco, 'usuarios', espacoSalvo && espacoSalvo !== conta ? espacoSalvo : conta, 'imagens', id));
  return doc.exists() ? (doc.data() as { dataUrl?: string }).dataUrl : undefined;
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
    'permission-denied': 'Sem permissão para isso. Confira seu papel neste espaço e as regras do Firestore.',
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
