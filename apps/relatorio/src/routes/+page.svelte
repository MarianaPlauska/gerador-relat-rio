<script lang="ts">
  import { historico, segundaDaSemana, somarDias, type TotaisPainel } from '@supervisao/core';
  import { carregar, type Dados } from '#lib/armazenamento.ts';
  import { svgLinha, svgSparkline } from '#lib/graficos.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, semanasDisponiveis } from '#lib/semana.ts';

  const dados: Dados = carregar();
  let semana = $state(segundaDaSemana(hoje()));

  const ctx = $derived(contextoDaSemana(dados, semana));
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const ta = $derived<TotaisPainel>(ctx.anterior?.foto?.totais ?? {});
  const plano = $derived(ctx.atual.plano);
  const kp = $derived(ctx.comp.planoAtual);
  const fotosAteSemana = $derived(dados.fotos.filter((f) => f.data <= ctx.sexta));
  const serie = (chave: keyof TotaisPainel) => historico(fotosAteSemana, chave).slice(-8);

  const passos = $derived([
    {
      n: '01', titulo: 'Colar o painel', href: '/painel', feito: !!ctx.atual.foto,
      texto: ctx.atual.foto
        ? `Foto de ${dataCurta(ctx.atual.foto.data)}: ${ctx.atual.foto.cards.length} cards e ${Object.keys(ctx.atual.foto.totais).length} números.`
        : 'Copie ou tire print do painel do gestor e cole.',
    },
    {
      n: '02', titulo: 'Planejar a semana', href: '/semana', feito: !!plano?.confirmadoEm,
      texto: plano ? (plano.confirmadoEm ? `Plano confirmado com ${kp?.planejados ?? 0} itens.` : 'Plano começado, falta confirmar.') : 'O que cada pessoa vai fazer, até quando e para quê.',
    },
    {
      n: '03', titulo: 'Fechar a semana', href: '/semana', feito: !!plano?.fechadoEm,
      texto: plano?.fechadoEm ? `${kp?.feitos ?? 0} de ${kp?.planejados ?? 0} itens feitos.` : 'Na sexta: o que saiu, o que não saiu e por quê.',
    },
    { n: '04', titulo: 'Gerar o relatório', href: '/relatorio', feito: false, texto: 'PDF com o comparativo da semana anterior.' },
  ]);

  function variacao(chave: keyof TotaisPainel, sufixo = ''): string
  {
    const a = ta[chave];
    const b = t[chave];
    if (a === undefined || b === undefined) return '';
    const d = b - a;
    return `${d > 0 ? '+' : ''}${d}${sufixo} na semana`;
  }
</script>

<main>
  <section class="topo">
    <div>
      <span class="etiqueta">semana de {dataMedia(semana)} a {dataMedia(ctx.sexta)}</span>
      <h1>Visão da semana<span class="cursor">_</span></h1>
    </div>
    <div class="acoes">
      <select bind:value={semana} aria-label="Semana">
        {#each semanasDisponiveis(dados) as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
      </select>
      <a class="botao-principal" href="/relatorio">Gerar relatório</a>
    </div>
  </section>

  <section class="passos">
    {#each passos as p (p.n)}
      <a class="passo" class:feito={p.feito} href={p.href}>
        <span class="n">{p.n}</span>
        <b>{p.titulo}</b>
        <span class="estado">{p.feito ? 'feito' : 'pendente'}</span>
        <p>{p.texto}</p>
      </a>
    {/each}
  </section>

  <section class="kpis">
    <div class="kpi">
      <span class="etiqueta">dentro do prazo</span>
      <span class="valor">{t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}%` : '-'}</span>
      <span class="detalhe">{ctx.meta !== undefined ? `meta ${ctx.meta}%` : ''} {variacao('dentroDoPrazoPct', ' pp')}</span>
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

  <div class="colunas">
    <section class="cartao">
      <h2>O que o sistema percebeu</h2>
      {#if ctx.frases.length}
        <ul class="frases">
          {#each ctx.frases as f, i (i)}<li class={f.tom}><i></i>{f.texto}</li>{/each}
        </ul>
      {:else}
        <p class="dica">Cole o painel e monte o plano para o sistema comparar com a semana anterior.</p>
      {/if}
    </section>

    <section class="cartao">
      <h2>Time</h2>
      {#each ctx.comp.pessoas as p (p.pessoa.id)}
        <div class="pessoa">
          <div class="linha">
            <b>{p.pessoa.nome}</b>
            {#if p.alertas}<span class="pilula vermelho">{p.alertas} {p.alertas === 1 ? 'alerta' : 'alertas'}</span>{/if}
          </div>
          <span class="barra"><span style:width="{p.atual.pctFeitos ?? 0}%"></span></span>
          <span class="dica maquina">
            {p.atual.feitos}/{p.atual.planejados} feitos · <span class:estourou={p.horas > p.pessoa.capacidadeHorasSemana}>{p.horas}h de {p.pessoa.capacidadeHorasSemana}h</span>
          </span>
        </div>
      {/each}
    </section>
  </div>

  {#if serie('dentroDoPrazoPct').length >= 2}
    <section class="cartao">
      <h2>Evolução do prazo</h2>
      <div class="grafico">{@html svgLinha(serie('dentroDoPrazoPct').map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { meta: ctx.meta, sufixo: '%', largura: 1100 })}</div>
    </section>
  {/if}
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
    font-size: 2.3rem;
    margin: 6px 0 0;
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
  .acoes
  {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .botao-principal
  {
    font-family: var(--fonte-maquina);
    font-weight: 700;
    background: var(--marca);
    color: #fff;
    text-decoration: none;
    padding: 9px 20px;
    border-radius: 999px;
  }
  .botao-principal:hover
  {
    background: #0b7d40;
  }
  .passos
  {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 26px;
  }
  .passo
  {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px 18px;
    color: inherit;
    text-decoration: none;
    box-shadow: var(--sombra);
    transition: transform 0.15s, border-color 0.15s;
  }
  .passo:hover
  {
    transform: translateY(-2px);
    border-color: var(--marca);
  }
  .passo .n
  {
    font-family: var(--fonte-maquina);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--marca);
  }
  .passo b
  {
    font-family: var(--fonte-maquina);
    font-size: 1.05rem;
  }
  .passo p
  {
    margin: 4px 0 0;
    font-size: 0.85rem;
    color: var(--suave);
  }
  .estado
  {
    position: absolute;
    top: 16px;
    right: 16px;
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--suave);
    border: 1px dashed var(--borda);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .passo.feito
  {
    border-top: 4px solid var(--verde);
  }
  .passo.feito .estado
  {
    color: var(--verde);
    border: 1px solid var(--verde);
  }
  .kpis
  {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 18px;
  }
  .kpi
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--marca-escura);
    color: #fff;
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
    background: var(--cinza, #b8b4ad);
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
    .passos, .kpis
    {
      grid-template-columns: repeat(2, 1fr);
    }
    .colunas
    {
      grid-template-columns: 1fr;
    }
  }
</style>
