import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // pasta fixa: sem opções, na Vercel o adapter grava em .vercel/output e o vercel.json não acha o site
  plugins: [sveltekit({ adapter: adapter({ pages: 'build', assets: 'build' }) })],
});
