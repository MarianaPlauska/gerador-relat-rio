<script lang="ts">
  import { goto } from '$app/navigation';
  import { agoraLocal, historico, novoVivo, type TotaisPainel } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { svgLinha } from '#lib/graficos.ts';
  import { contextoDoRelatorio, dataCurta, hoje } from '#lib/semana.ts';

  const dados = $state<Dados>(carregar());
  const dia = hoje();
  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const rotuloMes = (ym: string) => `${nomesMes[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
  const fimDoMes = (ym: string) => `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;

  const meses = [...new Set([dia.slice(0, 7), ...dados.fotos.map((f) => f.data.slice(0, 7)), ...dados.planos.map((p) => p.inicio.slice(0, 7))])].sort().reverse();
  let mes = $state(meses[0]!);

  const inicio = $derived(`${mes}-01`);
  const fim = $derived(fimDoMes(mes));
  const ctx = $derived(contextoDoRelatorio(dados, { inicio, fim, livre: true }));
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const ta = $derived<TotaisPainel>(ctx.anterior?.foto?.totais ?? {});
  const fotosDoMes = $derived(dados.fotos.filter((f) => f.data >= inicio && f.data <= fim));
  const serie = $derived(historico(fotosDoMes, 'dentroDoPrazoPct'));
  const kp = $derived(ctx.comp.planoAtual);
  const cumpridas = $derived(ctx.promessas.filter((p) => p.cumprida === true).length);
  const naoCumpridas = $derived(ctx.promessas.filter((p) => p.cumprida === false).length);
  const emAberto = $derived(ctx.promessas.filter((p) => p.cumprida === undefined).length);
  const riscosAbertos = $derived(dados.riscos.filter((r) => r.status === 'aberto'));
  const atencao = $derived(ctx.frases.filter((f) => f.tom === 'atencao'));
  const positivas = $derived(ctx.frases.filter((f) => f.tom === 'positivo'));

  const delta = (a?: number, b?: number, sufixo = '') => (a === undefined || b === undefined ? '' : `${a - b > 0 ? '+' : ''}${Math.round((a - b) * 10) / 10}${sufixo} no mês`);

  function gerarRelatorio()
  {
    dados.ultimoModelo = 'periodo';
    salvar($state.snapshot(dados));
    goto(`/relatorio?de=${inicio}&ate=${fim}`);
  }

  function criarVivo()
  {
    const v = novoVivo(`Relatório de ${rotuloMes(mes)}`, 'periodo', inicio, fim, true, agoraLocal());
    dados.vivos.push(v);
    salvar($state.snapshot(dados));
    goto(`/vivos?id=${v.id}`);
  }
</script>

<main>
  <header>
    <div>
      <span class="prompt">&gt; mes</span>
      <h1>Visão do mês<span class="cursor">_</span></h1>
    </div>
    <select bind:value={mes} aria-label="Mês">
      {#each meses as m (m)}<option value={m}>{rotuloMes(m)}</option>{/each}
    </select>
    <button onclick={criarVivo}>Criar checklist diário do mês</button>
    <button class="principal" onclick={gerarRelatorio}>Gerar relatório do mês</button>
  </header>

  {#if !ctx.atual.foto && !ctx.atual.plano}
    <p class="aviso">Sem foto do painel nem plano em {rotuloMes(mes)}.</p>
  {/if}

  <section class="kpis">
    <div class="kpi">
      <span class="etiqueta">dentro do prazo</span>
      <span class="valor">{t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}%` : '-'}</span>
      <span class="detalhe">
        {#if ctx.meta !== undefined && t.dentroDoPrazoPct !== undefined}meta {ctx.meta}% · <b class:abaixo={t.dentroDoPrazoPct < ctx.meta}>{t.dentroDoPrazoPct - ctx.meta >= 0 ? '+' : ''}{t.dentroDoPrazoPct - ctx.meta} pp</b> · {/if}{delta(t.dentroDoPrazoPct, ta.dentroDoPrazoPct, ' pp')}
      </span>
    </div>
    <div class="kpi">
      <span class="etiqueta">concluídos</span>
      <span class="valor">{t.concluidos ?? '-'}</span>
      <span class="detalhe">{t.itensCronograma !== undefined ? `de ${t.itensCronograma} itens · ` : ''}{delta(t.concluidos, ta.concluidos)}</span>
    </div>
    <div class="kpi">
      <span class="etiqueta">planos do mês</span>
      <span class="valor">{kp ? `${kp.feitos}/${kp.planejados}` : '-'}</span>
      <span class="detalhe">{kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% feito` : 'sem plano no mês'}</span>
    </div>
    <div class="kpi" class:alerta={naoCumpridas > 0}>
      <span class="etiqueta">compromissos</span>
      <span class="valor">{cumpridas}/{ctx.promessas.length}</span>
      <span class="detalhe">{naoCumpridas} não {naoCumpridas === 1 ? 'cumprido' : 'cumpridos'} · {emAberto} em aberto</span>
    </div>
  </section>

  <div class="grade">
    <div class="coluna">
      <section class="cartao">
        <h2>Prazo, semana a semana</h2>
        {#if serie.length >= 2}
          <div class="grafico">{@html svgLinha(serie.map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor })), { meta: ctx.meta, sufixo: '%', largura: 760 })}</div>
        {:else}
          <p class="dica">O gráfico precisa de pelo menos 2 fotos do painel no mês ({fotosDoMes.length} agora).</p>
        {/if}
      </section>

      <section class="cartao">
        <h2>Time no mês</h2>
        <table>
          <thead><tr><th>Pessoa</th><th class="num">Feitos</th><th class="num">% feito</th><th class="num">Alterados</th><th class="num">Horas</th><th class="num">Alertas</th></tr></thead>
          <tbody>
            {#each ctx.comp.pessoas.filter((x) => x.atual.planejados > 0 || x.horas > 0) as x (x.pessoa.id)}
              <tr>
                <td><b>{x.pessoa.nome}</b></td>
                <td class="num">{x.atual.feitos}/{x.atual.planejados}</td>
                <td class="num">{x.atual.pctFeitos ?? '-'}{x.atual.pctFeitos !== undefined ? '%' : ''}</td>
                <td class="num">{x.atual.alterados}</td>
                <td class="num">{x.horas}h</td>
                <td class="num" class:ruim={x.alertas > 0}>{x.alertas}</td>
              </tr>
            {:else}
              <tr><td colspan="6" class="dica">Nenhum plano no mês.</td></tr>
            {/each}
          </tbody>
        </table>
      </section>
    </div>

    <aside class="coluna">
      <section class="cartao">
        <h2>Pontos de atenção ({atencao.length})</h2>
        <ul class="frases">
          {#each atencao.slice(0, 6) as f, i (i)}<li><i class="atencao"></i>{f.texto}</li>{:else}<li class="dica">Nada pede atenção no período.</li>{/each}
        </ul>
      </section>
      <section class="cartao">
        <h2>Pontos positivos ({positivas.length})</h2>
        <ul class="frases">
          {#each positivas.slice(0, 5) as f, i (i)}<li><i class="positivo"></i>{f.texto}</li>{:else}<li class="dica">Sem pontos positivos registrados.</li>{/each}
        </ul>
      </section>
      <section class="cartao">
        <h2>Riscos abertos ({riscosAbertos.length})</h2>
        <ul class="frases">
          {#each riscosAbertos.slice(0, 5) as r (r.id)}<li><i class="atencao"></i>{r.descricao}</li>{:else}<li class="dica">Nenhum risco aberto.</li>{/each}
        </ul>
      </section>
    </aside>
  </div>
</main>

<style>
  header > div
  {
    margin-right: auto;
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
    border: 1px solid var(--borda);
    border-top: 2px solid var(--marca);
    border-radius: var(--raio);
    padding: var(--size-4);
    min-height: 120px;
  }
  .kpi.alerta
  {
    border-top-color: var(--amarelo);
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
  }
  .kpi .detalhe b
  {
    color: var(--verde);
  }
  .kpi .detalhe b.abaixo
  {
    color: var(--amarelo);
  }
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
  }
  .coluna .cartao > h2::before
  {
    content: '// ';
    color: var(--marca);
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
  .frases
  {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .frases li
  {
    display: flex;
    gap: var(--size-2);
    align-items: baseline;
    padding: var(--size-2) 0;
    border-bottom: 1px dashed var(--borda);
    font-size: 0.9rem;
    background: none;
    color: var(--texto);
  }
  .frases li:last-child
  {
    border-bottom: none;
  }
  .frases i
  {
    flex: 0 0 9px;
    height: 9px;
    border-radius: 50%;
  }
  .frases i.atencao
  {
    background: var(--amarelo);
  }
  .frases i.positivo
  {
    background: var(--verde);
  }
  .frases .dica
  {
    color: var(--suave);
  }
  .ruim
  {
    color: var(--vermelho);
    font-weight: 700;
  }
  @media (max-width: 900px)
  {
    .kpis
    {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .grade
    {
      grid-template-columns: 1fr;
    }
  }
</style>
