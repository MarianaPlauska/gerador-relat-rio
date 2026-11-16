<script lang="ts">
  import { onMount } from 'svelte';

  // Fases: 'cobrinha' (animação da cobrinha comendo os commits) -> 'mascote' (vira o rostinho tech simpático)
  let fase = $state<'cobrinha' | 'mascote'>('cobrinha');
  let passoCobrinha = $state(0);
  let piscando = $state(false);
  let reagindo = $state(false);
  let fala = $state<string | null>(null);

  // Grade 7x3 representando o gráfico de commits do GitHub
  // 0 = vazio escuro, 1 = verde fraco, 2 = verde médio, 3 = verde forte, 4 = cobrinha / comido
  const gradeInicial = [
    [1, 0, 2, 1, 0, 3, 1],
    [2, 3, 1, 2, 1, 0, 2],
    [0, 1, 3, 0, 2, 3, 1],
  ];

  // Caminho da cobrinha pelas coordenadas [linha, coluna]
  const caminho = [
    [0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0],
    [2, 0], [2, 1], [2, 2], [2, 3], [1, 3], [0, 3],
    [0, 4], [0, 5], [1, 5], [1, 4], [2, 4], [2, 5],
    [2, 6], [1, 6], [0, 6]
  ];

  let visitados = $state<Set<string>>(new Set());

  function iniciarCobrinha()
  {
    fase = 'cobrinha';
    passoCobrinha = 0;
    visitados = new Set();
    fala = 'Carregando commits...';

    const intervalo = setInterval(() =>
    {
      if (passoCobrinha < caminho.length)
      {
        const coord = caminho[passoCobrinha]!;
        visitados.add(`${coord[0]}-${coord[1]}`);
        passoCobrinha++;
      }
      else
      {
        clearInterval(intervalo);
        setTimeout(() =>
        {
          fase = 'mascote';
          fala = 'OrbisOS pronto! Tudo offline e no seu ritmo.';
          setTimeout(() => (fala = null), 4000);
        }, 350);
      }
    }, 90);
  }

  onMount(() =>
  {
    iniciarCobrinha();

    // Piscar olhos periodicamente
    const timerPiscar = setInterval(() =>
    {
      if (fase === 'mascote')
      {
        piscando = true;
        setTimeout(() => (piscando = false), 200);
      }
    }, 3800);

    return () => clearInterval(timerPiscar);
  });

  function clicarMascote()
  {
    if (fase === 'mascote')
    {
      reagindo = true;
      const frases = [
        'Olá Mariana! Painel pronto.',
        'Supervisão 100% no seu navegador!',
        'Cobrinha alimentada com sucesso!',
        'Semáforo da semana calculado.',
        'Tudo sob controle por aqui! ✨',
      ];
      fala = frases[Math.floor(Math.random() * frases.length)] ?? 'Olá!';
      setTimeout(() => (reagindo = false), 600);
      setTimeout(() => (fala = null), 3500);
    }
    else
    {
      fase = 'mascote';
    }
  }
</script>

<div class="mascote-conteiner">
  {#if fala}
    <div class="balao-fala" role="status">
      <span>{fala}</span>
      <div class="seta-balao"></div>
    </div>
  {/if}

  {#if fase === 'cobrinha'}
    <!-- FASE 1: COBRINHA DO GITHUB -->
    <div class="caixa-cobrinha" title="Cobrinha do GitHub comendo os commits...">
      <div class="grade-commits">
        {#each gradeInicial as linha, r}
          <div class="linha-commits">
            {#each linha as nivel, c}
              {@const chave = `${r}-${c}`}
              {@const comido = visitados.has(chave)}
              {@const cabeca = caminho[passoCobrinha - 1]?.[0] === r && caminho[passoCobrinha - 1]?.[1] === c}
              <div
                class="celula-commit nivel-{nivel}"
                class:comido
                class:cabeca
              ></div>
            {/each}
          </div>
        {/each}
      </div>
      <span class="legenda-cobrinha">git activity 🐍</span>
    </div>
  {:else}
    <!-- FASE 2: O BICHINHO / ROSTINHO TECH (ORBI) -->
    <button
      class="bichinho-botao"
      class:reagindo
      onclick={clicarMascote}
      title="OrbisOS Mascot · Clique para interagir ou reiniciar a cobrinha"
      aria-label="Mascote Orbi"
    >
      <div class="bichinho-corpo">
        <div class="antena">
          <div class="antena-luz"></div>
        </div>
        <div class="rosto">
          <!-- Olhos expressivos -->
          <div class="olhos" class:fechados={piscando}>
            <div class="olho esquerdo">
              <div class="brilho"></div>
            </div>
            <div class="olho direito">
              <div class="brilho"></div>
            </div>
          </div>
          <!-- Bochechas rosadas -->
          <div class="bochechas">
            <span class="bochecha"></span>
            <span class="bochecha"></span>
          </div>
          <!-- Boquinha sorrindo -->
          <div class="boca" class:aberta={reagindo}></div>
        </div>
      </div>
    </button>
    <button class="btn-reiniciar-cobrinha" onclick={iniciarCobrinha} title="Ver a cobrinha do GitHub novamente">
      🐍
    </button>
  {/if}
</div>

<style>
  .mascote-conteiner
  {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
  }
  .balao-fala
  {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: var(--superficie);
    border: 1px solid var(--marca);
    border-radius: var(--raio-pequeno);
    padding: 6px 12px;
    font-size: 0.76rem;
    font-weight: 500;
    color: var(--texto);
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 50;
    animation: surgir 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .seta-balao
  {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--marca);
  }
  @keyframes surgir
  {
    from { opacity: 0; transform: translate(-50%, 4px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  /* COBRINHA DO GITHUB */
  .caixa-cobrinha
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--borda);
    border-radius: 8px;
  }
  .grade-commits
  {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .linha-commits
  {
    display: flex;
    gap: 3px;
  }
  .celula-commit
  {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: #161b22;
    transition: background 0.12s, transform 0.12s;
  }
  .celula-commit.nivel-1 { background: #0e4429; }
  .celula-commit.nivel-2 { background: #006d32; }
  .celula-commit.nivel-3 { background: #26a641; }

  .celula-commit.comido
  {
    background: #39d353 !important;
    box-shadow: 0 0 5px rgba(57, 211, 83, 0.8);
    transform: scale(1.1);
  }
  .celula-commit.cabeca
  {
    background: #ffffff !important;
    box-shadow: 0 0 8px #ffffff;
    transform: scale(1.25);
    border-radius: 50%;
  }
  .legenda-cobrinha
  {
    font-family: var(--fonte-maquina);
    font-size: 0.62rem;
    color: #39d353;
  }

  /* BICHINHO / ROSTINHO (ORBI) */
  .bichinho-botao
  {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .bichinho-botao:hover
  {
    transform: translateY(-2px) scale(1.05);
  }
  .bichinho-botao.reagindo
  {
    transform: translateY(-4px) scale(1.15) rotate(5deg);
  }
  .bichinho-corpo
  {
    position: relative;
    width: 44px;
    height: 40px;
    background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
    border-radius: 16px 16px 12px 12px;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .antena
  {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: 6px;
    background: #10b981;
  }
  .antena-luz
  {
    position: absolute;
    top: -4px;
    left: -2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 6px #34d399;
    animation: pulso-luz 2s infinite;
  }
  @keyframes pulso-luz
  {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.3); }
  }
  .rosto
  {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
  }
  .olhos
  {
    display: flex;
    gap: 12px;
    transition: transform 0.15s;
  }
  .olho
  {
    position: relative;
    width: 7px;
    height: 9px;
    background: #0f172a;
    border-radius: 50%;
    transition: height 0.15s;
  }
  .olho .brilho
  {
    position: absolute;
    top: 1px;
    right: 1px;
    width: 2.5px;
    height: 2.5px;
    background: #ffffff;
    border-radius: 50%;
  }
  .olhos.fechados .olho
  {
    height: 2px;
    border-radius: 1px;
    margin-top: 4px;
  }
  .olhos.fechados .brilho
  {
    display: none;
  }
  .bochechas
  {
    display: flex;
    gap: 20px;
    position: absolute;
    top: 20px;
  }
  .bochecha
  {
    width: 5px;
    height: 3px;
    background: rgba(244, 63, 94, 0.45);
    border-radius: 50%;
  }
  .boca
  {
    width: 6px;
    height: 3px;
    border-bottom: 2px solid #0f172a;
    border-radius: 0 0 4px 4px;
    transition: all 0.15s;
  }
  .boca.aberta
  {
    width: 7px;
    height: 5px;
    background: #0f172a;
    border-radius: 2px 2px 5px 5px;
    border-bottom: none;
  }
  .btn-reiniciar-cobrinha
  {
    font-size: 0.85rem;
    padding: 3px 6px;
    background: transparent;
    border: 1px solid var(--borda);
    border-radius: var(--raio-pequeno);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .btn-reiniciar-cobrinha:hover
  {
    opacity: 1;
    border-color: var(--marca);
  }
</style>
