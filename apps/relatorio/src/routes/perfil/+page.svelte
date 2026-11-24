<script lang="ts">
  import { progressoDosItens, type CardSnapshot, type Publicacao } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { minhasPublicacoes } from '#lib/links.ts';
  import QuemPodeEntrar from '#lib/QuemPodeEntrar.svelte';
  import { firebaseConfig } from '#lib/firebaseConfig.ts';
  import { nuvem, recuperarSenha, sairDaNuvem, textoDoErro, trocarNomeDaConta, trocarSenha } from '#lib/nuvem.svelte.ts';
  import { dataCurta } from '#lib/semana.ts';
  import { atualizarSessao, fecharSessao, lerSessao } from '#lib/sessao.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const sessao = lerSessao();
  let nome = $state(nuvem.nome ?? sessao?.nome ?? dados.identificacao.elaboradoPor ?? '');
  const logada = $derived(nuvem.estado === 'ok' || nuvem.estado === 'sincronizando' || nuvem.estado === 'erro');
  const rotuloNuvem = $derived(
    nuvem.estado === 'ok' ? (nuvem.email ?? 'conectado')
    : nuvem.estado === 'sincronizando' ? 'sincronizando'
    : nuvem.verificando ? 'verificando a conta'
    : nuvem.estado === 'erro' ? 'erro ao salvar'
    : nuvem.estado === 'sem_login' ? 'sem login'
    : 'desligada',
  );
  let escuro = $state(document.documentElement.dataset.tema !== 'claro');
  let senhaAtual = $state('');
  let senhaNova = $state('');
  let emailRecuperacao = $state(nuvem.email ?? sessao?.email ?? '');
  let msg = $state<Record<string, { ok: boolean; texto: string }>>({});
  let importando = $state(false);
  let escopoPedidos = $state<'meus' | 'todos'>('meus');
  let meusLinks = $state<({ codigo: string } & Publicacao)[]>([]);
  let carregandoLinks = $state(false);

  const avisar = (onde: string, ok: boolean, texto: string) => (msg[onde] = { ok, texto });

  const normalizar = (s?: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // última foto de cada projeto para montar o painel pessoal de pedidos
  const cardsRecentes = $derived.by(() =>
  {
    const porPasta = new Map<string, { data: string; cards: CardSnapshot[] }>();
    for (const f of dados.fotos)
    {
      const pasta = (f.pasta ?? dados.prefixo ?? 'DEV').toUpperCase();
      const atual = porPasta.get(pasta);
      if (!atual || f.data >= atual.data) porPasta.set(pasta, { data: f.data, cards: f.cards });
    }
    const lista: (CardSnapshot & { pasta: string })[] = [];
    for (const [pasta, info] of porPasta)
    {
      for (const c of info.cards) lista.push({ ...c, pasta });
    }
    return lista;
  });

  const meusPedidos = $derived.by(() =>
  {
    const alvo = normalizar(nome || dados.identificacao.elaboradoPor);
    const primeiro = alvo.split(/\s+/)[0] ?? '';
    if (!alvo) return [];
    const pessoaMatch = dados.pessoas.find((p) =>
    {
      const pn = normalizar(p.nome);
      return pn === alvo || (primeiro.length >= 3 && pn.includes(primeiro));
    });
    return cardsRecentes.filter((c) =>
    {
      if (pessoaMatch && c.responsavelEtapaAtual === pessoaMatch.id) return true;
      const resp = normalizar(c.responsavelEtapaAtual);
      return !!resp && (resp === alvo || (primeiro.length >= 3 && resp.includes(primeiro)));
    });
  });

  const pedidosVisiveis = $derived(escopoPedidos === 'meus' && meusPedidos.length ? meusPedidos : escopoPedidos === 'todos' ? cardsRecentes : []);
  const pedidosAtencao = $derived(pedidosVisiveis.filter((c) => c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || c.situacao === 'atrasado').length);

  $effect(() =>
  {
    if (nuvem.email && !emailRecuperacao) emailRecuperacao = nuvem.email;
    if (!logada)
    {
      meusLinks = [];
      return;
    }
    carregandoLinks = true;
    minhasPublicacoes()
      .then((r) => (meusLinks = r))
      .catch(() => (meusLinks = []))
      .finally(() => (carregandoLinks = false));
  });

  async function salvarNome()
  {
    const n = nome.trim();
    if (!n) return;
    try
    {
      if (logada) await trocarNomeDaConta(n);
      atualizarSessao({ nome: n });
      if (!dados.identificacao.elaboradoPor) dados.identificacao.elaboradoPor = n;
      avisar('nome', true, 'Nome atualizado.');
    }
    catch (e)
    {
      avisar('nome', false, textoDoErro(e));
    }
  }

  function mudarTema(claro: boolean)
  {
    escuro = !claro;
    if (claro) document.documentElement.dataset.tema = 'claro';
    else delete document.documentElement.dataset.tema;
    try
    {
      localStorage.setItem('orbisos-tema', claro ? 'claro' : 'escuro');
    }
    catch
    {
      // sem armazenamento: vale só nesta aba
    }
  }

  async function mudarSenha()
  {
    try
    {
      await trocarSenha(senhaAtual, senhaNova);
      senhaAtual = '';
      senhaNova = '';
      avisar('senha', true, 'Senha trocada.');
    }
    catch (e)
    {
      avisar('senha', false, textoDoErro(e));
    }
  }

  async function esqueci()
  {
    const destino = (nuvem.email ?? emailRecuperacao).trim();
    if (!destino)
    {
      avisar('senha', false, 'Informe seu e-mail para receber o link de redefinição.');
      return;
    }
    try
    {
      await recuperarSenha(destino);
      avisar('senha', true, `Enviei um e-mail para ${destino} com o link para criar uma senha nova. Confira também o spam.`);
    }
    catch (e)
    {
      avisar('senha', false, textoDoErro(e));
    }
  }

  async function importar(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo || !confirm('Importar este backup substitui os dados deste navegador. Continuar?')) return;
    importando = true;
    try
    {
      salvar(await importarJson(arquivo));
      location.reload();
    }
    catch
    {
      avisar('dados', false, 'Não consegui ler esse arquivo.');
      importando = false;
    }
  }

  async function sair()
  {
    if (!(await sairDaNuvem().catch(() => true))) return;
    fecharSessao();
    location.href = '/entrar';
  }
</script>

<main>
  <span class="prompt">&gt; perfil</span>
  <h1>Meu perfil e painel pessoal<span class="cursor">_</span></h1>

  <!-- DASHBOARD PESSOAL: MEUS PEDIDOS, LISTAS E RETORNOS DE LINKS -->
  <section class="cartao painel-pessoal">
    <div class="cabeca-pessoal">
      <div>
        <h2>Meu painel pessoal</h2>
        <p class="dica">Resumo dos seus pedidos no painel, listas salvas e links publicados.</p>
      </div>
      <div class="linha">
        <button class:principal={escopoPedidos === 'meus'} onclick={() => (escopoPedidos = 'meus')}>Meus pedidos ({meusPedidos.length})</button>
        <button class:principal={escopoPedidos === 'todos'} onclick={() => (escopoPedidos = 'todos')}>Todos do painel ({cardsRecentes.length})</button>
      </div>
    </div>

    <div class="kpis-pessoais">
      <div class="mini-kpi">
        <span class="etiqueta">Pedidos exibidos</span>
        <strong class="maquina">{pedidosVisiveis.length}</strong>
        <small>{pedidosAtencao ? `${pedidosAtencao} pedem atenção` : 'Sem atrasos'}</small>
      </div>
      <div class="mini-kpi">
        <span class="etiqueta">Minhas listas</span>
        <strong class="maquina">{dados.listas.length}</strong>
        <small><a href="/listas">Abrir listas &rarr;</a></small>
      </div>
      <div class="mini-kpi">
        <span class="etiqueta">Links publicados</span>
        <strong class="maquina">{logada ? meusLinks.length : '-'}</strong>
        <small><a href="/retornos">Ver retornos &rarr;</a></small>
      </div>
      <div class="mini-kpi">
        <span class="etiqueta">Backend</span>
        <strong class="maquina">{firebaseConfig.projectId ? 'Firebase' : 'Local'}</strong>
        <small>{firebaseConfig.projectId ? `Firestore · ${firebaseConfig.projectId}` : 'sem projeto na nuvem'}</small>
        <small>{rotuloNuvem}</small>
      </div>
    </div>

    <div class="grade-pessoal">
      <div>
        <h3>{escopoPedidos === 'meus' ? 'Meus pedidos' : 'Pedidos recentes do painel'}</h3>
        {#if pedidosVisiveis.length === 0}
          <p class="dica">
            {#if escopoPedidos === 'meus' && cardsRecentes.length > 0}
              Nenhum card está atribuído ao nome "{nome || 'sem nome'}". Clique em <b>Todos do painel</b> ou ajuste seu nome abaixo.
            {:else}
              Nenhum pedido lido ainda. Cole um print em <a href="/painel">Diário do painel</a>.
            {/if}
          </p>
        {:else}
          <ul class="lista-pessoal">
            {#each pedidosVisiveis.slice(0, 8) as c (`${c.pasta}-${c.codigo}`)}
              <li>
                <div>
                  <a href="/cards?q={encodeURIComponent(c.codigo)}" class="maquina"><b>{c.codigo}</b></a>
                  <span class="chip-mini">{c.pasta}</span>
                  <span>{c.assunto || c.titulo || 'Sem título'}</span>
                </div>
                <div class="linha">
                  {#if c.etapaAtual}<small class="dica">{c.etapaAtual}</small>{/if}
                  {#if c.vencimento}<small class="dica">Venc. {dataCurta(c.vencimento)}</small>{/if}
                  {#if c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado'}
                    <span class="pilula atrasado">atrasado</span>
                  {:else if c.ritmoPainel === 'em_risco'}
                    <span class="pilula em_risco">em risco</span>
                  {:else}
                    <span class="pilula no_ritmo">{c.situacao === 'concluido' ? 'concluído' : 'no ritmo'}</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
          {#if pedidosVisiveis.length > 8}
            <p class="dica"><a href="/cards">Ver todos os {pedidosVisiveis.length} pedidos &rarr;</a></p>
          {/if}
        {/if}
      </div>

      <div class="coluna-lateral-pessoal">
        <div>
          <h3>Minhas listas salvas</h3>
          {#if dados.listas.length === 0}
            <p class="dica">Nenhuma lista criada ainda. <a href="/listas">Criar lista &rarr;</a></p>
          {:else}
            <ul class="lista-pessoal">
              {#each dados.listas as l (l.id)}
                {@const p = progressoDosItens(l, l.itens)}
                <li>
                  <a href="/listas?id={l.id}"><b>{l.nome}</b></a>
                  <span class="dica maquina">{p.concluidos}/{p.total} ({p.pct}%)</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div>
          <h3>Retornos dos meus links</h3>
          {#if nuvem.verificando}
            <p class="dica">Verificando conta na nuvem...</p>
          {:else if !logada}
            <p class="dica">Entre na sua conta na nuvem para acompanhar os links publicados. <a href="/entrar?modo=conta">Entrar</a></p>
          {:else if carregandoLinks}
            <p class="dica">Carregando links...</p>
          {:else if meusLinks.length === 0}
            <p class="dica">Nenhum link publicado ainda. Publique em <a href="/relatorio">Relatório</a>.</p>
          {:else}
            <ul class="lista-pessoal">
              {#each meusLinks.slice(0, 5) as lk (lk.codigo)}
                <li>
                  <a href="/retornos?c={lk.codigo}"><b>{lk.conteudo.titulo}</b></a>
                  <span class="pilula" class:verde={lk.ativo} class:atencao={!lk.ativo}>{lk.ativo ? 'ativo' : 'desativado'}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <div class="duas">
    <section class="cartao">
      <h2>Conta</h2>
      <div class="avatar-linha">
        <span class="avatar">{(nome || '?').charAt(0).toUpperCase()}</span>
        <div>
          <strong>{nome || 'sem nome'}</strong>
          <p class="dica">{nuvem.email ?? 'sem conta na nuvem: dados só neste navegador'}</p>
        </div>
      </div>
      <label>Nome <input bind:value={nome} autocomplete="name" /></label>
      <div class="linha">
        <button class="principal" disabled={!nome.trim()} onclick={salvarNome}>Salvar nome</button>
        {#if msg.nome}<span class:ok={msg.nome.ok} class:ruim={!msg.nome.ok}>{msg.nome.texto}</span>{/if}
      </div>
      <p class="dica">
        Backend: <b>{firebaseConfig.projectId ? 'Firebase' : 'só neste navegador'}</b>
        {#if firebaseConfig.projectId}
          (Authentication e Firestore, projeto <span class="maquina">{firebaseConfig.projectId}</span>).
          O site é estático; a cópia de trabalho fica no navegador e a conta grava no Firestore.
        {/if}
        Estado: <b>{rotuloNuvem}</b>
        {#if nuvem.estado === 'sem_login' && !nuvem.verificando}<a href="/entrar?modo=conta">entrar ou criar conta</a>{/if}
      </p>
    </section>

    <section class="cartao">
      <h2>Identificação dos relatórios</h2>
      <p class="dica">Aparece na capa e no quadro de aprovação do PDF.</p>
      <label>Elaborado por <input bind:value={dados.identificacao.elaboradoPor} /></label>
      <label>Cargo <input bind:value={dados.identificacao.cargo} /></label>
      <label>Área <input bind:value={dados.identificacao.area} /></label>
      <label>Destinatário (gestor) <input bind:value={dados.identificacao.destinatario} /></label>
      <label>Prefixo dos cards <input bind:value={dados.prefixo} maxlength="8" /></label>
    </section>

    <section class="cartao">
      <h2>Aparência</h2>
      <div class="linha">
        <button class:principal={escuro} onclick={() => mudarTema(false)}>Escuro</button>
        <button class:principal={!escuro} onclick={() => mudarTema(true)}>Claro</button>
      </div>
      <p class="dica">A escolha fica salva neste navegador.</p>
    </section>

    <section class="cartao" id="seguranca">
      <h2>Segurança e senha</h2>
      {#if nuvem.estado === 'desligada'}
        <p class="dica">A nuvem está desligada neste ambiente.</p>
      {:else if nuvem.verificando}
        <p class="dica">Verificando sua conta...</p>
      {:else if logada}
        <label>Senha atual <input type="password" bind:value={senhaAtual} autocomplete="current-password" /></label>
        <label>Senha nova <input type="password" bind:value={senhaNova} autocomplete="new-password" placeholder="pelo menos 6 caracteres" /></label>
        <div class="linha">
          <button class="principal" disabled={!senhaAtual || senhaNova.length < 6} onclick={mudarSenha}>Trocar senha</button>
          <button onclick={esqueci}>Esqueci minha senha</button>
        </div>
        {#if msg.senha}<p class:ok={msg.senha.ok} class:ruim={!msg.senha.ok}>{msg.senha.texto}</p>{/if}
      {:else}
        <p class="dica">Você está no modo local. Para trocar a senha logada, conecte sua conta — ou peça um link de redefinição abaixo:</p>
        <label>E-mail da conta <input type="email" bind:value={emailRecuperacao} placeholder="voce@empresa.com" autocomplete="email" /></label>
        <div class="linha">
          <button onclick={esqueci} disabled={!emailRecuperacao.trim()}>Esqueci minha senha</button>
          <a class="botao principal" href="/entrar?modo=conta">Entrar na conta</a>
        </div>
        {#if msg.senha}<p class:ok={msg.senha.ok} class:ruim={!msg.senha.ok}>{msg.senha.texto}</p>{/if}
      {/if}
    </section>

    {#if logada}
      <QuemPodeEntrar />
    {/if}

    <section class="cartao">
      <h2>Seus dados</h2>
      <div class="linha">
        <button onclick={() => exportarJson(carregar())}>Baixar backup</button>
        <label class="arquivo botao">Importar backup<input type="file" accept="application/json,.json" onchange={importar} disabled={importando} hidden /></label>
      </div>
      {#if msg.dados}<p class="ruim">{msg.dados.texto}</p>{/if}
      <p class="dica">O backup tem fotos do painel, planos, listas, fluxos e modelos. Os links publicados ficam na <a href="/retornos">tela Retornos</a>.</p>
    </section>

    <section class="cartao">
      <h2>Sessão</h2>
      <p class="dica">Entrou {sessao ? `em ${sessao.desde.slice(8, 10)}/${sessao.desde.slice(5, 7)}` : ''}. Sair não apaga nada.</p>
      <button class="perigo" onclick={sair}>Sair</button>
    </section>
  </div>
</main>

<style>
  .painel-pessoal
  {
    margin-top: 0;
    margin-bottom: var(--size-4);
    display: grid;
    gap: var(--size-4);
  }
  .cabeca-pessoal
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-3);
  }
  .cabeca-pessoal h2
  {
    margin: 0 0 2px;
  }
  .kpis-pessoais
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: var(--size-3);
  }
  .mini-kpi
  {
    padding: var(--size-3);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    display: grid;
    gap: 2px;
  }
  .mini-kpi strong
  {
    font-size: 1.5rem;
    color: var(--texto);
  }
  .mini-kpi small
  {
    color: var(--suave);
    font-size: 0.78rem;
  }
  .grade-pessoal
  {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: var(--size-4);
  }
  .coluna-lateral-pessoal
  {
    display: grid;
    gap: var(--size-3);
    align-content: start;
  }
  .painel-pessoal h3
  {
    margin: 0 0 var(--size-2);
  }
  .lista-pessoal
  {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--size-2);
  }
  .lista-pessoal li
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-2);
    padding: var(--size-2) var(--size-3);
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    font-size: 0.86rem;
  }
  .chip-mini
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    padding: 1px 6px;
    border-radius: var(--raio-pequeno);
    background: var(--superficie);
    border: 1px solid var(--borda);
    color: var(--suave);
    margin: 0 4px;
  }
  @media (max-width: 820px)
  {
    .grade-pessoal
    {
      grid-template-columns: 1fr;
    }
  }
  .duas
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--size-4);
    align-items: start;
  }
  .duas .cartao
  {
    margin-top: 0;
    display: grid;
    gap: var(--size-3);
  }
  .duas h2
  {
    margin: 0;
  }
  label
  {
    display: grid;
    gap: var(--size-1);
  }
  .linha
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
  }
  .avatar-linha
  {
    display: flex;
    align-items: center;
    gap: var(--size-3);
  }
  .avatar-linha p
  {
    margin: 0;
  }
  .avatar
  {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--marca);
    color: var(--sobre-marca);
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.3rem;
  }
  .ok
  {
    color: var(--verde);
    font-size: 0.86rem;
  }
  .ruim
  {
    color: var(--vermelho);
    font-size: 0.86rem;
  }
  p
  {
    margin: 0;
  }
  .perigo
  {
    color: var(--vermelho);
    justify-self: start;
  }
  .arquivo
  {
    cursor: var(--cursor-clique);
  }
</style>
