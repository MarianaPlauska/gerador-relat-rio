<script lang="ts">
  import { dicionarioPadrao, resumoSugerido, segundaDaSemana, somarDias, type Bloco, type CorSemaforo } from '@supervisao/core';
  import { carregar, salvar, type Dados, type NotasRelatorio } from '#lib/armazenamento.ts';
  import ListaDeBlocos from '#lib/ListaDeBlocos.svelte';
  import { acharModelo, blocosDoRelatorio, chaveDoRelatorio, ehPronto, novoId, todosModelos } from '#lib/modelos.ts';
  import { baixarPdf, gerarPdf } from '#lib/pdf.ts';
  import { baixarTexto, copiar, textoPacote, textoTeams } from '#lib/saidas.ts';
  import { contextoDoRelatorio, dataCurta, hoje, periodoDaSemana, semaforoDoRelatorio, semanasDisponiveis, type Periodo } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  let semana = $state(segundaDaSemana(hoje()));
  let semanaAnterior = $state(somarDias(segundaDaSemana(hoje()), -7));
  // período livre: por padrão as últimas 4 semanas até a sexta desta
  let de = $state(somarDias(segundaDaSemana(hoje()), -21));
  let ate = $state(somarDias(segundaDaSemana(hoje()), 4));
  let modeloId = $state(dados.ultimoModelo);
  const modelo = $derived(acharModelo(dados, modeloId));
  const periodo = $derived<Periodo>(modelo.periodo === 'livre' ? { inicio: de, fim: ate, livre: true } : periodoDaSemana(semana, semanaAnterior));
  const chave = $derived(chaveDoRelatorio(periodo));
  let previa = $state('');
  let gerando = $state(false);
  let erro = $state('');
  let copiado = $state('');

  async function copiarSaida(nome: string, texto: string)
  {
    await copiar(texto);
    copiado = nome;
    setTimeout(() => (copiado = ''), 2000);
  }

  $effect(() => salvar($state.snapshot(dados)));

  const semanas = $derived(semanasDisponiveis(dados));
  const opcoesAnteriores = $derived([...new Set([somarDias(semana, -7), ...semanas.filter((s) => s < semana)])].sort().reverse());
  const ctx = $derived(contextoDoRelatorio(dados, periodo));
  const notas = $derived<NotasRelatorio>(dados.relatorios[chave] ?? {});
  const blocos = $derived(blocosDoRelatorio(modelo, notas));
  const mexido = $derived(!!notas.blocos?.[modelo.id]);
  const sugestao = $derived(resumoSugerido(ctx.frases));
  const semaforoAuto = $derived(semaforoDoRelatorio(ctx, {}));
  const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };

  function anotar<K extends keyof NotasRelatorio>(campo: K, valor: NotasRelatorio[K])
  {
    dados.relatorios[chave] = { ...notas, [campo]: valor };
  }

  function trocarSemana(nova: string)
  {
    semana = nova;
    semanaAnterior = somarDias(nova, -7);
  }

  function trocarModelo(id: string)
  {
    modeloId = id;
    dados.ultimoModelo = id;
  }

  function alternar(campo: 'frasesOcultas', valor: string)
  {
    const atual = notas[campo] ?? [];
    anotar(campo, atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor]);
  }

  // mexer nos blocos vale só para este relatório; o modelo continua igual
  function mudarBlocos(novos: Bloco[])
  {
    anotar('blocos', { ...notas.blocos, [modelo.id]: novos });
  }

  function voltarAoModelo()
  {
    const { [modelo.id]: _, ...outros } = notas.blocos ?? {};
    const { secoesOcultas: _antigas, ...resto } = notas;
    dados.relatorios[chave] = { ...resto, blocos: outros };
  }

  function salvarComoModelo()
  {
    const nome = prompt('Nome do modelo novo:', `${modelo.nome} (cópia)`)?.trim();
    if (!nome) return;
    const novo = { ...$state.snapshot(modelo), id: novoId(), nome, blocos: $state.snapshot(blocos) as Bloco[] };
    dados.modelos.push(novo);
    voltarAoModelo();
    trocarModelo(novo.id);
  }

  const entrada = () => ({
    dados: $state.snapshot(dados) as Dados,
    ctx,
    notas: $state.snapshot(notas) as NotasRelatorio,
    resumo: notas.resumo ?? sugestao,
    modelo: $state.snapshot(modelo),
    blocos: $state.snapshot(blocos) as Bloco[],
  });

  // refaz a prévia meio segundo depois da última mudança
  $effect(() =>
  {
    const e = entrada();
    const espera = setTimeout(async () =>
    {
      gerando = true;
      try
      {
        const blob = await gerarPdf(e);
        if (previa) URL.revokeObjectURL(previa);
        previa = URL.createObjectURL(blob);
        erro = '';
      }
      catch (x)
      {
        erro = `Não consegui gerar o PDF: ${String(x)}`;
      }
      finally
      {
        gerando = false;
      }
    }, 500);
    return () => clearTimeout(espera);
  });
</script>

<main>
  <aside>
    <span class="etiqueta">relatório</span>
    <h1>Gerador de PDF<span class="cursor">_</span></h1>

    <div class="grupo">
      <label>Modelo
        <select value={modelo.id} onchange={(e) => trocarModelo(e.currentTarget.value)}>
          {#each todosModelos(dados) as m (m.id)}<option value={m.id}>{m.nome}{ehPronto(m.id) ? '' : ' (meu)'}</option>{/each}
        </select>
      </label>
      <p class="dica">{modelo.descricao} <a href="/modelos">gerenciar modelos</a></p>
      {#if modelo.periodo === 'livre'}
        <div class="datas">
          <label>De <input type="date" bind:value={de} max={ate} /></label>
          <label>Até <input type="date" bind:value={ate} min={de} /></label>
        </div>
      {:else}
        <label>Semana
          <select value={semana} onchange={(e) => trocarSemana(e.currentTarget.value)}>
            {#each semanas as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
          </select>
        </label>
        <label>Comparar com
          <select bind:value={semanaAnterior}>
            {#each opcoesAnteriores as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
          </select>
        </label>
      {/if}
      <label>Semáforo
        <select value={notas.semaforo ?? ''} onchange={(e) => anotar('semaforo', (e.currentTarget.value || undefined) as CorSemaforo | undefined)}>
          <option value="">Automático{semaforoAuto ? ` (${nomesSemaforo[semaforoAuto]})` : ''}</option>
          {#each Object.entries(nomesSemaforo) as [cor, nome] (cor)}<option value={cor}>{nome}</option>{/each}
        </select>
      </label>
    </div>
    {#if !ctx.atual.foto}<p class="aviso">{ctx.livre ? "Este período" : "Esta semana"} ainda não tem foto do painel. <a href="/painel">Colar o painel</a></p>{/if}
    {#if !ctx.anterior}<p class="dica">{ctx.livre ? "Sem foto antes do período: o comparativo usa a primeira foto do período quando houver duas." : "Sem dados da semana anterior: o comparativo aparece quando existir uma semana antes desta."}</p>{/if}

    <div class="bloco">
      <div class="titulo-bloco">
        <h2>Resumo executivo</h2>
        <button class="link" onclick={() => anotar('resumo', sugestao)} disabled={!sugestao}>usar texto sugerido</button>
      </div>
      <textarea
        rows="5"
        value={notas.resumo ?? ''}
        placeholder={sugestao || 'Em 2 ou 3 frases: como a semana está e o que muda para a gestão.'}
        oninput={(e) => anotar('resumo', e.currentTarget.value || undefined)}
      ></textarea>
      <p class="dica">Se ficar vazio, o PDF usa o texto sugerido pelo sistema.</p>
    </div>

    <div class="bloco">
      <h2>O que o sistema percebeu</h2>
      <p class="dica">Desmarque o que não quer no PDF.</p>
      {#each ctx.frases as f, i (i)}
        <label class="marcavel {f.tom}">
          <input type="checkbox" checked={!notas.frasesOcultas?.includes(f.texto)} onchange={() => alternar('frasesOcultas', f.texto)} />
          <span>{f.texto}</span>
        </label>
      {:else}
        <p class="dica">Nada para comparar ainda.</p>
      {/each}
    </div>

    <div class="bloco">
      <div class="titulo-bloco">
        <h2>Blocos deste relatório</h2>
        {#if mexido}<button class="link" onclick={voltarAoModelo}>voltar ao modelo</button>{/if}
      </div>
      <p class="dica">O PDF segue esta ordem. Adicione texto, gráfico ou tabela em qualquer ponto e suba ou desça. Mexer aqui não muda o modelo.</p>
      <ListaDeBlocos listas={dados.listas} {blocos} onmudar={mudarBlocos} />
      <button class="link salvar-modelo" onclick={salvarComoModelo}>salvar estes blocos como modelo novo</button>
    </div>

    <div class="bloco">
      <h2>Identificação (capa e aprovação)</h2>
      <label>Área <input bind:value={dados.identificacao.area} /></label>
      <label>Elaborado por <input bind:value={dados.identificacao.elaboradoPor} placeholder="Seu nome" /></label>
      <label>Cargo <input bind:value={dados.identificacao.cargo} /></label>
      <label>Destinatário <input bind:value={dados.identificacao.destinatario} placeholder="Nome do gestor" /></label>
    </div>

    <div class="bloco">
      <h2>Texto da supervisão</h2>
      <p class="dica">Uma linha por item: cada linha vira um tópico no PDF.</p>
      <label>Destaques da semana
        <textarea rows="3" value={notas.destaques ?? ''} oninput={(e) => anotar('destaques', e.currentTarget.value || undefined)} placeholder="Entregas, avanços e o que deu certo."></textarea>
      </label>
      <label>Decisões e apoio necessários
        <textarea rows="3" value={notas.decisoes ?? ''} oninput={(e) => anotar('decisoes', e.currentTarget.value || undefined)} placeholder="O que a gestão precisa decidir ou destravar, com prazo."></textarea>
      </label>
      <label>Próximos passos
        <textarea rows="3" value={notas.proximosPassos ?? ''} oninput={(e) => anotar('proximosPassos', e.currentTarget.value || undefined)} placeholder="O que será feito, por quem, até quando e para quê."></textarea>
      </label>
    </div>

    <div class="bloco">
      <h2>Dicionário do painel</h2>
      <p class="dica">O que significa cada número do painel do gestor. Uma linha por termo, no formato "Termo: definição". Vai para o glossário do PDF e para o pacote da IA.</p>
      <textarea rows="8" bind:value={dados.dicionario}></textarea>
      <button class="link" onclick={() => (dados.dicionario = dicionarioPadrao)}>voltar ao texto inicial</button>
    </div>

    <button class="principal grande" onclick={() => baixarPdf(entrada())}>Baixar PDF</button>
    <div class="saidas">
      <button onclick={() => copiarSaida('teams', textoTeams(dados, ctx, notas))}>{copiado === 'teams' ? 'Copiado!' : 'Copiar mensagem do Teams'}</button>
      <button onclick={() => copiarSaida('pacote', textoPacote(dados, ctx, notas))}>{copiado === 'pacote' ? 'Copiado!' : 'Copiar pacote para IA'}</button>
      <button onclick={() => baixarTexto(textoPacote(dados, ctx, notas), `pacote-ia-${dados.prefixo}-${chave}.md`)}>Baixar pacote (.md)</button>
    </div>
  </aside>

  <section class="previa">
    <span class="etiqueta">prévia{gerando ? ' · atualizando...' : ''}</span>
    {#if erro}<p class="aviso">{erro}</p>{/if}
    {#if previa}
      <iframe src={previa} title="Prévia do relatório"></iframe>
    {:else}
      <p class="dica">Gerando a prévia...</p>
    {/if}
  </section>
</main>

<style>
  main
  {
    display: grid;
    grid-template-columns: 440px 1fr;
    gap: 24px;
    padding: 24px 28px;
    height: calc(100vh - 60px);
  }
  aside
  {
    overflow-y: auto;
    padding-right: 6px;
  }
  h1
  {
    font-size: 2rem;
    margin: 4px 0 14px;
  }
  .cursor
  {
    color: var(--marca);
  }
  .grupo
  {
    display: grid;
    gap: 10px;
  }
  .grupo label, .bloco label:not(.marcavel)
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bloco
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px;
    margin-top: 14px;
  }
  .bloco h2
  {
    font-size: 1rem;
    margin-bottom: 8px;
  }
  .titulo-bloco
  {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  textarea
  {
    width: 100%;
    resize: vertical;
  }
  .bloco label + label
  {
    margin-top: 10px;
  }
  .marcavel
  {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 8px;
    border-radius: 8px;
    background: none;
    color: var(--texto);
    font-size: 0.86rem;
    cursor: var(--cursor-clique);
  }
  .marcavel:hover
  {
    background: #faf8f5;
  }
  .marcavel.atencao
  {
    border-left: 3px solid var(--amarelo);
  }
  .marcavel.positivo
  {
    border-left: 3px solid var(--verde);
  }
  .marcavel.neutro
  {
    border-left: 3px solid var(--borda);
  }
  .marcavel input
  {
    margin-top: 3px;
    accent-color: var(--marca);
  }
  .datas
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .salvar-modelo
  {
    margin-top: 10px;
  }
  .grande
  {
    width: 100%;
    margin: 16px 0 8px;
    padding: 12px;
    font-size: 1rem;
  }
  .saidas
  {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.82rem;
  }
  .previa
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  iframe
  {
    flex: 1;
    width: 100%;
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    background: #fff;
    box-shadow: var(--sombra);
  }
  .aviso a
  {
    color: var(--marca);
  }
  @media (max-width: 1000px)
  {
    main
    {
      grid-template-columns: 1fr;
      height: auto;
    }
    iframe
    {
      height: 80vh;
    }
  }
</style>
