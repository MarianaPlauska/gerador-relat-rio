<script lang="ts">
  import EstadoNuvem from '#lib/EstadoNuvem.svelte';
  import
  {
    agoraLocal, alertasDoPlano, confirmarPlano, horasPlanejadas, kpisDosItens, pendenciasDaSemana, segundaDaSemana, somarDias, sugerirItens,
    type Alerta, type CardSnapshot, type ItemPlano, type PlanoPessoa, type PlanoSemana, type Ritmo, type Risco,
  } from '@supervisao/core';
  import { carregar, hidratarImagens, salvar, salvarAgora, type Dados, type GovernancaSemana } from '#lib/armazenamento.ts';
  import { nuvem } from '#lib/nuvem.svelte.ts';
  import { copiar } from '#lib/saidas.ts';

  let dados = $state<Dados>(carregar());
  // as imagens dos prints ficam na nuvem: busca as que faltam para mostrar as miniaturas
  $effect(() =>
  {
    void hidratarImagens(dados);
  });
  const hoje = agoraLocal().slice(0, 10);
  let semana = $state(segundaDaSemana(hoje));
  let copiadoExtrato = $state(false);
  let novaEtapaPorItem = $state<Record<string, string>>({});

  $effect(() => salvar($state.snapshot(dados)));

  function garantirGov(sem = semana): GovernancaSemana
  {
    dados.governancaSemanal ??= {};
    dados.governancaSemanal[sem] ??= {};
    return dados.governancaSemanal[sem]!;
  }

  const gov = $derived<GovernancaSemana>(dados.governancaSemanal?.[semana] ?? {});

  // meta progressiva de entregas no prazo: >=75% nov, >=80% dez, >=85% jan+
  const metaPrazoMes = $derived.by(() =>
  {
    const mes = Number(semana.slice(5, 7));
    if (mes === 11) return 75;
    if (mes === 12) return 80;
    return 85;
  });

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

  // indicadores de governança (sincronizados no Firebase via dados.governancaSemanal)
  const prazoAtualPct = $derived(foto?.totais.dentroDoPrazoPct ?? kpis?.pctDentroDoCronograma);
  const qualidadeAtualPct = $derived(foto?.totais.qualidadePct ?? foto?.totais.eficienciaQualidade ?? gov.qualidadeManualPct);

  const semanasOrdenadasPlanos = $derived([...new Set(dados.planos.map((p) => p.inicio))].sort());
  const numeroSemanaPlano = $derived(Math.max(1, semanasOrdenadasPlanos.indexOf(semana) + 1));
  const exigeRevisaoSexta = $derived(numeroSemanaPlano <= 2);

  const resumoSegundas = $derived.by(() =>
  {
    const todas = semanasOrdenadasPlanos;
    if (!todas.length) return { feitas: 0, total: 0, pct: 0 };
    const feitas = todas.filter((s) => dados.governancaSemanal?.[s]?.extratoSegundaApresentado).length;
    return { feitas, total: todas.length, pct: Math.round((feitas / todas.length) * 100) };
  });

  const backlogDaSemana = (sem: string): number | undefined =>
  {
    const manual = dados.governancaSemanal?.[sem]?.backlogFimSemana;
    if (manual !== undefined) return manual;
    const f = dados.fotos.filter((x) => x.data <= somarDias(sem, 4)).at(-1);
    return f?.totais.emAbertoAgora ?? f?.totais.demandasEmAndamento;
  };

  const statusBacklog = $derived.by(() =>
  {
    const b0 = backlogDaSemana(semana);
    const b1 = backlogDaSemana(somarDias(semana, -7));
    const b2 = backlogDaSemana(somarDias(semana, -14));
    const cresceu2Seguidas = b0 !== undefined && b1 !== undefined && b2 !== undefined && b0 > b1 && b1 > b2;
    return { atual: b0, anterior: b1, cresceu2Seguidas };
  });

  const resumoSaidasEntradas = $derived.by(() =>
  {
    const todas = [...new Set([...semanasOrdenadasPlanos, ...Object.keys(dados.governancaSemanal ?? {})])].sort();
    let total = 0;
    let ok = 0;
    for (const s of todas)
    {
      const g = dados.governancaSemanal?.[s];
      if (g?.entradasSemana !== undefined && g?.saidasSemana !== undefined)
      {
        total++;
        if (g.saidasSemana >= g.entradasSemana) ok++;
      }
    }
    return { ok, total, maioriaOk: total > 0 && ok >= Math.ceil(total / 2) };
  });

  // radar 48h: itens não concluídos vencendo em até 2 dias (48h) ou já em risco/atrasados
  const limite48h = $derived(somarDias(hoje, 2));
  const radar48h = $derived.by(() =>
  {
    if (!plano) return [];
    const lista: { pessoaId: string; item: ItemPlano; prazo?: string; motivo: string }[] = [];
    for (const pp of plano.pessoas)
    {
      for (const item of pp.itens)
      {
        if (item.status === 'feito') continue;
        const card = item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined;
        const prazo = item.ate || card?.previsao || card?.vencimento;
        const em48h = !!prazo && prazo <= limite48h;
        const riscoCard = card?.ritmoPainel === 'atrasado' || card?.ritmoPainel === 'em_risco';
        if (em48h || riscoCard || item.status === 'bloqueado')
        {
          const motivo = item.status === 'bloqueado'
            ? 'Item bloqueado'
            : prazo && prazo < hoje
              ? `Prazo vencido (${dataCurta(prazo)})`
              : em48h
                ? `Entrega em até 48h (${dataCurta(prazo)})`
                : `Card ${card?.ritmoPainel === 'atrasado' ? 'atrasado' : 'em risco'} no painel`;
          lista.push({ pessoaId: pp.pessoaId, item, prazo, motivo });
        }
      }
    }
    return lista;
  });

  // estimado x realizado da semana
  const estimadoRealizado = $derived.by(() =>
  {
    if (!plano) return { est: 0, real: 0, feitosEst: 0 };
    let est = 0;
    let real = 0;
    let feitosEst = 0;
    for (const pp of plano.pessoas)
    {
      for (const item of pp.itens)
      {
        const h = item.horasEstimadas ?? 0;
        est += h;
        const hr = gov.horasReaisPorItem?.[item.id];
        if (hr !== undefined) real += hr;
        else if (item.status === 'feito') real += h;
        if (item.status === 'feito') feitosEst += h;
      }
    }
    return { est, real, feitosEst };
  });

  function atualizarGov(parcial: Partial<GovernancaSemana>)
  {
    const g = garantirGov();
    Object.assign(g, parcial);
    dados.governancaSemanal = { ...dados.governancaSemanal };
    salvarAgora($state.snapshot(dados));
  }

  function adicionarEtapaItem(itemId: string)
  {
    const texto = (novaEtapaPorItem[itemId] ?? '').trim();
    if (!texto) return;
    const g = garantirGov();
    g.etapasPorItem ??= {};
    g.etapasPorItem[itemId] = [...(g.etapasPorItem[itemId] ?? []), { texto, feita: false }];
    dados.governancaSemanal = { ...dados.governancaSemanal };
    novaEtapaPorItem[itemId] = '';
    salvarAgora($state.snapshot(dados));
  }

  function alternarEtapaItem(itemId: string, idx: number)
  {
    const g = garantirGov();
    const lista = g.etapasPorItem?.[itemId];
    if (!lista?.[idx]) return;
    lista[idx]!.feita = !lista[idx]!.feita;
    dados.governancaSemanal = { ...dados.governancaSemanal };
    salvarAgora($state.snapshot(dados));
  }

  function removerEtapaItem(itemId: string, idx: number)
  {
    const g = garantirGov();
    if (!g.etapasPorItem?.[itemId]) return;
    g.etapasPorItem[itemId] = g.etapasPorItem[itemId]!.filter((_, i) => i !== idx);
    dados.governancaSemanal = { ...dados.governancaSemanal };
    salvarAgora($state.snapshot(dados));
  }

  function definirHorasReais(itemId: string, val: string)
  {
    const g = garantirGov();
    g.horasReaisPorItem ??= {};
    if (val === '') delete g.horasReaisPorItem[itemId];
    else g.horasReaisPorItem[itemId] = Number(val);
    dados.governancaSemanal = { ...dados.governancaSemanal };
    salvar($state.snapshot(dados));
  }

  function sinalizarRisco48h(pessoaId: string, item: ItemPlano, motivo: string)
  {
    const g = garantirGov();
    g.sinalizado48hPorItem ??= {};
    g.sinalizado48hPorItem[item.id] = agoraLocal();
    dados.governancaSemanal = { ...dados.governancaSemanal };
    const desc = `[Alerta 48h] ${item.cardCodigo ? `${item.cardCodigo} - ` : ''}${item.descricao || 'Entrega em risco'} (${motivo})`;
    if (!dados.riscos.some((r) => r.descricao === desc))
    {
      novoRisco({ descricao: desc, cardCodigo: item.cardCodigo, pessoaId, origem: 'automatico', probabilidade: 'alta', impacto: 'alto' });
    }
    salvarAgora($state.snapshot(dados));
  }

  async function copiarExtratoSegunda()
  {
    if (!plano) return;
    const linhas: string[] = [
      `EXTRATO DA SEMANA (${dataCurta(semana)} a ${dataCurta(sexta)})`,
      `Meta de prazo: >=${metaPrazoMes}% (atual: ${prazoAtualPct !== undefined ? `${prazoAtualPct}%` : 'sem leitura'}) | Qualidade: >=95% (atual: ${qualidadeAtualPct !== undefined ? `${qualidadeAtualPct}%` : '-'})`,
      '',
      'QUEM FICA COM O QUÊ E PRIORIDADES:',
    ];
    for (const pessoa of dados.pessoas)
    {
      const pp = plano.pessoas.find((x) => x.pessoaId === pessoa.id);
      if (!pp?.itens.length) continue;
      linhas.push(`- ${pessoa.nome} (${horasPlanejadas(pp)}h / ${pessoa.capacidadeHorasSemana}h):`);
      for (const item of pp.itens)
      {
        const etapas = gov.etapasPorItem?.[item.id] ?? [];
        const etTxt = etapas.length ? ` [etapas: ${etapas.map((e) => `${e.feita ? '✓' : '○'} ${e.texto}`).join('; ')}]` : '';
        linhas.push(`  • ${item.cardCodigo ? `[${item.cardCodigo}] ` : ''}${item.descricao || 'Sem descrição'}${item.ate ? ` (até ${dataCurta(item.ate)})` : ''}${item.horasEstimadas ? ` ~${item.horasEstimadas}h` : ''}${etTxt}`);
      }
    }
    if (radar48h.length || riscosAbertos.length)
    {
      linhas.push('', 'RISCOS DE PRAZO (AVISO >=48h):');
      for (const r of radar48h) linhas.push(`- ${nomePessoa(r.pessoaId)}: ${r.item.cardCodigo ?? ''} ${r.item.descricao} — ${r.motivo}`);
      for (const r of riscosAbertos) if (r.descricao) linhas.push(`- ${r.descricao}${r.planoB ? ` | Plano B: ${r.planoB}` : ''}`);
    }
    await copiar(linhas.join('\n'));
    copiadoExtrato = true;
    setTimeout(() => (copiadoExtrato = false), 2500);
  }

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

  // prints do Diário desta semana marcados para a pessoa (ou em que ela aparece como responsável)
  const printsDaSemana = $derived(dados.registros.filter((r) => r.data >= semana && r.data <= somarDias(semana, 6)).flatMap((r) => r.capturas.map((cap) => ({ registro: r, cap }))));
  const printsDaPessoa = (id: string, nome: string) => printsDaSemana.filter(({ cap }) => cap.pessoaId === id || (!cap.pessoaId && cap.porPessoa?.some((g) => g.pessoa === nome)));

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
    salvarAgora($state.snapshot(dados));
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
  <span class="prompt">&gt; semana</span>
  <header>
    <h1>Plano da semana<span class="cursor">_</span></h1>
    <label>Semana de
      <select bind:value={semana}>
        {#each semanas as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
      </select>
    </label>
    <span class="dica">{foto ? `Comparando com a foto do painel de ${dataCurta(foto.data)}` : 'Sem foto do painel: cole o painel antes para ter os alertas.'}</span>
    <EstadoNuvem />
  </header>

  <!-- PAINEL DE METAS, RITO DE SEGUNDA E GOVERNANÇA (SINCRONIZADO NO FIREBASE) -->
  <section class="cartao gov-painel">
    <div class="topo">
      <h2>Metas e governança da semana</h2>
      <span class="espaco"></span>
      {#if plano}
        <button onclick={copiarExtratoSegunda}>{copiadoExtrato ? 'Extrato copiado!' : 'Copiar extrato da reunião de segunda'}</button>
        <a class="botao principal" href="/relatorio?semana={semana}">Gerar PDF da semana</a>
      {/if}
    </div>

    <div class="gov-kpis">
      <div class="gov-card">
        <span class="etiqueta">Entregas no prazo (meta ≥{metaPrazoMes}%)</span>
        <strong class="maquina">{prazoAtualPct !== undefined ? `${prazoAtualPct}%` : '-'}</strong>
        <span class="pilula" class:verde={prazoAtualPct !== undefined && prazoAtualPct >= metaPrazoMes} class:atrasado={prazoAtualPct !== undefined && prazoAtualPct < metaPrazoMes}>
          {prazoAtualPct === undefined ? 'Sem leitura' : prazoAtualPct >= metaPrazoMes ? 'Dentro da meta' : `Abaixo da meta (${metaPrazoMes}%)`}
        </span>
      </div>

      <div class="gov-card">
        <span class="etiqueta">Qualidade (meta ≥95%)</span>
        <strong class="maquina">{qualidadeAtualPct !== undefined ? `${qualidadeAtualPct}%` : '-'}</strong>
        {#if foto?.totais.qualidadePct === undefined && foto?.totais.eficienciaQualidade === undefined}
          <input type="number" min="0" max="100" class="mini" placeholder="%" value={gov.qualidadeManualPct ?? ''} onchange={(e) => atualizarGov({ qualidadeManualPct: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} aria-label="Qualidade manual (%)" />
        {/if}
        <span class="pilula" class:verde={qualidadeAtualPct !== undefined && qualidadeAtualPct >= 95} class:atrasado={qualidadeAtualPct !== undefined && qualidadeAtualPct < 95}>
          {qualidadeAtualPct === undefined ? 'Informar ou ler print' : qualidadeAtualPct >= 95 ? 'Meta mantida' : 'Abaixo de 95%'}
        </span>
      </div>

      <div class="gov-card">
        <span class="etiqueta">Extrato nas segundas (meta 100%)</span>
        <strong class="maquina">{resumoSegundas.total ? `${resumoSegundas.pct}%` : '-'}</strong>
        <small class="dica">{resumoSegundas.feitas}/{resumoSegundas.total} segundas apresentadas</small>
      </div>

      <div class="gov-card">
        <span class="etiqueta">Backlog (sem crescer 2 sem.)</span>
        <strong class="maquina">{statusBacklog.atual ?? '-'}</strong>
        <span class="pilula" class:verde={!statusBacklog.cresceu2Seguidas && statusBacklog.atual !== undefined} class:atrasado={statusBacklog.cresceu2Seguidas}>
          {statusBacklog.cresceu2Seguidas ? 'Cresceu 2 sem. seguidas!' : statusBacklog.atual !== undefined ? 'Sob controle' : 'Sem leitura'}
        </span>
      </div>

      <div class="gov-card">
        <span class="etiqueta">Saídas ≥ Entradas (maioria)</span>
        <strong class="maquina">{resumoSaidasEntradas.total ? `${resumoSaidasEntradas.ok}/${resumoSaidasEntradas.total}` : '-'}</strong>
        <span class="pilula" class:verde={resumoSaidasEntradas.maioriaOk} class:amarelo={resumoSaidasEntradas.total > 0 && !resumoSaidasEntradas.maioriaOk}>
          {resumoSaidasEntradas.total === 0 ? 'Preencha abaixo' : resumoSaidasEntradas.maioriaOk ? 'Maioria positiva' : 'Entradas > Saídas'}
        </span>
      </div>
    </div>

    <div class="gov-controles">
      <label class="check-inline">
        <input type="checkbox" checked={!!gov.extratoSegundaApresentado} onchange={(e) => atualizarGov({ extratoSegundaApresentado: e.currentTarget.checked, extratoApresentadoEm: e.currentTarget.checked ? hoje : undefined })} />
        <span>Extrato apresentado na reunião de segunda</span>
      </label>
      <label class="check-inline">
        <input type="checkbox" checked={!!gov.revisaoSextaFeita} onchange={(e) => atualizarGov({ revisaoSextaFeita: e.currentTarget.checked })} />
        <span>Revisão prévia feita na sexta anterior</span>
        <span class="pilula" class:amarelo={exigeRevisaoSexta && !gov.revisaoSextaFeita} class:verde={!exigeRevisaoSexta || gov.revisaoSextaFeita}>
          {exigeRevisaoSexta ? `Semana ${numeroSemanaPlano}/2: revisar na sexta` : '3ª semana+: autonomia'}
        </span>
      </label>
      <div class="gov-fluxo-inputs">
        <label>Entradas <input type="number" min="0" class="mini" value={gov.entradasSemana ?? ''} onchange={(e) => atualizarGov({ entradasSemana: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} /></label>
        <label>Saídas <input type="number" min="0" class="mini" value={gov.saidasSemana ?? foto?.totais.concluidasNoPeriodo ?? ''} onchange={(e) => atualizarGov({ saidasSemana: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} /></label>
        <label>Backlog fim <input type="number" min="0" class="mini" value={gov.backlogFimSemana ?? statusBacklog.atual ?? ''} onchange={(e) => atualizarGov({ backlogFimSemana: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} /></label>
      </div>
    </div>
  </section>

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
        <div><b>{estimadoRealizado.real}h / {estimadoRealizado.est}h</b><span>realizado × estimado</span></div>
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

    {#if radar48h.length}
      <section class="cartao">
        <h2>Radar 48h — entregas em risco para sinalizar com antecedência</h2>
        <ul class="alertas">
          {#each radar48h as r (`${r.pessoaId}-${r.item.id}`)}
            {@const jaSinalizado = gov.sinalizado48hPorItem?.[r.item.id]}
            <li class={jaSinalizado ? 'medio' : 'alto'}>
              <span><b>{r.item.cardCodigo ?? 'Sem card'}</b> {r.item.descricao || '(sem descrição)'} — {r.motivo}</span>
              <span class="dica">{nomePessoa(r.pessoaId)}</span>
              {#if jaSinalizado}
                <span class="pilula verde">Sinalizado em {dataCurta(jaSinalizado)}</span>
              {:else}
                <button class="link" onclick={() => sinalizarRisco48h(r.pessoaId, r.item, r.motivo)}>Sinalizar 48h e virar risco</button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

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
        <div class="prints-pessoa">
          <span class="etiqueta">Prints da semana ({printsDaPessoa(pessoa.id, pessoa.nome).length})</span>
          {#each printsDaPessoa(pessoa.id, pessoa.nome) as { registro, cap } (cap.id)}
            <details class="print-pessoa">
              <summary>
                {#if cap.imagemDataUrl}<img src={cap.imagemDataUrl} alt="Print de {pessoa.nome}" />{/if}
                <span><b>{registro.data.split('-').reverse().join('/')}</b> {cap.oQueVaiFazer ?? (cap.comentario || registro.motivo || cap.nome)}</span>
              </summary>
              {#if cap.imagemDataUrl}<img class="grande" src={cap.imagemDataUrl} alt="Print de {pessoa.nome}" />{/if}
              {#if cap.oQueVaiFazer}<p><b>O que vai fazer:</b> {cap.oQueVaiFazer}</p>{/if}
              {#if cap.porque}<p><b>Por quê:</b> {cap.porque}</p>{/if}
              {#if registro.resumo}<p class="dica">Registro: {registro.resumo}</p>{/if}
            </details>
          {/each}
          <a class="botao mini" href="/painel?pessoa={pessoa.id}&semana={semana}">+ Print de {pessoa.nome.split(' ')[0]} para esta semana</a>
        </div>

        {#each pp.itens as item (item.id)}
          {@const card = item.cardCodigo ? porCodigo.get(item.cardCodigo) : undefined}
          {@const meus = alertasDoItem(item.id)}
          {@const etapasItem = gov.etapasPorItem?.[item.id] ?? []}
          <div class="item" class:feito={item.status === 'feito'} class:com-alerta={meus.length}>
            <div class="linha1">
              <select bind:value={item.cardCodigo} class="card">
                <option value={undefined}>sem card</option>
                {#each cards as c (c.codigo)}<option value={c.codigo}>{c.codigo} - {c.titulo ?? c.sistema ?? ''}</option>{/each}
                {#if item.cardCodigo && !card}<option value={item.cardCodigo}>{item.cardCodigo}</option>{/if}
              </select>
              <input bind:value={item.descricao} placeholder="O que vai ser feito" class="largo" />
              <label>Até <input type="date" bind:value={item.ate} onchange={() => mudarData(item)} /></label>
              <label>Est. (h) <input type="number" min="0" class="mini" bind:value={item.horasEstimadas} /></label>
              <label>Real (h) <input type="number" min="0" class="mini" value={gov.horasReaisPorItem?.[item.id] ?? ''} onchange={(e) => definirHorasReais(item.id, e.currentTarget.value)} /></label>
              {#if item.tipo === 'nao_planejado'}<span class="pilula amarelo">não planejado</span>{/if}
              <button class="link" onclick={() => remover(planoDe(pessoa.id), item.id)}>remover</button>
            </div>
            <div class="linha2">
              <input bind:value={item.objetivo} placeholder="Para quê (objetivo)" class="largo" />
              <input bind:value={item.frente} list="frentes" placeholder="Frente" />
              <input bind:value={item.dor} list="dores" placeholder="Dor que resolve" />
            </div>
            <!-- quebra da demanda em etapas (sincronizada no Firebase) -->
            <div class="etapas-quebra">
              {#if etapasItem.length}
                <div class="etapas-chips">
                  {#each etapasItem as et, idx (idx)}
                    <label class="etapa-chip" class:concluida={et.feita}>
                      <input type="checkbox" checked={et.feita} onchange={() => alternarEtapaItem(item.id, idx)} />
                      <span>{et.texto}</span>
                      <button type="button" class="link" onclick={() => removerEtapaItem(item.id, idx)} aria-label="Remover etapa">&times;</button>
                    </label>
                  {/each}
                </div>
              {/if}
              <div class="etapa-nova">
                <input
                  value={novaEtapaPorItem[item.id] ?? ''}
                  oninput={(e) => (novaEtapaPorItem[item.id] = e.currentTarget.value)}
                  onkeydown={(e) => e.key === 'Enter' && adicionarEtapaItem(item.id)}
                  placeholder="+ Quebrar demanda em etapa (Enter para adicionar)..."
                />
                {#if (novaEtapaPorItem[item.id] ?? '').trim()}
                  <button type="button" onclick={() => adicionarEtapaItem(item.id)}>+ Etapa</button>
                {/if}
              </div>
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
  .gov-painel
  {
    display: grid;
    gap: 14px;
  }
  .gov-kpis
  {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  .gov-card
  {
    padding: 10px 12px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: flex-start;
  }
  .gov-card strong
  {
    font-size: 1.35rem;
    color: var(--texto);
  }
  .gov-controles
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    padding-top: 8px;
    border-top: 1px solid var(--borda);
  }
  .check-inline
  {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--texto);
  }
  .gov-fluxo-inputs
  {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-left: auto;
  }
  .etapas-quebra
  {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }
  .etapas-chips
  {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .etapa-chip
  {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    background: var(--superficie-2);
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    font-size: 0.8rem;
    color: var(--texto);
  }
  .etapa-chip.concluida span
  {
    text-decoration: line-through;
    color: var(--suave);
  }
  .etapa-nova
  {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .etapa-nova input
  {
    flex: 1;
    font-size: 0.82rem;
    padding: 4px 8px;
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
    color: var(--texto);
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
    background: var(--superficie-2);
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
    background: var(--azul-fundo);
    color: var(--azul);
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
    color: var(--azul);
    text-decoration: underline;
    padding: 2px 4px;
  }
  .prints-pessoa
  {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--size-2);
    margin: var(--size-2) 0 var(--size-3);
  }
  .prints-pessoa .etiqueta
  {
    flex-basis: 100%;
  }
  .print-pessoa
  {
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    padding: var(--size-2);
    max-width: 360px;
    background: var(--superficie-2);
  }
  .print-pessoa summary
  {
    display: flex;
    gap: var(--size-2);
    align-items: center;
    font-size: 0.84rem;
  }
  .print-pessoa summary img
  {
    width: 72px;
    height: 44px;
    object-fit: cover;
    border-radius: 2px;
  }
  .print-pessoa img.grande
  {
    width: 100%;
    margin-top: var(--size-2);
  }
  .print-pessoa p
  {
    margin: var(--size-1) 0 0;
    font-size: 0.86rem;
  }
</style>
