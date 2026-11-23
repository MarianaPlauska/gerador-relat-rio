<script lang="ts">
  import { nuvem, tentarDeNovo } from '#lib/nuvem.svelte.ts';

  // o estado real da nuvem, com o erro escrito e um jeito de tentar de novo
  const hora = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<span class="estado-nuvem">
  {#if nuvem.estado === 'ok'}
    <span class="pilula verde">Salvo no Firebase{nuvem.ultimoEnvio ? ` às ${hora(nuvem.ultimoEnvio)}` : ''}</span>
  {:else if nuvem.estado === 'sincronizando'}
    <span class="pilula amarelo">Salvando no Firebase...</span>
  {:else if nuvem.verificando}
    <span class="pilula amarelo">Verificando o Firebase...</span>
  {:else if nuvem.estado === 'erro'}
    <span class="pilula atencao" title={nuvem.erro}>Não salvou no Firebase</span>
    <button class="link" onclick={() => tentarDeNovo()}>tentar de novo</button>
  {:else if nuvem.estado === 'sem_login'}
    <span class="pilula amarelo">Só neste navegador (<a href="/entrar?modo=conta">entrar na conta</a>)</span>
  {:else}
    <span class="pilula">Nuvem desligada</span>
  {/if}
</span>
{#if nuvem.estado === 'erro' && nuvem.erro}
  <p class="erro-nuvem">O Firebase recusou o salvamento: {nuvem.erro}</p>
{/if}
{#if nuvem.aviso}
  <p class="aviso-nuvem">{nuvem.aviso}</p>
{/if}

<style>
  .estado-nuvem
  {
    display: inline-flex;
    align-items: center;
    gap: var(--size-2);
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: 0.82rem;
  }
  .erro-nuvem, .aviso-nuvem
  {
    flex-basis: 100%;
    margin: var(--size-1) 0 0;
    font-size: 0.84rem;
    padding: var(--size-2) var(--size-3);
    border-radius: var(--raio-pequeno);
  }
  .erro-nuvem
  {
    background: var(--vermelho-fundo);
    color: var(--vermelho);
  }
  .aviso-nuvem
  {
    background: var(--amarelo-fundo);
    color: var(--amarelo);
  }
</style>
