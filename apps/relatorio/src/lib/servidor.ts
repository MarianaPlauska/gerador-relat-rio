import { tokenDaConta } from './nuvem.svelte.ts';

// conversa com o servidor em Python (api/admin.py), mandando o crachá da conta junto
export async function chamarAdmin<T>(acao: string, extra: Record<string, string> = {}): Promise<T>
{
  const token = await tokenDaConta();
  if (!token) throw new Error('Entre na sua conta para usar esta tela.');
  const resposta = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ acao, ...extra }),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
  if (!resposta.ok) throw new Error(corpo.erro ?? `O servidor respondeu ${resposta.status}.`);
  return corpo as T;
}

export async function estadoDoServidor(): Promise<{ servidor: string; projeto: string; configurado: boolean } | null>
{
  const resposta = await fetch('/api/admin').catch(() => null);
  if (!resposta?.ok) return null;
  return (await resposta.json()) as { servidor: string; projeto: string; configurado: boolean };
}
