<script lang="ts">
  import { chamarAdmin, estadoDoServidor } from './servidor.ts';

  // administração do acesso: roda no servidor em Python, e só aparece para quem o servidor
  // reconhece como administrador (ORBIS_ADMINS)
  type Permitido = { email: string; desde?: string | null };
  type Conta = { email?: string | null; uid: string; ultimoAcesso?: string | null };

  let fase = $state<'carregando' | 'sem_servidor' | 'configurar' | 'fora' | 'pronta'>('carregando');
  let projeto = $state('');
  let permitidos = $state<Permitido[]>([]);
  let contas = $state<Conta[]>([]);
  let novoEmail = $state('');
  let feito = $state('');
  let erro = $state('');
  let ocupada = $state(false);
  let confirmarConta = $state('');

  async function acao(nome: string, extra: Record<string, string> = {})
  {
    ocupada = true;
    erro = '';
    try
    {
      const r = await chamarAdmin<{ feito?: string; permitidos?: Permitido[]; contas?: Conta[] }>(nome, extra);
      if (r.permitidos) permitidos = r.permitidos;
      if (r.contas) contas = r.contas;
      feito = r.feito ?? '';
      return true;
    }
    catch (e)
    {
      erro = e instanceof Error ? e.message : String(e);
      return false;
    }
    finally
    {
      ocupada = false;
    }
  }

  async function abrir()
  {
    const estado = await estadoDoServidor();
    if (!estado)
    {
      fase = 'sem_servidor';
      return;
    }
    projeto = estado.projeto;
    if (!estado.configurado)
    {
      fase = 'configurar';
      return;
    }
    fase = (await acao('permitidos')) ? 'pronta' : 'fora';
  }

  $effect(() =>
  {
    void abrir();
  });

  const dataCurtaIso = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
  const dataDoCarimbo = (ms?: string | null) => (ms ? new Date(Number(ms)).toLocaleDateString('pt-BR') : '');
</script>

{#if fase !== 'fora' && fase !== 'carregando'}
  <section class="cartao">
    <h2>Quem pode entrar</h2>

    {#if fase === 'sem_servidor'}
      <p class="dica">
        Esta tela fala com o servidor em Python do site (<span class="maquina">/api/admin</span>), que só existe na
        versão publicada. Rodando aqui no seu computador ele não responde.
      </p>
    {:else if fase === 'configurar'}
      <p class="dica">
        O servidor está no ar (projeto <span class="maquina">{projeto}</span>), mas ainda falta a configuração dele na
        Vercel. Em Settings, Environment Variables, crie:
      </p>
      <ul class="dica">
        <li><span class="maquina">FIREBASE_CREDENCIAIS</span>: o JSON da conta de serviço do Firebase (Configurações do projeto, Contas de serviço, Gerar nova chave privada).</li>
        <li><span class="maquina">ORBIS_ADMINS</span>: os e-mails que podem usar esta tela, separados por vírgula.</li>
      </ul>
      <p class="dica">Depois de salvar, publique de novo: as variáveis só valem para a próxima publicação.</p>
    {:else}
      <p class="dica">
        Só os e-mails desta lista conseguem ler ou gravar no Firestore. Quem fica de fora não entra, nem criando conta.
      </p>

      <ul class="lista-acesso">
        {#each permitidos as p (p.email)}
          <li>
            <span class="maquina">{p.email}</span>
            {#if p.desde}<small class="dica">desde {dataCurtaIso(p.desde)}</small>{/if}
            <button type="button" class="link perigo" disabled={ocupada} onclick={() => acao('bloquear', { email: p.email })}>bloquear</button>
          </li>
        {/each}
        {#if !permitidos.length}<li class="dica">A lista está vazia.</li>{/if}
      </ul>

      <div class="linha">
        <input placeholder="email@empresa.com.br" bind:value={novoEmail} autocomplete="off" />
        <button
          class="principal"
          disabled={ocupada || !novoEmail.includes('@')}
          onclick={async () => { if (await acao('permitir', { email: novoEmail })) novoEmail = ''; }}
        >
          Liberar
        </button>
      </div>

      <details>
        <summary>Contas criadas</summary>
        <div class="linha">
          <button type="button" disabled={ocupada} onclick={() => acao('contas')}>Ver as contas</button>
        </div>
        <ul class="lista-acesso">
          {#each contas as c (c.uid)}
            <li>
              <span class="maquina">{c.email ?? c.uid}</span>
              {#if c.ultimoAcesso}<small class="dica">último acesso {dataDoCarimbo(c.ultimoAcesso)}</small>{/if}
              {#if confirmarConta === c.uid}
                <button type="button" class="link perigo" disabled={ocupada} onclick={async () => { await acao('excluir-conta', { email: c.email ?? '' }); confirmarConta = ''; }}>confirmar exclusão</button>
                <button type="button" class="link" onclick={() => (confirmarConta = '')}>cancelar</button>
              {:else}
                <button type="button" class="link perigo" onclick={() => (confirmarConta = c.uid)}>apagar conta</button>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="dica">Apagar a conta não apaga os dados dela no Firestore, só o acesso.</p>
      </details>
    {/if}

    {#if feito}<p class="ok">{feito}</p>{/if}
    {#if erro}<p class="ruim">{erro}</p>{/if}
  </section>
{/if}

<style>
  .lista-acesso { list-style: none; margin: 8px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .lista-acesso li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 10px; background: var(--superficie-2); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); }
  .link { border: none; background: none; padding: 0; margin-left: auto; text-decoration: underline; font-size: 0.82rem; cursor: var(--cursor-clique); }
  .perigo { color: var(--vermelho); }
  .ok { color: var(--verde); }
  .ruim { color: var(--vermelho); }
  summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; margin: 6px 0; }
</style>
