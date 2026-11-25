<script lang="ts">
  import { ordenarCardsResumidos, type CardSnapshot, type CriterioOrdenacaoCards, type GanttSemana as DadosGantt, type Pessoa, type ResumoPessoaProjeto } from '@supervisao/core';
  import type { AcoesCards, AnexosCard } from './acoes.ts';
  import GanttSemana from './GanttSemana.svelte';
  import InspetorTarefaCard from './InspetorTarefaCard.svelte';

  // resumo das tarefas, pessoas da semana com etapas ticáveis, painel lateral da tarefa e cronograma da semana
  let { cardsLidos, pessoasDaPasta, pastaAtual, analiseEnvio, gantt, acoes, anexos, selecionadoCodigo = $bindable(null), pessoaExpandidaEnvio = $bindable(null), aoAmpliarModal }: {
    cardsLidos: CardSnapshot[];
    pessoasDaPasta: Pessoa[];
    pastaAtual: string;
    analiseEnvio: ResumoPessoaProjeto[];
    gantt: DadosGantt;
    acoes: AcoesCards;
    anexos?: AnexosCard | undefined;
    selecionadoCodigo?: string | null;
    // pessoa aberta na árvore (a barra de equipe da página também abre uma)
    pessoaExpandidaEnvio?: string | null;
    aoAmpliarModal: () => void;
  } = $props();

  let ordenacaoTarefas = $state<CriterioOrdenacaoCards>('prioridade_maior');
  let filtroPessoa = $state('');
  const donoDe = (c: CardSnapshot) => c.responsavelEtapaAtual ?? c.responsaveis[0] ?? '';
  const nomeDe = (id: string) => pessoasDaPasta.find((p) => p.id === id)?.nome ?? id;
  const donos = $derived([...new Set(cardsLidos.map(donoDe))].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b))));
  const cardsOrdenadosResumo = $derived(ordenarCardsResumidos(cardsLidos, ordenacaoTarefas).filter((c) => !filtroPessoa || donoDe(c) === filtroPessoa));
  const cardSelecionado = $derived(cardsLidos.find((c) => c.codigo === selecionadoCodigo) ?? null);
</script>
          <div class="grade-arvore-envio" class:com-painel-direito={!!cardSelecionado}>
            <div class="caixa-arvore">
              <div class="linha-entre topo-caixa-arvore">
                <span class="etiqueta">Resumo das tarefas ({cardsOrdenadosResumo.length} de {cardsLidos.length})</span>
                <label class="organizador-select">
                  <span>Pessoa:</span>
                  <select bind:value={filtroPessoa}>
                    <option value="">todas ({donos.length})</option>
                    {#each donos as d (d)}
                      <option value={d}>{d ? nomeDe(d) : 'sem responsável'} ({cardsLidos.filter((c) => donoDe(c) === d).length})</option>
                    {/each}
                  </select>
                </label>
                <label class="organizador-select">
                  <span>Organizar:</span>
                  <select bind:value={ordenacaoTarefas}>
                    <option value="prioridade_maior">Prioridade e tempo (maior → menor)</option>
                    <option value="card_maior">Card {pastaAtual}-xxx (maior → menor)</option>
                    <option value="card_menor">Card {pastaAtual}-xxx (menor → maior)</option>
                    <option value="nomes_parecidos">Assuntos / nomes parecidos</option>
                    <option value="datas_proximas">Prazo mais próximo primeiro</option>
                    <option value="datas_distantes">Prazo mais longo primeiro</option>
                  </select>
                </label>
              </div>
              <div class="lista-tarefas-resumo">
                {#each cardsOrdenadosResumo as card (card.codigo)}
                  {@const selecionado = selecionadoCodigo === card.codigo}
                  <button
                    type="button"
                    class="item-tarefa-resumo"
                    class:selecionado
                    onclick={() => (selecionadoCodigo = card.codigo)}
                  >
                    <div class="linha-entre">
                      <span>
                        <b class="maquina">{card.codigo}</b>
                        {#if card.prioridadeCard}
                          <span class="pilula prio-{card.prioridadeCard.toLowerCase()}">{card.prioridadeCard}</span>
                        {/if}
                        {#if card.statusCard}
                          <span class="badge-status-card">{card.statusCard}</span>
                        {/if}
                      </span>
                      <span class="fontes-vetor">~{card.horasEstimadas ?? 4}h</span>
                    </div>
                    <div class="assunto-tarefa">{card.assunto || card.titulo || 'Demanda do painel'}</div>
                    <div class="dono-tarefa">{donoDe(card) ? nomeDe(donoDe(card)) : 'sem responsável'}</div>
                  </button>
                {/each}
              </div>
            </div>

            <div class="caixa-arvore caixa-pessoas">
              <span class="etiqueta">Pessoas na semana (clique para expandir tarefas e etapas)</span>
              <div class="lista-pessoas-arvore">
                {#each analiseEnvio.filter((p) => p.total > 0) as p (p.pessoa.id)}
                  {@const aberta = pessoaExpandidaEnvio === p.pessoa.id}
                  <div class="pessoa-no-arvore" class:aberta>
                    <button
                      type="button"
                      class="cabecalho-pessoa-arvore"
                      onclick={() => (pessoaExpandidaEnvio = aberta ? null : p.pessoa.id)}
                    >
                      <span class="nome-pessoa-arvore-bloco">
                        <span class="seta-arvore">{aberta ? '▾' : '▸'}</span>
                        <b>{p.pessoa.nome}</b>
                        <small>({p.total} {p.total === 1 ? 'tarefa' : 'tarefas'})</small>
                        {#if p.estagioCritico}
                          <span class="pilula perigo-sobrecarga" title={p.motivoEstagioCritico}>[Sobrecarga crítica]</span>
                        {/if}
                      </span>
                      <span class="metricas-pessoa-arvore">
                        <span class="pilula">{p.horasEstipuladasSemana}h / {p.capacidadeHorasSemana}h</span>
                        <span class="pilula" class:no_ritmo={p.probabilidadeMaisServicosPct >= 60} class:em_risco={p.probabilidadeMaisServicosPct >= 35 && p.probabilidadeMaisServicosPct < 60} class:atrasado={p.probabilidadeMaisServicosPct < 35}>
                          {p.probabilidadeMaisServicosPct}% prob. +serviços
                        </span>
                      </span>
                    </button>

                    {#if aberta}
                      <div class="corpo-pessoa-arvore">
                        <div class="resumo-probabilistico">
                          <span>Entrega: <b>{p.nivelEntregaPct}%</b></span>
                          <span>Demora: <b>{p.nivelDemora}</b> ({p.motivoDemora})</span>
                          <span>Capacidade extra: <b>+{p.servicosExtrasSugeridos} {p.servicosExtrasSugeridos === 1 ? 'serviço' : 'serviços'} (~{p.horasLivresCalibradas}h livres)</b></span>
                          <span>
                            {#if p.calibracao.usouHistorico}
                              Histórico: <b>{p.calibracao.velocidadeMediaHorasSemana}h/semana</b> em {p.calibracao.semanasAmostra} {p.calibracao.semanasAmostra === 1 ? 'semana' : 'semanas'} (confiança {p.calibracao.confiancaPct}%)
                            {:else}
                              Sem histórico ainda: vale a folga da jornada
                            {/if}
                          </span>
                        </div>

                        {#each p.tarefas as tar (tar.codigo)}
                          <div class="card-filho-arvore" class:selecionado={selecionadoCodigo === tar.codigo}>
                            <div class="linha-entre">
                              <button
                                type="button"
                                class="btn-titulo-card-filho"
                                onclick={() => (selecionadoCodigo = tar.codigo)}
                              >
                                <b class="maquina">{tar.codigo}</b> {tar.assunto}
                                {#if tar.prioridadeCard}<span class="badge-status-card">{tar.prioridadeCard}</span>{/if}
                              </button>
                              <div class="acoes-card-filho">
                                <label class="mini">Tempo (h)
                                  <input
                                    type="number"
                                    step="0.5"
                                    class="input-horas-curto"
                                    value={tar.horasEstimadas}
                                    onchange={(e) => acoes.atualizarHoras(tar.codigo, e.currentTarget.value)}
                                  />
                                </label>
                                <button
                                  type="button"
                                  class="btn-abrir-direita"
                                  onclick={() => (selecionadoCodigo = tar.codigo)}
                                >
                                  Detalhes / Etapas &rarr;
                                </button>
                              </div>
                            </div>
                            {#if tar.descricaoCompleta}
                              <p class="pedido-completo"><b>O que foi pedido:</b> {tar.descricaoCompleta}</p>
                            {/if}
                            {#if tar.etapas?.length}
                              <div class="bloco-etapas-filhas">
                                <span class="etiqueta-micro">Etapas e o que vai fazer (marque o que já foi ou será feito):</span>
                                <ul class="etapas-filhas-interativas">
                                  {#each tar.etapas as et (et.ordem)}
                                    <li class:etapa-concluida={et.situacao === 'concluida'}>
                                      <label class="check-etapa-linha">
                                        <input
                                          type="checkbox"
                                          checked={et.situacao === 'concluida'}
                                          onchange={() => acoes.alternarEtapa(tar.codigo, et.ordem)}
                                        />
                                        <span>
                                          <b>{et.ordem}. {et.nome}</b>
                                          <small class="status-etapa-tag">
                                            [{et.situacao.replace('_', ' ')}{et.tempoRodandoHoras !== undefined ? ` · ${et.tempoRodandoHoras}h rodando` : et.horasEstimadas ? ` · ~${et.horasEstimadas}h` : ''}]
                                          </small>
                                        </span>
                                      </label>
                                      {#if et.descricao}
                                        <div class="desc-etapa-fazer">{et.descricao}</div>
                                      {/if}
                                    </li>
                                  {/each}
                                </ul>
                              </div>
                            {/if}
                            {#if tar.impactoSemana}
                              <div class="impacto-card-filho">
                                <b>Impacto e correlação na semana:</b> {tar.impactoSemana}
                              </div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            {#if cardSelecionado}
              <aside class="painel-detalhe-direita">
                <InspetorTarefaCard
                  card={cardSelecionado}
                  todosCards={cardsLidos}
                  pessoas={pessoasDaPasta}
                  {pastaAtual}
                  modo="lateral"
                  aoAtualizarCampo={acoes.atualizarCampo}
                  aoAtualizarHoras={acoes.atualizarHoras}
                  aoAlternarEtapa={acoes.alternarEtapa}
                  aoAtualizarSituacaoEtapa={acoes.atualizarSituacaoEtapa}
                  aoAtualizarDescricaoEtapa={acoes.atualizarDescricaoEtapa}
                  aoAdicionarEtapa={acoes.adicionarEtapa}
                  aoRemoverEtapa={acoes.removerEtapa}
                  aoVincularRelacionado={acoes.vincular}
                  aoDesvincularRelacionado={acoes.desvincular}
                  aoSelecionarOutroCard={(cod) => (selecionadoCodigo = cod)}
                  aoAmpliarModal={() => aoAmpliarModal()}
                  aoFechar={() => (selecionadoCodigo = null)}
                  {anexos}
                />
              </aside>
            {/if}
          </div>

          <details class="conferir cronograma-envio">
            <summary>Cronograma da semana: quem faz o quê em cada dia e quando fica livre</summary>
            <GanttSemana gantt={gantt} selecionado={selecionadoCodigo} aoSelecionarCard={(cod) => (selecionadoCodigo = cod)} aoReordenar={acoes.reordenarFila} />
          </details>

<style>
  .grade-arvore-envio { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; margin: 12px 0; align-items: start; }
  /* com uma tarefa aberta: lista e pessoas na coluna da esquerda, inspeção na direita ocupando as duas linhas
     (é o que deixa o sticky dela ter espaço para grudar; numa linha só ela escorregava junto com a página) */
  .grade-arvore-envio.com-painel-direito { grid-template-columns: minmax(300px, 1fr) minmax(380px, 1.4fr); }
  .com-painel-direito .caixa-arvore { grid-area: 1 / 1; }
  .com-painel-direito .caixa-pessoas { grid-area: 2 / 1; }
  .com-painel-direito .painel-detalhe-direita { grid-area: 1 / 2 / 3 / 3; }
  /* com a inspeção aberta as listas crescem na página: é o que dá altura para a inspeção ficar parada enquanto
     a lista rola, e tira a rolagem de dentro da rolagem */
  .com-painel-direito .lista-tarefas-resumo, .com-painel-direito .lista-pessoas-arvore { max-height: none; overflow: visible; padding-right: 0; }
  .dono-tarefa { font-size: 0.74rem; color: var(--suave); }
  .assunto-tarefa { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .caixa-arvore { background: var(--superficie-2); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .topo-caixa-arvore { gap: 8px; }
  .organizador-select { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--suave); }
  .organizador-select select { font-size: 0.75rem; padding: 2px 6px; max-width: 210px; }

  .lista-tarefas-resumo, .lista-pessoas-arvore {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 440px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--borda-forte) var(--superficie);
  }
  .lista-tarefas-resumo::-webkit-scrollbar, .lista-pessoas-arvore::-webkit-scrollbar {
    width: 6px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-track, .lista-pessoas-arvore::-webkit-scrollbar-track {
    background: var(--superficie);
    border-radius: 4px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-thumb, .lista-pessoas-arvore::-webkit-scrollbar-thumb {
    background: var(--borda-forte);
    border-radius: 4px;
  }
  .lista-tarefas-resumo::-webkit-scrollbar-thumb:hover, .lista-pessoas-arvore::-webkit-scrollbar-thumb:hover {
    background: var(--marca);
  }
  .pilula.perigo-sobrecarga {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
    border: 1px solid var(--vermelho);
    font-weight: 700;
    font-size: 0.7rem;
  }
  .item-tarefa-resumo { flex-shrink: 0; width: 100%; text-align: left; background: var(--superficie); border: 1px solid var(--borda); border-left: 3px solid var(--cor-barra); border-radius: 6px; padding: 9px 12px; font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px; cursor: var(--cursor-clique); transition: border-color 0.15s, background 0.15s; }
  .item-tarefa-resumo:hover, .item-tarefa-resumo.selecionado { border-color: var(--marca); border-left-color: var(--marca); background: var(--marca-clara); }
  .assunto-tarefa { color: var(--texto); line-height: 1.35; font-weight: 500; }
  .fontes-vetor { font-family: var(--fonte-maquina); font-size: 0.72rem; color: var(--suave); }
  .badge-status-card { font-family: var(--fonte-maquina); font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: var(--superficie-2); border: 1px solid var(--borda); color: var(--suave); margin-left: 4px; }
  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }

  .pessoa-no-arvore { flex-shrink: 0; background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; margin-bottom: 2px; }
  .pessoa-no-arvore.aberta { border-color: var(--marca); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12); }
  .cabecalho-pessoa-arvore { width: 100%; min-height: 46px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; background: none; border: none; text-align: left; color: var(--texto); font-family: inherit; cursor: var(--cursor-clique); }
  .nome-pessoa-arvore-bloco { display: flex; align-items: center; gap: 6px; font-size: 0.92rem; }
  .seta-arvore { color: var(--marca); font-family: var(--fonte-maquina); }
  .metricas-pessoa-arvore { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .corpo-pessoa-arvore { border-top: 1px solid var(--borda); padding: 12px; background: var(--superficie-2); display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; }
  .resumo-probabilistico { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px; background: var(--superficie); border-radius: 6px; border: 1px solid var(--borda); font-size: 0.78rem; color: var(--suave); }
  .resumo-probabilistico b { color: var(--texto); }
  .card-filho-arvore { flex-shrink: 0; background: var(--superficie); border: 1px solid var(--borda); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .card-filho-arvore.selecionado { border-color: var(--marca); }
  .btn-titulo-card-filho { border: none; background: none; padding: 0; text-align: left; color: var(--texto); font-size: 0.84rem; cursor: var(--cursor-clique); }
  .btn-titulo-card-filho:hover { color: var(--marca); }
  .acoes-card-filho { display: flex; align-items: center; gap: 8px; }
  .btn-abrir-direita { font-size: 0.74rem; padding: 2px 8px; background: var(--superficie-2); border: 1px solid var(--borda-forte); color: var(--marca); border-radius: 4px; cursor: var(--cursor-clique); }
  .input-horas-curto { width: 64px; font-size: 0.78rem; padding: 2px 5px; }
  .pedido-completo { margin: 2px 0 0; font-size: 0.78rem; line-height: 1.4; color: var(--suave); white-space: pre-line; background: var(--superficie-2); padding: 6px 8px; border-radius: 4px; }
  .bloco-etapas-filhas { background: var(--superficie-2); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--borda); }
  .etiqueta-micro { display: block; font-size: 0.72rem; color: var(--suave); margin-bottom: 4px; font-weight: 600; }
  .etapas-filhas-interativas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; }
  .etapas-filhas-interativas li { padding: 4px 6px; border-radius: 4px; background: var(--superficie); border: 1px solid var(--borda); }
  .etapas-filhas-interativas li.etapa-concluida { opacity: 0.75; border-left: 3px solid var(--verde); }
  .check-etapa-linha { display: flex; align-items: center; gap: 6px; cursor: var(--cursor-clique); }
  .status-etapa-tag { color: var(--suave); margin-left: 4px; font-family: var(--fonte-maquina); }
  .desc-etapa-fazer { margin: 3px 0 0 22px; font-size: 0.75rem; color: var(--suave); line-height: 1.3; }
  .impacto-card-filho { font-size: 0.75rem; color: var(--suave); padding: 5px 8px; background: var(--superficie-2); border-left: 2px solid var(--marca); border-radius: 4px; }
  .input-desc-etapa { width: 100%; font-size: 0.78rem; padding: 4px 6px; margin-top: 4px; }

  .painel-detalhe-direita { background: var(--superficie); border: 1.5px solid var(--marca); border-radius: var(--raio); padding: 14px; position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow-y: auto; overscroll-behavior: contain; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .mini { font-size: 0.78rem; display: flex; gap: 6px; align-items: center; }
  .conferir { margin-top: 10px; }
  summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; margin: 6px 0; }
  @media (max-width: 1024px) { .grade-arvore-envio.com-painel-direito { grid-template-columns: 1fr; } }
</style>
