<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { goto } from '$app/navigation';
  import { semAcento } from '@supervisao/core';
  import { carregar } from '#lib/armazenamento.ts';

  interface Comando
  {
    grupo: string;
    nome: string;
    dica?: string;
    busca: string;
    executar: () => void;
  }

  let { aberta = $bindable(false), trocarTema, baixarBackup, sair }: { aberta: boolean; trocarTema: () => void; baixarBackup: () => void; sair: () => void } = $props();

  let consulta = $state('');
  let marcado = $state(0);
  let comandos = $state<Comando[]>([]);

  const ir = (rota: string) => () => goto(rota);
  const criar = (grupo: string, nome: string, executar: () => void, dica?: string): Comando => ({ grupo, nome, dica, executar, busca: semAcento(`${grupo} ${nome} ${dica ?? ''}`) });

  function montar(): Comando[]
  {
    const dados = carregar();
    const paginas: [string, string, string?][] = [
      ['Início', '/'], ['Diário do painel', '/painel'], ['Cards', '/cards'], ['Semana', '/semana'], ['Atas e Combinados', '/atas'], ['Listas', '/listas'], ['Fluxos', '/fluxos'], ['Planilhas', '/planilhas'], ['Priorização', '/priorizacao'],
      ['Checklist diário', '/vivos'], ['Relatório (PDF)', '/relatorio'], ['Visão do mês', '/mes'], ['Modelos de relatório', '/modelos'],
      ['Retornos dos links', '/retornos'], ['Meu perfil', '/perfil'], ['Roadmap', '/roadmap'],
    ];
    const lista: Comando[] = paginas.map(([nome, rota]) => criar('Ir para', nome, ir(rota!)));
    lista.push(
      criar('Ação', 'Nova ata de reunião', ir('/atas'), 'resumo executivo e radar de combinados'),
      criar('Ação', 'Nova matriz de priorização', ir('/priorizacao'), 'Impacto x Esforço e RICE'),
      criar('Ação', 'Novo checklist diário', ir('/vivos'), 'registrar todo dia'),
      criar('Ação', 'Novo fluxograma', ir('/fluxos'), 'mapear um processo'),
      criar('Ação', 'Nova lista de checagem', ir('/listas')),
      criar('Ação', 'Nova planilha', ir('/planilhas'), 'organizar material solto com IA gratuita'),
      criar('Ação', 'Novo registro no diário do painel', ir('/painel')),
      criar('Ação', 'Gerar PDF da semana', ir('/relatorio')),
      criar('Ação', 'Trocar tema claro ou escuro', trocarTema),
      criar('Ação', 'Baixar backup', baixarBackup),
      criar('Ação', 'Sair', sair),
    );
    for (const a of dados.atas) lista.push(criar('Ata', a.titulo, ir(`/atas?id=${a.id}`), a.data));
    for (const m of dados.matrizes) lista.push(criar('Priorização', m.nome, ir(`/priorizacao?id=${m.id}`), `${m.itens.length} itens`));
    for (const l of dados.listas) lista.push(criar('Lista', l.nome, ir(`/listas?id=${l.id}`)));
    for (const f of dados.fluxos) lista.push(criar('Fluxo', f.nome, ir(`/fluxos?id=${f.id}`)));
    for (const p of dados.planilhas) lista.push(criar('Planilha', p.nome, ir(`/planilhas?id=${p.id}`)));
    for (const v of dados.vivos) lista.push(criar('Checklist', v.nome, ir(`/vivos?id=${v.id}`), v.encerradoEm ? 'encerrado' : 'em andamento'));
    const cards = dados.fotos.at(-1)?.cards ?? [];
    for (const c of cards) lista.push(criar('Card', `${c.codigo} ${c.titulo}`, ir(`/cards?q=${encodeURIComponent(c.codigo)}`)));
    return lista;
  }

  const resultados = $derived.by(() =>
  {
    const termos = semAcento(consulta).split(/\s+/).filter(Boolean);
    if (!termos.length) return comandos.filter((c) => c.grupo !== 'Card').slice(0, 12);
    return comandos
      .filter((c) => termos.every((t) => c.busca.includes(t)))
      .sort((a, b) => Number(semAcento(b.nome).startsWith(termos[0]!)) - Number(semAcento(a.nome).startsWith(termos[0]!)))
      .slice(0, 12);
  });

  $effect(() =>
  {
    if (aberta)
    {
      comandos = montar();
      consulta = '';
      marcado = 0;
    }
  });

  $effect(() =>
  {
    consulta;
    marcado = 0;
  });

  function executar(c: Comando | undefined)
  {
    if (!c) return;
    aberta = false;
    c.executar();
  }

  function teclas(e: KeyboardEvent)
  {
    if (e.key === 'ArrowDown')
    {
      e.preventDefault();
      marcado = Math.min(marcado + 1, resultados.length - 1);
    }
    else if (e.key === 'ArrowUp')
    {
      e.preventDefault();
      marcado = Math.max(marcado - 1, 0);
    }
    else if (e.key === 'Enter')
    {
      e.preventDefault();
      executar(resultados[marcado]);
    }
  }

  // a Início tem um campo que abre a paleta por este evento
  $effect(() =>
  {
    const abrir = () => (aberta = true);
    window.addEventListener('orbispaleta', abrir);
    return () => window.removeEventListener('orbispaleta', abrir);
  });

  function atalhoGlobal(e: KeyboardEvent)
  {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
    {
      e.preventDefault();
      aberta = !aberta;
    }
  }
</script>

<svelte:window onkeydown={atalhoGlobal} />

<Dialog.Root bind:open={aberta}>
  <Dialog.Portal>
    <Dialog.Overlay class="paleta-fundo" />
    <Dialog.Content class="paleta" aria-label="Paleta de comandos">
      <Dialog.Title class="paleta-titulo">Paleta de comandos</Dialog.Title>
      <input class="paleta-busca" bind:value={consulta} onkeydown={teclas} placeholder="Digite uma tela, ação, lista, fluxo ou card (DEV-198)..." />
      <ul class="paleta-lista" role="listbox">
        {#each resultados as c, i (c.grupo + c.nome + i)}
          <li role="option" aria-selected={i === marcado}>
            <button class:marcado={i === marcado} onclick={() => executar(c)} onmousemove={() => (marcado = i)}>
              <span class="grupo">{c.grupo}</span>
              <span class="nome">{c.nome}</span>
              {#if c.dica}<span class="dica-item">{c.dica}</span>{/if}
            </button>
          </li>
        {:else}
          <li class="vazio">Nada encontrado para "{consulta}".</li>
        {/each}
      </ul>
      <div class="paleta-rodape"><span>↑ ↓ escolhe</span><span>Enter abre</span><span>Esc fecha</span></div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.paleta-fundo)
  {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(8 11 15 / 60%);
    backdrop-filter: blur(2px);
  }
  :global(.paleta)
  {
    position: fixed;
    z-index: 61;
    top: 14vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 24px));
    background: var(--superficie);
    border: 1px solid var(--borda-forte);
    border-radius: var(--raio);
    box-shadow: var(--sombra), 0 0 0 1px color-mix(in srgb, var(--marca) 25%, transparent);
    overflow: hidden;
  }
  :global(.paleta-titulo)
  {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .paleta-busca
  {
    width: 100%;
    border: none;
    border-bottom: 1px solid var(--borda);
    border-radius: 0;
    background: transparent;
    padding: var(--size-4);
    font-family: var(--fonte-maquina);
    font-size: 1rem;
  }
  .paleta-busca:focus
  {
    box-shadow: none;
  }
  .paleta-lista
  {
    list-style: none;
    margin: 0;
    padding: var(--size-2);
    max-height: 52vh;
    overflow-y: auto;
  }
  .paleta-lista button
  {
    width: 100%;
    display: grid;
    grid-template-columns: 90px 1fr auto;
    gap: var(--size-3);
    align-items: baseline;
    text-align: left;
    border: none;
    background: transparent;
    padding: var(--size-2) var(--size-3);
    border-radius: var(--raio-pequeno);
    font-family: var(--fonte-texto);
    font-size: 0.92rem;
  }
  .paleta-lista button.marcado
  {
    background: var(--marca-clara);
  }
  .grupo
  {
    font-family: var(--fonte-maquina);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--marca);
  }
  .nome
  {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dica-item
  {
    color: var(--suave);
    font-size: 0.78rem;
  }
  .vazio
  {
    padding: var(--size-4);
    color: var(--suave);
    font-size: 0.9rem;
  }
  .paleta-rodape
  {
    display: flex;
    gap: var(--size-4);
    padding: var(--size-2) var(--size-4);
    border-top: 1px solid var(--borda);
    font-family: var(--fonte-maquina);
    font-size: 0.72rem;
    color: var(--suave);
  }
</style>
