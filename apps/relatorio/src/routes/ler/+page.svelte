<script lang="ts">
  import { agoraLocal, codigoValido, nomesMarca, type MarcaInterativa, type Publicacao, type SecaoInterativa } from '@supervisao/core';
  import { page } from '$app/state';
  import { svgLinha } from '#lib/graficos.ts';
  import { svgDoFluxo } from '#lib/fluxograma.ts';
  import { enviarResposta, lerPublicacao } from '#lib/links.ts';

  const codigo = page.url.searchParams.get('c');
  const chaveNome = 'orbisos-leitor-nome';
  const chaveMinhas = `orbisos-leitor-${codigo}`;
  const marcas = Object.keys(nomesMarca) as MarcaInterativa[];

  type Minha = { marca?: MarcaInterativa | undefined; comentarios: { texto: string; em: string }[] };
  const lerLocal = <T,>(chave: string, padrao: T): T =>
  {
    try
    {
      const bruto = localStorage.getItem(chave);
      return bruto ? (JSON.parse(bruto) as T) : padrao;
    }
    catch
    {
      return padrao;
    }
  };

  let estado = $state<'carregando' | 'ok' | 'indisponivel' | 'erro'>('carregando');
  let publicacao = $state<Publicacao>();
  let nome = $state(lerLocal(chaveNome, ''));
  let minhas = $state<Record<string, Minha>>(lerLocal(chaveMinhas, {}));
  let abertos = $state<Record<string, boolean>>({});
  let rascunhos = $state<Record<string, string>>({});
  let enviando = $state('');
  let falha = $state('');

  const chave = (secaoId: string, itemId?: string) => (itemId ? `${secaoId}/${itemId}` : secaoId);

  $effect(() =>
  {
    if (!codigoValido(codigo))
    {
      estado = 'indisponivel';
      return;
    }
    lerPublicacao(codigo)
      .then((p) =>
      {
        publicacao = p;
        estado = p?.ativo ? 'ok' : 'indisponivel';
      })
      // sem permissão = link desativado ou inexistente
      .catch((e) => (estado = String((e as { code?: string }).code).includes('permission') ? 'indisponivel' : 'erro'));
  });

  function guardarLocal()
  {
    try
    {
      localStorage.setItem(chaveNome, JSON.stringify(nome));
      localStorage.setItem(chaveMinhas, JSON.stringify($state.snapshot(minhas)));
    }
    catch
    {
      // sem armazenamento: as marcas continuam valendo nesta aba
    }
  }

  async function responder(secaoId: string, itemId: string | undefined, marca: MarcaInterativa | undefined, texto: string)
  {
    if (!nome.trim())
    {
      falha = 'Escreva seu nome no alto da página antes de responder.';
      document.getElementById('nome')?.focus();
      return;
    }
    falha = '';
    const k = chave(secaoId, itemId);
    enviando = k;
    const em = agoraLocal();
    try
    {
      await enviarResposta(codigo!, { secaoId, ...(itemId ? { itemId } : {}), ...(marca ? { marca } : {}), texto: texto.trim(), nome: nome.trim(), em });
      const atual = minhas[k] ?? { comentarios: [] };
      minhas[k] = { marca: marca ?? atual.marca, comentarios: texto.trim() ? [...atual.comentarios, { texto: texto.trim(), em }] : atual.comentarios };
      if (texto.trim())
      {
        rascunhos[k] = '';
        abertos[k] = false;
      }
      guardarLocal();
    }
    catch
    {
      falha = 'Não consegui enviar. Veja a conexão e tente de novo; se o link foi desativado, peça um novo.';
    }
    finally
    {
      enviando = '';
    }
  }

  const marcar = (secaoId: string, itemId: string, m: MarcaInterativa) => responder(secaoId, itemId, m, '');
  const hora = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
  const grafico = (s: Extract<SecaoInterativa, { tipo: 'grafico' }>) => svgLinha(s.pontos, { largura: 560, altura: 200, ...(s.meta !== undefined ? { meta: s.meta } : {}), ...(s.sufixo ? { sufixo: s.sufixo } : {}) });
  const fluxo = (s: Extract<SecaoInterativa, { tipo: 'fluxo' }>) => svgDoFluxo(s).svg;
</script>

<svelte:head>
  <title>{publicacao?.conteudo.titulo ?? 'Relatório'} - OrbisOS</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="topo">
  <span class="marca">OrbisOS<span>_</span></span>
  <span class="dica">relatório recebido por link</span>
</header>

<main class="leitura">
  {#if estado === 'carregando'}
    <p class="dica">Abrindo o relatório...</p>
  {:else if estado === 'indisponivel'}
    <section class="cartao vazio">
      <h1>Link indisponível</h1>
      <p>Este link não existe ou foi desativado por quem enviou. Peça um link novo.</p>
    </section>
  {:else if estado === 'erro'}
    <section class="cartao vazio">
      <h1>Não consegui abrir</h1>
      <p>Verifique a conexão com a internet e recarregue a página.</p>
    </section>
  {:else if publicacao}
    {@const r = publicacao.conteudo}
    <span class="prompt">&gt; {r.subtitulo || 'relatório'}</span>
    <h1>{r.titulo}<span class="cursor">_</span></h1>
    <p class="meta">
      {r.periodo}
      {#if r.situacao}<span class="pilula situacao">{r.situacao}</span>{/if}
      {#if r.autor}<span>por {r.autor}</span>{/if}
      <span>gerado em {hora(r.geradoEm)}</span>
    </p>

    <section class="cartao quem">
      <label>
        Seu nome (aparece junto das suas respostas)
        <input id="nome" bind:value={nome} onchange={guardarLocal} maxlength="60" placeholder="Como você quer assinar" autocomplete="name" />
      </label>
      <p class="dica">Em cada ponto, marque <b>Ciente</b>, <b>Concordo</b> ou <b>Tenho dúvida</b> e, se quiser, comente. Cada clique já é enviado a quem publicou o relatório.</p>
      {#if falha}<p class="erro">{falha}</p>{/if}
    </section>

    {#each r.secoes as s (s.id)}
      <section class="cartao">
        <h2>{s.titulo}</h2>
        {#if s.tipo === 'texto'}
          {#each s.paragrafos as p, i (i)}<p>{p}</p>{/each}
          {#if s.imagens?.length}
            <div class="imagens-secao">
              {#each s.imagens as img, i (i)}
                <figure><img src={img.dataUrl} alt={img.nome} /><figcaption>{img.nome}</figcaption></figure>
              {/each}
            </div>
          {/if}
        {:else if s.tipo === 'tabela'}
          <div class="rolagem">
            <table>
              <thead><tr>{#each s.colunas as c, i (i)}<th class:num={i > 0}>{c}</th>{/each}</tr></thead>
              <tbody>
                {#each s.linhas as l, i (i)}
                  <tr>{#each l.celulas as c, j (j)}<td class:num={j > 0}>{c}</td>{/each}</tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if s.tipo === 'grafico'}
          <div class="grafico">{@html grafico(s)}</div>
        {:else if s.tipo === 'fluxo'}
          <div class="fluxo">{@html fluxo(s)}</div>
        {:else}
          {#if s.intro}<p class="dica">{s.intro}</p>{/if}
          {#if s.imagens?.length}
            <div class="imagens-secao">
              {#each s.imagens as img, i (i)}
                <figure><img src={img.dataUrl} alt={img.nome} /><figcaption>{img.nome}</figcaption></figure>
              {/each}
            </div>
          {/if}
          <ul class="itens">
            {#each s.itens as item (item.id)}
              {@const k = chave(s.id, item.id)}
              {@const m = minhas[k]}
              <li class={item.nivel ?? ''}>
                <p class="texto">{item.texto}</p>
                {#if item.detalhe}<p class="detalhe">{item.detalhe}</p>{/if}
                <div class="acoes">
                  {#each marcas as marca (marca)}
                    <button class="marca-botao {marca}" class:ativa={m?.marca === marca} disabled={enviando === k} onclick={() => marcar(s.id, item.id, marca)}>
                      {nomesMarca[marca]}
                    </button>
                  {/each}
                  <button class="link" onclick={() => (abertos[k] = !abertos[k])}>{abertos[k] ? 'fechar' : 'comentar'}</button>
                </div>
                {#if abertos[k]}
                  <div class="comentar">
                    <textarea rows="3" maxlength="1000" bind:value={rascunhos[k]} placeholder="Escreva seu comentário"></textarea>
                    <button class="principal" disabled={!rascunhos[k]?.trim() || enviando === k} onclick={() => responder(s.id, item.id, undefined, rascunhos[k] ?? '')}>Enviar comentário</button>
                  </div>
                {/if}
                {#each m?.comentarios ?? [] as c (c.em)}
                  <p class="meu">Você, {hora(c.em)}: {c.texto}</p>
                {/each}
              </li>
            {/each}
          </ul>
        {/if}

        {#if s.tipo !== 'itens'}
          {@const k = chave(s.id)}
          <div class="acoes">
            <button class="link" onclick={() => (abertos[k] = !abertos[k])}>{abertos[k] ? 'fechar' : 'comentar esta parte'}</button>
          </div>
          {#if abertos[k]}
            <div class="comentar">
              <textarea rows="3" maxlength="1000" bind:value={rascunhos[k]} placeholder="Escreva seu comentário"></textarea>
              <button class="principal" disabled={!rascunhos[k]?.trim() || enviando === k} onclick={() => responder(s.id, undefined, undefined, rascunhos[k] ?? '')}>Enviar comentário</button>
            </div>
          {/if}
          {#each minhas[k]?.comentarios ?? [] as c (c.em)}
            <p class="meu">Você, {hora(c.em)}: {c.texto}</p>
          {/each}
        {/if}
      </section>
    {/each}

    <section class="cartao">
      <h2>Comentário geral</h2>
      <textarea rows="4" maxlength="1000" bind:value={rascunhos.geral} placeholder="Algo mais que queira dizer sobre o relatório?"></textarea>
      <div class="acoes">
        <button class="principal" disabled={!rascunhos.geral?.trim() || enviando === 'geral'} onclick={() => responder('geral', undefined, undefined, rascunhos.geral ?? '')}>Enviar</button>
      </div>
      {#each minhas.geral?.comentarios ?? [] as c (c.em)}
        <p class="meu">Você, {hora(c.em)}: {c.texto}</p>
      {/each}
    </section>
  {/if}
</main>

<style>
  .topo
  {
    display: flex;
    align-items: baseline;
    gap: var(--size-3);
    padding: var(--size-3) var(--size-6);
    background: var(--barra);
    border-bottom: 1px solid var(--borda);
  }
  .marca
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    font-size: 1.1rem;
    color: #fff;
  }
  .marca span
  {
    color: var(--suave);
  }
  .leitura
  {
    max-width: 860px;
  }
  .meta
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2) var(--size-4);
    align-items: center;
    margin: 0 0 var(--size-4);
    color: var(--suave);
    font-size: 0.9rem;
  }
  .situacao
  {
    background: var(--amarelo-fundo);
    color: var(--amarelo);
  }
  .vazio
  {
    text-align: center;
  }
  .quem label
  {
    display: grid;
    gap: var(--size-1);
  }
  .quem input
  {
    max-width: 360px;
  }
  .erro
  {
    margin: var(--size-2) 0 0;
    color: var(--vermelho);
    font-size: 0.88rem;
  }
  .rolagem
  {
    overflow-x: auto;
  }
  .grafico, .fluxo
  {
    display: grid;
    justify-items: center;
    overflow-x: auto;
  }
  .fluxo
  {
    background: #fff;
    border-radius: var(--raio-pequeno);
    padding: var(--size-3);
  }
  .grafico :global(svg), .fluxo :global(svg)
  {
    max-width: 100%;
    height: auto;
  }
  .imagens-secao
  {
    display: grid;
    gap: var(--size-3);
    margin: var(--size-3) 0;
  }
  .imagens-secao figure
  {
    margin: 0;
  }
  .imagens-secao img
  {
    max-width: 100%;
    border-radius: var(--raio-pequeno);
    border: 1px solid var(--borda);
  }
  .imagens-secao figcaption
  {
    font-size: 0.78rem;
    color: var(--suave);
    margin-top: 4px;
  }
  .itens
  {
    list-style: none;
    margin: var(--size-3) 0 0;
    padding: 0;
    display: grid;
    gap: var(--size-3);
  }
  .itens li
  {
    padding: var(--size-3);
    border: 1px solid var(--borda);
    border-left: 3px solid var(--borda-forte);
    border-radius: var(--raio-pequeno);
    background: var(--superficie-2);
  }
  .itens li.alto
  {
    border-left-color: var(--vermelho);
  }
  .itens li.medio
  {
    border-left-color: var(--amarelo);
  }
  .itens li.baixo
  {
    border-left-color: var(--verde);
  }
  .texto
  {
    margin: 0;
  }
  .detalhe
  {
    margin: var(--size-1) 0 0;
    color: var(--suave);
    font-size: 0.86rem;
  }
  .acoes
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2);
    align-items: center;
    margin-top: var(--size-3);
  }
  .marca-botao
  {
    font-size: 0.8rem;
    padding: 5px 12px;
  }
  .marca-botao.ativa.ciente
  {
    background: var(--azul-fundo);
    border-color: var(--azul);
    color: var(--azul);
  }
  .marca-botao.ativa.concordo
  {
    background: var(--verde-fundo);
    border-color: var(--verde);
    color: var(--verde);
  }
  .marca-botao.ativa.duvida
  {
    background: var(--amarelo-fundo);
    border-color: var(--amarelo);
    color: var(--amarelo);
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    color: var(--suave);
    text-decoration: underline;
    font-size: 0.84rem;
  }
  .comentar
  {
    display: grid;
    gap: var(--size-2);
    margin-top: var(--size-2);
    justify-items: start;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .meu
  {
    margin: var(--size-2) 0 0;
    padding: var(--size-2);
    background: var(--marca-clara);
    border-radius: var(--raio-pequeno);
    font-size: 0.86rem;
  }
  @media (max-width: 700px)
  {
    .topo
    {
      padding: var(--size-3);
    }
  }
</style>
