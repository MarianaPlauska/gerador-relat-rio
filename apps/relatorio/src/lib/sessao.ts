// quem entrou neste navegador. Não é segurança: os dados ficam no navegador de qualquer jeito.
// A proteção de verdade é o login Google do Firebase, quando ele estiver ligado.
const CHAVE = 'orbisos-sessao';

export interface Sessao
{
  nome: string;
  email?: string | undefined;
  desde: string;
}

export function lerSessao(): Sessao | undefined
{
  try
  {
    const bruto = localStorage.getItem(CHAVE) ?? sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Sessao) : undefined;
  }
  catch
  {
    return undefined;
  }
}

// manter = continua conectada depois de fechar o navegador
export function abrirSessao(sessao: Sessao, manter: boolean): void
{
  (manter ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(sessao));
}

export function fecharSessao(): void
{
  localStorage.removeItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
}
