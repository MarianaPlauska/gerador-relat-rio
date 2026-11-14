import { browser } from '$app/env';
import { redirect } from '@sveltejs/kit';
import { lerSessao } from '#lib/sessao.ts';

export const prerender = true;
export const ssr = false;

// sem sessão, toda tela abre pela entrada
export function load({ url }: { url: URL })
{
  if (!browser || url.pathname === '/entrar' || lerSessao()) return;
  redirect(307, '/entrar');
}
