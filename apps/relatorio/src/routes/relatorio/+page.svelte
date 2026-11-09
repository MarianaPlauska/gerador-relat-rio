<script lang="ts">
  import
  {
    alertasDoPlano, aplicarControle, compararTotais, datasAlteradasNoPainel, definicoesPadrao, kpisDosItens, mapaDeDores, mapaDeFrentes,
    nomesTotais, ritmoPorPessoa, segundaDaSemana, semaforoPrazo, somarDias,
    type CardSnapshot, type CorSemaforo, type ItemPlano, type Ritmo, type TotaisPainel,
  } from '@supervisao/core';
  import { carregar, salvar, type Dados, type NotasRelatorio } from '#lib/armazenamento.ts';

  let dados = $state<Dados>(carregar());
  let dataFoto = $state(dados.fotos.at(-1)?.data ?? '');
  let dataAnterior = $state(dados.fotos.at(-2)?.data ?? '');

  const nomesRitmo: Record<Ritmo, string> = { no_ritmo: 'No ritmo', em_risco: 'Em risco', atrasado: 'Atrasado' };
  const nomesSemaforo: Record<CorSemaforo, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };
  const pesoRitmo: Record<Ritmo, number> = { atrasado: 0, em_risco: 1, no_ritmo: 2 };

  const foto = $derived(dados.fotos.find((f) => f.data === dataFoto));
  const anterior = $derived(dados.fotos.find((f) => f.data === dataAnterior && f.data !== dataFoto));
  const totais = $derived<TotaisPainel>(foto?.totais ?? {});
  const notas = $derived<NotasRelatorio>(dados.relatorios[dataFoto] ?? {});

  const comparativo = $derived(
    Object.fromEntries(compararTotais(totais, anterior?.totais).map((l) => [l.chave, l])),
  );
  const linhasComparativo = $derived(
    (Object.keys(nomesTotais) as (keyof TotaisPainel)[]).map((c) => comparativo[c]).filter((l) => l !== undefined),
  );

  const emExecucao = $derived(
    (foto?.cards ?? [])
      .filter((c) => c.origens.includes('em_execucao'))
      .map((painel) => ({ painel, card: aplicarControle(painel, dataFoto, dados.controle[painel.codigo]) }))
      .sort((a, b) => (a.card.previsao ?? '9999').localeCompare(b.card.previsao ?? '9999')),
  );
  const atencao = $derived(
    emExecucao
      .filter(({ card }) => card.ritmoPainel === 'atrasado' || card.ritmoPainel === 'em_risco' || (card.previsao ?? '9999') < dataFoto)
      .sort((a, b) => pesoRitmo[a.card.ritmoPainel ?? 'no_ritmo'] - pesoRitmo[b.card.ritmoPainel ?? 'no_ritmo']),
  );
  const porPessoa = $derived(ritmoPorPessoa(emExecucao.map((l) => l.card), dados.pessoas).filter((p) => p.contagem.total > 0));
  const maiorCarga = $derived(Math.max(1, ...porPessoa.map((p) => p.contagem.total)));

  // prefere os números do painel; sem eles, conta nos cards lidos
  const ritmoGeral = $derived<Record<Ritmo, number>>({
    no_ritmo: totais.ritmoNoRitmo ?? emExecucao.filter((l) => l.card.ritmoPainel === 'no_ritmo').length,
    em_risco: totais.ritmoEmRisco ?? emExecucao.filter((l) => l.card.ritmoPainel === 'em_risco').length,
    atrasado: totais.ritmoAtrasadas ?? emExecucao.filter((l) => l.card.ritmoPainel === 'atrasado').length,
  });
  const ritmoDoPainel = $derived(totais.ritmoNoRitmo !== undefined);
  const totalRitmo = $derived(Math.max(1, ritmoGeral.no_ritmo + ritmoGeral.em_risco + ritmoGeral.atrasado));

  const meta = $derived(totais.metaPct ?? definicoesPadrao.metas.dentroDoPrazoPorMes[dataFoto.slice(0, 7)]);
  const semaforoAuto = $derived(semaforoPrazo(totais.dentroDoPrazoPct, meta, definicoesPadrao.semaforo.amareloAte));
  const semaforo = $derived(notas.semaforo ?? semaforoAuto);

  const segunda = $derived(dataFoto ? segundaDaSemana(dataFoto) : '');
  const sexta = $derived(segunda ? somarDias(segunda, 4) : '');

  const plano = $derived(dados.planos.find((p) => p.inicio === segunda));
  const cardsFoto = $derived(foto?.cards ?? []);
  const porCodigo = $derived(new Map(cardsFoto.map((c) => [c.codigo, c])));
  const kpisPlano = $derived(plano ? kpisDosItens(plano.pessoas.flatMap((pp) => pp.itens), cardsFoto) : undefined);
  const alertasPlano = $derived(plano ? alertasDoPlano(plano, cardsFoto, dados.pessoas) : []);
  const datasMudadas = $derived(foto && anterior ? datasAlteradasNoPainel(foto.cards, anterior.cards) : []);
  const frentes = $derived(plano ? mapaDeFrentes(plano) : []);
  const doresPlano = $derived(plano ? mapaDeDores(plano) : []);
  const pessoasNoPlano = $derived(
    dados.pessoas
      .map((pessoa) => ({ pessoa, pp: plano?.pessoas.find((x) => x.pessoaId === pessoa.id) }))
      .filter(({ pp }) => pp && (pp.itens.length || pp.dificuldade))
      .map(({ pessoa, pp }) => ({ pessoa, pp: pp!, kpis: kpisDosItens(pp!.itens, cardsFoto) })),
  );
  const pessoasComFrente = $derived(dados.pessoas.filter((p) => frentes.some((f) => f.porPessoa[p.id])));
  const naoSaiu = $derived(
    plano?.pessoas.flatMap((pp) => pp.itens.filter((i) => i.status !== 'feito' && (plano.fechadoEm || i.motivoNaoFeito)).map((item) => ({ pessoaId: pp.pessoaId, item }))) ?? [],
  );
  const riscos = $derived(dados.riscos.filter((r) => r.status === 'aberto' || (r.sinalizadoEm >= segunda && r.sinalizadoEm <= sexta)));
  const promessas = $derived(dados.promessas.filter((p) => p.semana === segunda));
  const promessasAnteriores = $derived(dados.promessas.filter((p) => p.semana === somarDias(segunda, -7)));

  const nomesStatus: Record<ItemPlano['status'], string> = { a_fazer: 'A fazer', fazendo: 'Fazendo', feito: 'Feito', bloqueado: 'Bloqueado', adiado: 'Adiado' };
  const nomesCausa: Record<NonNullable<ItemPlano['causa']>, string> = {
    requisito_mudou: 'requisito mudou', dependencia_externa: 'dependência externa', estimativa_errada: 'estimativa errada',
    bloqueio: 'bloqueio', urgencia: 'entrou urgência', outro: 'outro',
  };
  const corStatus = (s: ItemPlano['status']) => (s === 'feito' ? 'verde' : s === 'bloqueado' || s === 'adiado' ? 'vermelho' : '');
  const rotuloItem = (item: ItemPlano) => item.cardCodigo ?? 'Sem card';

  const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '-');
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '-';
  const valor = (n?: number) => (n === undefined ? '-' : n.toLocaleString('pt-BR'));
  const ehPct = (chave: string) => chave.endsWith('Pct');

  function variacao(chave: keyof TotaisPainel): string
  {
    const d = comparativo[chave]?.diferenca;
    if (d === undefined) return '';
    const sinal = d > 0 ? '+' : '';
    return `${sinal}${d.toLocaleString('pt-BR')}${ehPct(chave) ? ' pp' : ''}`;
  }

  function anotar(campo: keyof NotasRelatorio, texto: string)
  {
    const novo = { ...notas, [campo]: texto || undefined };
    dados.relatorios[dataFoto] = novo;
    salvar($state.snapshot(dados));
  }

  const diferenteDoPainel = (painel: CardSnapshot, card: CardSnapshot) => painel !== card;
</script>

<svelte:head>
  <title>Relatório de acompanhamento DEV {dataFoto}</title>
</svelte:head>

{#snippet kpi(rotulo: string, chave: keyof TotaisPainel, sufixo: string, detalhe: string)}
  <div class="kpi">
    <span class="rotulo">{rotulo}</span>
    <span class="valor">{valor(totais[chave])}{totais[chave] !== undefined ? sufixo : ''}</span>
    <span class="detalhe">{detalhe}</span>
    {#if comparativo[chave]?.diferenca !== undefined}
      <span class="variacao {comparativo[chave]?.tendencia}">{variacao(chave)} vs {dataCurta(anterior?.data)}</span>
    {/if}
  </div>
{/snippet}

{#snippet kpiLivre(rotulo: string, valorTexto: string, detalhe: string)}
  <div class="kpi plano-kpi">
    <span class="rotulo">{rotulo}</span>
    <span class="valor">{valorTexto}</span>
    <span class="detalhe">{detalhe}</span>
  </div>
{/snippet}

{#snippet nota(campo: keyof NotasRelatorio, titulo: string, dica: string)}
  <div class="nota" class:vazia={!notas[campo]}>
    <h3>{titulo}</h3>
    <textarea
      class="nao-imprimir"
      rows="3"
      placeholder={dica}
      value={notas[campo] ?? ''}
      onchange={(e) => anotar(campo, e.currentTarget.value)}
    ></textarea>
    <p class="so-imprimir">{notas[campo]}</p>
  </div>
{/snippet}

<div class="barra nao-imprimir">
  <label>Foto do painel
    <select bind:value={dataFoto}>
      {#each dados.fotos as f (f.data)}<option value={f.data}>{dataCurta(f.data)}</option>{/each}
    </select>
  </label>
  <label>Comparar com
    <select bind:value={dataAnterior}>
      <option value="">nenhuma</option>
      {#each dados.fotos.filter((f) => f.data < dataFoto) as f (f.data)}<option value={f.data}>{dataCurta(f.data)}</option>{/each}
    </select>
  </label>
  <label>Semáforo
    <select value={notas.semaforo ?? ''} onchange={(e) => anotar('semaforo', e.currentTarget.value)}>
      <option value="">Automático{semaforoAuto ? ` (${nomesSemaforo[semaforoAuto]})` : ''}</option>
      {#each Object.entries(nomesSemaforo) as [cor, nome] (cor)}<option value={cor}>{nome}</option>{/each}
    </select>
  </label>
  <span class="espaco"></span>
  <button class="principal" onclick={() => window.print()} disabled={!foto}>Gerar PDF</button>
</div>
<p class="dica centro nao-imprimir">Na janela de impressão, escolha "Salvar como PDF", papel A4 e marque "Gráficos de plano de fundo".</p>

{#if !foto}
  <p class="dica centro">Nenhuma foto salva ainda. Cole o painel na tela de entrada.</p>
{:else}
  <article class="folha">
    <header class="capa">
      <div>
        <p class="sobre">Relatório de acompanhamento semanal</p>
        <h1>Desenvolvimento ({dados.prefixo})</h1>
        <p>Semana de {dataCurta(segunda)} a {dataCurta(sexta)}</p>
      </div>
      <div class="meta-capa">
        <p>Foto do painel: <b>{dataCurta(dataFoto)}</b></p>
        {#if anterior}<p>Comparado com: <b>{dataCurta(anterior.data)}</b></p>{/if}
        <p>Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </header>

    <section>
      <div class="titulo-secao">
        <h2>1. Resumo executivo</h2>
        {#if semaforo}<span class="semaforo {semaforo}">{nomesSemaforo[semaforo]}</span>{/if}
      </div>
      <div class="kpis">
        {@render kpi('Dentro do prazo', 'dentroDoPrazoPct', '%', meta !== undefined ? `meta ${meta}%` : '')}
        {@render kpi('Concluídos', 'concluidos', '', totais.itensCronograma !== undefined ? `de ${totais.itensCronograma} itens${totais.concluidosPct !== undefined ? ` (${totais.concluidosPct}%)` : ''}` : '')}
        {@render kpi('Eficiência da área', 'eficiencia', '', totais.eficienciaPrazo !== undefined ? `prazo ${totais.eficienciaPrazo} · vazão ${totais.eficienciaVazao ?? '-'} · qualidade ${totais.eficienciaQualidade ?? '-'}` : '')}
        {@render kpi('Em andamento', 'demandasEmAndamento', '', totais.etapaRodando !== undefined ? `${totais.etapaRodando} com etapa rodando` : '')}
        {@render kpi('Atrasados', 'atrasadosVencimento', '', 'vencimento já passou')}
        {@render kpi('Vencem em até 15 dias', 'vencem15Dias', '', '')}
      </div>
      {#if kpisPlano}
        <h3>Execução do plano da semana</h3>
        <div class="kpis">
          {@render kpiLivre('Itens feitos', `${kpisPlano.feitos}/${kpisPlano.planejados}`,
            `${kpisPlano.pctFeitos !== undefined ? `${kpisPlano.pctFeitos}% do planejado` : 'nada planejado'}${kpisPlano.naoPlanejadosFeitos ? ` · +${kpisPlano.naoPlanejadosFeitos} não planejados` : ''}`)}
          {@render kpiLivre('Itens alterados', String(kpisPlano.alterados),
            `datas mudadas ou adiados no plano${anterior ? ` · ${datasMudadas.length} ${datasMudadas.length === 1 ? 'data mudada' : 'datas mudadas'} no painel` : ''}`)}
          {@render kpiLivre('Continuidade no cronograma', kpisPlano.pctDentroDoCronograma !== undefined ? `${kpisPlano.pctDentroDoCronograma}%` : '-',
            kpisPlano.feitosComLimite ? `${kpisPlano.dentroDoCronograma} de ${kpisPlano.feitosComLimite} entregas dentro da previsão do card` : 'sem entregas ainda')}
        </div>
      {/if}
      {@render nota('resumo', 'Leitura da semana', 'Em 2 ou 3 frases: como a semana está e o que muda para a gestão.')}
    </section>

    <section>
      <h2>2. Ritmo das demandas em execução</h2>
      <div class="barra-ritmo">
        {#each Object.entries(nomesRitmo) as [r, nome] (r)}
          {#if ritmoGeral[r as Ritmo]}
            <div class={r} style:width="{(ritmoGeral[r as Ritmo] / totalRitmo) * 100}%">{nome} {ritmoGeral[r as Ritmo]}</div>
          {/if}
        {/each}
      </div>
      <p class="fonte">{ritmoDoPainel ? 'Números do painel.' : 'Contado nos cards lidos do painel.'}</p>

      {#if porPessoa.length}
        <h3>Por pessoa (responsável pela etapa atual)</h3>
        <div class="pessoas">
          {#each porPessoa as { pessoa, contagem } (pessoa.id)}
            <span class="nome">{pessoa.nome}</span>
            <div class="trilho">
              <div class="pilha" style:width="{(contagem.total / maiorCarga) * 100}%">
                {#each Object.keys(nomesRitmo) as r (r)}
                  {#if contagem[r as Ritmo]}<div class={r} style:flex={contagem[r as Ritmo]}>{contagem[r as Ritmo]}</div>{/if}
                {/each}
                {#if contagem.semRitmo}<div class="sem" style:flex={contagem.semRitmo}>{contagem.semRitmo}</div>{/if}
              </div>
            </div>
            <span class="total">{contagem.total}</span>
          {/each}
        </div>
        <div class="legenda">
          {#each Object.entries(nomesRitmo) as [r, nome] (r)}<span><i class={r}></i>{nome}</span>{/each}
        </div>
      {/if}
    </section>

    {#if plano}
      <section>
        <h2>3. Frentes e responsáveis</h2>
        <table class="matriz">
          <thead>
            <tr><th>Frente</th>{#each pessoasComFrente as p (p.id)}<th>{p.nome}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each frentes as f (f.frente)}
              <tr>
                <td class="frente">{f.frente}</td>
                {#each pessoasComFrente as p (p.id)}
                  <td>
                    {#each f.porPessoa[p.id] ?? [] as item (item.id)}
                      <div class="celula {corStatus(item.status)}"><b>{rotuloItem(item)}</b> {item.descricao}</div>
                    {/each}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if doresPlano.length}
          <h3>Dores que estamos atacando</h3>
          <ul class="dores">
            {#each doresPlano as d (d.dor)}
              <li>
                <b>{d.dor}</b>
                <span>{d.itens.map(({ pessoaId, item }) => `${rotuloItem(item)} (${nomePessoa(pessoaId).split(' ')[0]})`).join(', ')}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="pode-quebrar">
        <h2>4. Plano por pessoa</h2>
        {#each pessoasNoPlano as { pessoa, pp, kpis } (pessoa.id)}
          <div class="bloco-pessoa">
            <div class="cabeca-pessoa">
              <b>{pessoa.nome}</b>
              <span class="trilho-plano"><span style:width="{kpis.pctFeitos ?? 0}%"></span></span>
              <span class="dica">{kpis.feitos} de {kpis.planejados} feitos{kpis.alterados ? ` · ${kpis.alterados} alterados` : ''}</span>
            </div>
            {#if pp.dificuldade}<p class="dificuldade"><b>Maior dificuldade:</b> {pp.dificuldade}</p>{/if}
            {#if pp.itens.length}
              <table>
                <thead><tr><th>Card</th><th>O que</th><th>Para quê</th><th>Frente</th><th>Até</th><th>Status</th></tr></thead>
                <tbody>
                  {#each pp.itens as item (item.id)}
                    {@const card = item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined}
                    <tr>
                      <td class="codigo">{rotuloItem(item)}{#if card?.titulo}<small>{card.titulo}</small>{/if}</td>
                      <td>{item.descricao}{#if item.tipo === 'nao_planejado'}<small>não planejado</small>{/if}</td>
                      <td>{item.objetivo ?? ''}</td>
                      <td>{item.frente ?? ''}</td>
                      <td>
                        {dataCurta(item.ate)}
                        {#if item.ateOriginal && item.ate !== item.ateOriginal}<small>era {dataCurta(item.ateOriginal)}</small>{/if}
                        {#if alertasPlano.some((a) => a.itemId === item.id)}<small class="vencida">passa do painel</small>{/if}
                      </td>
                      <td><span class="pilula {corStatus(item.status)}">{nomesStatus[item.status]}</span></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        {:else}
          <p class="dica">Plano da semana ainda vazio.</p>
        {/each}
      </section>

      {#if naoSaiu.length}
        <section>
          <h2>4.1 Fechamento: o que não saiu</h2>
          <table>
            <thead><tr><th>Quem</th><th>Item</th><th>Status</th><th>Causa</th><th>Motivo</th></tr></thead>
            <tbody>
              {#each naoSaiu as { pessoaId, item } (item.id)}
                <tr>
                  <td>{nomePessoa(pessoaId)}</td>
                  <td><b>{rotuloItem(item)}</b> {item.descricao}</td>
                  <td><span class="pilula {corStatus(item.status)}">{nomesStatus[item.status]}</span></td>
                  <td>{item.causa ? nomesCausa[item.causa] : '-'}</td>
                  <td>{item.motivoNaoFeito ?? '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      {/if}
    {/if}

    <section>
      <h2>5. Pontos de atenção</h2>
      {#if alertasPlano.length}
        <h3>O plano passa do que o painel espera</h3>
        <ul class="lista-alertas">
          {#each alertasPlano as a, i (i)}<li class={a.nivel === 'alto' ? 'vermelho' : 'amarelo'}>{a.texto}</li>{/each}
        </ul>
      {/if}
      {#if datasMudadas.length}
        <h3>Datas alteradas no painel desde {dataCurta(anterior?.data)}</h3>
        <ul class="lista-alertas">
          {#each datasMudadas as m (m.codigo + m.campo)}
            <li>{m.codigo}: {m.campo === 'previsao' ? 'previsão' : 'vencimento'} de {dataCurta(m.de)} para {dataCurta(m.para)}</li>
          {/each}
        </ul>
      {/if}
      <h3>Demandas em risco, atrasadas ou com previsão vencida</h3>
      {#if atencao.length}
        <table>
          <thead><tr><th>Card</th><th>Demanda</th><th>Etapa atual · quem</th><th class="num">Etapas</th><th>Previsão</th><th>Ritmo</th></tr></thead>
          <tbody>
            {#each atencao as { card } (card.codigo)}
              <tr>
                <td class="codigo">{card.codigo}</td>
                <td>{card.titulo ?? card.sistema ?? ''}</td>
                <td>{card.etapaAtual ?? '-'}<small>{nomePessoa(card.responsavelEtapaAtual)}</small></td>
                <td class="num">{card.etapasConcluidas ?? '?'}/{card.etapasTotal ?? '?'}</td>
                <td class:vencida={(card.previsao ?? '9999') < dataFoto}>{dataCurta(card.previsao)}</td>
                <td>{#if card.ritmoPainel}<span class="pilula {card.ritmoPainel}">{nomesRitmo[card.ritmoPainel]}</span>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="dica">Nenhuma demanda em risco, atrasada ou com previsão vencida.</p>
      {/if}
      {@render nota('decisoes', 'Decisões e apoio necessários', 'O que a gestão precisa decidir ou destravar, com prazo.')}
    </section>

    {#if riscos.length}
      <section>
        <h2>6. Riscos e plano B</h2>
        <table>
          <thead><tr><th>Risco</th><th>Chance · impacto</th><th>Gatilho</th><th>Plano B</th><th>Decisão necessária</th></tr></thead>
          <tbody>
            {#each riscos as r (r.id)}
              <tr>
                <td>{r.descricao}<small>{[r.cardCodigo, r.pessoaId && nomePessoa(r.pessoaId), r.status !== 'aberto' && r.status].filter(Boolean).join(' · ')}</small></td>
                <td><span class="pilula {r.impacto === 'alto' || r.probabilidade === 'alta' ? 'vermelho' : 'amarelo'}">{r.probabilidade} · {r.impacto}</span></td>
                <td>{r.gatilho}</td>
                <td>{r.planoB}</td>
                <td>{r.decisaoNecessaria ?? ''}{#if r.prazoDecisao}<small>até {dataCurta(r.prazoDecisao)}</small>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if promessas.length || promessasAnteriores.length}
      <section>
        <h2>7. Compromissos com a gestão</h2>
        <table>
          <thead><tr><th>Semana</th><th>Compromisso</th><th>Situação</th></tr></thead>
          <tbody>
            {#each [...promessasAnteriores, ...promessas] as p (p.id)}
              <tr>
                <td>{dataCurta(p.semana)}</td>
                <td>{p.texto}{#if p.justificativa}<small>{p.justificativa}</small>{/if}</td>
                <td>
                  <span class="pilula {p.cumprida === true ? 'verde' : p.cumprida === false ? 'vermelho' : ''}">
                    {p.cumprida === true ? 'cumprido' : p.cumprida === false ? 'não cumprido' : 'em aberto'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    <section class="pode-quebrar">
      <h2>8. Quem está cuidando de quê</h2>
      <table>
        <thead><tr><th>Card</th><th>Demanda</th><th class="num">Nível</th><th>Etapa atual · quem</th><th class="num">Etapas</th><th>Previsão</th><th>Ritmo</th></tr></thead>
        <tbody>
          {#each emExecucao as { painel, card } (card.codigo)}
            <tr>
              <td class="codigo">{card.codigo}{diferenteDoPainel(painel, card) ? '*' : ''}</td>
              <td>{card.titulo ?? ''}<small>{card.sistema ?? ''}</small></td>
              <td class="num">{card.criticidade ?? '-'}</td>
              <td>{card.etapaAtual ?? '-'}<small>{nomePessoa(card.responsavelEtapaAtual)}</small></td>
              <td class="num">
                {card.etapasConcluidas ?? '?'}/{card.etapasTotal ?? '?'}
                <span class="progresso"><span style:width="{card.etapasTotal ? ((card.etapasConcluidas ?? 0) / card.etapasTotal) * 100 : 0}%"></span></span>
              </td>
              <td>{dataCurta(card.previsao)}</td>
              <td>{#if card.ritmoPainel}<span class="pilula {card.ritmoPainel}">{nomesRitmo[card.ritmoPainel]}</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if emExecucao.some(({ painel, card }) => diferenteDoPainel(painel, card))}
        <p class="fonte">* Etapa atualizada pela supervisão depois da foto do painel.</p>
      {/if}
    </section>

    <section>
      <h2>9. Comparativo {anterior ? `com a foto de ${dataCurta(anterior.data)}` : 'dos números do painel'}</h2>
      <table class="comparativo">
        <thead>
          <tr><th>Indicador</th>{#if anterior}<th class="num">{dataCurta(anterior.data)}</th>{/if}<th class="num">{dataCurta(dataFoto)}</th>{#if anterior}<th class="num">Variação</th>{/if}</tr>
        </thead>
        <tbody>
          {#each linhasComparativo as l (l.chave)}
            <tr>
              <td>{nomesTotais[l.chave]}</td>
              {#if anterior}<td class="num">{valor(l.anterior)}{l.anterior !== undefined && ehPct(l.chave) ? '%' : ''}</td>{/if}
              <td class="num"><b>{valor(l.atual)}{l.atual !== undefined && ehPct(l.chave) ? '%' : ''}</b></td>
              {#if anterior}<td class="num"><span class="variacao {l.tendencia}">{variacao(l.chave)}</span></td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section>
      <h2>10. Destaques e próximos passos</h2>
      {@render nota('destaques', 'Destaques da semana', 'Entregas, avanços e o que deu certo.')}
      {@render nota('proximosPassos', 'Próximos passos', 'O que será feito, por quem, até quando e com qual objetivo.')}
    </section>

    <footer>
      Fonte: painel do gestor, foto de {dataCurta(dataFoto)}. Os números do painel são usados como estão, sem recálculo.
    </footer>
  </article>
{/if}

<style>
  .barra
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    max-width: 210mm;
    margin: 24px auto 4px;
  }
  .espaco
  {
    flex: 1;
  }
  .centro
  {
    text-align: center;
  }
  .folha
  {
    background: #fff;
    width: 210mm;
    max-width: 100%;
    margin: 12px auto 48px;
    padding: 14mm 14mm 10mm;
    box-shadow: 0 4px 24px rgb(16 24 40 / 12%);
    font-size: 10pt;
  }
  .capa
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    background: var(--marca-escura);
    color: #fff;
    border-radius: 8px;
    padding: 18px 22px;
    margin-bottom: 18px;
  }
  .capa h1
  {
    font-size: 1.6rem;
    margin: 2px 0 4px;
  }
  .capa p
  {
    margin: 0;
  }
  .sobre
  {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: #9fc3cb;
  }
  .meta-capa
  {
    text-align: right;
    font-size: 0.85rem;
    color: #d3e4e8;
  }
  section
  {
    margin-bottom: 18px;
    break-inside: avoid-page;
  }
  h2
  {
    color: var(--marca);
    border-bottom: 2px solid var(--marca-clara);
    padding-bottom: 6px;
  }
  .titulo-secao
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .titulo-secao h2
  {
    flex: 1;
  }
  .semaforo
  {
    margin-left: 12px;
    padding: 4px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
  }
  .semaforo::before
  {
    content: "";
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: currentColor;
    margin-right: 6px;
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .kpi
  {
    border: 1px solid var(--borda);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rotulo
  {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--suave);
  }
  .valor
  {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--marca-escura);
  }
  .detalhe
  {
    font-size: 0.78rem;
    color: var(--suave);
    min-height: 1em;
  }
  .variacao
  {
    align-self: flex-start;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 4px;
    padding: 0 6px;
  }
  .variacao.igual, .variacao.neutra
  {
    color: var(--suave);
  }
  .barra-ritmo
  {
    display: flex;
    border-radius: 6px;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .barra-ritmo div
  {
    padding: 8px 10px;
    white-space: nowrap;
    min-width: 90px;
  }
  .barra-ritmo .no_ritmo, .pilha .no_ritmo, .legenda .no_ritmo
  {
    background: #2e9e5b;
    color: #fff;
  }
  .barra-ritmo .em_risco, .pilha .em_risco, .legenda .em_risco
  {
    background: #e8833a;
    color: #fff;
  }
  .barra-ritmo .atrasado, .pilha .atrasado, .legenda .atrasado
  {
    background: #d64545;
    color: #fff;
  }
  .pessoas
  {
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    gap: 6px 12px;
    align-items: center;
  }
  .nome
  {
    font-size: 0.85rem;
  }
  .trilho
  {
    background: #f1f4f6;
    border-radius: 4px;
  }
  .pilha
  {
    display: flex;
    height: 20px;
    border-radius: 4px;
    overflow: hidden;
    font-size: 0.72rem;
    font-weight: 600;
    text-align: center;
    line-height: 20px;
  }
  .pilha .sem
  {
    background: #b9c3cc;
    color: #fff;
  }
  .total
  {
    font-weight: 700;
    font-size: 0.85rem;
  }
  .legenda
  {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-size: 0.75rem;
    color: var(--suave);
  }
  .legenda i
  {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: -1px;
  }
  table
  {
    font-size: 0.82rem;
  }
  th, td
  {
    padding: 6px;
  }
  thead
  {
    display: table-header-group;
  }
  tr
  {
    break-inside: avoid;
  }
  td small
  {
    display: block;
    color: var(--suave);
    font-size: 0.75rem;
  }
  .codigo
  {
    font-weight: 700;
    white-space: nowrap;
  }
  .vencida
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  .progresso
  {
    display: block;
    height: 4px;
    background: #e8edf1;
    border-radius: 2px;
    margin-top: 4px;
    width: 50px;
    margin-left: auto;
  }
  .progresso span
  {
    display: block;
    height: 100%;
    background: var(--marca);
    border-radius: 2px;
  }
  .comparativo td
  {
    padding: 4px 6px;
  }
  .nota textarea
  {
    width: 100%;
    resize: vertical;
  }
  .nota p
  {
    white-space: pre-wrap;
    margin: 0;
  }
  .fonte
  {
    font-size: 0.75rem;
    color: var(--suave);
    margin: 6px 0 0;
  }
  footer
  {
    border-top: 1px solid var(--borda);
    padding-top: 8px;
    font-size: 0.72rem;
    color: var(--suave);
  }
  .so-imprimir
  {
    display: none;
  }
  .pode-quebrar
  {
    break-inside: auto;
  }
  .plano-kpi
  {
    background: var(--marca-clara);
    border-color: transparent;
  }
  .matriz td
  {
    min-width: 120px;
  }
  .frente
  {
    font-weight: 700;
    color: var(--marca-escura);
  }
  .celula
  {
    font-size: 0.78rem;
    background: #f1f4f6;
    border-radius: 4px;
    padding: 3px 6px;
    margin-bottom: 3px;
  }
  .dores
  {
    margin: 0;
    padding-left: 18px;
    font-size: 0.85rem;
  }
  .dores span
  {
    color: var(--suave);
    margin-left: 6px;
  }
  .bloco-pessoa td.codigo
  {
    width: 32%;
    white-space: normal;
  }
  .bloco-pessoa td.codigo small
  {
    font-weight: 400;
  }
  .bloco-pessoa
  {
    border: 1px solid var(--borda);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
    break-inside: avoid;
  }
  .cabeca-pessoa
  {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .trilho-plano
  {
    flex: 0 0 120px;
    height: 8px;
    background: #e8edf1;
    border-radius: 4px;
    overflow: hidden;
  }
  .trilho-plano span
  {
    display: block;
    height: 100%;
    background: var(--verde);
  }
  .dificuldade
  {
    margin: 6px 0;
    font-size: 0.85rem;
    background: var(--amarelo-fundo);
    padding: 6px 10px;
    border-radius: 6px;
  }
  .lista-alertas
  {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
    font-size: 0.82rem;
  }
  .lista-alertas li
  {
    padding: 4px 10px;
    border-radius: 4px;
    margin-bottom: 3px;
    background: #f1f4f6;
  }
  @media print
  {
    .nao-imprimir
    {
      display: none !important;
    }
    .so-imprimir
    {
      display: block;
    }
    .nota.vazia
    {
      display: none;
    }
    .folha
    {
      width: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
  }
</style>
