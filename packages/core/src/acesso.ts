// Acesso compartilhado: quem pode ver ou mexer nos dados de outra pessoa (o dono do espaço).
// Tudo aqui é lógica pura, sem relógio e sem Firebase: as telas passam a data e gravam o resultado.
// As regras do Firestore (firestore.rules) repetem as mesmas decisões do lado do servidor.

export type Papel = 'dono' | 'supervisor' | 'leitor';
// quem recebe convite nunca é dono: o dono é quem criou o espaço
export type PapelConvidado = Exclude<Papel, 'dono'>;
export type StatusConvite = 'pendente' | 'aceito' | 'revogado';

export const papeis: readonly Papel[] = ['dono', 'supervisor', 'leitor'];
export const papeisConvidados: readonly PapelConvidado[] = ['supervisor', 'leitor'];

export interface Convite
{
  // sempre minúsculo e sem espaços nas pontas
  email: string;
  donoUid: string;
  papel: PapelConvidado;
  // projetos liberados; vazio = todos
  pastas: string[];
  criadoEm: string;
  status: StatusConvite;
  // quem convidou, só para a tela do convidado mostrar de quem é o espaço
  donoEmail?: string | undefined;
  donoNome?: string | undefined;
}

export interface Membro
{
  uid: string;
  email: string;
  nome?: string | undefined;
  papel: Papel;
  // projetos liberados; vazio = todos
  pastas: string[];
}

export interface Permissoes
{
  ler: boolean;
  editar: boolean;
  gerenciarEquipe: boolean;
  publicarLink: boolean;
}

export type ResultadoAcesso<T> = { ok: true; valor: T } | { ok: false; erro: string };

const falhou = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });
const deu = <T>(valor: T): { ok: true; valor: T } => ({ ok: true, valor });

export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

export function emailValido(email: string): boolean
{
  const e = normalizarEmail(email);
  // o "/" não pode entrar porque o e-mail vira parte do id do documento
  return e.length <= 254 && /^[^\s@/]+@[^\s@/.]+(\.[^\s@/.]+)+$/.test(e);
}

export const papelValido = (papel: unknown): papel is Papel => typeof papel === 'string' && (papeis as readonly string[]).includes(papel);
export const papelConvidadoValido = (papel: unknown): papel is PapelConvidado => typeof papel === 'string' && (papeisConvidados as readonly string[]).includes(papel);

// id do documento em convites/{id}: o convidado e o dono formam a chave, então reconvidar não duplica
export const idDoConvite = (email: string, donoUid: string): string => `${normalizarEmail(email)}__${donoUid}`;

// papel desconhecido não pode nada
export function permissoes(papel: Papel): Permissoes
{
  switch (papel)
  {
    case 'dono':
      return { ler: true, editar: true, gerenciarEquipe: true, publicarLink: true };
    case 'supervisor':
      return { ler: true, editar: true, gerenciarEquipe: false, publicarLink: true };
    case 'leitor':
      return { ler: true, editar: false, gerenciarEquipe: false, publicarLink: false };
    default:
      return { ler: false, editar: false, gerenciarEquipe: false, publicarLink: false };
  }
}

const chavePasta = (pasta: string): string => pasta.trim().toLowerCase();

// pastas vazia = todos os projetos; o dono vê todos sempre. Maiúsculas e minúsculas não importam
export function podeVerPasta(membro: Pick<Membro, 'papel' | 'pastas'>, pasta: string): boolean
{
  if (!permissoes(membro.papel).ler) return false;
  if (membro.papel === 'dono' || membro.pastas.length === 0) return true;
  const alvo = chavePasta(pasta);
  return alvo !== '' && membro.pastas.some((p) => chavePasta(p) === alvo);
}

function limparPastas(pastas: readonly string[] | undefined): string[]
{
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const p of pastas ?? [])
  {
    const nome = p.trim();
    const chave = chavePasta(nome);
    if (!nome || vistas.has(chave)) continue;
    vistas.add(chave);
    lista.push(nome);
  }
  return lista;
}

export interface EntradaConvite
{
  email: string;
  donoUid: string;
  // string solta de propósito: vem de um campo da tela e é validada aqui
  papel: string;
  pastas?: readonly string[] | undefined;
  criadoEm: string;
  // se informado, o dono não convida a si mesmo e o e-mail e o nome dele aparecem para o convidado
  emailDoDono?: string | undefined;
  nomeDoDono?: string | undefined;
}

// `existentes` são os convites que o dono já tem; convite pendente ou aceito para o mesmo e-mail não se repete
export function criarConvite(entrada: EntradaConvite, existentes: readonly Convite[] = []): ResultadoAcesso<Convite>
{
  const email = normalizarEmail(entrada.email);
  if (!emailValido(email)) return falhou('E-mail inválido.');
  if (!entrada.donoUid.trim()) return falhou('Falta o dono do espaço.');
  if (!papelConvidadoValido(entrada.papel)) return falhou('Papel inexistente. Use supervisor ou leitor.');
  if (entrada.emailDoDono && normalizarEmail(entrada.emailDoDono) === email) return falhou('Você já é o dono deste espaço.');
  const id = idDoConvite(email, entrada.donoUid);
  const repetido = existentes.find((c) => idDoConvite(c.email, c.donoUid) === id && c.status !== 'revogado');
  if (repetido) return falhou(repetido.status === 'aceito' ? 'Essa pessoa já tem acesso.' : 'Já existe um convite pendente para esse e-mail.');
  const donoEmail = entrada.emailDoDono ? normalizarEmail(entrada.emailDoDono) : undefined;
  const donoNome = entrada.nomeDoDono?.trim() || undefined;
  return deu({ email, donoUid: entrada.donoUid, papel: entrada.papel, pastas: limparPastas(entrada.pastas), criadoEm: entrada.criadoEm, status: 'pendente', donoEmail, donoNome });
}

export interface Convidado
{
  uid: string;
  email: string;
  nome?: string | undefined;
}

// só quem tem o e-mail do convite aceita, e só enquanto ele está pendente; devolve o membro e o convite já marcado como aceito
export function aceitarConvite(convite: Convite, usuario: Convidado): ResultadoAcesso<{ membro: Membro; convite: Convite }>
{
  if (convite.status !== 'pendente') return falhou(convite.status === 'aceito' ? 'Esse convite já foi aceito.' : 'Esse convite foi revogado.');
  if (!usuario.uid.trim()) return falhou('Entre na sua conta para aceitar.');
  if (normalizarEmail(usuario.email) !== normalizarEmail(convite.email)) return falhou('Esse convite é para outro e-mail.');
  if (usuario.uid === convite.donoUid) return falhou('Você já é o dono deste espaço.');
  if (!papelConvidadoValido(convite.papel)) return falhou('Papel inexistente. Use supervisor ou leitor.');
  const membro: Membro = { uid: usuario.uid, email: normalizarEmail(usuario.email), nome: usuario.nome?.trim() || undefined, papel: convite.papel, pastas: [...convite.pastas] };
  return deu({ membro, convite: { ...convite, status: 'aceito' } });
}

// revogar é idempotente; quem já entrou também precisa ter o documento de membro apagado (isso é feito pelo app)
export const revogar = (convite: Convite): Convite => (convite.status === 'revogado' ? convite : { ...convite, status: 'revogado' });
