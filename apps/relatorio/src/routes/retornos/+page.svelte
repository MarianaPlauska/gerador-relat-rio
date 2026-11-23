<script lang="ts">
  import { agoraLocal, marcasAtuais, nomesMarca, pontosDoRelatorio, resumirRetornos, type Publicacao, type RespostaInterativa } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { carregar } from '#lib/armazenamento.ts';
  import { apagarResposta, excluirPublicacao, linkDe, mudarAtivo, minhasPublicacoes, ouvirRespostas } from '#lib/links.ts';
  import { nuvem, textoDoErro } from '#lib/nuvem.svelte.ts';
  import { copiar } from '#lib/saidas.ts';

  // garante que a autenticação na nuvem esteja iniciada mesmo abrindo /retornos diretamente
  carregar();

  type Item = { codigo: string } & Publicacao;
  const chaveVisto = 'orbisos-retornos-visto';

  let lista = $state<Item[]>([]);
  let carregando = $state(false);
  let erro = $state('');
  let respostas = $state<RespostaInterativa[]>([]);
  let copiado = $state('');
  // não reativo de propósito: o efeito de baixo grava aqui ao sair da tela
  let visto = lerVisto();
  // o "desde" fica fixo enquanto a pessoa lê, para o que era novo continuar destacado
  let desde = $state('');

  const codigoAberto = $derived(page.url.searchParams.get('c'));
  const aberto = $derived(lista.find((x) => x.codigo === codigoAberto));
  const logada = $derived(nuvem.estado === 'ok' || nuvem.estado === 'sincronizando' || nuvem.estado === 'erro');

  function lerVisto(): Record<string, string>
  {
    try
    {
      return JSON.parse(localStorage.getItem(chaveVisto) ?? '{}') as Record<string, string>;
    }
    catch
    {
      return {};
    }
  }

  async function carregarLista()
  {
    carregando = true;
    erro = '';
    try
    {
      lista = await minhasPublicacoes();
    }
    catch (e)
    {
      erro = e instanceof Error && !('code' in e) ? e.message : textoDoErro(e);
    }
    finally
    {
      carregando = false;
    }
  }

  // espera o Firebase dizer se há conta conectada antes de buscar
  $effect(() =>
  {
    if (nuvem.estado === 'desligada' || nuvem.estado === 'sem_login') return;
    carregarLista();
  });

  $effect(() =>
  {
    const codigo = codigoAberto;
    respostas = [];
    if (!codigo || !logada) return;
    desde = visto[codigo] ?? '';
    let parar: (() => void) | undefined;
    let ativo = true;
    ouvirRespostas(codigo, (r) => (respostas = r), (e) => (erro = textoDoErro(e))).then((p) =>
    {
      if (ativo) parar = p;
      else p();
    });
    return () =>
    {
      ativo = false;
      parar?.();
      // saiu da tela: tudo o que chegou até agora conta como visto
      visto = { ...visto, [codigo]: agoraLocal() };
      try
      {
        localStorage.setItem(chaveVisto, JSON.stringify(visto));
      }
      catch
      {
        // sem armazenamento: tudo volta a aparecer como novo
      }
    };
  });

  const resumo = $derived(resumirRetornos(respostas, desde));
  const pontos = $derived(aberto ? pontosDoRelatorio(aberto.conteudo) : []);
  const atuais = $derived(marcasAtuais(respostas));
  const porPonto = (secaoId: string, itemId?: string) => respostas.filter((r) => r.secaoId === secaoId && (r.itemId ?? undefined) === itemId);
  const marcasDoPonto = (secaoId: string, itemId?: string) => atuais.filter((r) => r.secaoId === secaoId && (r.itemId ?? undefined) === itemId);
  const gerais = $derived(respostas.filter((r) => r.secaoId === 'geral'));
  const hora = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

  async function copiarLink(codigo: string)
  {
    await copiar(linkDe(codigo));
    copiado = codigo;
    setTimeout(() => (copiado = ''), 2000);
  }

  async function alternar(x: Item)
  {
    try
    {
      await mudarAtivo(x.codigo, !x.ativo);
      lista = lista.map((i) => (i.codigo === x.codigo ? { ...i, ativo: !x.ativo } : i));
    }
    catch (e)
    {
      erro = textoDoErro(e);
    }
  }

  async function excluir(x: Item)
  {
    if (!confirm(`Excluir o link "${x.conteudo.titulo}" e todas as respostas recebidas? Quem tiver o link deixa de abrir.`)) return;
    try
    {
      await excluirPublicacao(x.codigo);
      lista = lista.filter((i) => i.codigo !== x.codigo);
      if (codigoAberto === x.codigo) goto('/retornos');
    }
    catch (e)
    {
      erro = textoDoErro(e);
    }
  }

  async function apagar(r: RespostaInterativa)
  {
    if (!r.id || !codigoAberto || !confirm('Apagar esta resposta?')) return;
    try
    {
      await apagarResposta(codigoAberto, r.id);
    }
    catch (e)
    {
      erro = textoDoErro(e);
    }
  }
</script>

<main>
  <span class="prompt">&gt; retornos</span>
  <h1>Retornos dos links<span class="cursor">_</span></h1>

  {#if nuvem.estado === 'desligada'}
    <section class="cartao"><p>Os links dependem da nuvem, que ainda está desligada. Veja <a href="/perfil">Meu perfil</a>.</p></section>
  {:else if nuvem.verificando}
    <section class="cartao"><p class="dica">Verificando sua conta na nuvem...</p></section>
  {:else if !logada}
    <section class="cartao">
      <h2>Conecte sua conta na nuvem</h2>
      <p>Sua sessão atual está apenas no modo local deste navegador. Para ver os relatórios publicados e as respostas recebidas, entre com seu e-mail e senha.</p>
      <p><a class="botao principal" href="/entrar?modo=conta">Entrar com e-mail e senha</a></p>
    </section>
  {:else}
    {#if erro}<p class="aviso">{erro}</p>{/if}

    {#if aberto}
      {@const r = aberto.conteudo}
      <div class="topo-detalhe">
        <button onclick={() => goto('/retornos')}>&larr; Todos os links</button>
        <button onclick={() => copiarLink(aberto.codigo)}>{copiado === aberto.codigo ? 'Link copiado!' : 'Copiar link'}</button>
        <button onclick={() => alternar(aberto)}>{aberto.ativo ? 'Desativar link' : 'Reativar link'}</button>
      </div>
      <h2>{r.titulo} <small>{r.periodo}</small></h2>
      <p class="dica">{aberto.ativo ? 'Link ativo.' : 'Link desativado: ninguém consegue abrir nem responder.'} Publicado em {hora(aberto.criadoEm)}{aberto.atualizadoEm !== aberto.criadoEm ? `, atualizado em ${hora(aberto.atualizadoEm)}` : ''}.</p>

      <div class="kpis">
        <div class="cartao"><span class="etiqueta">pessoas</span><strong>{resumo.pessoas.length}</strong><small>{resumo.pessoas.join(', ') || 'ninguém respondeu ainda'}</small></div>
        <div class="cartao"><span class="etiqueta">novas</span><strong>{resumo.novas}</strong><small>desde a última visita</small></div>
        <div class="cartao"><span class="etiqueta">concordo</span><strong class="verde-t">{resumo.marcas.concordo}</strong><small>{resumo.marcas.ciente} ciente</small></div>
        <div class="cartao"><span class="etiqueta">dúvidas</span><strong class:amarelo-t={resumo.marcas.duvida}>{resumo.marcas.duvida}</strong><small>{resumo.comentarios} comentários</small></div>
      </div>

      {#if resumo.duvidas.length}
        <section class="cartao">
          <h2>Dúvidas para responder</h2>
          <ul class="simples">
            {#each resumo.duvidas as d (d.id)}
              <li>
                <b>{d.nome}</b>: {pontos.find((p) => p.secaoId === d.secaoId && p.itemId === d.itemId)?.rotulo ?? d.secaoId}
                <span class="dica">{hora(d.em)}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section class="cartao">
        <h2>Ponto a ponto</h2>
        <table>
          <thead><tr><th>Ponto</th><th>Marcas</th><th>Comentários</th></tr></thead>
          <tbody>
            {#each pontos as p (`${p.secaoId}/${p.itemId ?? ''}`)}
              {@const marcas = marcasDoPonto(p.secaoId, p.itemId)}
              {@const comentarios = porPonto(p.secaoId, p.itemId).filter((x) => x.texto.trim())}
              <tr>
                <td class="ponto">{p.rotulo}</td>
                <td>
                  {#each marcas as m (m.id)}
                    <span class="pilula marca-{m.marca}" title={hora(m.em)}>{m.nome}: {nomesMarca[m.marca!]}</span>
                  {:else}
                    <span class="dica">-</span>
                  {/each}
                </td>
                <td>
                  {#each comentarios as c (c.id)}
                    <p class="comentario" class:novo={c.em > desde}>
                      <b>{c.nome}</b> <span class="dica">{hora(c.em)}</span><br />{c.texto}
                      <button class="link" onclick={() => apagar(c)}>apagar</button>
                    </p>
                  {/each}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      {#if gerais.length}
        <section class="cartao">
          <h2>Comentários gerais</h2>
          {#each gerais as c (c.id)}
            <p class="comentario" class:novo={c.em > desde}>
              <b>{c.nome}</b> <span class="dica">{hora(c.em)}</span><br />{c.texto}
              <button class="link" onclick={() => apagar(c)}>apagar</button>
            </p>
          {/each}
        </section>
      {/if}
    {:else}
      {#if carregando}
        <p class="dica">Buscando seus links...</p>
      {:else if !lista.length}
        <section class="cartao">
          <h2>Nenhum link publicado</h2>
          <p>Na tela Relatório, escolha um modelo (o <b>Interativo</b> foi feito para isso) e clique em <b>Publicar link</b>. Depois mande o endereço para quem precisa validar.</p>
          <a class="botao" href="/relatorio">Ir para Relatório</a>
        </section>
      {:else}
        <div class="grade">
          {#each lista as x (x.codigo)}
            <article class="cartao">
              <strong>{x.conteudo.titulo}</strong>
              <span class="dica">{x.conteudo.periodo} - publicado em {hora(x.criadoEm)}</span>
              <span class="pilula" class:verde={x.ativo} class:atencao={!x.ativo}>{x.ativo ? 'ativo' : 'desativado'}</span>
              <div class="botoes">
                <a class="botao principal" href="/retornos?c={x.codigo}">Ver respostas</a>
                <button onclick={() => copiarLink(x.codigo)}>{copiado === x.codigo ? 'Copiado!' : 'Copiar link'}</button>
                <button onclick={() => alternar(x)}>{x.ativo ? 'Desativar' : 'Reativar'}</button>
                <button class="perigo" onclick={() => excluir(x)}>Excluir</button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</main>

<style>
  .grade
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--size-3);
  }
  .grade article
  {
    display: grid;
    gap: var(--size-2);
    margin-top: 0;
    align-content: start;
  }
  .botoes, .topo-detalhe
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
  }
  .topo-detalhe
  {
    margin-bottom: var(--size-4);
  }
  .botoes button, .botoes a
  {
    font-size: 0.8rem;
    padding: 5px 10px;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  h2 small
  {
    color: var(--suave);
    font-weight: 400;
    font-size: 0.85rem;
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: var(--size-3);
    margin: var(--size-3) 0;
  }
  .kpis .cartao
  {
    margin-top: 0;
    display: grid;
    gap: 2px;
  }
  .kpis strong
  {
    font-family: var(--fonte-maquina);
    font-size: 1.8rem;
  }
  .kpis small
  {
    color: var(--suave);
  }
  .verde-t
  {
    color: var(--verde);
  }
  .amarelo-t
  {
    color: var(--amarelo);
  }
  .simples
  {
    margin: 0;
    padding-left: var(--size-4);
    display: grid;
    gap: var(--size-1);
  }
  .ponto
  {
    max-width: 320px;
  }
  .pilula
  {
    margin: 0 4px 4px 0;
  }
  .marca-ciente
  {
    background: var(--azul-fundo);
    color: var(--azul);
  }
  .marca-concordo
  {
    background: var(--verde-fundo);
    color: var(--verde);
  }
  .marca-duvida
  {
    background: var(--amarelo-fundo);
    color: var(--amarelo);
  }
  .comentario
  {
    margin: 0 0 var(--size-2);
    padding: var(--size-2);
    background: var(--superficie-2);
    border-radius: var(--raio-pequeno);
    font-size: 0.88rem;
  }
  .comentario.novo
  {
    border-left: 3px solid var(--marca);
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--suave);
    text-decoration: underline;
    font-size: 0.78rem;
    margin-left: var(--size-2);
  }
</style>
