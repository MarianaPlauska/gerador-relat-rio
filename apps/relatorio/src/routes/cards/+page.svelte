<script lang="ts">
  import { agoraLocal, aplicarControle, type CardSnapshot, type ControleCard, type OrigemLeitura, type Ritmo } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';

  let dados = $state<Dados>(carregar());
  let dataFoto = $state(dados.fotos.at(-1)?.data ?? '');
  let pessoa = $state('');
  let origem = $state<'' | OrigemLeitura>('em_execucao');
  let ritmosVisiveis = $state<Ritmo[]>(['atrasado', 'em_risco', 'no_ritmo']);

  const hoje = agoraLocal().slice(0, 10);
  const nomesRitmo: Record<Ritmo, string> = { atrasado: 'atrasado', em_risco: 'em risco', no_ritmo: 'no ritmo' };
  const nomesStatus: Record<NonNullable<CardSnapshot['etapaAtualStatus']>, string> = {
    rodando: 'rodando',
    aguardando_start: 'aguardando start',
    parada_na_fila: 'parada na fila',
  };

  const foto = $derived(dados.fotos.find((f) => f.data === dataFoto));
  const linhas = $derived(
    (foto?.cards ?? [])
      .filter((c) => !origem || c.origens.includes(origem))
      .map((painel) => ({ painel, card: aplicarControle(painel, dataFoto, dados.controle[painel.codigo]) }))
      .filter(({ card }) => !pessoa || card.responsavelEtapaAtual === pessoa || card.responsaveis.includes(pessoa))
      .sort((a, b) => (a.card.previsao ?? '9999').localeCompare(b.card.previsao ?? '9999')),
  );
  const visiveis = $derived(linhas.filter(({ card }) => !card.ritmoPainel || ritmosVisiveis.includes(card.ritmoPainel)));
  const contagem = (r: Ritmo) => linhas.filter(({ card }) => card.ritmoPainel === r).length;
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '-';
  const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '-');

  // o controle antigo (de antes desta foto) não vale mais, começa do zero
  function marcar(codigo: string, campos: Omit<ControleCard, 'atualizadoEm'>)
  {
    const atual = dados.controle[codigo];
    const base = atual && atual.atualizadoEm >= dataFoto ? atual : {};
    dados.controle[codigo] = { ...base, ...campos, atualizadoEm: hoje < dataFoto ? dataFoto : hoje };
    salvar($state.snapshot(dados));
  }

  function desfazer(codigo: string)
  {
    delete dados.controle[codigo];
    salvar($state.snapshot(dados));
  }

  function avancar(card: CardSnapshot, passo: number)
  {
    const novo = Math.max(0, Math.min(card.etapasTotal ?? Infinity, (card.etapasConcluidas ?? 0) + passo));
    marcar(card.codigo, { etapasConcluidas: novo });
  }

  function alternarRitmo(r: Ritmo)
  {
    ritmosVisiveis = ritmosVisiveis.includes(r) ? ritmosVisiveis.filter((x) => x !== r) : [...ritmosVisiveis, r];
  }
</script>

<main>
  <span class="prompt">&gt; cards</span>
  <header>
    <h1>Quem está cuidando de quê<span class="cursor">_</span></h1>
    <label>Foto de
      <select bind:value={dataFoto}>
        {#each dados.fotos as f (f.data)}<option value={f.data}>{dataCurta(f.data)}</option>{/each}
      </select>
    </label>
    <label>Responsável
      <select bind:value={pessoa}>
        <option value="">Todos</option>
        {#each dados.pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
      </select>
    </label>
    <label>Trecho
      <select bind:value={origem}>
        <option value="em_execucao">Em execução</option>
        <option value="fila">Fila</option>
        <option value="cronograma">Cronograma</option>
        <option value="">Todos</option>
      </select>
    </label>
  </header>

  {#if !foto}
    <p class="dica">Nenhuma foto salva ainda. Cole o painel na tela de entrada.</p>
  {:else}
    <div class="chips">
      {#each Object.entries(nomesRitmo) as [r, nome] (r)}
        <button class="chip {r}" class:desligado={!ritmosVisiveis.includes(r as Ritmo)} onclick={() => alternarRitmo(r as Ritmo)}>
          {nome} <b>{contagem(r as Ritmo)}</b>
        </button>
      {/each}
      <span class="dica">{visiveis.length} cards · ordenado pela previsão</span>
    </div>

    <div class="rolagem">
      <table>
        <thead>
          <tr>
            <th>Card</th><th>Demanda</th><th class="num">Nível</th><th>Etapa atual · quem</th>
            <th class="num">Etapas</th><th>Previsão</th><th>Ritmo</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each visiveis as { painel, card } (card.codigo)}
            {@const mexido = dados.controle[card.codigo] && card !== painel}
            <tr class:mexido>
              <td><span class="codigo">{card.codigo}</span></td>
              <td class="demanda">
                <b>{card.sistema ?? ''}</b>
                <small>{card.titulo ?? ''}</small>
              </td>
              <td class="num">{card.criticidade ?? '-'}</td>
              <td class="etapa">
                <input value={card.etapaAtual ?? ''} onchange={(e) => marcar(card.codigo, { etapaAtual: e.currentTarget.value })} />
                <div class="quem">
                  <select value={card.responsavelEtapaAtual ?? ''} onchange={(e) => marcar(card.codigo, { responsavelEtapaAtual: e.currentTarget.value || undefined })}>
                    <option value="">-</option>
                    {#each dados.pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
                  </select>
                  ·
                  <select value={card.etapaAtualStatus ?? ''} onchange={(e) => marcar(card.codigo, { etapaAtualStatus: (e.currentTarget.value || undefined) as CardSnapshot['etapaAtualStatus'] })}>
                    <option value="">-</option>
                    {#each Object.entries(nomesStatus) as [s, nome] (s)}<option value={s}>{nome}</option>{/each}
                  </select>
                  {#if card.etapaAtualStatus === 'rodando' && card.etapaAtualRodandoHaDias !== undefined && !mexido}
                    há {String(card.etapaAtualRodandoHaDias).replace('.', ',')} d
                  {/if}
                </div>
                {#if mexido && (painel.etapaAtual !== card.etapaAtual || painel.responsavelEtapaAtual !== card.responsavelEtapaAtual)}
                  <small class="painel">painel: {painel.etapaAtual ?? '-'} · {nomePessoa(painel.responsavelEtapaAtual)}</small>
                {/if}
              </td>
              <td class="num etapas">
                <button onclick={() => avancar(card, -1)} title="Voltar uma etapa">−</button>
                <span>{card.etapasConcluidas ?? '?'}/{card.etapasTotal ?? '?'}</span>
                <button onclick={() => avancar(card, 1)} title="Concluir a etapa atual">+</button>
                {#if mexido && painel.etapasConcluidas !== card.etapasConcluidas}
                  <small class="painel">painel: {painel.etapasConcluidas ?? '?'}/{painel.etapasTotal ?? '?'}</small>
                {/if}
              </td>
              <td>{dataCurta(card.previsao)}</td>
              <td>
                {#if card.ritmoPainel}<span class="pilula {card.ritmoPainel}">{nomesRitmo[card.ritmoPainel]}</span>{/if}
              </td>
              <td>
                {#if mexido}<button class="link" onclick={() => desfazer(card.codigo)} title="Voltar ao que está no painel">desfazer</button>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="dica">
      O que você muda aqui fica marcado em amarelo e vale até você salvar uma foto mais nova do painel.
      O ritmo é sempre o do painel do gestor.
    </p>
  {/if}
</main>

<style>
  main
  {
    max-width: 1300px;
    margin: 0 auto;
    padding: 16px;
  }
  header
  {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  h1
  {
    margin-right: auto;
    font-size: 1.4rem;
  }
  .chips
  {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 12px 0;
  }
  .chip
  {
    border-radius: 999px;
    border: 1px solid var(--borda-forte);
    background: var(--superficie);
    padding: 4px 12px;
    cursor: var(--cursor-clique);
  }
  .chip.desligado
  {
    opacity: 0.4;
    text-decoration: line-through;
  }
  .rolagem
  {
    overflow-x: auto;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: 8px;
  }
  table
  {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }
  th
  {
    text-transform: uppercase;
    font-size: 0.72rem;
    letter-spacing: 0.05em;
    color: var(--suave);
    text-align: left;
  }
  th, td
  {
    border-bottom: 1px solid var(--superficie-2);
    padding: 10px 8px;
    vertical-align: top;
  }
  .num
  {
    text-align: right;
  }
  .codigo
  {
    display: inline-block;
    border: 1px solid var(--borda-forte);
    border-radius: 6px;
    padding: 4px 8px;
    font-weight: 600;
    white-space: nowrap;
  }
  .demanda
  {
    max-width: 380px;
  }
  .demanda small, .painel
  {
    display: block;
    color: var(--suave);
  }
  .etapa input
  {
    font-weight: 600;
    border: 1px solid transparent;
    background: transparent;
    padding: 2px;
    width: 100%;
  }
  .etapa input:hover, .etapa input:focus
  {
    border-color: var(--borda-forte);
    background: var(--superficie);
  }
  .quem
  {
    color: var(--suave);
    white-space: nowrap;
  }
  .quem select
  {
    border: none;
    background: transparent;
    color: inherit;
  }
  .etapas
  {
    white-space: nowrap;
  }
  .etapas span
  {
    display: inline-block;
    min-width: 44px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .etapas button
  {
    width: 24px;
  }
  .pilula
  {
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .no_ritmo
  {
    background: var(--verde-fundo);
    color: var(--verde);
    border-color: var(--verde);
  }
  .em_risco
  {
    background: var(--amarelo-fundo);
    color: var(--amarelo);
    border-color: var(--amarelo);
  }
  .atrasado
  {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
    border-color: var(--vermelho);
  }
  .mexido
  {
    background: var(--amarelo-fundo);
  }
  .painel
  {
    font-size: 0.75rem;
    font-style: italic;
  }
  .link
  {
    border: none;
    background: none;
    color: var(--azul);
    text-decoration: underline;
    cursor: var(--cursor-clique);
  }
  .dica
  {
    color: var(--suave);
    font-size: 0.9rem;
  }
</style>
