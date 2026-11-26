<script lang="ts">
  import { ehCsvDeDemandas, type CapturaLida, type CardSnapshot } from '@supervisao/core';
  import type { AcoesCards, AnexosCard } from './acoes';
  import TabelaCsv from './TabelaCsv.svelte';

  // um print enviado: miniatura, "Entendi como", card ao qual pertence, resumo do que foi lido, comentÃ¡rio e texto lido
  let { cap, indice, cardsLidos, nomesOrigemPadrao, origensPersonalizadas, obterNomeOrigem, aoAmpliar, aoRecalcular, aoRemover, aoCriarOpcao, aoDescartarTexto, pessoas = [], aoRelerImagem, abertaInicialmente = true, acoes, anexos, aoAbrirCard }: {
    acoes?: AcoesCards | undefined;
    anexos?: AnexosCard | undefined;
    aoAbrirCard?: ((codigo: string) => void) | undefined;
    cap: CapturaLida;
    indice: number;
    cardsLidos: CardSnapshot[];
    nomesOrigemPadrao: Record<string, string>;
    origensPersonalizadas?: string[] | undefined;
    obterNomeOrigem: (origem: string) => string;
    aoAmpliar: () => void;
    aoRecalcular: () => void;
    aoRemover: () => void;
    aoCriarOpcao: (nome: string) => void;
    aoDescartarTexto?: (texto: string) => void;
    pessoas?: { id: string; nome: string }[];
    aoRelerImagem?: () => void;
    abertaInicialmente?: boolean;
  } = $props();

  let criando = $state(false);
  let textoNovaOpcao = $state('');
  // com muitos prints, só o mais recente vem aberto: os outros ficam resumidos numa linha até clicar.
  // undefined = segue o padrão (abertaInicialmente, que muda sozinho quando chega um print novo); depois do primeiro clique, a escolha da pessoa manda
  let manual = $state<boolean | undefined>(undefined);
  const aberta = $derived(manual ?? abertaInicialmente);

  function salvarOpcao()
  {
    const nome = textoNovaOpcao.trim();
    if (nome) aoCriarOpcao(nome);
    criando = false;
    textoNovaOpcao = '';
  }

  const nomeDaPessoa = $derived(pessoas.find((p) => p.id === cap.pessoaId)?.nome);
  const ehCsv = $derived(!!cap.arquivoCsv || ehCsvDeDemandas(cap.texto));
  const coisa = $derived(ehCsv ? 'arquivo' : 'print');
  const linhasCsv = $derived(ehCsv ? Math.max(0, cap.texto.split(/\r?\n(?=[A-Za-z][A-Za-z0-9]*-\d+[,;])/).length - 1) : 0);
</script>
  <article class="captura" class:colapsada={!aberta || ehCsv}>
    {#if aberta && !ehCsv}
      <button
        type="button"
        class="img btn-img-modal"
        onclick={aoAmpliar}
        title="Clique para ampliar a imagem e ver todas as informações em modal"
      >
        {#if cap.imagemDataUrl}
          <img src={cap.imagemDataUrl} alt={cap.nome} />
          <span class="selo-ampliar-img">Clique para ampliar em modal</span>
        {:else}
          <div class="sem-img">texto colado (clique para abrir em modal)</div>
        {/if}
      </button>
    {/if}
    <div class="conteudo">
      <div class="linha-entre">
        <button type="button" class="alternar-captura" onclick={() => (manual = !aberta)} aria-expanded={aberta}>
          <span class="seta-captura">{aberta ? '▾' : '▸'}</span>
          <b>#{indice + 1} {cap.nome.split(' · ')[0]}</b>
        </button>
        {#if !aberta}
          <span class="linha linha-acoes-captura">
            <span class="resumo-colapsada">
              {cap.cards.length} {cap.cards.length === 1 ? 'demanda' : 'demandas'}{nomeDaPessoa ? ` · ${nomeDaPessoa}` : ''}{cap.comentario ? ' · comentado' : ''}
            </span>
            <button class="link perigo" onclick={() => aoRemover()}>remover</button>
          </span>
        {/if}
        {#if aberta}
        <span class="linha linha-acoes-captura">
          <button
            type="button"
            class="btn-ampliar-captura"
            onclick={aoAmpliar}
          >
            Ver em modal
          </button>
          {#if criando}
            <div class="linha-nova-opcao">
              <input
                class="input-nova-opcao"
                bind:value={textoNovaOpcao}
                placeholder="Nome da opção (ex.: Homologação...)"
                onkeydown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); salvarOpcao(); }
                  else if (e.key === 'Escape') { criando = false; }
                }}
              />
              <button class="btn-salvar-opcao" onclick={() => salvarOpcao()}>Salvar</button>
              <button class="link" onclick={() => { criando = false; textoNovaOpcao = ''; }}>cancelar</button>
            </div>
          {:else}
            <label class="mini">Entendi como
              <select
                value={cap.origem}
                onchange={(e) => {
                  const val = e.currentTarget.value;
                  if (val === '__nova__') {
                    criando = true;
                    textoNovaOpcao = '';
                  } else {
                    cap.origem = val;
                    cap.nome = `${cap.nome.split(' · ')[0]} · ${obterNomeOrigem(val)}`;
                    aoRecalcular();
                  }
                }}
              >
                <optgroup label="Padrões">
                  {#each Object.entries(nomesOrigemPadrao) as [v, n] (v)}
                    <option value={v}>{n}</option>
                  {/each}
                </optgroup>
                {#if origensPersonalizadas && origensPersonalizadas.length > 0}
                  <optgroup label="Personalizados">
                    {#each origensPersonalizadas as custom (custom)}
                      <option value={custom}>{custom}</option>
                    {/each}
                  </optgroup>
                {/if}
                <option value="__nova__">+ Criar nova opção...</option>
              </select>
            </label>
            <button
              class="btn-adicionar-opcao"
              onclick={() => { criando = true; textoNovaOpcao = ''; }}
              title="Criar nova opção personalizada de classificação"
            >
              +
            </button>
          {/if}
          <button class="link perigo" onclick={() => aoRemover()}>remover</button>
        </span>
        {/if}
      </div>
      {#if aberta}
      {#if ehCsv}
        <p class="faixa-csv"><b>CSV</b> planilha exportada do painel · {linhasCsv} {linhasCsv === 1 ? 'linha' : 'linhas'} no arquivo · {cap.cards.length} lidas</p>
      {/if}
      <h4 class="rotulo-bloco">O que o {coisa} mostra</h4>
      {#if ehCsv}
        <p class="dica">Cada linha da planilha virou uma demanda. Confira abaixo se ID, status, prioridade e responsável caíram nas colunas certas.</p>
      {:else if cap.trouxe}
        <p class="dica">Preencheu: {cap.trouxe}.</p>
      {/if}
      <div class="chips">
        <span class="pilula">{cap.cards.length} {cap.cards.length === 1 ? 'demanda' : 'demandas'}</span>
        {#if !ehCsv}<span class="pilula" title="Números calculados a partir de todas as demandas lidas até agora">{cap.totais.length} indicadores calculados</span>{/if}
        {#if cap.ondas}<span class="pilula">{cap.ondas} ondas</span>{/if}
        {#if cap.novos?.length}<span class="pilula novo">{cap.novos.length} novos</span>{/if}
        {#if cap.repetidos?.length}<span class="pilula repetido">{cap.repetidos.length} já vistos</span>{/if}
      </div>
      {#if ehCsv}
        <!-- colar um print numa linha cria um print novo no fim da lista; a planilha fica aberta mesmo assim -->
        <TabelaCsv codigos={cap.cards} {cardsLidos} {pessoas} {acoes} {anexos} {aoAbrirCard} aoAbrirLinha={() => (manual = true)} />
      {:else if cap.porPessoa?.length}
        <ul class="por-pessoa-print">
          {#each cap.porPessoa as gp (gp.pessoa)}
            <li class="item-pessoa-print"><b>{gp.pessoa}</b><span class="codigos">{#each gp.tarefas as t, i (i)}<span class="codigo" title={t}>{t.split(' ')[0]}</span>{/each}</span></li>
          {/each}
        </ul>
      {/if}
      {#if cap.avisos.length}<p class="alerta">{cap.avisos.join(' ')}</p>{/if}
      {#if cap.repetidos?.some((r) => r.mudou.length)}
        <p class="mudou"><b>Mudou desde antes:</b> {cap.repetidos.filter((r) => r.mudou.length).slice(0, 5).map((r) => `${r.codigo} (${r.mudou.join('; ')})`).join(' | ')}</p>
      {/if}
      <h4 class="rotulo-bloco">De quem é e por quê</h4>
      <div class="linha-pessoa">
        <label class="mini">Este {coisa} é de
          <select value={cap.pessoaId ?? ''} onchange={(e) => { cap.pessoaId = e.currentTarget.value || undefined; aoRecalcular(); }}>
            <option value="">várias pessoas (ler do {coisa})</option>
            {#each pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
          </select>
        </label>
        {#if aoRelerImagem && cap.imagemDataUrl}
          <button type="button" class="link" onclick={aoRelerImagem} title="Roda o OCR outra vez sobre esta imagem">ler a imagem de novo</button>
        {/if}
      </div>
      {#if cap.pessoaId}
        <div class="plano-pessoa">
          <label>O que vai fazer na semana
            <textarea rows="2" value={cap.oQueVaiFazer ?? ''} oninput={(e) => { cap.oQueVaiFazer = e.currentTarget.value || undefined; }} placeholder="As entregas e etapas desta pessoa na semana"></textarea>
          </label>
          <label>Por quê
            <textarea rows="2" value={cap.porque ?? ''} oninput={(e) => { cap.porque = e.currentTarget.value || undefined; }} placeholder="O motivo: prioridade, prazo, pedido do cliente, risco..."></textarea>
          </label>
        </div>
      {/if}
      {#if cap.cardPaiVinculado || cap.origem === 'card'}
        <div class="vinculo-arvore-barra">
          <span class="etiqueta">Pertence ao card:</span>
          <select
            value={cap.cardPaiManual ?? ''}
            onchange={(e) => { cap.cardPaiManual = e.currentTarget.value || undefined; aoRecalcular(); }}
          >
            <option value="">Descobrir sozinho{cap.cardPaiVinculado ? ` (${cap.cardPaiVinculado})` : ''}</option>
            {#each cardsLidos as c (c.codigo)}
              <option value={c.codigo}>{c.codigo} ({c.assunto || c.titulo || 'Demanda'})</option>
            {/each}
          </select>
          {#if cap.confiancaVinculoPct !== undefined}
            <span class="pilula novo">{cap.confiancaVinculoPct}% confiança</span>
          {/if}
          {#if cap.motivoVinculo}
            <small class="dica">{cap.motivoVinculo}</small>
          {/if}
        </div>
      {/if}
      <h4 class="rotulo-bloco">Seu comentário</h4>
      <textarea rows="2" value={cap.comentario} oninput={(e) => { cap.comentario = e.currentTarget.value; }} placeholder={`Algo a mais sobre este ${coisa}: dependências, riscos, uso do tempo livre...`} aria-label={`Seu comentário sobre este ${coisa}`}></textarea>
      {#if cap.sugestoes.length}
        <p class="dica"><b>Sugestões:</b> {cap.sugestoes.join(' ')}
          <button class="link" onclick={() => (cap.comentario = [cap.comentario, ...cap.sugestoes].filter(Boolean).join(' '))}>usar no comentário</button></p>
      {/if}
      {#if cap.coberturaPct !== undefined && cap.coberturaPct < 70}
        <p class="aviso">O leitor entendeu só {cap.coberturaPct}% das linhas deste texto. Confira as linhas sem card abaixo: o formato do painel pode ter mudado.</p>
      {/if}
      <details>
        <summary>{ehCsv ? 'Conteúdo do arquivo' : 'Texto lido e complemento'} {cap.coberturaPct !== undefined ? `· leitura ${cap.coberturaPct}%` : ''} {cap.naoReconhecido?.length ? `(${cap.naoReconhecido.length} linhas sem card)` : ''}</summary>
        {#if cap.naoReconhecido?.length}
          <p class="dica">Trechos do print que não viraram card nem número. Podem ser o complemento de algo já visto:</p>
          <ul class="complemento">
            {#each cap.naoReconhecido as l, i (i)}
              <li>
                <span>{l}</span>
                {#if aoDescartarTexto}
                  <button type="button" class="link" onclick={() => aoDescartarTexto(l)}>+ virar regra de descarte</button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        <textarea rows="5" value={cap.texto} oninput={(e) => { cap.texto = e.currentTarget.value; }}></textarea>
        <button onclick={aoRecalcular}>Reprocessar com o texto corrigido</button>
      </details>
      {/if}
    </div>
  </article>
<style>
  .linha, .chips { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  textarea { width: 100%; background: var(--superficie-2); font-size: 0.9rem; margin: 6px 0; }
  summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; margin: 6px 0; }
  .link { border: none; background: none; padding: 0; margin-left: 6px; text-decoration: underline; font-size: 0.84rem; }
  .perigo { color: var(--vermelho); }
  .linha-acoes-captura { display: flex; align-items: center; gap: 6px; }
  .btn-adicionar-opcao { padding: 1px 7px; font-size: 0.85rem; font-weight: 700; background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: 4px; color: var(--marca); cursor: var(--cursor-clique); line-height: 1.3; }
  .btn-adicionar-opcao:hover { border-color: var(--marca); background: var(--marca-clara); }
  .linha-nova-opcao { display: flex; align-items: center; gap: 6px; background: var(--superficie); padding: 3px 6px; border: 1px solid var(--marca); border-radius: 4px; }
  .input-nova-opcao { font-size: 0.78rem; padding: 3px 6px; border: 1px solid var(--borda); border-radius: 3px; min-width: 150px; background: var(--fundo); color: var(--texto); }
  .btn-salvar-opcao { font-size: 0.74rem; padding: 3px 8px; background: var(--marca); color: var(--sobre-marca); border: none; border-radius: 3px; cursor: var(--cursor-clique); font-weight: 600; }
  .btn-img-modal { position: relative; border: none; background: none; padding: 0; cursor: var(--cursor-clique); display: block; text-align: left; }
  .selo-ampliar-img { display: block; margin-top: 4px; font-size: 0.74rem; color: var(--marca); text-align: center; font-weight: 600; }
  .btn-ampliar-captura { font-size: 0.76rem; padding: 3px 8px; background: var(--superficie); border: 1px solid var(--marca); color: var(--marca); border-radius: 4px; cursor: var(--cursor-clique); }
  .vinculo-arvore-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; padding: 6px 10px; background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--marca); border-radius: 4px; }
  .vinculo-arvore-barra select { font-size: 0.78rem; padding: 2px 6px; max-width: 280px; }
  .por-pessoa-print { list-style: none; display: grid; gap: 6px; margin: 8px 0; padding: 0; font-size: 0.85rem; }
  .item-pessoa-print { display: grid; grid-template-columns: minmax(140px, 200px) 1fr; gap: 10px; align-items: start; padding: 6px 10px; background: var(--superficie); border: 1px solid var(--borda); border-radius: 4px; color: var(--texto); }
  .codigos { display: flex; flex-wrap: wrap; gap: 4px; }
  .codigo { font-family: var(--fonte-maquina); font-size: 0.78rem; padding: 1px 6px; border: 1px solid var(--borda-forte); border-radius: 3px; }
  .rotulo-bloco { margin: 14px 0 4px; padding-top: 10px; border-top: 1px dashed var(--borda); font-family: var(--fonte-maquina); font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--suave); }
  .captura { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; gap: 14px; padding: 12px; margin: 10px 0; border: 1px solid var(--borda); border-radius: var(--raio); background: var(--superficie-2); }
  .captura.colapsada { grid-template-columns: 1fr; padding: 8px 12px; }
  .conteudo { min-width: 0; }
  .alternar-captura { display: flex; align-items: center; gap: 6px; border: none; background: none; padding: 0; color: var(--texto); font-size: 1rem; cursor: var(--cursor-clique); }
  .seta-captura { color: var(--marca); font-size: 0.8rem; }
  .resumo-colapsada { color: var(--suave); font-size: 0.84rem; }
  .img img { width: 100%; max-height: 240px; object-fit: contain; border-radius: 6px; border: 1px solid var(--borda); background: var(--fundo); }
  .sem-img { height: 100px; display: grid; place-items: center; border: 1px dashed var(--borda); border-radius: 6px; color: var(--suave); }
  .faixa-csv { margin: 8px 0 0; padding: 6px 10px; border-left: 3px solid var(--marca); background: var(--superficie); font-family: var(--fonte-maquina); font-size: 0.78rem; color: var(--suave); }
  .faixa-csv b { color: var(--marca); margin-right: 6px; }
  .mini { font-size: 0.78rem; display: flex; gap: 6px; align-items: center; }
  .chips { margin: 8px 0; }
  .pilula.novo { background: var(--verde-fundo); color: var(--verde); }
  .pilula.repetido { background: var(--amarelo-fundo); color: var(--amarelo); }
  .alerta { color: var(--vermelho); font-size: 0.84rem; margin: 6px 0; padding: 6px 10px; border-left: 3px solid var(--vermelho); background: var(--superficie); }
  .mudou { font-size: 0.84rem; margin: 4px 0; }
  .complemento { margin: 4px 0 8px 18px; padding: 0; font-size: 0.82rem; color: var(--suave); }
  .complemento li { overflow-wrap: anywhere; }
  @media (max-width: 800px) { .captura { grid-template-columns: 1fr; } }
  .linha-pessoa
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-3);
    margin: var(--size-2) 0;
  }
  .plano-pessoa
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--size-2);
    margin-bottom: var(--size-2);
  }
  .plano-pessoa label
  {
    display: grid;
    gap: 4px;
  }
  .plano-pessoa textarea
  {
    width: 100%;
    resize: vertical;
  }
</style>