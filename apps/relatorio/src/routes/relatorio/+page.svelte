<script lang="ts">
  import { resumoSugerido, segundaDaSemana, somarDias, type CorSemaforo } from '@supervisao/core';
  import { carregar, salvar, type Dados, type NotasRelatorio } from '#lib/armazenamento.ts';
  import { baixarPdf, gerarPdf, secoesRelatorio, semaforoDoRelatorio, type Secao } from '#lib/pdf.ts';
  import { contextoDaSemana, dataCurta, hoje, semanasDisponiveis } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  let semana = $state(segundaDaSemana(hoje()));
  let semanaAnterior = $state(somarDias(segundaDaSemana(hoje()), -7));
  let previa = $state('');
  let gerando = $state(false);
  let erro = $state('');

  $effect(() => salvar($state.snapshot(dados)));

  const semanas = $derived(semanasDisponiveis(dados));
  const opcoesAnteriores = $derived([...new Set([somarDias(semana, -7), ...semanas.filter((s) => s < semana)])].sort().reverse());
  const ctx = $derived(contextoDaSemana(dados, semana, semanaAnterior));
  const notas = $derived<NotasRelatorio>(dados.relatorios[semana] ?? {});
  const sugestao = $derived(resumoSugerido(ctx.frases));
  const semaforoAuto = $derived(semaforoDoRelatorio(ctx, {}));
  const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };

  function anotar<K extends keyof NotasRelatorio>(campo: K, valor: NotasRelatorio[K])
  {
    dados.relatorios[semana] = { ...notas, [campo]: valor };
  }

  function trocarSemana(nova: string)
  {
    semana = nova;
    semanaAnterior = somarDias(nova, -7);
  }

  function alternar(campo: 'secoesOcultas' | 'frasesOcultas', valor: string)
  {
    const atual = notas[campo] ?? [];
    anotar(campo, atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor]);
  }

  const entrada = () => ({
    dados: $state.snapshot(dados) as Dados,
    ctx,
    notas: $state.snapshot(notas) as NotasRelatorio,
    resumo: notas.resumo ?? sugestao,
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
      <label>Semáforo
        <select value={notas.semaforo ?? ''} onchange={(e) => anotar('semaforo', (e.currentTarget.value || undefined) as CorSemaforo | undefined)}>
          <option value="">Automático{semaforoAuto ? ` (${nomesSemaforo[semaforoAuto]})` : ''}</option>
          {#each Object.entries(nomesSemaforo) as [cor, nome] (cor)}<option value={cor}>{nome}</option>{/each}
        </select>
      </label>
    </div>
    {#if !ctx.atual.foto}<p class="aviso">Esta semana ainda não tem foto do painel. <a href="/painel">Colar o painel</a></p>{/if}
    {#if !ctx.anterior}<p class="dica">Sem dados da semana anterior: o comparativo aparece quando existir uma semana antes desta.</p>{/if}

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
      <h2>Seções do PDF</h2>
      <div class="secoes">
        {#each Object.entries(secoesRelatorio) as [chave, nome] (chave)}
          <label class="marcavel">
            <input type="checkbox" checked={!notas.secoesOcultas?.includes(chave)} onchange={() => alternar('secoesOcultas', chave as Secao)} />
            <span>{nome}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="bloco">
      <h2>Texto da supervisão</h2>
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

    <button class="principal grande" onclick={() => baixarPdf(entrada())}>Baixar PDF</button>
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
  .secoes
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .grande
  {
    width: 100%;
    margin: 16px 0 8px;
    padding: 12px;
    font-size: 1rem;
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
