<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import
  {
    agoraLocal, alternarItem, camposParaRelatorio, camposVivo, diasSemRegistro, definicoesPadrao, entradasDoCampo, idCurto, itemFeito, nomesCampoVivo, novoVivo,
    progressoVivo, registrar, registrouHoje, segundaDaSemana, somarDias, type CampoVivo, type RelatorioVivo,
  } from '@supervisao/core';
  import { carregar, salvar, type Dados } from '#lib/armazenamento.ts';
  import { acharModelo, chaveDoRelatorio, todosModelos } from '#lib/modelos.ts';
  import { dataCurta, hoje, periodoDaSemana } from '#lib/semana.ts';

  let dados = $state<Dados>(carregar());
  $effect(() => salvar($state.snapshot(dados)));

  const dia = hoje();
  const abertoId = $derived(page.url.searchParams.get('id'));
  const aberto = $derived(dados.vivos.find((v) => v.id === abertoId));
  const modelos = $derived(todosModelos(dados));

  const mesAtual = dia.slice(0, 7);
  const fimDoMes = (ym: string) => `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;

  let nome = $state('');
  let modeloNovo = $state(dados.ultimoModelo);
  let semanaNova = $state(segundaDaSemana(dia));
  let de = $state(`${mesAtual}-01`);
  let ate = $state(fimDoMes(mesAtual));
  const modeloEscolhido = $derived(acharModelo(dados, modeloNovo));
  let campo = $state<CampoVivo>('destaques');
  let texto = $state('');
  let novoItem = $state('');
  let novoItemDiario = $state(false);

  const abertos = $derived(dados.vivos.filter((v) => !v.encerradoEm));
  const encerrados = $derived(dados.vivos.filter((v) => v.encerradoEm));

  const rotuloPeriodo = (v: RelatorioVivo) => (v.livre ? `${dataCurta(v.inicio)} a ${dataCurta(v.fim)}` : `semana de ${dataCurta(v.inicio)} a ${dataCurta(v.fim)}`);

  function criar()
  {
    const livre = modeloEscolhido.periodo === 'livre';
    const inicio = livre ? de : semanaNova;
    const fim = livre ? ate : somarDias(semanaNova, 4);
    const padrao = `${modeloEscolhido.nome}, ${livre ? `${dataCurta(inicio)} a ${dataCurta(fim)}` : `semana de ${dataCurta(inicio)}`}`;
    const v = novoVivo(nome || padrao, modeloEscolhido.id, inicio, fim, livre, agoraLocal());
    dados.vivos.push(v);
    nome = '';
    goto(`/vivos?id=${v.id}`);
  }

  function registrarHoje()
  {
    if (!aberto) return;
    registrar(aberto, campo, texto, agoraLocal());
    texto = '';
  }

  function adicionarItem()
  {
    const t = novoItem.trim();
    if (!aberto || !t) return;
    aberto.itens.push({ id: idCurto(), texto: t, diario: novoItemDiario });
    novoItem = '';
  }

  function excluirEntrada(v: RelatorioVivo, id: string)
  {
    v.entradas = v.entradas.filter((e) => e.id !== id);
  }

  function excluirVivo(v: RelatorioVivo)
  {
    if (!confirm(`Excluir "${v.nome}" e todos os registros dele?`)) return;
    dados.vivos = dados.vivos.filter((x) => x.id !== v.id);
    goto('/vivos');
  }

  // põe o que foi registrado nos campos do relatório do mesmo período e abre a tela do relatório
  function abrirNoRelatorio(v: RelatorioVivo)
  {
    const periodo = v.livre ? { inicio: v.inicio, fim: v.fim, livre: true } : periodoDaSemana(v.inicio);
    const chave = chaveDoRelatorio(periodo);
    dados.relatorios[chave] = { ...dados.relatorios[chave], ...camposParaRelatorio(v) };
    dados.ultimoModelo = v.modeloId;
    salvar($state.snapshot(dados));
    goto(v.livre ? `/relatorio?de=${v.inicio}&ate=${v.fim}` : `/relatorio?semana=${v.inicio}`);
  }

  const hora = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
</script>

<main>
  {#if aberto}
    {@const v = aberto}
    {@const pr = progressoVivo(v, dia)}
    {@const atraso = diasSemRegistro(v, dia, definicoesPadrao.feriados)}
    <header>
      <div>
        <span class="prompt">&gt; <a href="/vivos">vivos</a> / {acharModelo(dados, v.modeloId).nome}</span>
        <h1>{v.nome}<span class="cursor">_</span></h1>
      </div>
      <button class="principal" onclick={() => abrirNoRelatorio(v)}>Abrir no Relatório</button>
    </header>

    <p class="dica periodo">{rotuloPeriodo(v)} · {pr.feitos} de {pr.total} itens de hoje · {v.entradas.length} {v.entradas.length === 1 ? 'registro' : 'registros'}</p>
    <span class="barra"><span style:width="{pr.pct}%"></span></span>

    {#if !v.encerradoEm && atraso > 0}
      <p class="aviso">Faz {atraso} {atraso === 1 ? 'dia útil' : 'dias úteis'} sem registro neste relatório.</p>
    {/if}

    <div class="grade">
      <div class="coluna">
        <section class="cartao">
          <h2>Registrar hoje</h2>
          <div class="registro">
            <select bind:value={campo} aria-label="Campo do relatório">
              {#each camposVivo as c (c)}<option value={c}>{nomesCampoVivo[c]}</option>{/each}
            </select>
            <textarea
              rows="3"
              bind:value={texto}
              placeholder="O que andou, o que travou, o que a gestão precisa saber. Ctrl+Enter registra."
              onkeydown={(e) => e.ctrlKey && e.key === 'Enter' && registrarHoje()}
            ></textarea>
            <div class="linha">
              <button class="principal" disabled={!texto.trim()} onclick={registrarHoje}>Registrar</button>
              <span class="dica">{registrouHoje(v, dia) ? 'Hoje já tem registro.' : 'Nada registrado hoje.'}</span>
            </div>
          </div>
        </section>

        {#each camposVivo as c (c)}
          {@const lista = entradasDoCampo(v, c)}
          <section class="cartao">
            <h2>{nomesCampoVivo[c]} ({lista.length})</h2>
            {#each lista as e (e.id)}
              <div class="entrada">
                <span class="quando maquina">{hora(e.quando)}</span>
                <span class="texto">{e.texto}</span>
                <button class="x" title="Excluir registro" aria-label="Excluir registro" onclick={() => excluirEntrada(v, e.id)}>x</button>
              </div>
            {:else}
              <p class="dica">Sem registros. O texto deste campo no relatório sai daqui, na ordem das datas.</p>
            {/each}
          </section>
        {/each}
      </div>

      <aside class="coluna">
        <section class="cartao">
          <h2>Checklist</h2>
          {#each v.itens as item (item.id)}
            <div class="item">
              <label>
                <input type="checkbox" checked={itemFeito(item, dia)} onchange={() => alternarItem(item, dia)} />
                <span class:feito={itemFeito(item, dia)}>{item.texto}</span>
              </label>
              {#if item.diario}<span class="etiqueta">todo dia</span>{/if}
              <button class="x" title="Tirar do checklist" aria-label="Tirar do checklist" onclick={() => (v.itens = v.itens.filter((i) => i.id !== item.id))}>x</button>
            </div>
          {/each}
          <div class="novo-item">
            <input bind:value={novoItem} placeholder="Novo item" onkeydown={(e) => e.key === 'Enter' && adicionarItem()} />
            <label class="diario"><input type="checkbox" bind:checked={novoItemDiario} /> todo dia</label>
            <button disabled={!novoItem.trim()} onclick={adicionarItem}>Adicionar</button>
          </div>
        </section>

        <section class="cartao">
          <h2>Fechar e enviar</h2>
          <ol class="passos">
            {#if v.livre}
              <li>Conferir o mês na <a href="/mes">Visão do mês</a>.</li>
            {:else}
              <li>Conferir o plano e fechar a semana em <a href="/semana">Semana</a>.</li>
            {/if}
            <li><button class="link" onclick={() => abrirNoRelatorio(v)}>Abrir no Relatório</button>: os registros viram os campos do período.</li>
            <li>No Relatório, baixar o PDF ou publicar o link.</li>
            <li>Acompanhar as marcas e os comentários em <a href="/retornos">Retornos</a>.</li>
          </ol>
          <div class="linha">
            {#if v.encerradoEm}
              <button onclick={() => (v.encerradoEm = undefined)}>Reabrir</button>
            {:else}
              <button onclick={() => (v.encerradoEm = agoraLocal())}>Encerrar</button>
            {/if}
            <button class="perigo" onclick={() => excluirVivo(v)}>Excluir</button>
          </div>
        </section>
      </aside>
    </div>
  {:else}
    <span class="prompt">&gt; vivos</span>
    <h1>Relatórios vivos<span class="cursor">_</span></h1>
    <p class="dica">Um relatório que fica aberto: você registra um pouco por dia, marca o checklist e, no fim, gera o PDF.</p>

    <section class="cartao">
      <h2>Novo relatório vivo</h2>
      <div class="form">
        <label>Nome <input bind:value={nome} placeholder="deixe vazio para usar o nome do modelo" /></label>
        <label>Modelo
          <select bind:value={modeloNovo}>
            {#each modelos as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
          </select>
        </label>
        {#if modeloEscolhido.periodo === 'livre'}
          <label>De <input type="date" bind:value={de} /></label>
          <label>Até <input type="date" bind:value={ate} /></label>
        {:else}
          <label>Semana de <input type="date" bind:value={semanaNova} onchange={() => (semanaNova = segundaDaSemana(semanaNova))} /></label>
        {/if}
        <button class="principal" onclick={criar}>Criar</button>
      </div>
    </section>

    {#each [{ titulo: 'Em andamento', lista: abertos }, { titulo: 'Encerrados', lista: encerrados }] as grupo (grupo.titulo)}
      {#if grupo.lista.length}
        <h3>{grupo.titulo} ({grupo.lista.length})</h3>
        <div class="cartoes">
          {#each grupo.lista as v (v.id)}
            {@const pr = progressoVivo(v, dia)}
            <a class="vivo cartao" href="/vivos?id={v.id}">
              <b>{v.nome}</b>
              <span class="dica">{acharModelo(dados, v.modeloId).nome} · {rotuloPeriodo(v)}</span>
              <span class="barra"><span style:width="{pr.pct}%"></span></span>
              <span class="dica maquina">{pr.feitos}/{pr.total} hoje · {v.entradas.length} registros · {registrouHoje(v, dia) ? 'registrou hoje' : 'sem registro hoje'}</span>
            </a>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</main>

<style>
  .periodo
  {
    margin: 0 0 var(--size-2);
  }
  .barra
  {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--borda);
    overflow: hidden;
  }
  .barra span
  {
    display: block;
    height: 100%;
    background: var(--marca);
  }
  .grade
  {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: var(--size-4);
    align-items: start;
    margin-top: var(--size-4);
  }
  .coluna
  {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    min-width: 0;
  }
  .coluna .cartao
  {
    margin-top: 0;
  }
  .coluna .cartao > h2::before
  {
    content: '// ';
    color: var(--marca);
  }
  .registro, .form
  {
    display: grid;
    gap: var(--size-3);
  }
  .form
  {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    align-items: end;
  }
  .form label
  {
    display: grid;
    gap: var(--size-1);
  }
  textarea
  {
    resize: vertical;
  }
  .linha
  {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-3);
  }
  .entrada
  {
    display: grid;
    grid-template-columns: 96px 1fr auto;
    gap: var(--size-3);
    padding: var(--size-2) 0;
    border-bottom: 1px dashed var(--borda);
    align-items: start;
  }
  .entrada:last-child
  {
    border-bottom: none;
  }
  .quando
  {
    color: var(--marca);
    font-size: 0.8rem;
  }
  .texto
  {
    white-space: pre-wrap;
    font-size: 0.92rem;
  }
  .x
  {
    padding: 0 var(--size-2);
    border: none;
    background: none;
    color: var(--suave);
    font-size: 1rem;
  }
  .x:hover:not(:disabled)
  {
    color: var(--vermelho);
  }
  .item
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
    padding: var(--size-1) 0;
  }
  .item label
  {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--size-2);
    color: var(--texto);
    font-size: 0.92rem;
  }
  .feito
  {
    color: var(--suave);
    text-decoration: line-through;
  }
  .novo-item
  {
    display: grid;
    gap: var(--size-2);
    margin-top: var(--size-3);
  }
  .diario
  {
    display: flex;
    align-items: center;
    gap: var(--size-2);
  }
  .passos
  {
    margin: 0 0 var(--size-3);
    padding-left: var(--size-5);
    font-size: 0.9rem;
    display: grid;
    gap: var(--size-2);
  }
  .link
  {
    border: none;
    background: none;
    color: var(--marca);
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }
  .perigo
  {
    color: var(--vermelho);
  }
  .cartoes
  {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--size-4);
  }
  .vivo
  {
    display: grid;
    gap: var(--size-2);
    margin-top: 0;
    text-decoration: none;
    color: var(--texto);
    transition: border-color 0.2s;
  }
  .vivo:hover
  {
    border-color: var(--marca);
  }
  @media (max-width: 900px)
  {
    .grade
    {
      grid-template-columns: 1fr;
    }
  }
</style>
