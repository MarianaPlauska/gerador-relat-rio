<script lang="ts">
  import
  {
    acoesDeHoje, aplicarControle, definicoesPadrao, diasUteisEntre, historico, linhaDoTempo, progressoDaLista, resumoDoFluxo, ritmoPorPessoa, segundaDaSemana, semanaDoAno, serieSemanal, somarDias, textoProjecao,
    type Destino, type Evento, type TotaisPainel,
  } from '@supervisao/core';
  import { carregar, exportarJson, importarJson, salvar, type Dados, type NotasRelatorio } from '#lib/armazenamento.ts';
  import { svgLinha, svgSparkline } from '#lib/graficos.ts';
  import { entrar, nuvem, sairDaNuvem } from '#lib/nuvem.svelte.ts';
  import { baixarTexto, copiar, textoPacote, textoTeams } from '#lib/saidas.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, semanasDisponiveis } from '#lib/semana.ts';
  import { fecharSessao, lerSessao } from '#lib/sessao.ts';
  import { goto } from '$app/navigation';

  let dados = $state<Dados>(carregar());
  const dia = hoje();
  let semana = $state(segundaDaSemana(dia));
  let copiado = $state('');
  let entradaBackup = $state<HTMLInputElement>();

  const ctx = $derived(contextoDaSemana(dados, semana));
  const notas = $derived<NotasRelatorio>(dados.relatorios[semana] ?? {});
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const ta = $derived<TotaisPainel>(ctx.anterior?.foto?.totais ?? {});
  const kp = $derived(ctx.comp.planoAtual);
  const fotosAteSemana = $derived(dados.fotos.filter((f) => f.data <= ctx.fim));
  const serie = (chave: keyof TotaisPainel) => historico(fotosAteSemana, chave).slice(-8);
  const promessasDaSemana = $derived(dados.promessas.filter((p) => p.semana === semana));
  const emAberto = $derived(promessasDaSemana.filter((p) => p.cumprida === undefined));

  const acoes = $derived(acoesDeHoje({
    hoje: dia,
    inicio: semana,
    fotos: dados.fotos,
    plano: ctx.atual.plano,
    alertas: ctx.alertas,
    riscos: dados.riscos,
    promessasDaSemana,
    promessasAnteriores: ctx.promessasAnteriores,
    listas: dados.listas,
  }));
  const fluxo = $derived(resumoDoFluxo(ctx.atual.foto?.cards ?? [], ctx.atual.foto?.data ?? dia, serieSemanal(fotosAteSemana, 'dentroDoPrazoPct', semana), ctx.meta));
  const nomePessoa = (id: string) => dados.pessoas.find((p) => p.id === id)?.nome.split(' ')[0] ?? id;
  const eventos = $derived(linhaDoTempo(dados.fotos, ctx.atual.plano, dados.riscos, dados.pessoas, semana));
  const eventosPorDia = $derived(Object.entries(eventos.reduce<Record<string, Evento[]>>((m, e) => ((m[e.data] ??= []).push(e), m), {})));

  const ritmo = $derived.by(() =>
  {
    const foto = ctx.atual.foto;
    if (!foto) return new Map<string, { no_ritmo: number; em_risco: number; atrasado: number; total: number }>();
    const emExec = foto.cards.filter((c) => c.origens.includes('em_execucao')).map((c) => aplicarControle(c, foto.data, dados.controle[c.codigo]));
    return new Map(ritmoPorPessoa(emExec, dados.pessoas).map((r) => [r.pessoa.id, r.contagem]));
  });

  const nomesDias = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const rotinaDia = ['colar o painel e planejar', 'acompanhar', 'colar o painel', 'acompanhar', 'colar o painel e fechar'];
  const regua = $derived(nomesDias.map((nome, i) =>
  {
    const data = somarDias(semana, i);
    return { nome, data, rotina: rotinaDia[i]!, hoje: data === dia, passou: data < dia, foto: dados.fotos.some((f) => f.data === data) };
  }));

  const rotas: Record<Destino, string> = { painel: '/painel', semana: '/semana', cards: '/cards', relatorio: '/relatorio', listas: '/listas' };
  const iconeEvento: Record<Evento['tipo'], string> = {
    foto: '[foto]', etapa: '[etapa]', previsao: '[previsão]', ritmo: '[ritmo]', entrou: '[entrou]', saiu: '[saiu]', plano: '[plano]', entrega: '[entrega]', risco: '[risco]',
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || '').split(' ')[0]);

  const ultimaFoto = $derived([...dados.fotos].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);
  const nomesNuvem: Record<typeof nuvem.estado, string> = { desligada: 'desligada', sem_login: 'sem login', sincronizando: 'sincronizando', ok: 'ok', erro: 'erro' };
  // atenção primeiro: com a lista recolhida, o que importa aparece
  const ordemTom = { atencao: 0, positivo: 1, neutro: 2 };
  const frasesOrdenadas = $derived([...ctx.frases].sort((a, b) => ordemTom[a.tom] - ordemTom[b.tom]));
  let todasFrases = $state(false);

  function sair()
  {
    fecharSessao();
    goto('/entrar');
  }

  function variacao(chave: keyof TotaisPainel, sufixo = ''): string
  {
    const a = ta[chave];
    const b = t[chave];
    if (a === undefined || b === undefined) return '';
    const d = b - a;
    return `${d > 0 ? '+' : ''}${d}${sufixo} na semana`;
  }

  async function copiarSaida(nome: string, texto: string)
  {
    await copiar(texto);
    copiado = nome;
    setTimeout(() => (copiado = ''), 2000);
  }

  async function restaurar(arquivo?: File)
  {
    if (!arquivo || !confirm('Restaurar o backup substitui todos os dados deste navegador. Continuar?')) return;
    dados = await importarJson(arquivo);
    salvar($state.snapshot(dados) as Dados);
  }
</script>

<main>
  <section class="topo">
    <div>
      <span class="prompt">&gt; {saudacao.toLowerCase()}{primeiroNome ? `, ${primeiroNome.toLowerCase()}` : ''}<span class="cursor">_</span></span>
      <h1>OrbisOS</h1>
      <p class="lema">seu giro da semana: painel, plano, riscos e relatório num lugar só.</p>
    </div>
    <div class="topo-direita">
      <select bind:value={semana} aria-label="Semana">
        {#each semanasDisponiveis(dados) as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
      </select>
      <button class="link" onclick={sair}>sair</button>
    </div>
  </section>

  <ul class="status maquina">
    <li><span>semana</span><b>S{semanaDoAno(semana)}</b></li>
    <li class:aviso={!ultimaFoto || diasDesdeFoto >= 2}><span>última foto</span><b>{ultimaFoto ? `${dataCurta(ultimaFoto.data)}${diasDesdeFoto > 0 ? ` · há ${diasDesdeFoto} d úteis` : ' · hoje'}` : 'nenhuma'}</b></li>
    <li class:aviso={ctx.alertas.length > 0}><span>alertas</span><b>{ctx.alertas.length}</b></li>
    <li class:aviso={fluxo.parados.length > 0}><span>parados</span><b>{fluxo.parados.length}</b></li>
    <li class:ok={nuvem.estado === 'ok'}><span>nuvem</span><b>{nomesNuvem[nuvem.estado]}</b></li>
  </ul>

  <ol class="regua">
    {#each regua as d (d.data)}
      <li class:hoje={d.hoje} class:passou={d.passou}>
        <span class="dia maquina">{d.nome} {dataCurta(d.data)}</span>
        <span class="rotina">{d.rotina}</span>
        {#if d.foto}<span class="marca-foto" title="foto do painel neste dia">foto</span>{/if}
      </li>
    {/each}
  </ol>

  <section class="hoje-painel">
    <div class="titulo-hoje">
      <span class="etiqueta">agora</span>
      <h2>O que fazer</h2>
    </div>
    <ul class="acoes">
      {#each acoes as a, i (i)}
        <li class={a.nivel}>
          <i></i>
          <span>{a.texto}</span>
          {#if a.destino}<a href={rotas[a.destino]}>abrir</a>{/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="kpis">
    <div class="kpi">
      <span class="etiqueta">dentro do prazo</span>
      <span class="valor">{t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}%` : '-'}</span>
      <span class="detalhe">
        {#if ctx.meta !== undefined && t.dentroDoPrazoPct !== undefined}
          meta {ctx.meta}% · <b class:abaixo={t.dentroDoPrazoPct < ctx.meta}>{t.dentroDoPrazoPct - ctx.meta >= 0 ? '+' : ''}{t.dentroDoPrazoPct - ctx.meta} pp</b>
        {/if}
        {variacao('dentroDoPrazoPct', ' pp')}
      </span>
      {@html svgSparkline(serie('dentroDoPrazoPct').map((p) => p.valor))}
    </div>
    <div class="kpi">
      <span class="etiqueta">concluídos</span>
      <span class="valor">{t.concluidos ?? '-'}</span>
      <span class="detalhe">{t.itensCronograma !== undefined ? `de ${t.itensCronograma} itens` : ''} {variacao('concluidos')}</span>
      {@html svgSparkline(serie('concluidos').map((p) => p.valor))}
    </div>
    <div class="kpi">
      <span class="etiqueta">plano da semana</span>
      <span class="valor">{kp ? `${kp.feitos}/${kp.planejados}` : '-'}</span>
      <span class="detalhe">{kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% feito` : 'sem plano ainda'}{ctx.comp.planoAnterior?.pctFeitos !== undefined ? ` · anterior ${ctx.comp.planoAnterior.pctFeitos}%` : ''}</span>
      <span class="barra"><span style:width="{kp?.pctFeitos ?? 0}%"></span></span>
    </div>
    <a class="kpi" href="/semana" class:alerta={ctx.alertas.length > 0}>
      <span class="etiqueta">alertas</span>
      <span class="valor">{ctx.alertas.length}</span>
      <span class="detalhe">{ctx.alertas.length ? 'itens que passam do que o painel espera' : 'nada passa do painel'}</span>
    </a>
  </section>

  <div class="grade">
    <div class="principal-col">
      <section class="cartao fluxo">
        <h2>Fluxo</h2>
        <div class="projecao">
          {#if fluxo.projecao}
            <p class="veredito {fluxo.projecao.veredito}">meta de prazo no fim do mês: {fluxo.projecao.veredito === 'bate' ? 'deve bater' : fluxo.projecao.veredito === 'perto' ? 'perto da meta' : 'não deve bater'} ({fluxo.projecao.projetado.toLocaleString('pt-BR')}% para {fluxo.projecao.meta}%)</p>
            <p class="dica">{textoProjecao(fluxo.projecao)}</p>
          {:else}
            <p class="dica">A projeção da meta precisa de 3 semanas com "dentro do prazo" e a meta do painel.</p>
          {/if}
        </div>
        <div class="colunas-fluxo">
          <div>
            <h3>Parados além do normal ({fluxo.parados.length})</h3>
            {#each fluxo.parados.slice(0, 5) as x (x.card.codigo)}
              <p class="linha-fluxo"><b class="maquina">{x.card.codigo}</b> {x.card.titulo} <span class="dica">{x.idadeDias.toLocaleString('pt-BR')} d aberto, normal até {x.limiteDias.toLocaleString('pt-BR')} d ({x.base}){x.card.responsaveis.length ? ` - ${x.card.responsaveis.map(nomePessoa).join(', ')}` : ''}</span></p>
            {:else}
              <p class="dica">{fluxo.tempos.geral ? 'Nenhuma demanda aberta além do normal.' : 'Importe o CSV da lista de Demandas em Colar painel para medir o normal.'}</p>
            {/each}
          </div>
          <div>
            <h3>Onde as demandas se acumulam</h3>
            {#each fluxo.gargalos.slice(0, 5) as g (g.etapa)}
              <p class="linha-fluxo"><b>{g.etapa}</b> <span class="dica">{g.quantidade} {g.quantidade === 1 ? 'demanda' : 'demandas'}{g.esperando ? `, ${g.esperando} esperando começar` : ''}{g.maiorRodandoDias !== undefined ? `, maior tempo rodando ${g.maiorRodandoDias.toLocaleString('pt-BR')} d` : ''}</span></p>
            {:else}
              <p class="dica">Cole o "Quem está cuidando de quê" ou um card aberto para ver as etapas.</p>
            {/each}
          </div>
        </div>
      </section>

      <section class="cartao">
        <h2>O que o sistema percebeu</h2>
        {#if ctx.frases.length}
          <ul class="frases">
            {#each todasFrases ? frasesOrdenadas : frasesOrdenadas.slice(0, 6) as f, i (i)}<li class={f.tom}><i></i>{f.texto}</li>{/each}
          </ul>
          {#if frasesOrdenadas.length > 6}
            <button class="link" onclick={() => (todasFrases = !todasFrases)}>{todasFrases ? 'mostrar menos' : `ver todas (${frasesOrdenadas.length})`}</button>
          {/if}
        {:else}
          <p class="dica">Cole o painel e monte o plano para o sistema comparar com a semana anterior.</p>
        {/if}
      </section>

      <section class="cartao">
        <h2>Linha do tempo da semana</h2>
        {#each eventosPorDia as [data, lista] (data)}
          <div class="dia-tempo">
            <span class="data maquina">{dataMedia(data)}</span>
            <ul>
              {#each lista as e, i (i)}<li class={e.tipo}><span class="tipo maquina">{iconeEvento[e.tipo]}</span> {e.texto}</li>{/each}
            </ul>
          </div>
        {:else}
          <p class="dica">Nada registrado nesta semana ainda.</p>
        {/each}
      </section>

      {#if serie('dentroDoPrazoPct').length >= 2}
        <section class="cartao">
          <h2>Evolução do prazo</h2>
          <div class="grafico">{@html svgLinha(serie('dentroDoPrazoPct').map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { meta: ctx.meta, sufixo: '%', largura: 760 })}</div>
        </section>
      {/if}
    </div>

    <aside class="pilha">
      <section class="cartao">
        <h2>Time</h2>
        {#each ctx.comp.pessoas as p (p.pessoa.id)}
          {@const r = ritmo.get(p.pessoa.id)}
          {@const dificuldade = ctx.atual.plano?.pessoas.find((x) => x.pessoaId === p.pessoa.id)?.dificuldade}
          <div class="pessoa">
            <div class="linha">
              <b>{p.pessoa.nome}</b>
              {#if p.alertas}<span class="pilula vermelho">{p.alertas} {p.alertas === 1 ? 'alerta' : 'alertas'}</span>{/if}
            </div>
            <span class="barra clara"><span style:width="{p.atual.pctFeitos ?? 0}%"></span></span>
            <span class="dica maquina">
              {p.atual.feitos}/{p.atual.planejados} feitos · <span class:estourou={p.horas > p.pessoa.capacidadeHorasSemana}>{p.horas}h de {p.pessoa.capacidadeHorasSemana}h</span>
            </span>
            {#if r && r.total}
              <span class="barra-ritmo" title="demandas em execução por ritmo">
                {#if r.no_ritmo}<span class="no_ritmo" style:flex={r.no_ritmo}>{r.no_ritmo}</span>{/if}
                {#if r.em_risco}<span class="em_risco" style:flex={r.em_risco}>{r.em_risco}</span>{/if}
                {#if r.atrasado}<span class="atrasado" style:flex={r.atrasado}>{r.atrasado}</span>{/if}
              </span>
            {/if}
            {#if dificuldade}<span class="dificuldade">{dificuldade}</span>{/if}
          </div>
        {/each}
      </section>

      <section class="cartao saidas">
        <h2>Saídas</h2>
        <a class="saida principal" href="/relatorio"><b>Gerar PDF</b><span>semanal, executivo, período ou seus modelos</span></a>
        <button class="saida" onclick={() => copiarSaida('teams', textoTeams(dados, ctx, notas))}>
          <b>{copiado === 'teams' ? 'Copiado!' : 'Mensagem do Teams'}</b><span>8 a 10 linhas, pronta para colar</span>
        </button>
        <button class="saida" onclick={() => copiarSaida('pacote', textoPacote(dados, ctx, notas))}>
          <b>{copiado === 'pacote' ? 'Copiado!' : 'Pacote para IA'}</b><span>números conferidos + dicionário; a IA só escreve</span>
        </button>
        <div class="backup">
          <button class="link" onclick={() => exportarJson($state.snapshot(dados) as Dados)}>baixar backup</button>
          <button class="link" onclick={() => entradaBackup?.click()}>restaurar backup</button>
          <button class="link" onclick={() => baixarTexto(textoPacote(dados, ctx, notas), `pacote-ia-${dados.prefixo}-${semana}.md`)}>baixar pacote .md</button>
          <a class="link" href="/modelos">modelos de relatório</a>
          <input type="file" accept="application/json" hidden bind:this={entradaBackup} onchange={(e) => restaurar(e.currentTarget.files?.[0])} />
        </div>
      </section>

      <section class="cartao">
        <h2>Listas</h2>
        {#each dados.listas as l (l.id)}
          {@const pr = progressoDaLista(l)}
          <div class="lista-resumo">
            <div class="linha"><b>{l.nome}</b><span class="maquina dica">{pr.concluidos}/{pr.total}</span></div>
            <span class="barra clara"><span style:width="{pr.pct}%"></span></span>
          </div>
        {:else}
          <p class="dica">Checklists suas, como o teste de agendamentos por empresa.</p>
        {/each}
        <a class="link-secao" href="/listas">{dados.listas.length ? 'abrir listas' : 'criar uma lista'}</a>
      </section>

      <section class="cartao">
        <h2>Compromissos com a gestão</h2>
        {#each emAberto as p (p.id)}
          <p class="compromisso">{p.texto}</p>
        {:else}
          <p class="dica">{promessasDaSemana.length ? 'Todos os compromissos da semana têm situação.' : 'Nenhum compromisso registrado nesta semana.'}</p>
        {/each}
        <a class="link-secao" href="/semana">ver na semana</a>
      </section>

      <section class="cartao nuvem">
        <h2>Nuvem</h2>
        {#if nuvem.estado === 'desligada'}
          <p class="dica">Desligada: os dados ficam só neste navegador. Para ligar, preencha a configuração do Firebase (passo a passo no README).</p>
        {:else if nuvem.estado === 'sem_login'}
          <p class="dica">Entre com a conta Google para guardar tudo no Firebase e abrir em outro computador.</p>
          <button onclick={() => entrar().catch((e) => alert(`Não consegui entrar: ${e}`))}>Entrar com Google</button>
        {:else}
          <p class="estado {nuvem.estado}">
            {nuvem.estado === 'sincronizando' ? 'sincronizando...' : nuvem.estado === 'erro' ? 'erro ao sincronizar' : 'tudo guardado na nuvem'}
          </p>
          <p class="dica">{nuvem.email}{nuvem.ultimoEnvio ? ` - último envio ${nuvem.ultimoEnvio.slice(11, 16)}` : ''}</p>
          {#if nuvem.erro}<p class="dica erro">{nuvem.erro}</p>{/if}
          <button class="link" onclick={() => sairDaNuvem()}>sair da nuvem</button>
        {/if}
      </section>
    </aside>
  </div>
</main>

<style>
  main
  {
    max-width: 1180px;
    margin: 0 auto;
    padding: 32px 28px 48px;
  }
  .topo
  {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
  }
  h1
  {
    font-size: 2.8rem;
    margin: 6px 0 0;
    letter-spacing: -0.02em;
  }
  .lema
  {
    margin: 4px 0 0;
    color: var(--suave);
    font-family: var(--fonte-maquina);
  }
  .cursor
  {
    color: var(--marca);
    animation: piscar 1.1s steps(1) infinite;
  }
  @keyframes piscar
  {
    50%
    {
      opacity: 0;
    }
  }
  .regua
  {
    list-style: none;
    padding: 0;
    margin: 22px 0 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .regua li
  {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    background-image: none;
    color: var(--texto);
  }
  .regua li.passou
  {
    opacity: 0.6;
  }
  .regua li.hoje
  {
    background: var(--marca-escura);
    border-color: var(--marca);
    color: #fff;
    opacity: 1;
  }
  .regua .dia
  {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.8rem;
  }
  .regua li.hoje .dia
  {
    color: var(--marca);
  }
  .regua .rotina
  {
    font-size: 0.8rem;
    color: var(--suave);
  }
  .regua li.hoje .rotina
  {
    color: #cfd8d3;
  }
  .marca-foto
  {
    position: absolute;
    top: 8px;
    right: 10px;
    font-family: var(--fonte-maquina);
    font-size: 0.68rem;
    color: var(--marca);
    border: 1px solid var(--marca);
    border-radius: 999px;
    padding: 0 6px;
  }
  .hoje-painel
  {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 18px;
    margin-top: 16px;
    padding: 20px 22px;
    border-radius: var(--raio);
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-left: 5px solid var(--marca);
    box-shadow: var(--sombra);
  }
  .titulo-hoje h2
  {
    font-size: 1.5rem;
    margin: 4px 0 0;
  }
  .acoes
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .acoes li
  {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--borda);
    background: none;
    color: var(--texto);
  }
  .acoes li:last-child
  {
    border-bottom: none;
  }
  .acoes i
  {
    flex: 0 0 9px;
    height: 9px;
    border-radius: 2px;
    background: var(--marca);
  }
  .acoes .alto i
  {
    background: var(--vermelho);
  }
  .acoes .medio i
  {
    background: var(--amarelo);
  }
  .acoes span
  {
    flex: 1;
  }
  .acoes a
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    color: var(--marca);
    font-size: 0.85rem;
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 16px;
  }
  .kpi
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--marca-escura);
    color: #fff;
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 18px;
    text-decoration: none;
    min-height: 150px;
  }
  .kpi .etiqueta
  {
    color: #b9b6b0;
  }
  .kpi .valor
  {
    font-family: var(--fonte-maquina);
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    color: #fff;
  }
  .kpi .detalhe
  {
    font-size: 0.82rem;
    color: #d5d2cc;
    flex: 1;
  }
  .kpi .detalhe b
  {
    color: var(--marca);
  }
  .kpi .detalhe b.abaixo
  {
    color: #f5c542;
  }
  .kpi.alerta .valor
  {
    color: #f5c542;
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: rgb(150 150 150 / 25%);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
  }
  .colunas
  {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 18px;
  }
  .pilha
  {
    display: flex;
    flex-direction: column;
  }
  .frases
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .frases li
  {
    display: flex;
    gap: 10px;
    align-items: baseline;
    background: none;
    color: var(--texto);
    padding: 7px 0;
    border-bottom: 1px dashed var(--borda);
    font-size: 0.92rem;
  }
  .frases i
  {
    flex: 0 0 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--borda-forte);
  }
  .frases .positivo i
  {
    background: var(--verde);
  }
  .frases .atencao i
  {
    background: var(--amarelo);
  }
  .pessoa
  {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 0;
    border-bottom: 1px dashed var(--borda);
  }
  .pessoa .linha
  {
    display: flex;
    justify-content: space-between;
  }
  .estourou
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  .barra-ritmo
  {
    display: flex;
    height: 16px;
    border-radius: 4px;
    overflow: hidden;
    font-family: var(--fonte-maquina);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .barra-ritmo span
  {
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .barra-ritmo .no_ritmo
  {
    background: var(--verde);
  }
  .barra-ritmo .em_risco
  {
    background: var(--amarelo);
  }
  .barra-ritmo .atrasado
  {
    background: var(--vermelho);
  }
  .dificuldade
  {
    font-size: 0.8rem;
    color: var(--suave);
    font-style: italic;
  }
  .dia-tempo
  {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--borda);
  }
  .dia-tempo .data
  {
    font-weight: 700;
    color: var(--marca);
  }
  .dia-tempo ul
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .dia-tempo li
  {
    padding: 2px 0;
    font-size: 0.88rem;
    background: none;
    color: var(--texto);
  }
  .dia-tempo .tipo
  {
    color: var(--suave);
    font-size: 0.75rem;
  }
  .dia-tempo .risco .tipo, .dia-tempo .previsao .tipo, .dia-tempo .ritmo .tipo
  {
    color: var(--amarelo);
  }
  .dia-tempo .entrega .tipo, .dia-tempo .etapa .tipo
  {
    color: var(--verde);
  }
  .saidas
  {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .saida
  {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--borda);
    background: var(--superficie);
    color: var(--texto);
    text-decoration: none;
    font-family: inherit;
  }
  .saida b
  {
    font-family: var(--fonte-maquina);
  }
  .saida span
  {
    font-size: 0.8rem;
    color: var(--suave);
  }
  .saida:hover
  {
    border-color: var(--marca);
    background: var(--marca-clara);
    color: var(--texto);
  }
  .saida.principal
  {
    background: var(--marca);
    border-color: var(--marca);
    color: var(--sobre-marca);
  }
  .saida.principal span
  {
    color: var(--sobre-marca);
  }
  .saida.principal:hover
  {
    filter: brightness(1.1);
    color: var(--sobre-marca);
  }
  .backup
  {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
  }
  .colunas-fluxo
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .colunas-fluxo h3
  {
    font-size: 0.85rem;
    margin: 0 0 8px;
  }
  .linha-fluxo
  {
    font-size: 0.86rem;
    margin: 0 0 6px;
  }
  .linha-fluxo .dica
  {
    display: block;
    font-size: 0.78rem;
  }
  .veredito
  {
    font-weight: 700;
    margin: 0 0 4px;
  }
  .veredito.bate
  {
    color: var(--verde);
  }
  .veredito.perto
  {
    color: var(--amarelo);
  }
  .veredito.nao_bate
  {
    color: var(--vermelho);
  }
  @media (max-width: 900px)
  {
    .colunas-fluxo
    {
      grid-template-columns: 1fr;
    }
  }
  .nuvem .estado
  {
    font-weight: 600;
    margin: 0;
  }
  .nuvem .ok
  {
    color: var(--verde);
  }
  .nuvem .erro
  {
    color: var(--vermelho);
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
  .compromisso
  {
    margin: 0;
    padding: 6px 0;
    border-bottom: 1px dashed var(--borda);
    font-size: 0.9rem;
  }
  .link-secao
  {
    display: inline-block;
    margin-top: 8px;
    color: var(--marca);
    font-size: 0.85rem;
  }
  .grafico
  {
    overflow-x: auto;
  }
  .grafico :global(svg)
  {
    max-width: 100%;
    height: auto;
  }
  @media (max-width: 900px)
  {
    .kpis
    {
      grid-template-columns: repeat(2, 1fr);
    }
    .regua
    {
      grid-template-columns: repeat(5, minmax(90px, 1fr));
      overflow-x: auto;
    }
    .colunas, .hoje-painel
    {
      grid-template-columns: 1fr;
    }
  }
  /* fundo de grade discreto, como papel quadriculado de terminal */
  main
  {
    background-image: linear-gradient(var(--grade-fundo) 1px, transparent 1px), linear-gradient(90deg, var(--grade-fundo) 1px, transparent 1px);
    background-size: 28px 28px;
    background-position: -1px -1px;
  }
  .prompt
  {
    font-family: var(--fonte-maquina);
    font-size: 0.85rem;
    color: var(--marca);
  }
  .topo-direita
  {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .status
  {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin: 18px 0 0;
  }
  .status li
  {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 6px 12px;
    border: 1px solid var(--borda);
    border-left: 3px solid var(--marca);
    border-radius: 8px;
    background: var(--superficie);
    font-size: 0.8rem;
  }
  .status span
  {
    color: var(--suave);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.7rem;
  }
  .status li.aviso
  {
    border-left-color: var(--amarelo);
  }
  .status li.ok b
  {
    color: var(--verde);
  }
  /* coluna principal e lateral: sem buraco entre as duas */
  .grade
  {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  /* títulos dos quadros como comentário de código */
  .grade .cartao > h2::before
  {
    content: '// ';
    color: var(--marca);
  }
  .grade .cartao
  {
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .grade .cartao:hover
  {
    border-color: rgb(18 164 84 / 35%);
    box-shadow: var(--sombra), 0 0 0 3px rgb(18 164 84 / 6%);
  }
  .kpi
  {
    position: relative;
    overflow: hidden;
    border-top: 2px solid var(--marca);
  }
  .kpi::after
  {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 100% 0%, rgb(18 164 84 / 18%), transparent 55%);
    pointer-events: none;
  }
  .kpi.alerta
  {
    border-top-color: #f5c542;
  }
  .projecao
  {
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--fundo);
    margin-bottom: 16px;
  }
  .projecao p
  {
    margin: 0;
  }
  .projecao .dica
  {
    margin-top: 4px;
  }
  .lista-resumo
  {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }
  .lista-resumo .linha
  {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  @media (max-width: 900px)
  {
    .grade
    {
      grid-template-columns: 1fr;
    }
  }
</style>
