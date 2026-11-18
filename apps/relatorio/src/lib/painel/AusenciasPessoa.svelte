<script lang="ts">
  import type { Ausencia, Pessoa } from '@supervisao/core';
  import { dataCurta } from '#lib/semana.ts';

  let { pessoas, aoMudar }: { pessoas: Pessoa[]; aoMudar: (pessoa: Pessoa, ausencias: Ausencia[]) => void } = $props();

  // rascunho do período novo de cada pessoa
  let rascunho = $state<Record<string, { de: string; ate: string; motivo: string }>>({});

  const atual = (id: string) => (rascunho[id] ??= { de: '', ate: '', motivo: '' });
  const valido = (id: string) =>
  {
    const r = rascunho[id];
    return !!r && !!r.de && (!r.ate || r.ate >= r.de);
  };

  function adicionar(p: Pessoa)
  {
    const r = rascunho[p.id];
    if (!r || !valido(p.id)) return;
    const nova: Ausencia = { de: r.de, ate: r.ate || r.de, ...(r.motivo.trim() ? { motivo: r.motivo.trim() } : {}) };
    aoMudar(p, [...(p.ausencias ?? []), nova].sort((a, b) => a.de.localeCompare(b.de)));
    rascunho[p.id] = { de: '', ate: '', motivo: '' };
  }

  function remover(p: Pessoa, indice: number)
  {
    aoMudar(p, (p.ausencias ?? []).filter((_, i) => i !== indice));
  }
</script>

<div class="ausencias">
  <span class="etiqueta">Ausências e férias (dias sem expediente no cronograma)</span>
  <p class="dica">Feriados já são considerados para todos. Aqui entram férias, atestado e folga de cada pessoa: o cronograma pula esses dias e a fila anda depois.</p>
  {#each pessoas as p (p.id)}
    <div class="pessoa-ausencia">
      <b>{p.nome}</b>
      <div class="chips">
        {#each p.ausencias ?? [] as a, i (`${a.de}-${a.ate}-${i}`)}
          <span class="pilula">
            {dataCurta(a.de)}{a.ate !== a.de ? ` a ${dataCurta(a.ate)}` : ''}{a.motivo ? ` (${a.motivo})` : ''}
            <button type="button" class="link perigo" onclick={() => remover(p, i)}>remover</button>
          </span>
        {:else}
          <span class="dica-curta">Nenhuma ausência registrada</span>
        {/each}
      </div>
      <div class="linha novo-periodo">
        <label class="mini">De <input type="date" bind:value={() => atual(p.id).de, (v) => (atual(p.id).de = v)} /></label>
        <label class="mini">Até <input type="date" bind:value={() => atual(p.id).ate, (v) => (atual(p.id).ate = v)} min={atual(p.id).de} /></label>
        <input class="motivo" bind:value={() => atual(p.id).motivo, (v) => (atual(p.id).motivo = v)} placeholder="Motivo (opcional)" />
        <button type="button" disabled={!valido(p.id)} onclick={() => adicionar(p)}>+ Ausência</button>
      </div>
    </div>
  {/each}
</div>

<style>
  .ausencias { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--borda); }
  .pessoa-ausencia { display: grid; gap: 4px; padding: 8px 10px; background: var(--superficie-2); border: 1px solid var(--borda); border-radius: var(--raio-pequeno); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .novo-periodo { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; }
  .novo-periodo .motivo { flex: 1 1 160px; }
  .dica-curta { color: var(--suave); font-size: 0.78rem; }
</style>
