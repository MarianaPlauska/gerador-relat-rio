<script lang="ts">
  import
  {
    barrasDaSemana, eventosDoCronograma, eventosNoDia, gradeDoMes, pontosDoDia, tiposEventoCalendario,
    type TipoEventoCalendario,
  } from '@supervisao/core';
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import GradeCalendario from '#lib/calendario/GradeCalendario.svelte';
  import PainelDia from '#lib/calendario/PainelDia.svelte';
  import { atrasado, rotuloMes, type SemanaVista } from '#lib/calendario/rotulos.ts';
  import '#lib/calendario/cores.css';
  import { hoje } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const hojeIso = hoje();
  const limitePontos = 4;
  const diaPedido = page.url.searchParams.get('dia');
  const inicial = diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) ? diaPedido : hojeIso;

  let mes = $state(inicial.slice(0, 7));
  let diaAberto = $state<string | null>(inicial);
  let mostrarConcluidos = $state(false);
  let ativos = $state(Object.fromEntries(tiposEventoCalendario.map((t) => [t.id, true])) as Record<TipoEventoCalendario, boolean>);

  function mudarMes(delta: number)
  {
    const [ano, m] = mes.split('-').map(Number) as [number, number];
    mes = new Date(Date.UTC(ano, m - 1 + delta, 1)).toISOString().slice(0, 7);
  }

  function irParaHoje()
  {
    mes = hojeIso.slice(0, 7);
    diaAberto = hojeIso;
  }

  const visivel = (concluido: boolean) => mostrarConcluidos || !concluido;
  const grade = $derived(gradeDoMes(mes));
  const eventos = $derived(eventosDoCronograma(dados));
  const noPeriodo = $derived(eventos.filter((e) => e.inicio <= grade.fim && e.fim >= grade.inicio));
  const candidatos = $derived(noPeriodo.filter((e) => visivel(e.concluido)));
  const filtrados = $derived(eventos.filter((e) => ativos[e.tipo] && visivel(e.concluido)));
  const noMes = $derived(candidatos.filter((e) => ativos[e.tipo]));
  const ocultos = $derived(mostrarConcluidos ? 0 : noPeriodo.filter((e) => ativos[e.tipo] && e.concluido).length);
  const contagem = $derived(Object.fromEntries(tiposEventoCalendario.map((t) => [t.id, candidatos.filter((e) => e.tipo === t.id).length])) as Record<TipoEventoCalendario, number>);

  const vista = $derived<SemanaVista[]>(grade.semanas.map((dias) =>
  {
    const barras = barrasDaSemana(filtrados, dias);
    return {
      id: dias[0] ?? '',
      barras,
      faixas: barras.reduce((max, barra) => Math.max(max, barra.faixa + 1), 0),
      celulas: dias.map((iso, indice) =>
      {
        const pontos = pontosDoDia(filtrados, iso);
        return { iso, numero: Number(iso.slice(8, 10)), fora: !iso.startsWith(mes), fimDeSemana: indice >= 5, pontos: pontos.slice(0, limitePontos), extra: Math.max(0, pontos.length - limitePontos) };
      }),
    };
  }));

  const agenda = $derived(diaAberto
    ? eventosNoDia(filtrados, diaAberto).slice().sort((a, b) => Number(atrasado(b, hojeIso)) - Number(atrasado(a, hojeIso)) || a.titulo.localeCompare(b.titulo))
    : []);

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
    O calendário se preenche sozinho com o que já está no sistema: prazos e previsões dos cards (último print de cada pasta), ondas, plano da semana, combinados das atas, decisões de risco e ausências.
    Para pôr algo seu, clique no dia e use <b>Marcar neste dia</b>.
  </p>

  <div class="filtros">
    {#each tiposEventoCalendario as tipo (tipo.id)}
      <button type="button" class="filtro ev-{tipo.id}" class:ligado={ativos[tipo.id]} aria-pressed={ativos[tipo.id]} onclick={() => (ativos[tipo.id] = !ativos[tipo.id])}>
        {tipo.nome} <span class="num">{contagem[tipo.id]}</span>
      </button>
    {/each}
    <label class="mostrar"><input type="checkbox" bind:checked={mostrarConcluidos} /> Mostrar concluídos</label>
  </div>

  <p class="dica">{noMes.length} {noMes.length === 1 ? 'marca' : 'marcas'} em {rotuloMes(mes)}{#if ocultos} · {ocultos} {ocultos === 1 ? 'concluído oculto' : 'concluídos ocultos'}{/if}</p>

  {#if eventos.length === 0}
    <p class="aviso">Ainda não há datas. Clique num dia para marcar algo, ou cole um print do painel, monte o plano da semana ou registre uma ata.</p>
  {/if}

  <GradeCalendario {vista} {hojeIso} rotulo={rotuloMes(mes)} bind:diaAberto />

  <PainelDia dia={diaAberto} {agenda} {hojeIso} bind:marcas={dados.marcasCalendario} />
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
</style>
