<script lang="ts">
  import { calcularPeriodoHistoricoPessoa, type Ausencia, type Pessoa, type RegistroPainel, type ResumoPessoaProjeto, type Snapshot } from '@supervisao/core';
  import { dataCurta, dataMedia } from '#lib/semana.ts';
  import AcessoEquipe from './AcessoEquipe.svelte';
  import AusenciasPessoa from './AusenciasPessoa.svelte';

  let {
    pastaAtual,
    dataRegistro,
    analiseEnvio,
    todasPessoas,
    fotos,
    registros,
    modalGerenciarAberto,
    confirmacaoRemover,
    aoFecharGerenciar,
    aoAtualizarCapacidade,
    aoSolicitarRemocao,
    aoConfirmarRemocao,
    aoCancelarRemocao,
    aoReativarPessoa,
    aoAtualizarAusencias,
  }: {
    pastaAtual: string;
    dataRegistro: string;
    analiseEnvio: ResumoPessoaProjeto[];
    todasPessoas: Pessoa[];
    fotos: Snapshot[];
    registros: RegistroPainel[];
    modalGerenciarAberto: boolean;
    confirmacaoRemover: { pessoa: Pessoa; escopo: 'projeto' | 'organizacao'; de: string; ate: string } | null;
    aoFecharGerenciar: () => void;
    aoAtualizarCapacidade: (pessoaId: string, valor: string) => void;
    aoSolicitarRemocao: (pessoa: Pessoa, escopo: 'projeto' | 'organizacao') => void;
    aoConfirmarRemocao: () => void;
    aoCancelarRemocao: () => void;
    aoReativarPessoa: (nome: string) => void;
    aoAtualizarAusencias: (pessoa: Pessoa, ausencias: Ausencia[]) => void;
  } = $props();
</script>

{#if modalGerenciarAberto}
  <div class="modal-backdrop" role="presentation" onclick={aoFecharGerenciar}>
    <div
      class="modal-janela modal-largo"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && aoFecharGerenciar()}
    >
      <div class="linha-entre modal-topo">
        <div>
          <span class="etiqueta">Organização · Equipe e batimento de rendimento</span>
          <h2>Gerenciamento de pessoas ({pastaAtual})</h2>
        </div>
        <button type="button" class="principal" onclick={aoFecharGerenciar}>Fechar</button>
      </div>

      <p class="dica">Compare o rendimento semanal e acumulado de cada pessoa, ajuste a capacidade de horas ou remova colaboradores mantendo o histórico registrado.</p>

      <div class="rolagem">
        <table class="tabela-gerenciar-pessoas">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Projetos</th>
              <th>Capacidade (h/sem)</th>
              <th>Carga atual</th>
              <th>Entrega / Demora</th>
              <th>Rendimento (Sem. / Acum.)</th>
              <th>Histórico ativo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {#each analiseEnvio as item (item.pessoa.id)}
              {@const per = calcularPeriodoHistoricoPessoa(item.pessoa, fotos, registros, dataRegistro)}
              <tr>
                <td><b>{item.pessoa.nome}</b></td>
                <td>{(item.pessoa.pastas ?? [pastaAtual]).join(', ')}</td>
                <td>
                  <input
                    type="number"
                    class="curto"
                    value={item.capacidadeHorasSemana}
                    onchange={(e) => aoAtualizarCapacidade(item.pessoa.id, e.currentTarget.value)}
                  />
                </td>
                <td>{item.horasEstipuladasSemana}h ({item.total} tarefas)</td>
                <td>
                  <span class="pilula" class:no_ritmo={item.nivelDemora === 'baixo'} class:em_risco={item.nivelDemora === 'moderado'} class:atrasado={item.nivelDemora === 'alto'}>
                    {item.nivelEntregaPct}% entrega · demora {item.nivelDemora}
                  </span>
                </td>
                <td>
                  <b>{item.rendimentoSemanaPct}%</b> na semana · <b>{item.rendimentoAcumuladoPct}%</b> acum. ({item.probabilidadeMaisServicosPct}% prob. +serviços)
                </td>
                <td class="maquina">{dataCurta(per.de)} a {dataCurta(per.ate)}</td>
                <td>
                  <div class="linha">
                    <button type="button" class="link perigo" onclick={() => aoSolicitarRemocao(item.pessoa, 'projeto')}>
                      Remover de {pastaAtual}
                    </button>
                    <button type="button" class="link perigo" onclick={() => aoSolicitarRemocao(item.pessoa, 'organizacao')}>
                      Remover da organização
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <AusenciasPessoa pessoas={analiseEnvio.map((a) => a.pessoa)} aoMudar={aoAtualizarAusencias} />

      {#if todasPessoas.some((p) => p.removidaDaOrganizacao || (p.pastasRemovidas?.length ?? 0) > 0)}
        <div class="historico-removidos-bloco">
          <span class="etiqueta">Pessoas inativas (com histórico preservado na organização)</span>
          <div class="chips">
            {#each todasPessoas.filter((p) => p.removidaDaOrganizacao || (p.pastasRemovidas?.length ?? 0) > 0) as pRem (pRem.id)}
              <span class="pilula">
                {pRem.nome} (histórico: {dataCurta(pRem.historicoDe ?? dataRegistro)} a {dataCurta(pRem.historicoAte ?? dataRegistro)})
                <button type="button" class="link" onclick={() => aoReativarPessoa(pRem.nome)}>
                  reativar em {pastaAtual}
                </button>
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <AcessoEquipe />
    </div>
  </div>
{/if}

{#if confirmacaoRemover}
  <div class="modal-backdrop" role="presentation" onclick={aoCancelarRemocao}>
    <div
      class="modal-janela modal-alerta-remocao"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && aoCancelarRemocao()}
    >
      <span class="etiqueta perigo">Alerta de remoção da organização</span>
      <h2>Remover {confirmacaoRemover.pessoa.nome}?</h2>
      <p class="texto-alerta-remocao">
        Você está removendo <b>{confirmacaoRemover.pessoa.nome}</b>
        {confirmacaoRemover.escopo === 'organizacao' ? 'de toda a sua organização' : `do projeto ${pastaAtual}`}.
      </p>
      <div class="caixa-periodo-preservado">
        O sistema irá desativar esta pessoa para novos envios da organização, <b>mantendo apenas o histórico registrado do dia {dataMedia(confirmacaoRemover.de)} ao dia {dataMedia(confirmacaoRemover.ate)}</b>.
      </div>
      <div class="linha-entre acoes-modal-alerta">
        <button type="button" onclick={aoCancelarRemocao}>Cancelar</button>
        <button type="button" class="principal btn-confirmar-perigo" onclick={aoConfirmarRemocao}>
          Confirmar remoção (manter histórico de {dataCurta(confirmacaoRemover.de)} a {dataCurta(confirmacaoRemover.ate)})
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .linha, .chips { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .linha-entre { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  .rolagem { overflow-x: auto; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(8, 12, 20, 0.76); backdrop-filter: blur(3px); z-index: 900; display: grid; place-items: center; padding: 18px; overflow-y: auto; }
  .modal-janela { background: var(--superficie); border: 1px solid var(--borda-forte); border-radius: var(--raio); padding: 18px; width: 100%; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); }
  .modal-largo { max-width: 1140px; }
  .modal-alerta-remocao { max-width: 520px; border-color: var(--vermelho); }
  .modal-topo h2 { margin: 2px 0 0; font-size: 1.15rem; }
  .tabela-gerenciar-pessoas { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .tabela-gerenciar-pessoas th, .tabela-gerenciar-pessoas td { padding: 8px 10px; border-bottom: 1px solid var(--borda); text-align: left; }
  .historico-removidos-bloco { padding: 10px; background: var(--superficie-2); border-radius: 6px; border: 1px solid var(--borda); }
  .caixa-periodo-preservado { padding: 12px; background: var(--superficie-2); border-left: 3px solid var(--amarelo); border-radius: 6px; font-size: 0.88rem; line-height: 1.4; }
  .btn-confirmar-perigo { background: var(--vermelho); color: #fff; border-color: var(--vermelho); }
  .curto { width: 80px; }
  .link { border: none; background: none; padding: 0; margin-left: 6px; text-decoration: underline; font-size: 0.82rem; cursor: var(--cursor-clique); }
  .perigo { color: var(--vermelho); }
</style>
