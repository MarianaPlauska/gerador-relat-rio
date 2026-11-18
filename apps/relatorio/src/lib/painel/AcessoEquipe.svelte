<script lang="ts">
  import { untrack } from 'svelte';
  import type { Convite, Membro } from '@supervisao/core';
  import { aceitar, convidar, convitesRecebidos, espacosCompartilhados, listarConvitesEnviados, listarMembros, revogarAcesso, sairDoEspaco, type EspacoCompartilhado } from '#lib/acesso.ts';
  import { espacoAtual, nuvem, papelNoEspaco, textoDoErro, trocarDeEspaco } from '#lib/nuvem.svelte.ts';

  const nomeDoPapel: Record<string, string> = { dono: 'Dono', supervisor: 'Supervisor (lê e edita)', leitor: 'Leitor (só lê)' };

  let membros = $state<Membro[]>([]);
  let enviados = $state<Convite[]>([]);
  let recebidos = $state<Convite[]>([]);
  let espacos = $state<EspacoCompartilhado[]>([]);
  let carregando = $state(false);
  let erro = $state('');
  let aviso = $state('');

  let email = $state('');
  let papel = $state<'supervisor' | 'leitor'>('leitor');
  let projetos = $state('');

  const desligada = $derived(nuvem.estado === 'desligada');
  const logada = $derived(!!nuvem.email);
  // só o dono do espaço próprio gerencia a equipe
  const souDono = $derived(!espacoAtual() && papelNoEspaco() === 'dono');
  const pendentes = $derived(enviados.filter((c) => c.status === 'pendente'));
  const convitesParaMim = $derived(recebidos.filter((c) => c.status === 'pendente'));

  // texto de erro: mensagens do próprio app já vêm em português; as do Firebase passam por textoDoErro
  const frase = (e: unknown): string => (e instanceof Error && !('code' in e) ? e.message : textoDoErro(e));

  async function recarregar(): Promise<void>
  {
    carregando = true;
    erro = '';
    try
    {
      const [m, env, rec, esp] = await Promise.all([listarMembros(), listarConvitesEnviados(), convitesRecebidos(), espacosCompartilhados()]);
      membros = m;
      enviados = env;
      recebidos = rec;
      espacos = esp;
    }
    catch (e)
    {
      erro = frase(e);
    }
    carregando = false;
  }

  // carrega quando a conta aparece (o login do Firebase termina depois da tela abrir)
  $effect(() =>
  {
    if (nuvem.email) untrack(() => void recarregar());
  });

  async function executar(tarefa: () => Promise<void>, pronto: string): Promise<void>
  {
    erro = '';
    aviso = '';
    try
    {
      await tarefa();
      aviso = pronto;
      await recarregar();
    }
    catch (e)
    {
      erro = frase(e);
    }
  }

  const enviarConvite = (e: SubmitEvent) =>
  {
    e.preventDefault();
    const lista = projetos.split(',').map((p) => p.trim()).filter(Boolean);
    void executar(async () =>
    {
      await convidar(email, papel, lista);
      email = '';
      projetos = '';
    }, 'Convite criado. A pessoa precisa entrar no OrbisOS com esse e-mail e aceitar em Acesso e convites.');
  };

  const revogar = (alvo: string) => executar(() => revogarAcesso(alvo), 'Acesso revogado.');
  const aceitarConvite = (c: Convite) => executar(() => aceitar(c), 'Convite aceito. Escolha o espaço na lista acima para abrir.');
  const sair = (donoUid: string) => executar(() => sairDoEspaco(donoUid), 'Você saiu do espaço.');
</script>

<section class="acesso">
  <div>
    <span class="etiqueta">Acesso e convites</span>
    <p class="dica">Convide pessoas para ver ou ajudar a editar os dados da sua conta, ou abra o espaço de quem convidou você.</p>
  </div>

  {#if desligada}
    <p class="dica">A nuvem está desligada neste ambiente (o Firebase não foi configurado). Convites e espaços compartilhados dependem da nuvem, então esta seção fica sem função até ela ser ligada.</p>
  {:else if !logada}
    <p class="dica">Entre na sua conta para convidar pessoas ou aceitar convites.</p>
  {:else}
    <div class="linha">
      <label class="campo">
        <span class="etiqueta">Espaço</span>
        <select value={espacoAtual() ?? ''} onchange={(e) => trocarDeEspaco(e.currentTarget.value || undefined)}>
          <option value="">Meu espaço</option>
          {#each espacos as esp (esp.donoUid)}
            <option value={esp.donoUid}>{esp.donoNome || esp.donoEmail || esp.donoUid} ({esp.papel})</option>
          {/each}
          <!-- o espaço aberto continua na lista mesmo se a consulta ainda não voltou -->
          {#if espacoAtual() && !espacos.some((esp) => esp.donoUid === espacoAtual())}
            <option value={espacoAtual()}>Espaço compartilhado</option>
          {/if}
        </select>
      </label>
      <span class="pilula">Seu papel aqui: {nomeDoPapel[papelNoEspaco()] ?? papelNoEspaco()}</span>
      {#if espacoAtual()}
        <button type="button" class="link perigo" onclick={() => sair(espacoAtual()!)}>Sair deste espaço</button>
      {/if}
    </div>

    {#if papelNoEspaco() === 'leitor'}
      <p class="faixa-leitura"><b>Somente leitura.</b> Neste espaço você não pode salvar alterações.</p>
    {/if}

    {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
    {#if aviso}<p class="aviso-ok" role="status">{aviso}</p>{/if}

    {#if convitesParaMim.length}
      <div class="bloco">
        <span class="etiqueta">Convites recebidos</span>
        {#each convitesParaMim as c (c.donoUid)}
          <div class="linha">
            <span><b>{c.donoNome || c.donoEmail || 'Uma pessoa'}</b> convidou você como {nomeDoPapel[c.papel] ?? c.papel}{c.pastas.length ? `, projetos: ${c.pastas.join(', ')}` : ', todos os projetos'}.</span>
            <button type="button" class="principal" onclick={() => aceitarConvite(c)}>Aceitar</button>
          </div>
        {/each}
      </div>
    {/if}

    {#if souDono}
      <form class="bloco" onsubmit={enviarConvite}>
        <span class="etiqueta">Convidar por e-mail</span>
        <div class="linha">
          <input type="email" placeholder="e-mail da pessoa" bind:value={email} required />
          <select bind:value={papel} aria-label="Papel">
            <option value="leitor">Leitor (só lê)</option>
            <option value="supervisor">Supervisor (lê e edita)</option>
          </select>
          <input type="text" placeholder="projetos (vazio = todos), separe por vírgula" bind:value={projetos} class="largo" />
          <button type="submit" class="principal" disabled={carregando}>Convidar</button>
        </div>
        <p class="dica">Só você gerencia a equipe. A lista de projetos esconde os outros nas telas da pessoa, mas não é uma barreira de segurança: quem tem acesso ao espaço pode ler os dados de todos os projetos no Firestore.</p>
      </form>

      <div class="bloco">
        <span class="etiqueta">Pessoas com acesso</span>
        {#if !membros.length && !pendentes.length}
          <p class="dica">{carregando ? 'Carregando...' : 'Ninguém foi convidado ainda.'}</p>
        {/if}
        {#each membros as m (m.uid)}
          <div class="linha">
            <span><b>{m.nome || m.email}</b> ({m.email}) · {nomeDoPapel[m.papel] ?? m.papel} · {m.pastas.length ? m.pastas.join(', ') : 'todos os projetos'}</span>
            <button type="button" class="link perigo" onclick={() => revogar(m.email)}>Revogar</button>
          </div>
        {/each}
        {#each pendentes as c (c.email)}
          <div class="linha">
            <span><b>{c.email}</b> · convite pendente · {nomeDoPapel[c.papel] ?? c.papel} · {c.pastas.length ? c.pastas.join(', ') : 'todos os projetos'}</span>
            <button type="button" class="link perigo" onclick={() => revogar(c.email)}>Revogar</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="dica">Neste espaço só o dono convida e revoga pessoas.</p>
    {/if}
  {/if}
</section>

<style>
  .acesso { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 6px; }
  .linha { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .bloco { display: flex; flex-direction: column; gap: 8px; }
  .campo { display: flex; flex-direction: column; gap: 4px; }
  .largo { min-width: 280px; flex: 1; }
  .faixa-leitura { margin: 0; padding: 8px 10px; border-left: 3px solid var(--amarelo); background: var(--superficie); font-size: 0.85rem; }
  .erro { margin: 0; color: var(--vermelho); font-size: 0.85rem; }
  .aviso-ok { margin: 0; font-size: 0.85rem; }
  .link { border: none; background: none; padding: 0; text-decoration: underline; font-size: 0.82rem; cursor: pointer; }
  .perigo { color: var(--vermelho); }
</style>
