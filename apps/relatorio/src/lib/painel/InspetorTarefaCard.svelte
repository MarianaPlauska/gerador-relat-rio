<script lang="ts">
  import type { CardSnapshot, EtapaCard, Pessoa } from '@supervisao/core';
  import type { AnexosCard } from './acoes.ts';

  let {
    card,
    todosCards,
    pessoas,
    pastaAtual,
    modo = 'lateral',
    aoAtualizarCampo,
    aoAtualizarHoras,
    aoAlternarEtapa,
    aoAtualizarSituacaoEtapa,
    aoAtualizarDescricaoEtapa,
    aoAdicionarEtapa,
    aoRemoverEtapa,
    aoVincularRelacionado,
    aoDesvincularRelacionado,
    aoSelecionarOutroCard,
    aoAmpliarModal,
    aoFechar,
    anexos,
  }: {
    card: CardSnapshot;
    todosCards: CardSnapshot[];
    pessoas: Pessoa[];
    pastaAtual: string;
    modo?: 'lateral' | 'modal';
    aoAtualizarCampo: (codigo: string, parcial: Partial<CardSnapshot>) => void;
    aoAtualizarHoras: (codigo: string, valor: string) => void;
    aoAlternarEtapa: (codigo: string, ordemEtapa: number) => void;
    aoAtualizarSituacaoEtapa: (codigo: string, ordemEtapa: number, situacao: EtapaCard['situacao']) => void;
    aoAtualizarDescricaoEtapa: (codigo: string, ordemEtapa: number, descricao: string) => void;
    aoAdicionarEtapa: (codigo: string, nome: string, descricao: string) => void;
    aoRemoverEtapa: (codigo: string, ordemEtapa: number) => void;
    aoVincularRelacionado: (codigo: string, outroCodigo: string) => void;
    aoDesvincularRelacionado: (codigo: string, outroCodigo: string) => void;
    aoSelecionarOutroCard: (codigo: string) => void;
    aoAmpliarModal?: () => void;
    aoFechar: () => void;
    anexos?: AnexosCard | undefined;
  } = $props();

  let novaEtapaTexto = $state('');
  let novaEtapaDescricao = $state('');
  let cardRelacionadoNovo = $state('');
  let verTodas = $state(false);
  $effect(() =>
  {
    void card.codigo;
    verTodas = false;
  });

  function criarEtapa()
  {
    const nome = novaEtapaTexto.trim();
    if (!nome) return;
    aoAdicionarEtapa(card.codigo, nome, novaEtapaDescricao.trim());
    novaEtapaTexto = '';
    novaEtapaDescricao = '';
  }

  function vincular()
  {
    if (!cardRelacionadoNovo) return;
    aoVincularRelacionado(card.codigo, cardRelacionadoNovo);
    cardRelacionadoNovo = '';
  }
</script>

<div class="inspetor-conteiner" class:modo-modal={modo === 'modal'}>
  <div class="linha-entre topo-painel-direita">
    <div>
      <span class="etiqueta">{modo === 'modal' ? `Modal detalhado da demanda · Projeto ${pastaAtual}` : 'Inspeção da tarefa'}</span>
      <h3>
        <span class="maquina">{card.codigo}</span>
        {#if modo === 'modal'}· {card.assunto || card.titulo}{/if}
        {#if card.prioridadeCard}
          <span class="pilula prio-{card.prioridadeCard.toLowerCase()}">{card.prioridadeCard}</span>
        {/if}
      </h3>
    </div>
    <div class="acoes-topo-direita">
      {#if modo === 'lateral' && aoAmpliarModal}
        <button type="button" class="btn-ampliar-modal" onclick={aoAmpliarModal}>
          Ampliar em modal
        </button>
      {/if}
      <button type="button" class={modo === 'modal' ? 'principal' : 'btn-fechar-direita'} onclick={aoFechar} title="Fechar">
        {modo === 'modal' ? 'Fechar modal' : '×'}
      </button>
    </div>
  </div>

  <div class="grade-campos-card-direita">
    <label>Prioridade
      <select
        value={card.prioridadeCard ?? ''}
        onchange={(e) => {
          const v = e.currentTarget.value || undefined;
          const crit = v === 'Crítica' ? 3 : v === 'Alta' ? 2 : v ? 1 : undefined;
          aoAtualizarCampo(card.codigo, { prioridadeCard: v, criticidade: crit });
        }}
      >
        <option value="">Normal</option>
        <option value="Baixa">Baixa</option>
        <option value="Média">Média</option>
        <option value="Alta">Alta</option>
        <option value="Crítica">Crítica</option>
      </select>
    </label>
    <label>Status
      <select
        value={card.statusCard ?? 'Novo'}
        onchange={(e) => {
          const st = e.currentTarget.value;
          const sit = st === 'Resolvido' ? 'concluido' : st === 'Em andamento' ? 'em_execucao' : 'a_iniciar';
          aoAtualizarCampo(card.codigo, { statusCard: st, situacao: sit });
        }}
      >
        <option value="Novo">Novo</option>
        <option value="Planejado">Planejado</option>
        <option value="Em andamento">Em andamento</option>
        <option value="Resolvido">Resolvido</option>
      </select>
    </label>
    <label>Responsável
      <select
        value={card.responsavelEtapaAtual ?? card.responsaveis[0] ?? ''}
        onchange={(e) => {
          const r = e.currentTarget.value || undefined;
          aoAtualizarCampo(card.codigo, {
            responsavelEtapaAtual: r,
            responsaveis: r ? [r] : [],
          });
        }}
      >
        <option value="">Sem responsável</option>
        {#each pessoas as p (p.id)}
          <option value={p.id}>{p.nome}</option>
        {/each}
      </select>
    </label>
    <label>Tempo estipulado (h)
      <input
        type="number"
        step="0.5"
        value={card.horasEstimadas ?? 4}
        onchange={(e) => aoAtualizarHoras(card.codigo, e.currentTarget.value)}
      />
    </label>
  </div>

  {#if card.origemHoras === 'manual'}
    <small class="dica">Tempo fixado por você.</small>
  {:else if card.origemHoras === 'historico'}
    <small class="dica" title={card.notaHoras}>Tempo pelo histórico. Digite outro valor para fixar.</small>
  {:else if card.origemHoras === 'regra'}
    <small class="dica">Tempo pela prioridade. Digite outro valor para fixar.</small>
  {/if}

  {#if anexos}
    {@const prints = anexos.listar(card.codigo)}
    {@const lendo = anexos.progresso()}
    <div class="bloco-campo-direita">
      <h4 class="rotulo-bloco">Prints desta tarefa</h4>
      <textarea
        class="zona-print"
        rows="2"
        value=""
        placeholder="Cole aqui o print do card (Ctrl+V) ou arraste a imagem. Eu leio e preencho o pedido e as etapas abaixo."
        aria-label="Colar o print desta tarefa"
        onpaste={(e) => { e.preventDefault(); anexos.colar(card.codigo, e); }}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => { e.preventDefault(); anexos.soltar(card.codigo, e); }}
      ></textarea>
      <div class="linha-print">
        <label class="botao mini">
          Escolher imagem
          <input
            type="file"
            accept="image/*"
            hidden
            onchange={(e) => { const f = e.currentTarget.files?.[0]; if (f) anexos.escolher(card.codigo, f); e.currentTarget.value = ''; }}
          />
        </label>
        {#if lendo !== null}
          <span class="pilula">lendo... {Math.round(lendo * 100)}%</span>
        {/if}
      </div>
      {#if prints.length}
        <ul class="lista-prints">
          {#each prints as p (p.id)}
            <li>
              {#if p.imagemDataUrl}<img src={p.imagemDataUrl} alt={p.nome} />{/if}
              <span>{p.nome.split(' · ')[0]}</span>
              <button type="button" class="link perigo" onclick={() => anexos.remover(p.id)}>remover</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <label class="bloco-campo-direita">
    <h4 class="rotulo-bloco">O que foi pedido</h4>
    <textarea
      rows={modo === 'modal' ? 4 : 3}
      value={card.descricaoCompleta ?? card.titulo ?? ''}
      oninput={(e) => aoAtualizarCampo(card.codigo, { descricaoCompleta: e.currentTarget.value, titulo: e.currentTarget.value })}
      placeholder="Descreva o pedido completo e as regras da tarefa..."
    ></textarea>
  </label>

  <div class="bloco-campo-direita">
    <h4 class="rotulo-bloco">Etapas ({card.etapasConcluidas ?? 0} de {card.etapas?.length ?? 0} feitas)</h4>
    <div class="lista-etapas-editor">
      {#each card.etapas ?? [] as et (et.ordem)}
        <div class="item-etapa-editor" class:concluida={et.situacao === 'concluida'}>
          <div class="linha-entre">
            <label class="check-etapa-titulo">
              <input
                type="checkbox"
                checked={et.situacao === 'concluida'}
                onchange={() => aoAlternarEtapa(card.codigo, et.ordem)}
              />
              <b>{et.ordem}. {et.nome}</b>
            </label>
            <div class="controles-etapa-mini">
              <select
                value={et.situacao}
                onchange={(e) => aoAtualizarSituacaoEtapa(card.codigo, et.ordem, e.currentTarget.value as EtapaCard['situacao'])}
              >
                <option value="nao_iniciada">A fazer</option>
                <option value="rodando">Em andamento</option>
                <option value="concluida">Concluída</option>
              </select>
              <button type="button" class="link perigo" onclick={() => aoRemoverEtapa(card.codigo, et.ordem)}>
                {modo === 'modal' ? 'remover' : '×'}
              </button>
            </div>
          </div>
          <input
            class="input-desc-etapa"
            value={et.descricao ?? ''}
            oninput={(e) => aoAtualizarDescricaoEtapa(card.codigo, et.ordem, e.currentTarget.value)}
            placeholder="Descreva o que a pessoa vai fazer nesta etapa..."
          />
        </div>
      {/each}
    </div>
    <div class="nova-etapa-inline">
      <input bind:value={novaEtapaTexto} placeholder="Nova etapa (ex.: Homologação)" />
      <input bind:value={novaEtapaDescricao} placeholder="O que vai fazer nesta etapa..." />
      <button type="button" onclick={criarEtapa} disabled={!novaEtapaTexto.trim()}>+ Etapa</button>
    </div>
  </div>

  <details class="bloco-campo-direita caixa-impacto-correlacao">
    <summary>Tarefas relacionadas e impacto na semana ({card.cardsRelacionados?.length ?? 0})</summary>
    {#if modo === 'modal'}
      <textarea
        rows="2"
        value={card.impactoSemana ?? ''}
        oninput={(e) => aoAtualizarCampo(card.codigo, { impactoSemana: e.currentTarget.value })}
      ></textarea>
    {:else}
      <p class="texto-impacto-semana">{card.impactoSemana}</p>
    {/if}
    <div class="chips-relacionados">
      {#each (card.cardsRelacionados ?? []).slice(0, verTodas ? undefined : 8) as relCodigo (relCodigo)}
        <span class="pilula pilula-rel-card">
          <button type="button" class="btn-ir-card" onclick={() => aoSelecionarOutroCard(relCodigo)}>{relCodigo}</button>
          <button type="button" class="btn-rem-rel" onclick={() => aoDesvincularRelacionado(card.codigo, relCodigo)}>×</button>
        </span>
      {/each}
      {#if !verTodas && (card.cardsRelacionados?.length ?? 0) > 8}
        <button type="button" class="link" onclick={() => (verTodas = true)}>ver todas</button>
      {/if}
    </div>
    <div class="linha-vincular-rel">
      <select bind:value={cardRelacionadoNovo}>
        <option value="">Relacionar com outra tarefa da semana...</option>
        {#each todosCards.filter((c) => c.codigo !== card.codigo && !(card.cardsRelacionados ?? []).includes(c.codigo)) as c (c.codigo)}
          <option value={c.codigo}>{c.codigo} · {c.assunto || c.titulo}</option>
        {/each}
      </select>
      <button type="button" onclick={vincular} disabled={!cardRelacionadoNovo}>
        Vincular
      </button>
    </div>
  </details>

  <label class="bloco-campo-direita">
    <h4 class="rotulo-bloco">Sua anotação</h4>
    <textarea
      rows={modo === 'modal' ? 3 : 2}
      value={card.comentario ?? ''}
      oninput={(e) => aoAtualizarCampo(card.codigo, { comentario: e.currentTarget.value })}
      placeholder="Anotações sobre dependências, riscos ou alinhamento com a pessoa..."
    ></textarea>
  </label>
</div>

<style>
  .inspetor-conteiner { display: flex; flex-direction: column; gap: 12px; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .topo-painel-direita h3 { margin: 2px 0 0; font-size: 1rem; display: flex; align-items: center; gap: 6px; }
  .modo-modal .topo-painel-direita h3 { font-size: 1.15rem; }
  .acoes-topo-direita { display: flex; align-items: center; gap: 6px; }
  .btn-ampliar-modal { font-size: 0.76rem; padding: 4px 10px; background: var(--marca-clara); border: 1px solid var(--marca); color: var(--marca); font-weight: 600; cursor: var(--cursor-clique); }
  .btn-fechar-direita { font-size: 1.1rem; padding: 2px 8px; line-height: 1; }
  .grade-campos-card-direita { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .grade-campos-card-direita label { display: flex; flex-direction: column; gap: 3px; font-size: 0.78rem; font-weight: 600; }
  .bloco-campo-direita { display: flex; flex-direction: column; gap: 6px; }
  textarea { width: 100%; background: var(--superficie-2); font-size: 0.88rem; margin: 2px 0; }
  .lista-etapas-editor { display: flex; flex-direction: column; gap: 6px; }
  .item-etapa-editor { padding: 8px; border-radius: 6px; background: var(--superficie-2); border: 1px solid var(--borda); display: flex; flex-direction: column; gap: 5px; }
  .item-etapa-editor.concluida { border-left: 3px solid var(--verde); }
  .check-etapa-titulo { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: var(--cursor-clique); }
  .controles-etapa-mini { display: flex; align-items: center; gap: 6px; }
  .controles-etapa-mini select { font-size: 0.74rem; padding: 2px 4px; }
  .input-desc-etapa { width: 100%; font-size: 0.78rem; padding: 4px 6px; }
  .nova-etapa-inline { display: grid; grid-template-columns: 1fr 1.2fr auto; gap: 6px; margin-top: 4px; }
  .nova-etapa-inline input { font-size: 0.78rem; padding: 4px 6px; }
  .zona-print { border: 1.5px dashed var(--borda-forte); text-align: center; padding: 8px 10px; font-size: 0.8rem; resize: none; }
  .linha-print { display: flex; align-items: center; gap: 8px; }
  .lista-prints { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; }
  .lista-prints li { display: flex; align-items: center; gap: 8px; }
  .lista-prints img { width: 64px; height: 44px; object-fit: cover; border: 1px solid var(--borda); border-radius: 4px; background: var(--fundo); }
  .rotulo-bloco { margin: 6px 0 0; padding-top: 10px; border-top: 1px dashed var(--borda); font-family: var(--fonte-maquina); font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--suave); }
  .caixa-impacto-correlacao summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; font-size: 0.82rem; }
  .caixa-impacto-correlacao {padding: 8px 10px; background: var(--superficie-2); border-radius: 6px; border: 1px solid var(--borda); }
  .texto-impacto-semana { margin: 0; font-size: 0.78rem; color: var(--texto); line-height: 1.35; }
  .chips-relacionados { display: flex; flex-wrap: wrap; gap: 6px; }
  .pilula-rel-card { display: inline-flex; align-items: center; gap: 4px; background: var(--superficie); border: 1px solid var(--marca); }
  .btn-ir-card, .btn-rem-rel { border: none; background: none; padding: 0; font-size: 0.75rem; cursor: var(--cursor-clique); color: var(--marca); }
  .btn-rem-rel { color: var(--vermelho); font-weight: 700; }
  .linha-vincular-rel { display: flex; gap: 6px; align-items: center; }
  .linha-vincular-rel select { flex: 1; font-size: 0.76rem; padding: 3px 6px; }
  .link { border: none; background: none; padding: 0; margin-left: 6px; text-decoration: underline; font-size: 0.82rem; cursor: var(--cursor-clique); }
  .perigo { color: var(--vermelho); }
  .pilula.prio-crítica, .pilula.prio-critica, .pilula.prio-urgente { background: var(--vermelho-fundo); color: var(--vermelho); }
  .pilula.prio-alta { background: var(--amarelo-fundo); color: var(--amarelo); }
  .pilula.prio-baixa { background: var(--superficie-2); color: var(--suave); }
</style>
