<script lang="ts">
  import {
    analisarTimeNoProjeto,
    aprenderEstimativas,
    definicoesPadrao,
    diasUteisEntre,
    idCurto,
    montarGanttSemana,
    segundaDaSemana,
    somarDias,
    type TotaisPainel,
  } from '@supervisao/core';
  import { goto } from '$app/navigation';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import EstadoVazioInicio from '#lib/inicio/EstadoVazioInicio.svelte';
  import ResumoSemana from '#lib/inicio/ResumoSemana.svelte';
  import TabelaEquipe from '#lib/inicio/TabelaEquipe.svelte';
  import TarefasDaSemana from '#lib/inicio/TarefasDaSemana.svelte';
  import type { ItemResumo } from '#lib/inicio/tipos.ts';
  import OrbitaIcone from '#lib/OrbitaIcone.svelte';
  import { guardarOrdem, ordemManualDoProjeto } from '#lib/fila.ts';
  import GanttSemana from '#lib/painel/GanttSemana.svelte';
  import { chaveDoRelatorio } from '#lib/modelos.ts';
  import { contextoDaSemana, dataCurta, dataMedia, hoje, periodoDaSemana, semaforoDoRelatorio, semanasDisponiveis } from '#lib/semana.ts';
  import { lerSessao } from '#lib/sessao.ts';

  const dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const dia = hoje();
  let semana = $state(segundaDaSemana(dia));
  let projetoAtual = $state(dados.registros.at(-1)?.pasta ?? dados.prefixo ?? 'DEV');
  let novoProjeto = $state('');
  let pessoaExpandida = $state<string | null>(null);

  const projetos = $derived(
    [...new Set([
      'DEV',
      ...(dados.projetos ?? []),
      dados.prefixo || 'DEV',
      ...dados.registros.map((r) => r.pasta),
      ...dados.fotos.map((f) => f.pasta).filter((p): p is string => !!p),
      ...dados.pessoas.flatMap((p) => p.pastas ?? []),
      projetoAtual,
    ])].filter(Boolean),
  );

  const fotosDoProjeto = $derived(
    dados.fotos.filter((f) => (f.pasta ?? dados.prefixo ?? 'DEV').toUpperCase() === projetoAtual.toUpperCase()),
  );

  const dadosProjeto = $derived<Dados>({
    ...dados,
    fotos: fotosDoProjeto,
  });

  const ctx = $derived(contextoDaSemana(dadosProjeto, semana));
  const t = $derived<TotaisPainel>(ctx.atual.foto?.totais ?? {});
  const kp = $derived(ctx.comp.planoAtual);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = $derived((dados.identificacao.elaboradoPor || lerSessao()?.nome || 'Mariana').split(' ')[0] ?? 'Mariana');

  const ultimaFoto = $derived([...fotosDoProjeto].filter((f) => f.data <= dia).sort((a, b) => a.data.localeCompare(b.data)).at(-1));
  const diasDesdeFoto = $derived(ultimaFoto ? diasUteisEntre(ultimaFoto.data, dia, definicoesPadrao.feriados) : 0);

  const semaforo = $derived(semaforoDoRelatorio(ctx, {}));
  const nomesSemaforo: Record<string, string> = { verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Fora da meta' };

  const cardsFoto = $derived(ultimaFoto?.cards ?? []);
  const baseCards = $derived(
    cardsFoto.filter((c) => c.origens.includes('em_execucao')).length
      ? cardsFoto.filter((c) => c.origens.includes('em_execucao'))
      : cardsFoto,
  );

  // Tarefas da semana sem exibir o nome de cada pessoa (foco na tarefa)
  const tarefasDaSemana = $derived(
    [...baseCards]
      .sort((a, b) =>
      {
        const peso = (r?: string, s?: string) => (r === 'atrasado' || s === 'atrasado' ? 2 : r === 'em_risco' ? 1 : 0);
        return peso(b.ritmoPainel, b.situacao) - peso(a.ritmoPainel, a.situacao);
      })
      .slice(0, 8),
  );

  const atencaoCount = $derived(
    baseCards.filter((c) => c.ritmoPainel === 'atrasado' || c.ritmoPainel === 'em_risco' || c.situacao === 'atrasado').length,
  );

  const vencimentos = $derived(
    cardsFoto
      .filter((c) => c.vencimento && c.vencimento >= dia && c.vencimento <= somarDias(dia, 15))
      .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
      .slice(0, 4),
  );

  // Análise completa por pessoa no projeto selecionado (com expansão, disponibilidade, sugestões e rendimento semanal + acumulado)
  const modeloEstimativa = $derived(aprenderEstimativas(fotosDoProjeto));
  const pessoasProjeto = $derived(
    analisarTimeNoProjeto({
      pessoas: dados.pessoas,
      fotos: dados.fotos,
      planos: dados.planos,
      pasta: projetoAtual,
      semanaInicio: semana,
      semanaFim: somarDias(semana, 6),
      hoje: dia,
      modelo: modeloEstimativa,
    }),
  );

  const gantt = $derived(montarGanttSemana(pessoasProjeto, {
    semanaInicio: semana,
    hoje: dia,
    feriados: definicoesPadrao.feriados,
    ordemManual: ordemManualDoProjeto(dados.filaManual, projetoAtual),
  }));

  function reordenarFila(pessoaId: string, codigos: string[])
  {
    dados.filaManual = guardarOrdem(dados.filaManual, projetoAtual, pessoaId, codigos);
    salvar($state.snapshot(dados));
  }

  const registrosProjeto = $derived(
    [...dados.registros]
      .filter((r) => (r.pasta || 'DEV').toUpperCase() === projetoAtual.toUpperCase())
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)),
  );
  const ultimoRegistro = $derived(registrosProjeto[0]);

  function criarProjeto()
  {
    const p = novoProjeto.trim().toUpperCase();
    if (!p) return;
    const atuais = dados.projetos ?? ['DEV'];
    if (!atuais.includes(p))
    {
      dados.projetos = [...atuais, p];
    }
    projetoAtual = p;
    novoProjeto = '';
    salvar($state.snapshot(dados));
  }

  function adicionarPessoaAoProjeto(nome: string)
  {
    const id = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || idCurto();
    const existente = dados.pessoas.find((p) => p.id === id || p.nome.toLowerCase() === nome.toLowerCase());
    if (existente)
    {
      const atuais = existente.pastas ?? ['DEV'];
      if (!atuais.includes(projetoAtual)) existente.pastas = [...atuais, projetoAtual];
    }
    else
    {
      dados.pessoas = [...dados.pessoas, { id, nome, capacidadeHorasSemana: 40, pastas: [projetoAtual] }];
    }
    pessoaExpandida = id;
  }

  function abrirUmAUm(pessoaId: string)
  {
    const chave = chaveDoRelatorio(periodoDaSemana(semana));
    const atuais = dados.relatorios[chave] ?? {};
    dados.relatorios[chave] = { ...atuais, blocos: { ...atuais.blocos, umaum: [{ tipo: 'pessoa', pessoaId }] } };
    dados.ultimoModelo = 'umaum';
    salvar($state.snapshot(dados));
    goto(`/relatorio?semana=${semana}`);
  }

  const atrasadas = $derived(baseCards.filter((c) => c.ritmoPainel === 'atrasado' || c.situacao === 'atrasado').length);
  const emRisco = $derived(baseCards.filter((c) => c.ritmoPainel === 'em_risco').length);

  const resumo = $derived<ItemResumo[]>([
    {
      rotulo: 'Saúde da semana',
      valor: semaforo ? nomesSemaforo[semaforo]! : 'Sem leitura',
      ponto: semaforo ?? undefined,
      detalhe: t.dentroDoPrazoPct !== undefined ? `${t.dentroDoPrazoPct}% dentro do prazo${ctx.meta ? ` · meta ${ctx.meta}%` : ''}` : 'Cole um print no diário para medir',
    },
    {
      rotulo: 'Plano da semana',
      valor: kp ? `${kp.feitos}/${kp.planejados}` : '0/0',
      sub: 'entregas',
      numero: true,
      barra: kp?.pctFeitos ?? 0,
      detalhe: kp?.pctFeitos !== undefined ? `${kp.pctFeitos}% concluído` : 'Sem plano ativo',
    },
    {
      rotulo: 'Atenção imediata',
      valor: String(atencaoCount),
      sub: atencaoCount === 1 ? 'demanda' : 'demandas',
      numero: true,
      ...(atrasadas > 0 ? { tom: 'vermelho' as const } : atencaoCount > 0 ? { tom: 'amarelo' as const } : {}),
      detalhe: atencaoCount === 0 ? 'Nenhuma demanda atrasada' : `${atrasadas} atrasadas · ${emRisco} em risco`,
    },
    {
      rotulo: `Diário (${projetoAtual})`,
      valor: String(registrosProjeto.length),
      sub: registrosProjeto.length === 1 ? 'registro' : 'registros',
      numero: true,
      detalhe: ultimoRegistro ? `Último em ${dataCurta(ultimoRegistro.data)}` : 'Nenhum registro arquivado',
    },
  ]);
</script>

<main class="inicio">
  <header class="topo">
    <div class="boas-vindas">
      <OrbitaIcone />
      <div>
        <span class="prompt">&gt; {saudacao.toLowerCase()}, {primeiroNome.toLowerCase()} · projeto {projetoAtual.toLowerCase()}</span>
        <h1>Visão Executiva<span class="cursor">_</span></h1>
      </div>
    </div>

    <div class="controles">
      <div class="campo">
        <label for="seletor-projeto" class="etiqueta">Projeto</label>
        <div class="linha">
          <select id="seletor-projeto" bind:value={projetoAtual} aria-label="Projeto">
            {#each projetos as proj (proj)}<option value={proj}>{proj}</option>{/each}
          </select>
          <input bind:value={novoProjeto} placeholder="Novo..." onkeydown={(e) => e.key === 'Enter' && criarProjeto()} aria-label="Nome do novo projeto" />
          {#if novoProjeto.trim()}<button type="button" onclick={criarProjeto}>Criar</button>{/if}
        </div>
      </div>
      <div class="campo">
        <label for="seletor-semana" class="etiqueta">Semana ativa</label>
        <select id="seletor-semana" bind:value={semana} aria-label="Semana">
          {#each semanasDisponiveis(dados) as s (s)}<option value={s}>{dataCurta(s)} a {dataCurta(somarDias(s, 4))}</option>{/each}
        </select>
      </div>
    </div>
  </header>

  {#if !ultimaFoto}
    <EstadoVazioInicio projeto={projetoAtual} />
  {:else}
    {#if diasDesdeFoto >= 2}
      <p class="defasada">
        Última leitura de <b>{projetoAtual}</b> em {dataCurta(ultimaFoto.data)} ({diasDesdeFoto} dias úteis).
        <a href="/painel">Atualizar leitura</a>
      </p>
    {/if}
    <ResumoSemana itens={resumo} />
    <div class="duas">
      <TarefasDaSemana cards={tarefasDaSemana} total={baseCards.length} projeto={projetoAtual} {vencimentos} />
      <TabelaEquipe pessoas={pessoasProjeto} projeto={projetoAtual} bind:expandida={pessoaExpandida} aoAdicionar={adicionarPessoaAoProjeto} aoUmAUm={abrirUmAUm} />
    </div>
  {/if}

  {#if !ultimaFoto}
    <TabelaEquipe pessoas={pessoasProjeto} projeto={projetoAtual} bind:expandida={pessoaExpandida} aoAdicionar={adicionarPessoaAoProjeto} aoUmAUm={abrirUmAUm} />
  {/if}

  {#if pessoasProjeto.some((p) => p.total > 0)}
    <section class="bloco">
      <header>
        <div>
          <span class="etiqueta">Projeto {projetoAtual}</span>
          <h2>Cronograma da semana</h2>
        </div>
        <span class="dica">Fila de cada pessoa por prioridade, em jornadas de 8 h. Clique numa barra para abrir a tarefa.</span>
      </header>
      <GanttSemana gantt={gantt} aoSelecionarCard={(codigo) => goto(`/cards?q=${encodeURIComponent(codigo)}`)} aoReordenar={reordenarFila} />
    </section>
  {/if}

  {#if ultimoRegistro}
    <section class="ultimo">
      <p>
        <span class="etiqueta">Último registro do diário</span>
        <b>{dataMedia(ultimoRegistro.data)}</b> {ultimoRegistro.motivo || ultimoRegistro.resumo || 'Registro de acompanhamento salvo.'}
      </p>
      <span class="acoes">
        <a href="/painel" class="botao">Abrir diário</a>
        <a href="/relatorio" class="botao">Usar no relatório</a>
      </span>
    </section>
  {/if}
</main>

<style>
  .inicio
  {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1240px;
    margin: 0 auto;
    padding-bottom: var(--size-6);
  }
  .topo
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--borda);
  }
  .boas-vindas
  {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .boas-vindas h1
  {
    margin: 0;
  }
  .controles
  {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
  }
  .campo
  {
    display: grid;
    gap: 4px;
  }
  .linha
  {
    display: flex;
    gap: 6px;
  }
  .linha input
  {
    width: 110px;
  }
  .defasada
  {
    margin: 0;
    padding: 8px 14px;
    background: var(--amarelo-fundo);
    border-left: 3px solid var(--amarelo);
    border-radius: var(--raio-pequeno);
    font-size: 0.88rem;
  }
  .defasada a
  {
    margin-left: 8px;
    color: var(--texto);
  }
  .duas
  {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 16px;
    align-items: start;
  }
  .bloco
  {
    background: var(--superficie);
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 16px 18px;
  }
  .bloco > header
  {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px 16px;
    margin-bottom: 10px;
  }
  .bloco h2
  {
    margin: 0;
    font-size: 1.05rem;
  }
  .ultimo
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 20px;
    padding: 12px 18px;
    border-top: 1px solid var(--borda);
    font-size: 0.9rem;
  }
  .ultimo p
  {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .acoes
  {
    display: flex;
    gap: 8px;
  }
  .acoes a
  {
    text-decoration: none;
  }
  @media (max-width: 980px)
  {
    .duas
    {
      grid-template-columns: 1fr;
    }
  }
</style>
