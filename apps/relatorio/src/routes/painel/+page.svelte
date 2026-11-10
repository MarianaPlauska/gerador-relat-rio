<script lang="ts">
  import
  {
    detectarOrigem, fotoVazia, lerCards, lerTotais, mesclarNaFoto, nomesTotais,
    type CardSnapshot, type OrigemLeitura, type Ritmo, type TotaisPainel,
  } from '@supervisao/core';
  import { carregar, exportarJson, importarJson, salvar, type Dados } from '#lib/armazenamento.ts';
  import { lerColagem } from '#lib/colagem.ts';
  import { lerImagem } from '#lib/ocr.ts';
  import TabelaCards from '#lib/TabelaCards.svelte';

  type ChaveTotal = keyof TotaisPainel;

  // só os três primeiros grupos entram no relatório; o resto é opcional
  const gruposTotais: { titulo: string; chaves: ChaveTotal[]; dica?: string; secundario?: boolean }[] = [
    { titulo: 'Cronograma', chaves: ['itensCronograma', 'concluidos', 'concluidosPct', 'vencem15Dias', 'atrasadosVencimento'] },
    { titulo: 'Em andamento e ritmo', chaves: ['demandasEmAndamento', 'etapaRodando', 'ritmoNoRitmo', 'ritmoEmRisco', 'ritmoAtrasadas'] },
    { titulo: 'Prazo e eficiência', chaves: ['dentroDoPrazoPct', 'metaPct', 'concluidasNoPeriodo', 'eficiencia', 'eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade'] },
    {
      titulo: 'Outros números (opcional)',
      secundario: true,
      dica: '"Parada há" mostra há quantos dias as demandas abertas estão sem andar, separadas em faixas. Só preencha se quiser guardar.',
      chaves: ['aindaPlanejado', 'emExecucao', 'datasFixadas', 'paradasEntreEtapas', 'emAbertoAgora', 'foraDoPrazo', 'previsoesSemana', 'previsaoVencida', 'qualidadePct', 'idadeAte1Dia', 'idade1a3Dias', 'idade3a7Dias', 'idade7a15Dias', 'idadeMais15Dias'],
    },
  ];

  let dados = $state<Dados>(carregar());
  let dataFoto = $state(new Date().toISOString().slice(0, 10));
  let texto = $state('');
  let origemEscolhida = $state<'auto' | OrigemLeitura>('auto');
  let aviso = $state('');
  let progresso = $state<number | null>(null);
  let totaisLidos = $state<TotaisPainel>({});
  let cardsLidos = $state<CardSnapshot[]>([]);
  let leu = $state(false);
  let trechos = $state(0);

  // correções feitas na foto salva gravam na hora
  $effect(() => salvar($state.snapshot(dados)));

  const indiceFoto = $derived(dados.fotos.findIndex((f) => f.data === dataFoto));
  const foto = $derived(dados.fotos[indiceFoto] ?? fotoVazia(dataFoto));
  const origemDetectada = $derived(texto ? detectarOrigem(texto) : null);
  const chavesLidas = $derived(Object.keys(totaisLidos) as ChaveTotal[]);
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '';

  const nomesOrigem: Record<OrigemLeitura, string> = {
    em_execucao: 'Quem está cuidando de quê',
    fila: 'Fila - demandas a iniciar',
    cronograma: 'Lista do cronograma',
  };
  const ritmos: Ritmo[] = ['no_ritmo', 'em_risco', 'atrasado'];

  function apagarFoto()
  {
    if (!confirm(`Apagar a foto de ${dataFoto} inteira (${Object.keys(foto.totais).length} totais e ${foto.cards.length} cards)?`)) return;
    dados.fotos = dados.fotos.filter((f) => f.data !== dataFoto);
    aviso = `Foto de ${dataFoto} apagada.`;
  }

  async function aoColar(e: ClipboardEvent)
  {
    const colado = lerColagem(e);
    if (!colado) return;
    e.preventDefault();
    if (colado.tipo === 'texto')
    {
      texto = colado.texto;
      ler();
      return;
    }
    await lerImagens([colado.imagem]);
  }

  function aoSoltar(e: DragEvent)
  {
    const imagens = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!imagens.length) return;
    e.preventDefault();
    lerImagens(imagens);
  }

  // lê um print de cada vez e vai somando no que já foi lido
  async function lerImagens(imagens: Blob[])
  {
    try
    {
      for (const [i, imagem] of imagens.entries())
      {
        aviso = `Lendo a imagem ${i + 1} de ${imagens.length}... na primeira vez baixa o idioma português, pode demorar.`;
        progresso = 0;
        texto = await lerImagem(imagem, (p) => (progresso = p));
        ler();
      }
      aviso = 'Imagem lida. Confira os campos abaixo, a leitura de imagem pode errar. Pode colar o próximo print.';
    }
    catch (erro)
    {
      aviso = `Não consegui ler a imagem: ${String(erro)}`;
    }
    finally
    {
      progresso = null;
    }
  }

  function ler()
  {
    const origem = origemEscolhida === 'auto' ? undefined : origemEscolhida;
    const totais = lerTotais(texto);
    const cards = lerCards(texto, { prefixo: dados.prefixo, pessoas: dados.pessoas, origem, hoje: dataFoto });
    const acumulado = mesclarNaFoto({ data: dataFoto, totais: $state.snapshot(totaisLidos), cards: $state.snapshot(cardsLidos) }, totais, cards);
    totaisLidos = acumulado.totais;
    cardsLidos = acumulado.cards;
    trechos++;
    leu = true;
  }

  function limparLeitura()
  {
    texto = '';
    totaisLidos = {};
    cardsLidos = [];
    trechos = 0;
    leu = false;
  }

  function salvarNaFoto()
  {
    const nova = mesclarNaFoto(foto, totaisLidos, $state.snapshot(cardsLidos));
    dados.fotos = [...dados.fotos.filter((f) => f.data !== dataFoto), nova].sort((a, b) => a.data.localeCompare(b.data));
    salvar($state.snapshot(dados));
    aviso = `Salvo na foto de ${dataFoto}: ${chavesLidas.length} totais e ${cardsLidos.length} cards.`;
    limparLeitura();
  }

  async function aoImportar(e: Event)
  {
    const arquivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    dados = await importarJson(arquivo);
    salvar($state.snapshot(dados));
    aviso = 'Dados importados.';
  }

  function digitarTotal(chave: ChaveTotal, valor: string)
  {
    const numero = valor === '' ? undefined : Number(valor);
    const nova = { ...foto, totais: { ...foto.totais, [chave]: numero } };
    if (numero === undefined) delete nova.totais[chave];
    dados.fotos = [...dados.fotos.filter((f) => f.data !== dataFoto), nova].sort((a, b) => a.data.localeCompare(b.data));
    salvar($state.snapshot(dados));
  }

  function contar(pessoaId: string, ritmo: Ritmo): number
  {
    return foto.cards.filter((c) => c.responsavelEtapaAtual === pessoaId && c.ritmoPainel === ritmo).length;
  }
</script>

<main>
  <header>
    <h1>Colar o painel</h1>
    <label>Foto de <input type="date" bind:value={dataFoto} /></label>
    <label>Prefixo dos cards <input class="curto" bind:value={dados.prefixo} /></label>
    <button onclick={() => exportarJson($state.snapshot(dados))}>Exportar JSON</button>
    <label class="botao">Importar JSON <input type="file" accept="application/json" onchange={aoImportar} hidden /></label>
  </header>

  <section class="cartao">
    <h2>1. Cole aqui (Ctrl+V)</h2>
    <p class="dica">
      Selecione um trecho do painel e copie (Ctrl+C), ou tire um print (Win+Shift+S). Depois clique na caixa e cole.
      Pode colar vários prints seguidos: cada um soma no que já foi lido. Também dá para arrastar várias imagens para a caixa.
    </p>
    <textarea rows="8" bind:value={texto} onpaste={aoColar} ondrop={aoSoltar} ondragover={(e) => e.preventDefault()} placeholder="Cole o texto ou o print do painel"></textarea>
    <div class="linha">
      <label>Trecho
        <select bind:value={origemEscolhida}>
          <option value="auto">Detectar{origemDetectada ? ` (${nomesOrigem[origemDetectada]})` : ''}</option>
          {#each Object.entries(nomesOrigem) as [valor, nome] (valor)}
            <option value={valor}>{nome}</option>
          {/each}
        </select>
      </label>
      <button onclick={ler} disabled={!texto}>Ler este texto</button>
      <label class="botao">Escolher imagens
        <input type="file" accept="image/*" multiple hidden onchange={(e) => lerImagens([...(e.currentTarget.files ?? [])])} />
      </label>
      {#if trechos}<span class="dica">{trechos} {trechos === 1 ? 'trecho lido' : 'trechos lidos'}</span>{/if}
      <button onclick={limparLeitura} disabled={!leu}>Limpar leitura</button>
      {#if progresso !== null}<progress value={progresso}></progress>{/if}
    </div>
    {#if aviso}<p class="aviso">{aviso}</p>{/if}
  </section>

  {#if leu}
    <section class="cartao">
      <h2>2. Confira antes de salvar</h2>

      <h3>Totais encontrados ({chavesLidas.length})</h3>
      {#if chavesLidas.length}
        <table>
          <tbody>
            {#each chavesLidas as chave (chave)}
              <tr>
                <td>{nomesTotais[chave]}</td>
                <td><input type="number" class="curto" bind:value={totaisLidos[chave]} /></td>
                <td><button onclick={() => delete totaisLidos[chave]}>remover</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="dica">Nenhum total neste trecho.</p>
      {/if}

      <h3>Cards encontrados ({cardsLidos.length})</h3>
      {#if cardsLidos.length}
        <TabelaCards bind:cards={cardsLidos} pessoas={dados.pessoas} />
      {:else}
        <p class="dica">Nenhum card com o prefixo {dados.prefixo}- neste trecho.</p>
      {/if}

      <button class="principal" onclick={salvarNaFoto} disabled={!chavesLidas.length && !cardsLidos.length}>
        Salvar na foto de {dataFoto}
      </button>
    </section>
  {/if}

  <section class="cartao">
    <h2>Foto de {dataFoto}</h2>
    <p class="dica">
      {Object.keys(foto.totais).length} totais e {foto.cards.length} cards salvos.
      {#if indiceFoto >= 0}<button class="link perigo" onclick={apagarFoto}>apagar esta foto</button>{/if}
    </p>
    {#if indiceFoto >= 0 && foto.cards.length}
      <details>
        <summary>Cards desta foto (corrigir ou remover)</summary>
        <p class="dica">O que mudar aqui grava na hora e o relatório já usa a versão corrigida. Card com código errado: corrija o código ou remova.</p>
        <TabelaCards bind:cards={dados.fotos[indiceFoto]!.cards} pessoas={dados.pessoas} />
      </details>
    {/if}
    <details>
      <summary>Números do painel (digitar ou corrigir)</summary>
      <p class="dica">Preencha só o que aparece no painel do gestor. Campo vazio fica fora do relatório.</p>
      {#each gruposTotais as g (g.titulo)}
        <fieldset class:secundario={g.secundario}>
          <legend>{g.titulo}</legend>
          {#if g.dica}<p class="dica">{g.dica}</p>{/if}
          <div class="grade">
            {#each g.chaves as chave (chave)}
              <label>
                {nomesTotais[chave]}
                <input
                  type="number"
                  class="curto"
                  value={foto.totais[chave] ?? ''}
                  onchange={(e) => digitarTotal(chave, e.currentTarget.value)}
                />
              </label>
            {/each}
          </div>
        </fieldset>
      {/each}
    </details>
    <table>
      <thead><tr><th>Pessoa</th><th>No ritmo</th><th>Em risco</th><th>Atrasado</th></tr></thead>
      <tbody>
        {#each dados.pessoas as p (p.id)}
          <tr><td>{nomePessoa(p.id)}</td>{#each ritmos as r (r)}<td>{contar(p.id, r)}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </section>
</main>

<style>
  main
  {
    max-width: 1240px;
    margin: 0 auto;
    padding: 24px;
  }
  header, .linha
  {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  h1
  {
    margin: 0 auto 0 0;
  }
  textarea
  {
    width: 100%;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.82rem;
    margin: 8px 0;
    background: #fafbfc;
  }
  .grade
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px 20px;
    margin: 12px 0;
  }
  fieldset
  {
    border: 1px solid var(--borda);
    border-radius: 10px;
    margin: 12px 0;
    padding: 4px 14px 8px;
  }
  legend
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    padding: 0 6px;
  }
  .secundario
  {
    background: #faf9f7;
  }
  .grade label
  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  summary
  {
    cursor: var(--cursor-clique);
    color: var(--marca);
    font-weight: 600;
    margin: 8px 0;
  }
  .curto
  {
    width: 90px;
  }
  .link
  {
    border: none;
    background: none;
    padding: 0;
    margin-left: 8px;
    text-decoration: underline;
    font-size: 0.82rem;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .aviso
  {
    margin-top: 12px;
  }
  .principal
  {
    margin-top: 16px;
  }
</style>
