<script lang="ts">
  import { extrairRegrasDeTexto } from '@supervisao/core';
  import { lerColagem } from '#lib/colagem.ts';
  import { lerImagem } from '#lib/ocr.ts';

  let { regras, prefixo, aoAdicionarRegras, aoRemoverRegra, aoLimparRegras }: {
    regras: string[];
    prefixo: string;
    aoAdicionarRegras: (novas: string[]) => void;
    aoRemoverRegra: (regra: string) => void;
    aoLimparRegras: () => void;
  } = $props();

  let textoDigitado = $state('');
  let lendo = $state<number | null>(null);
  let mensagem = $state('');

  function adicionarDoTexto()
  {
    const extraidas = extrairRegrasDeTexto(textoDigitado, prefixo);
    if (!extraidas.length)
    {
      mensagem = 'Digite ou cole palavras/frases válidas (códigos de card e números puros são protegidos).';
      return;
    }
    aoAdicionarRegras(extraidas);
    textoDigitado = '';
    mensagem = `${extraidas.length} ${extraidas.length === 1 ? 'regra adicionada' : 'regras adicionadas'}.`;
  }

  async function lerImagensParaRegras(imagens: Blob[])
  {
    try
    {
      const encontradas: string[] = [];
      for (const img of imagens)
      {
        lendo = 0;
        mensagem = 'Lendo recorte do print para criar regras de descarte...';
        const textoLido = await lerImagem(img, (p) => (lendo = p), prefixo);
        encontradas.push(...extrairRegrasDeTexto(textoLido, prefixo));
      }
      if (!encontradas.length)
      {
        mensagem = 'Não encontrei palavras aproveitáveis nesse recorte. Tente recortar mais perto do texto ou digite acima.';
        return;
      }
      aoAdicionarRegras(encontradas);
      mensagem = `${encontradas.length} ${encontradas.length === 1 ? 'regra criada a partir do print' : 'regras criadas a partir do print'}.`;
    }
    catch (erro)
    {
      mensagem = `Erro ao ler recorte: ${String(erro)}`;
    }
    finally
    {
      lendo = null;
    }
  }

  async function aoColar(e: ClipboardEvent)
  {
    const colado = lerColagem(e);
    if (!colado) return;
    if (colado.tipo === 'imagem')
    {
      e.preventDefault();
      await lerImagensParaRegras([colado.imagem]);
    }
  }

  async function aoSoltar(e: DragEvent)
  {
    const imagens = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!imagens.length) return;
    e.preventDefault();
    await lerImagensParaRegras(imagens);
  }
</script>

<details class="cartao regras-descarte-box">
  <summary>
    Regras de descarte nos prints ({regras.length} {regras.length === 1 ? 'regra ativa' : 'regras ativas'}) · escreva ou cole um print do que deve ser ignorado
  </summary>

  <p class="dica">
    Escreva palavras ou frases (uma por linha ou separadas por ;) ou cole/envie um recorte de print com partes que não fazem sentido nas demandas. O sistema cria a regra e ignora esses trechos automaticamente ao transcrever as tarefas.
  </p>

  <div class="linha-regras-input">
    <textarea
      class="zona-regras"
      rows="2"
      bind:value={textoDigitado}
      onpaste={aoColar}
      ondrop={aoSoltar}
      ondragover={(e) => e.preventDefault()}
      onkeydown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || !textoDigitado.includes('\n')))
        {
          e.preventDefault();
          adicionarDoTexto();
        }
      }}
      placeholder="Ex.: Descrição do solicitante:&#10;ou cole aqui (Ctrl+V) um recorte de print com o texto que deve ser descartado"
    ></textarea>

    <div class="acoes-regras">
      <button type="button" class="mini principal" onclick={adicionarDoTexto} disabled={!textoDigitado.trim()}>+ Adicionar regra</button>
      <label class="botao mini">
        Ler de um print
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onchange={async (e) => {
            const arquivos = [...(e.currentTarget.files ?? [])];
            e.currentTarget.value = '';
            if (arquivos.length) await lerImagensParaRegras(arquivos);
          }}
        />
      </label>
      {#if lendo !== null}
        <progress value={lendo}></progress>
      {/if}
    </div>
  </div>

  {#if mensagem}
    <p class="dica msg-regra">{mensagem}</p>
  {/if}

  {#if regras.length}
    <div class="lista-regras-ativas">
      {#each regras as regra (regra)}
        <span class="pilula regra-chip">
          <span>{regra}</span>
          <button
            type="button"
            class="btn-remover-regra"
            title={`Remover regra "${regra}"`}
            onclick={() => aoRemoverRegra(regra)}
          >
            ×
          </button>
        </span>
      {/each}
      <button type="button" class="link perigo" onclick={aoLimparRegras}>limpar todas</button>
    </div>
  {/if}
</details>

<style>
  .regras-descarte-box { padding: 10px 14px; margin-bottom: 12px; }
  summary { cursor: var(--cursor-clique); color: var(--marca); font-weight: 600; font-size: 0.88rem; }
  .dica { margin: 8px 0 6px; font-size: 0.82rem; color: var(--suave); }
  .linha-regras-input { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
  .zona-regras { width: 100%; background: var(--superficie-2); border: 1.5px dashed var(--borda-forte); border-radius: var(--raio-pequeno); padding: 8px 10px; font-size: 0.84rem; resize: vertical; }
  .acoes-regras { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .msg-regra { color: var(--marca); font-weight: 600; margin: 6px 0 2px; }
  .lista-regras-ativas { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
  .regra-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--superficie-2); border: 1px solid var(--borda-forte); color: var(--texto); padding: 3px 8px; font-size: 0.78rem; }
  .btn-remover-regra { border: none; background: none; color: var(--suave); padding: 0 2px; font-size: 0.9rem; line-height: 1; cursor: var(--cursor-clique); }
  .btn-remover-regra:hover { color: var(--vermelho); }
  .link { border: none; background: none; padding: 0; margin-left: 6px; text-decoration: underline; font-size: 0.8rem; cursor: var(--cursor-clique); }
  .perigo { color: var(--vermelho); }
</style>
