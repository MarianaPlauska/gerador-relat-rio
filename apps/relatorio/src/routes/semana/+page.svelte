<script lang="ts">
  import
  {
    agoraLocal, alertasDoPlano, confirmarPlano, horasPlanejadas, kpisDosItens, pendenciasDaSemana, segundaDaSemana, somarDias, sugerirItens,
    type Alerta, type CardSnapshot, type ItemPlano, type PlanoPessoa, type PlanoSemana, type Ritmo, type Risco,
  } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';

  let dados = $state<Dados>(carregar());
  const hoje = agoraLocal().slice(0, 10);
  let semana = $state(segundaDaSemana(hoje));

  $effect(() => salvar($state.snapshot(dados)));

  const sexta = $derived(somarDias(semana, 4));
  const foto = $derived(dados.fotos.filter((f) => f.data <= sexta).at(-1) ?? dados.fotos.at(-1));
  const cards = $derived(foto?.cards ?? []);
  const porCodigo = $derived(new Map(cards.map((c) => [c.codigo, c])));
  const plano = $derived(dados.planos.find((p) => p.inicio === semana));
  const anterior = $derived(dados.planos.find((p) => p.inicio === somarDias(semana, -7)));
  const alertas = $derived(plano ? alertasDoPlano(plano, cards, dados.pessoas) : []);
  const kpis = $derived(plano ? kpisDosItens(plano.pessoas.flatMap((pp) => pp.itens), cards) : undefined);
  const semanas = $derived([...new Set([...dados.planos.map((p) => p.inicio), segundaDaSemana(hoje), somarDias(segundaDaSemana(hoje), 7)])].sort());
  const frentes = $derived([...new Set(dados.planos.flatMap((p) => p.pessoas.flatMap((pp) => pp.itens.map((i) => i.frente?.trim()))).filter(Boolean))]);
  const dores = $derived([...new Set(dados.planos.flatMap((p) => p.pessoas.flatMap((pp) => pp.itens.map((i) => i.dor?.trim()))).filter(Boolean))]);
  const riscosAbertos = $derived(dados.riscos.filter((r) => r.status === 'aberto' || r.sinalizadoEm >= semana));
  const promessasDaSemana = $derived(dados.promessas.filter((p) => p.semana === semana));
  const promessasAnteriores = $derived(dados.promessas.filter((p) => p.semana === somarDias(semana, -7)));

  const nomesRitmo: Record<Ritmo, string> = { no_ritmo: 'no ritmo', em_risco: 'em risco', atrasado: 'atrasado' };
  const nomesStatus: Record<ItemPlano['status'], string> = { a_fazer: 'A fazer', fazendo: 'Fazendo', feito: 'Feito', bloqueado: 'Bloqueado', adiado: 'Adiado' };
  const nomesCausa: Record<NonNullable<ItemPlano['causa']>, string> = {
    requisito_mudou: 'Requisito mudou',
    dependencia_externa: 'Dependência externa',
    estimativa_errada: 'Estimativa errada',
    bloqueio: 'Bloqueio',
    urgencia: 'Entrou urgência',
    outro: 'Outro',
  };
  const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
  const nomePessoa = (id?: string) => dados.pessoas.find((p) => p.id === id)?.nome ?? id ?? '-';
  const novoId = () => crypto.randomUUID();
  const alertasDoItem = (id: string) => alertas.filter((a) => a.itemId === id);

  function comecarPlano(trazerPendencias: boolean)
  {
    const pendentes = trazerPendencias && anterior ? pendenciasDaSemana(anterior, novoId) : [];
    const novo: PlanoSemana = {
      inicio: semana,
      pessoas: dados.pessoas.map((p) => ({ pessoaId: p.id, itens: pendentes.find((x) => x.pessoaId === p.id)?.itens ?? [] })),
    };
    dados.planos = [...dados.planos, novo].sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  function planoDe(pessoaId: string): PlanoPessoa
  {
    const p = plano!;
    let pp = p.pessoas.find((x) => x.pessoaId === pessoaId);
    if (!pp)
    {
      p.pessoas.push({ pessoaId, itens: [] });
      pp = p.pessoas.at(-1)!;
    }
    return pp;
  }

  function adicionar(pessoaId: string, tipo: ItemPlano['tipo'])
  {
    planoDe(pessoaId).itens.push({ id: novoId(), descricao: '', tipo, status: 'a_fazer' });
  }

  function sugerir(pessoaId: string)
  {
    const pp = planoDe(pessoaId);
    const jaNoPlano = pp.itens.map((i) => i.cardCodigo).filter((c): c is string => !!c);
    pp.itens.push(...sugerirItens(cards, pessoaId, semana, jaNoPlano, novoId));
  }

  function remover(pp: PlanoPessoa, id: string)
  {
    pp.itens = pp.itens.filter((i) => i.id !== id);
  }

  // antes de confirmar, mudar a data não conta como alteração
  function mudarData(item: ItemPlano)
  {
    if (!plano?.confirmadoEm) item.ateOriginal = item.ate;
  }

  function confirmar()
  {
    const i = dados.planos.findIndex((p) => p.inicio === semana);
    dados.planos[i] = confirmarPlano($state.snapshot(dados.planos[i]!), hoje);
  }

  function marcarStatus(item: ItemPlano)
  {
    if (item.status === 'feito' && !item.entregueEm) item.entregueEm = hoje;
    if (item.status !== 'feito') item.entregueEm = undefined;
  }

  function novoRisco(base: Partial<Risco> = {})
  {
    dados.riscos.push({
      id: novoId(), descricao: '', origem: 'manual', probabilidade: 'media', impacto: 'medio', gatilho: '', planoB: '',
      sinalizadoEm: hoje, status: 'aberto', ...base,
    });
  }

  function riscoDoAlerta(a: Alerta)
  {
    novoRisco({ descricao: a.texto, cardCodigo: a.cardCodigo, pessoaId: a.pessoaId, origem: 'automatico', impacto: a.nivel === 'alto' ? 'alto' : 'medio' });
  }

  const resumoCard = (c: CardSnapshot) =>
    [c.sistema, c.etapaAtual && `etapa ${c.etapaAtual}`, c.etapasTotal !== undefined && `${c.etapasConcluidas ?? 0}/${c.etapasTotal}`,
      c.previsao && `previsão ${dataCurta(c.previsao)}`, c.vencimento && `vence ${dataCurta(c.vencimento)}`,
      c.responsavelEtapaAtual && nomePessoa(c.responsavelEtapaAtual)].filter(Boolean).join(' · ');
</script>

<datalist id="frentes">{#each frentes as f (f)}<option value={f}></option>{/each}</datalist>
<datalist id="dores">{#each dores as d (d)}<option value={d}></option>{/each}</datalist>

<main>
  <header>
    <h1>Plano da semana</h1>
    <label>Semana de
      <select bind:value={semana}>
        {#each semanas as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
      </select>
    </label>
    <span class="dica">{foto ? `Comparando com a foto do painel de ${dataCurta(foto.data)}` : 'Sem foto do painel: cole o painel antes para ter os alertas.'}</span>
  </header>

  {#if !plano}
    <section class="cartao vazio">
      <p>Ainda não há plano para esta semana.</p>
      <button class="principal" onclick={() => comecarPlano(true)}>Começar o plano{anterior ? ' trazendo o que não foi feito na semana anterior' : ''}</button>
      {#if anterior}<button onclick={() => comecarPlano(false)}>Começar vazio</button>{/if}
    </section>
  {:else}
    <section class="cartao resumo">
      <div class="numeros">
        <div><b>{kpis?.feitos ?? 0}/{kpis?.planejados ?? 0}</b><span>itens feitos{kpis?.pctFeitos !== undefined ? ` (${kpis.pctFeitos}%)` : ''}</span></div>
        <div><b>{kpis?.alterados ?? 0}</b><span>itens alterados</span></div>
        <div><b>{kpis?.pctDentroDoCronograma !== undefined ? `${kpis.pctDentroDoCronograma}%` : '-'}</b><span>feitos dentro do cronograma</span></div>
        <div><b>{kpis?.naoPlanejadosFeitos ?? 0}</b><span>não planejados feitos</span></div>
        <div class:ruim={alertas.length > 0}><b>{alertas.length}</b><span>alertas</span></div>
      </div>
      <div class="acoes">
        {#if plano.confirmadoEm}
          <span class="pilula verde">Plano confirmado em {dataCurta(plano.confirmadoEm)}</span>
        {:else}
          <button class="principal" onclick={confirmar} title="Guarda as datas combinadas. Depois disso, mudar uma data conta como item alterado.">Confirmar plano</button>
        {/if}
        {#if plano.fechadoEm}
          <span class="pilula">Semana fechada em {dataCurta(plano.fechadoEm)}</span>
          <button onclick={() => (plano.fechadoEm = undefined)}>Reabrir</button>
        {:else}
          <button onclick={() => (plano.fechadoEm = hoje)} disabled={!plano.confirmadoEm}>Fechar a semana</button>
        {/if}
      </div>
    </section>

    {#if alertas.length}
      <section class="cartao">
        <h2>Alertas: o plano passa do que o painel do gestor espera</h2>
        <ul class="alertas">
          {#each alertas as a, i (i)}
            <li class={a.nivel}>
              <span>{a.texto}</span>
              <span class="dica">{nomePessoa(a.pessoaId)}</span>
              {#if !dados.riscos.some((r) => r.descricao === a.texto)}
                <button class="link" onclick={() => riscoDoAlerta(a)}>virar risco</button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#each dados.pessoas as pessoa (pessoa.id)}
      {@const pp = plano.pessoas.find((x) => x.pessoaId === pessoa.id) ?? { pessoaId: pessoa.id, itens: [] }}
      {@const horas = horasPlanejadas(pp)}
      <section class="cartao pessoa">
        <div class="topo">
          <h2>{pessoa.nome}</h2>
          <span class="dica" class:estourou={horas > pessoa.capacidadeHorasSemana}>{horas}h de {pessoa.capacidadeHorasSemana}h</span>
          <span class="espaco"></span>
          <button onclick={() => sugerir(pessoa.id)} disabled={!foto}>Sugerir do painel</button>
          <button onclick={() => adicionar(pessoa.id, 'planejado')}>+ Item</button>
          <button onclick={() => adicionar(pessoa.id, 'nao_planejado')}>+ Não planejado</button>
        </div>
        <label class="dificuldade">Maior problema ou dificuldade da semana
          <input value={pp.dificuldade ?? ''} onchange={(e) => (planoDe(pessoa.id).dificuldade = e.currentTarget.value || undefined)} placeholder="Ex.: depende do retorno do cliente sobre o certificado" />
        </label>

        {#each pp.itens as item (item.id)}
          {@const card = item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined}
          {@const meus = alertasDoItem(item.id)}
          <div class="item" class:feito={item.status === 'feito'} class:com-alerta={meus.length}>
            <div class="linha1">
              <select bind:value={item.cardCodigo} class="card">
                <option value={undefined}>sem card</option>
                {#each cards as c (c.codigo)}<option value={c.codigo}>{c.codigo} - {c.titulo ?? c.sistema ?? ''}</option>{/each}
                {#if item.cardCodigo && !card}<option value={item.cardCodigo}>{item.cardCodigo}</option>{/if}
              </select>
              <input bind:value={item.descricao} placeholder="O que vai ser feito" class="largo" />
              <label>Até <input type="date" bind:value={item.ate} onchange={() => mudarData(item)} /></label>
              <label>Horas <input type="number" min="0" class="mini" bind:value={item.horasEstimadas} /></label>
              {#if item.tipo === 'nao_planejado'}<span class="pilula amarelo">não planejado</span>{/if}
              <button class="link" onclick={() => remover(planoDe(pessoa.id), item.id)}>remover</button>
            </div>
            <div class="linha2">
              <input bind:value={item.objetivo} placeholder="Para quê (objetivo)" class="largo" />
              <input bind:value={item.frente} list="frentes" placeholder="Frente" />
              <input bind:value={item.dor} list="dores" placeholder="Dor que resolve" />
            </div>
            {#if card}
              <p class="info-card">
                {resumoCard(card)}
                {#if card.ritmoPainel}<span class="pilula {card.ritmoPainel}">{nomesRitmo[card.ritmoPainel]}</span>{/if}
                {#if card.titulo}<br /><span class="dica">{card.titulo}</span>{/if}
              </p>
            {/if}
            {#each meus as a, i (i)}<p class="alerta {a.nivel}">{a.texto}</p>{/each}
            {#if item.ateOriginal && item.ate !== item.ateOriginal}
              <p class="alterado">Data alterada: combinado {dataCurta(item.ateOriginal)}, agora {dataCurta(item.ate)}</p>
            {/if}
            <div class="linha3">
              <select bind:value={item.status} onchange={() => marcarStatus(item)} class="status {item.status}">
                {#each Object.entries(nomesStatus) as [s, nome] (s)}<option value={s}>{nome}</option>{/each}
              </select>
              {#if item.status === 'feito'}
                <label>Entregue em <input type="date" bind:value={item.entregueEm} /></label>
              {:else if (item.status !== 'a_fazer' && item.status !== 'fazendo') || plano.fechadoEm}
                <select bind:value={item.causa}>
                  <option value={undefined}>Causa</option>
                  {#each Object.entries(nomesCausa) as [c, nome] (c)}<option value={c}>{nome}</option>{/each}
                </select>
                <input bind:value={item.motivoNaoFeito} placeholder="Por que não saiu" class="largo" />
              {/if}
            </div>
          </div>
        {:else}
          <p class="dica">Nenhum item. Use "Sugerir do painel" para trazer os cards em que {pessoa.nome.split(' ')[0]} está na etapa atual.</p>
        {/each}
      </section>
    {/each}

    <section class="cartao">
      <div class="topo">
        <h2>Riscos e plano B</h2>
        <span class="espaco"></span>
        <button onclick={() => novoRisco()}>+ Risco</button>
      </div>
      {#each riscosAbertos as r (r.id)}
        <div class="item risco">
          <div class="linha1">
            <input bind:value={r.descricao} placeholder="O que pode dar errado" class="largo" />
            <select bind:value={r.cardCodigo}>
              <option value={undefined}>sem card</option>
              {#each cards as c (c.codigo)}<option value={c.codigo}>{c.codigo}</option>{/each}
            </select>
            <select bind:value={r.pessoaId}>
              <option value={undefined}>sem pessoa</option>
              {#each dados.pessoas as p (p.id)}<option value={p.id}>{p.nome}</option>{/each}
            </select>
            <label>Chance <select bind:value={r.probabilidade}><option value="baixa">baixa</option><option value="media">média</option><option value="alta">alta</option></select></label>
            <label>Impacto <select bind:value={r.impacto}><option value="baixo">baixo</option><option value="medio">médio</option><option value="alto">alto</option></select></label>
            <select bind:value={r.status}>
              <option value="aberto">aberto</option><option value="mitigado">mitigado</option><option value="ocorreu">ocorreu</option><option value="descartado">descartado</option>
            </select>
          </div>
          <div class="linha2">
            <input bind:value={r.gatilho} placeholder="Gatilho: quando acionar o plano B" />
            <input bind:value={r.planoB} placeholder="Plano B" class="largo" />
          </div>
          <div class="linha2">
            <input bind:value={r.decisaoNecessaria} placeholder="Decisão que a gestão precisa tomar (opcional)" class="largo" />
            <label>Até <input type="date" bind:value={r.prazoDecisao} /></label>
            <button class="link" onclick={() => (dados.riscos = dados.riscos.filter((x) => x.id !== r.id))}>remover</button>
          </div>
        </div>
      {:else}
        <p class="dica">Nenhum risco aberto. Os alertas acima podem virar risco com um clique.</p>
      {/each}
    </section>

    <section class="cartao">
      <div class="topo">
        <h2>Promessas ao gestor</h2>
        <span class="espaco"></span>
        <button onclick={() => dados.promessas.push({ id: novoId(), semana, texto: '' })}>+ Promessa</button>
      </div>
      {#each promessasDaSemana as p (p.id)}
        <div class="promessa">
          <input bind:value={p.texto} placeholder="O que foi combinado com o gestor nesta semana" class="largo" />
          <select value={p.cumprida === undefined ? '' : String(p.cumprida)} onchange={(e) => (p.cumprida = e.currentTarget.value === '' ? undefined : e.currentTarget.value === 'true')}>
            <option value="">em aberto</option><option value="true">cumprida</option><option value="false">não cumprida</option>
          </select>
          {#if p.cumprida === false}<input bind:value={p.justificativa} placeholder="Por quê" />{/if}
          <button class="link" onclick={() => (dados.promessas = dados.promessas.filter((x) => x.id !== p.id))}>remover</button>
        </div>
      {:else}
        <p class="dica">Nenhuma promessa nesta semana.</p>
      {/each}
      {#if promessasAnteriores.length}
        <h3>Da semana anterior</h3>
        {#each promessasAnteriores as p (p.id)}
          <div class="promessa">
            <span class="largo">{p.texto}</span>
            <select value={p.cumprida === undefined ? '' : String(p.cumprida)} onchange={(e) => (p.cumprida = e.currentTarget.value === '' ? undefined : e.currentTarget.value === 'true')}>
              <option value="">em aberto</option><option value="true">cumprida</option><option value="false">não cumprida</option>
            </select>
            {#if p.cumprida === false}<input bind:value={p.justificativa} placeholder="Por quê" />{/if}
          </div>
        {/each}
      {/if}
    </section>
  {/if}
</main>

<style>
  main
  {
    max-width: 1240px;
    margin: 0 auto;
    padding: 24px;
  }
  header, .topo, .linha1, .linha2, .linha3, .acoes, .promessa
  {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
  }
  header h1
  {
    margin: 0 12px 0 0;
  }
  .topo h2
  {
    margin: 0;
  }
  .espaco
  {
    flex: 1;
  }
  .vazio
  {
    text-align: center;
  }
  .vazio button
  {
    margin: 4px;
  }
  .resumo
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }
  .numeros
  {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
  }
  .numeros div
  {
    display: flex;
    flex-direction: column;
  }
  .numeros b
  {
    font-size: 1.5rem;
    color: var(--marca-escura);
  }
  .numeros span
  {
    font-size: 0.8rem;
    color: var(--suave);
  }
  .numeros .ruim b
  {
    color: var(--vermelho);
  }
  .alertas
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .alertas li
  {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 10px;
    border-left: 4px solid;
    margin-bottom: 4px;
    border-radius: 4px;
  }
  .alertas li span:first-child
  {
    flex: 1;
  }
  .alto
  {
    background: var(--vermelho-fundo);
    border-color: var(--vermelho);
    color: var(--vermelho);
  }
  .medio
  {
    background: var(--amarelo-fundo);
    border-color: var(--amarelo);
    color: var(--amarelo);
  }
  .estourou
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  .dificuldade
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 12px 0;
  }
  .item
  {
    border: 1px solid var(--borda);
    border-left: 4px solid var(--marca);
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item.com-alerta
  {
    border-left-color: var(--vermelho);
  }
  .item.feito
  {
    border-left-color: var(--verde);
    background: #fbfdfb;
  }
  .item.risco
  {
    border-left-color: var(--amarelo);
  }
  .card
  {
    max-width: 280px;
  }
  .largo
  {
    flex: 1;
    min-width: 220px;
  }
  .mini
  {
    width: 64px;
  }
  .info-card
  {
    margin: 0;
    font-size: 0.82rem;
    background: var(--marca-clara);
    padding: 6px 10px;
    border-radius: 6px;
  }
  .alerta, .alterado
  {
    margin: 0;
    font-size: 0.82rem;
    padding: 4px 10px;
    border-radius: 6px;
  }
  .alterado
  {
    background: #eef2ff;
    color: #3538cd;
  }
  .status.feito
  {
    background: var(--verde-fundo);
    color: var(--verde);
  }
  .status.bloqueado, .status.adiado
  {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
  }
  .promessa
  {
    margin-top: 8px;
  }
  .link
  {
    border: none;
    background: none;
    color: #175cd3;
    text-decoration: underline;
    padding: 2px 4px;
  }
</style>
