<script lang="ts">
  import
  {
    barrasDaSemana, eventosDoCronograma, eventosNoDia, gradeDoMes, pontosDoDia, tiposEventoCalendario,
    type EventoCalendario, type TipoEventoCalendario,
  } from '@supervisao/core';
  import { tick } from 'svelte';
  import { carregar } from '#lib/armazenamento.ts';
  import { hoje } from '#lib/semana.ts';

  const dados = carregar();
  const hojeIso = hoje();
  const limitePontos = 4;
  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomesSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const nomeTipo = Object.fromEntries(tiposEventoCalendario.map((tipo) => [tipo.id, tipo.nome])) as Record<TipoEventoCalendario, string>;

  let mes = $state(hojeIso.slice(0, 7));
  let diaAberto = $state<string | null>(hojeIso);
  let mostrarConcluidos = $state(false);
  let ativos = $state<Record<TipoEventoCalendario, boolean>>({
    vencimento: true,
    previsao: true,
    inicio: true,
    onda: true,
    plano: true,
    combinado: true,
    risco: true,
    ausencia: true,
    reuniao: true,
  });

  const rotuloMes = (ym: string) =>
  {
    const nome = nomesMes[Number(ym.slice(5, 7)) - 1] ?? '';
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ym.slice(0, 4)}`;
  };

  function rotuloDia(iso: string): string
  {
    const ano = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    const d = Number(iso.slice(8, 10));
    const semana = nomesSemana[new Date(Date.UTC(ano, m - 1, d)).getUTCDay()] ?? '';
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${d} de ${nomesMes[m - 1] ?? ''}`;
  }

  function mudarMes(delta: number)
  {
    const ano = Number(mes.slice(0, 4));
    const m = Number(mes.slice(5, 7));
    mes = new Date(Date.UTC(ano, m - 1 + delta, 1)).toISOString().slice(0, 7);
  }

  function irParaHoje()
  {
    mes = hojeIso.slice(0, 7);
    diaAberto = hojeIso;
  }

  function alternar(tipo: TipoEventoCalendario)
  {
    ativos[tipo] = !ativos[tipo];
  }

  function atrasado(evento: EventoCalendario): boolean
  {
    return !evento.concluido && evento.fim < hojeIso && evento.tipo !== 'ausencia' && evento.tipo !== 'reuniao' && evento.tipo !== 'inicio' && evento.tipo !== 'onda';
  }

  const texto = (evento: EventoCalendario) => [evento.titulo, evento.detalhe].filter(Boolean).join(' · ');

  const grade = $derived(gradeDoMes(mes));
  const eventos = $derived(eventosDoCronograma(dados));
  const candidatos = $derived(eventos.filter((evento) => (mostrarConcluidos || !evento.concluido) && evento.inicio <= grade.fim && evento.fim >= grade.inicio));
  const filtrados = $derived(eventos.filter((evento) => ativos[evento.tipo] && (mostrarConcluidos || !evento.concluido)));
  const noMes = $derived(candidatos.filter((evento) => ativos[evento.tipo]));
  const ocultos = $derived(mostrarConcluidos ? 0 : eventos.filter((evento) => ativos[evento.tipo] && evento.concluido && evento.inicio <= grade.fim && evento.fim >= grade.inicio).length);
  const contagem = $derived.by(() =>
  {
    const mapa = {} as Record<TipoEventoCalendario, number>;
    for (const tipo of tiposEventoCalendario) mapa[tipo.id] = candidatos.filter((evento) => evento.tipo === tipo.id).length;
    return mapa;
  });
  const vista = $derived(grade.semanas.map((dias) =>
  {
    const barras = barrasDaSemana(filtrados, dias);
    return {
      id: dias[0] ?? '',
      barras,
      faixas: barras.reduce((max, barra) => Math.max(max, barra.faixa + 1), 0),
      celulas: dias.map((iso, indice) =>
      {
        const pontos = pontosDoDia(filtrados, iso);
        return {
          iso,
          numero: Number(iso.slice(8, 10)),
          fora: !iso.startsWith(mes),
          fimDeSemana: indice >= 5,
          pontos: pontos.slice(0, limitePontos),
          extra: Math.max(0, pontos.length - limitePontos),
        };
      }),
    };
  }));
  const agenda = $derived.by(() =>
  {
    if (!diaAberto) return [];
    return eventosNoDia(filtrados, diaAberto).slice().sort((a, b) => Number(atrasado(b)) - Number(atrasado(a)) || a.titulo.localeCompare(b.titulo));
  });

  $effect(() =>
  {
    const aberto = diaAberto;
    if (!aberto) return;
    if (!grade.semanas.some((semana) => semana.includes(aberto)))
    {
      diaAberto = null;
      return;
    }
    void tick().then(() => document.querySelector('.dia.selecionado')?.scrollIntoView({ block: 'center', inline: 'nearest' }));
  });
</script>

<main>
  <header>
    <div>
      <span class="prompt">&gt; calendário</span>
      <h1>Calendário<span class="cursor">_</span></h1>
    </div>
    <div class="nav-mes">
      <button type="button" onclick={() => mudarMes(-1)}>Anterior</button>
      <strong class="mes-atual">{rotuloMes(mes)}</strong>
      <button type="button" onclick={() => mudarMes(1)}>Próximo</button>
      <button type="button" onclick={irParaHoje}>Hoje</button>
    </div>
    <a class="botao" href="/mes">Resumo do mês</a>
  </header>

  <p class="dica origem">
    Cronograma geral do mês. Cada card entra pela última foto da pasta, no vencimento ou na previsão. Ondas e ausências ocupam o período inteiro. O plano, os combinados das atas e as decisões de risco entram no dia combinado.
  </p>

  <div class="filtros">
    {#each tiposEventoCalendario as tipo (tipo.id)}
      <button type="button" class="filtro {tipo.id}" class:ligado={ativos[tipo.id]} aria-pressed={ativos[tipo.id]} onclick={() => alternar(tipo.id)}>
        {tipo.nome} <span class="num">{contagem[tipo.id]}</span>
      </button>
    {/each}
    <label class="mostrar"><input type="checkbox" bind:checked={mostrarConcluidos} /> Mostrar concluídos</label>
  </div>

  <p class="dica">{noMes.length} {noMes.length === 1 ? 'marca' : 'marcas'} em {rotuloMes(mes)}{#if ocultos} · {ocultos} {ocultos === 1 ? 'concluído oculto' : 'concluídos ocultos'}{/if}</p>

  {#if eventos.length === 0}
    <p class="aviso">Ainda não há datas. Elas aparecem quando existe foto do painel, plano da semana, ata, risco com prazo ou ausência.</p>
  {/if}

  <div class="calendario-scroll">
    <div class="grade" role="grid" aria-label="Calendário de {rotuloMes(mes)}">
      <div class="nomes" role="row">
        {#each ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as nome, i (nome)}
          <span role="columnheader" class:fim={i >= 5}>{nome}</span>
        {/each}
      </div>

      {#each vista as semana (semana.id)}
        <div class="semana" role="row">
          {#if semana.faixas > 0}
            <div class="barras" style:grid-template-rows="repeat({semana.faixas}, 22px)">
              {#each semana.barras as barra (barra.evento.id)}
                <a
                  class="barra {barra.evento.tipo}"
                  class:corta-antes={barra.continuaAntes}
                  class:corta-depois={barra.continuaDepois}
                  class:atrasado={atrasado(barra.evento)}
                  style:grid-column="{barra.coluna} / span {barra.span}"
                  style:grid-row={barra.faixa + 1}
                  href={barra.evento.href}
                  title={texto(barra.evento)}
                >{barra.evento.titulo}</a>
              {/each}
            </div>
          {/if}
          <div class="dias">
            {#each semana.celulas as celula (celula.iso)}
              <div
                class="dia"
                class:fora={celula.fora}
                class:fim={celula.fimDeSemana}
                class:hoje={celula.iso === hojeIso}
                class:selecionado={celula.iso === diaAberto}
                role="gridcell"
                tabindex="0"
                onclick={() => (diaAberto = celula.iso)}
                onkeydown={(evento) =>
                {
                  if (evento.target !== evento.currentTarget || (evento.key !== 'Enter' && evento.key !== ' ')) return;
                  evento.preventDefault();
                  diaAberto = celula.iso;
                }}
              >
                <button type="button" class="num-dia" aria-pressed={celula.iso === diaAberto} onclick={() => (diaAberto = celula.iso)}>
                  {celula.numero}
                </button>
                {#each celula.pontos as ponto (ponto.id)}
                  <a class="chip {ponto.tipo}" class:atrasado={atrasado(ponto)} class:feito={ponto.concluido} href={ponto.href} title={texto(ponto)}>{ponto.titulo}</a>
                {/each}
                {#if celula.extra > 0}
                  <button type="button" class="mais" onclick={() => (diaAberto = celula.iso)}>+{celula.extra}</button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <section class="cartao">
    <h2>{diaAberto ? rotuloDia(diaAberto) : 'Dia'}</h2>
    {#if !diaAberto}
      <p class="dica">Clique num dia para ver o que cai nele.</p>
    {:else if agenda.length === 0}
      <p class="dica">Nada neste dia com os filtros atuais.</p>
    {:else}
      <ul class="agenda">
        {#each agenda as evento (evento.id)}
          <li>
            <span class="pilula {evento.tipo}">{nomeTipo[evento.tipo]}</span>
            <a href={evento.href}>{evento.titulo}</a>
            {#if evento.detalhe}<small class="dica">{evento.detalhe}</small>{/if}
            {#if evento.fim > evento.inicio}<small class="dica">{evento.inicio.slice(8, 10)}/{evento.inicio.slice(5, 7)} a {evento.fim.slice(8, 10)}/{evento.fim.slice(5, 7)}</small>{/if}
            {#if evento.concluido}<span class="pilula">concluído</span>{/if}
            {#if atrasado(evento)}<span class="pilula atrasado">atrasado</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  .nav-mes
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
  }
  .mes-atual
  {
    min-width: 12rem;
    text-align: center;
    font-family: var(--fonte-maquina);
  }
  .origem
  {
    max-width: 68rem;
  }
  .filtros
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-2);
    margin: var(--size-3) 0;
  }
  .filtro
  {
    opacity: 0.55;
  }
  .filtro.ligado
  {
    opacity: 1;
  }
  .filtro .num
  {
    font-variant-numeric: tabular-nums;
  }
  .mostrar
  {
    display: inline-flex;
    align-items: center;
    gap: var(--size-1);
    margin-left: var(--size-2);
  }
  .calendario-scroll
  {
    overflow-x: auto;
    margin-top: var(--size-3);
  }
  .grade
  {
    min-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nomes, .dias, .barras
  {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .nomes span
  {
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--suave);
    padding: 0 6px 4px;
  }
  .nomes .fim, .dia.fim
  {
    color: var(--suave);
  }
  .semana
  {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .barras
  {
    gap: 3px 4px;
  }
  .barra, .chip
  {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
    border-radius: 3px;
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .barra
  {
    padding: 2px 6px;
  }
  .barra.corta-antes
  {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .barra.corta-depois
  {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .dias
  {
    gap: 4px;
  }
  .dia
  {
    min-height: 112px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 4px;
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    text-align: left;
  }
  .dia.fora
  {
    opacity: 0.48;
  }
  .dia.hoje
  {
    border-color: var(--marca);
  }
  .dia.selecionado
  {
    box-shadow: inset 0 0 0 2px var(--marca);
    background: var(--marca-clara);
  }
  .num-dia, .mais
  {
    border: none;
    background: transparent;
    box-shadow: none;
    padding: 0 4px;
    min-height: 0;
    font-family: var(--fonte-maquina);
  }
  .num-dia
  {
    align-self: flex-end;
    flex: none;
    line-height: 1.6;
    color: var(--texto);
  }
  .dia.hoje .num-dia
  {
    background: var(--marca);
    color: var(--sobre-marca);
    border-radius: var(--raio-pequeno);
  }
  .chip
  {
    padding: 1px 4px;
  }
  .chip.feito
  {
    opacity: 0.6;
    text-decoration: line-through;
  }
  .mais
  {
    color: var(--suave);
    text-align: left;
    font-size: 0.72rem;
  }
  .vencimento
  {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
  }
  .previsao
  {
    background: var(--azul-fundo);
    color: var(--azul);
  }
  .inicio, .reuniao
  {
    background: var(--marca-clara);
    color: var(--marca);
  }
  .onda
  {
    background: var(--superficie-2);
    color: var(--texto);
    box-shadow: inset 0 0 0 1px var(--borda-forte);
  }
  .plano
  {
    background: var(--verde-fundo);
    color: var(--verde);
  }
  .combinado
  {
    background: var(--amarelo-fundo);
    color: var(--amarelo);
  }
  .risco
  {
    background: var(--laranja-fundo);
    color: var(--laranja);
  }
  .ausencia
  {
    background: repeating-linear-gradient(135deg, var(--superficie-2), var(--superficie-2) 4px, var(--borda) 4px, var(--borda) 5px);
    color: var(--suave);
  }
  .atrasado
  {
    box-shadow: inset 3px 0 0 var(--vermelho);
  }
  .agenda
  {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--size-2);
  }
  .agenda li
  {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--size-2);
  }
  .agenda a
  {
    color: var(--texto);
    font-weight: 600;
  }
  .pilula.vencimento, .pilula.previsao, .pilula.inicio, .pilula.onda, .pilula.plano, .pilula.combinado, .pilula.risco, .pilula.ausencia, .pilula.reuniao
  {
    border-radius: var(--radius-round);
  }
</style>
