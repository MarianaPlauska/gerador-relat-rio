<script lang="ts">
  import
  {
    acoesDeHoje, aplicarControle, definicoesPadrao, diasUteisEntre, historico, linhaDoTempo, progressoDaLista, resumoDoFluxo, ritmoPorPessoa, segundaDaSemana, serieSemanal, somarDias, textoProjecao,
    type Destino, type Evento, type TotaisPainel,
  } from '@supervisao/core';
  import { Tabs } from 'bits-ui';
  import { carregar, type NotasRelatorio } from '#lib/armazenamento.ts';
  import { svgLinha, svgSparkline } from '#lib/graficos.ts';
  import { nuvem, sairDaNuvem } from '#lib/nuvem.svelte.ts';
  import { baixarTexto, copiar, textoPacote, textoTeams } from '#lib/saidas.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, semanasDisponiveis } from '#lib/semana.ts';
  import { lerSessao } from '#lib/sessao.ts';

  const dados = carregar();
  const dia = hoje();
  let semana = $state(segundaDaSemana(dia));
  let copiado = $state('');
  let abaSemana = $state('percebido');
  let abaLateral = $state('listas');

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

  const rotas: Record<Destino, string> = { painel: '/painel', semana: '/semana', cards: '/cards', relatorio: '/relatorio', listas: '/listas' };
  const iconeEvento: Record<Evento['tipo'], string> = {
    foto: '[foto]', etapa: '[etapa]', previsao: '[previsão]', ritmo: '[ritmo]', entrou: '[entrou]', saiu: '[saiu]', plano: '[plano]', entrega: '[entrega]', risco: '[risco]',
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || '').split(' ')[0]);

  const ultimaFoto = $derived([...dados.fotos].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);
  // atenção primeiro: com a lista recolhida, o que importa aparece
  const ordemTom = { atencao: 0, positivo: 1, neutro: 2 };
  const frasesOrdenadas = $derived([...ctx.frases].sort((a, b) => ordemTom[a.tom] - ordemTom[b.tom]));
  let todasFrases = $state(false);

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
</script>

<main>
  <header>
    <div>
      <span class="prompt">&gt; {saudacao.toLowerCase()}{primeiroNome ? `, ${primeiroNome.toLowerCase()}` : ''}</span>
      <h1>Início<span class="cursor">_</span></h1>
    </div>
    <select bind:value={semana} aria-label="Semana">
      {#each semanasDisponiveis(dados) as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
    </select>
  </header>

  {#if !ultimaFoto}
    <p class="aviso">Nenhuma foto do painel ainda. <a href="/painel">Colar o painel</a> para começar.</p>
  {:else if diasDesdeFoto >= 2}
    <p class="aviso">A última foto do painel é de {dataCurta(ultimaFoto.data)}, há {diasDesdeFoto} dias úteis. <a href="/painel">Colar o painel</a></p>
  {/if}

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
    <div class="coluna">
      <section class="cartao">
        <h2>O que fazer</h2>
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

      {#if serie('dentroDoPrazoPct').length >= 2}
        <section class="cartao">
          <h2>Evolução do prazo</h2>
          <div class="grafico">{@html svgLinha(serie('dentroDoPrazoPct').map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { meta: ctx.meta, sufixo: '%', largura: 760 })}</div>
        </section>
      {/if}

      <section class="cartao">
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
        <h2>Esta semana</h2>
        <Tabs.Root bind:value={abaSemana}>
          <Tabs.List class="abas">
            <Tabs.Trigger value="percebido" class="aba">O que o sistema percebeu ({ctx.frases.length})</Tabs.Trigger>
            <Tabs.Trigger value="tempo" class="aba">Linha do tempo</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="percebido">
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
          </Tabs.Content>
          <Tabs.Content value="tempo">
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
          </Tabs.Content>
        </Tabs.Root>
      </section>
    </div>

    <aside class="coluna">
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
        <button class="link" onclick={() => baixarTexto(textoPacote(dados, ctx, notas), `pacote-ia-${dados.prefixo}-${semana}.md`)}>baixar pacote .md</button>
      </section>

      <section class="cartao">
        <h2>Em andamento</h2>
        <Tabs.Root bind:value={abaLateral}>
          <Tabs.List class="abas">
            <Tabs.Trigger value="listas" class="aba">Listas</Tabs.Trigger>
            <Tabs.Trigger value="compromissos" class="aba">Compromissos{emAberto.length ? ` (${emAberto.length})` : ''}</Tabs.Trigger>
            <Tabs.Trigger value="conta" class="aba">Conta</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="listas">
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
          </Tabs.Content>
          <Tabs.Content value="compromissos">
            {#each emAberto as p (p.id)}
              <p class="compromisso">{p.texto}</p>
            {:else}
              <p class="dica">{promessasDaSemana.length ? 'Todos os compromissos da semana têm situação.' : 'Nenhum compromisso registrado nesta semana.'}</p>
            {/each}
            <a class="link-secao" href="/semana">ver na semana</a>
          </Tabs.Content>
          <Tabs.Content value="conta">
            {#if nuvem.estado === 'desligada'}
              <p class="dica">Nuvem desligada: os dados ficam só neste navegador.</p>
            {:else if nuvem.estado === 'sem_login'}
              <p class="dica">Entre na sua conta para guardar tudo na nuvem e abrir em outro computador.</p>
              <a class="botao" href="/entrar">Entrar ou criar conta</a>
            {:else}
              <p class="estado {nuvem.estado}">
                {nuvem.estado === 'sincronizando' ? 'sincronizando...' : nuvem.estado === 'erro' ? 'erro ao sincronizar' : 'tudo guardado na nuvem'}
              </p>
              <p class="dica">{nuvem.email} - <a href="/perfil">perfil</a>{nuvem.ultimoEnvio ? ` - último envio ${nuvem.ultimoEnvio.slice(11, 16)}` : ''}</p>
              {#if nuvem.erro}<p class="dica erro">{nuvem.erro}</p>{/if}
              <button class="link" onclick={() => sairDaNuvem()}>sair da nuvem</button>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      </section>
    </aside>
  </div>
</main>

<style>
  /* fundo de grade discreto, como papel quadriculado de terminal */
  main
  {
    background-image: linear-gradient(var(--grade-fundo) 1px, transparent 1px), linear-gradient(90deg, var(--grade-fundo) 1px, transparent 1px);
    background-size: 28px 28px;
    background-position: -1px -1px;
  }
  header > div
  {
    margin-right: auto;
  }
  .aviso a
  {
    color: inherit;
    font-weight: 700;
  }
  .aviso
  {
    margin: 0 0 var(--size-4);
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--size-4);
  }
  .kpi
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-1);
    background: var(--superficie);
    color: var(--texto);
    border: 1px solid var(--borda);
    border-top: 2px solid var(--marca);
    border-radius: var(--raio);
    padding: var(--size-4);
    text-decoration: none;
    min-height: 140px;
    transition: border-color 0.2s;
  }
  a.kpi:hover
  {
    border-color: var(--marca);
  }
  .kpi .valor
  {
    font-family: var(--fonte-maquina);
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1;
  }
  .kpi .detalhe
  {
    font-size: 0.82rem;
    color: var(--suave);
    flex: 1;
  }
  .kpi .detalhe b
  {
    color: var(--verde);
  }
  .kpi .detalhe b.abaixo
  {
    color: var(--amarelo);
  }
  .kpi.alerta
  {
    border-top-color: var(--amarelo);
  }
  .kpi.alerta .valor
  {
    color: var(--amarelo);
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--borda);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
  }
  /* coluna principal e lateral: sem buraco entre as duas */
  .grade
  {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: var(--size-4);
    align-items: start;
    margin-top: var(--size-4);
  }
  .coluna
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    min-width: 0;
  }
  .coluna .cartao
  {
    margin-top: 0;
    transition: border-color 0.2s;
  }
  .coluna .cartao:hover
  {
    border-color: color-mix(in srgb, var(--marca) 40%, var(--borda));
  }
  /* títulos dos quadros como comentário de código */
  .coluna .cartao > h2::before
  {
    content: '// ';
    color: var(--marca);
  }
  .acoes, .frases
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .acoes li, .frases li
  {
    display: flex;
    align-items: baseline;
    gap: var(--size-2);
    padding: var(--size-2) 0;
    border-bottom: 1px dashed var(--borda);
    background: none;
    color: var(--texto);
  }
  .acoes li:last-child, .frases li:last-child
  {
    border-bottom: none;
  }
  .frases li
  {
    font-size: 0.92rem;
  }
  .acoes i, .frases i
  {
    flex: 0 0 9px;
    height: 9px;
    background: var(--marca);
    border-radius: 2px;
  }
  .frases i
  {
    border-radius: 50%;
    background: var(--borda-forte);
  }
  .acoes .alto i
  {
    background: var(--vermelho);
  }
  .acoes .medio i
  {
    background: var(--amarelo);
  }
  .frases .positivo i
  {
    background: var(--verde);
  }
  .frases .atencao i
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
    font-size: 0.85rem;
  }
  .projecao
  {
    padding: var(--size-3);
    border-radius: var(--raio-pequeno);
    background: var(--fundo);
    margin-bottom: var(--size-4);
  }
  .projecao p
  {
    margin: 0;
  }
  .projecao .dica
  {
    margin-top: var(--size-1);
  }
  .veredito
  {
    font-weight: 700;
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
  .colunas-fluxo
  {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--size-5);
  }
  .colunas-fluxo h3
  {
    font-size: 0.85rem;
    margin: 0 0 var(--size-2);
  }
  .linha-fluxo
  {
    font-size: 0.86rem;
    margin: 0 0 var(--size-2);
  }
  .linha-fluxo .dica
  {
    display: block;
    font-size: 0.78rem;
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
  /* abas do Bits UI */
  :global(.abas)
  {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-1);
    margin-bottom: var(--size-3);
    border-bottom: 1px solid var(--borda);
  }
  :global(.aba)
  {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: var(--size-1) var(--size-3);
    font-size: 0.82rem;
    color: var(--suave);
    margin-bottom: -1px;
  }
  :global(.aba:hover:not(:disabled))
  {
    color: var(--texto);
    border-color: transparent transparent var(--borda-forte);
  }
  :global(.aba[data-state='active'])
  {
    color: var(--marca);
    border-bottom-color: var(--marca);
  }
  .pessoa
  {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: var(--size-3) 0;
    border-bottom: 1px dashed var(--borda);
  }
  .pessoa:last-child
  {
    border-bottom: none;
  }
  .linha
  {
    display: flex;
    justify-content: space-between;
    gap: var(--size-2);
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
    color: #10141a;
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
    gap: var(--size-2);
    padding: var(--size-2) 0;
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
    background: none;
    color: var(--texto);
    padding: 2px 0;
    font-size: 0.88rem;
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
    gap: var(--size-2);
  }
  .saida
  {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: var(--size-3);
    border-radius: var(--raio-pequeno);
    border: 1px solid var(--borda);
    background: var(--superficie-2);
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
  }
  .lista-resumo
  {
    display: grid;
    gap: 6px;
    margin-bottom: var(--size-3);
  }
  .estado
  {
    font-weight: 600;
    margin: 0;
  }
  .estado.ok
  {
    color: var(--verde);
  }
  .dica.erro
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
    justify-self: start;
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
    margin-top: var(--size-2);
    font-size: 0.85rem;
  }
  @media (max-width: 900px)
  {
    .kpis
    {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .grade, .colunas-fluxo
    {
      grid-template-columns: 1fr;
    }
  }
</style>
