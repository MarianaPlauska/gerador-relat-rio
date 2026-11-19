<script lang="ts">
  let { receber }: { receber: (texto: string, origem: string) => void } = $props();

  let ultima = $state('');

  // roda na página do painel: põe o valor dos campos (nome da etapa, responsável) no texto, lê a página como o Ctrl+C
  // e manda para esta tela do OrbisOS, repetindo até ela confirmar o recebimento
  const codigo = (destino: string) => `javascript:(()=>{const O=${JSON.stringify(destino)};const ocultos=[];const extras=[];document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select').forEach((el)=>{const v=el.tagName==='SELECT'?(el.selectedOptions[0]?el.selectedOptions[0].text:''):el.value;if(el.tagName==='SELECT'){ocultos.push([el,el.style.display]);el.style.display='none';}if(!v)return;const s=document.createElement('span');s.textContent=' '+v+' ';el.after(s);extras.push(s);});const t=document.body.innerText;extras.forEach((s)=>s.remove());ocultos.forEach(([el,d])=>{el.style.display=d;});const w=window.open(O+'/painel','orbisos');if(!w){alert('Permita pop-ups deste site para enviar ao OrbisOS.');return;}let n=0;const i=setInterval(()=>{w.postMessage({tipo:'orbisos-captura',texto:t,url:location.href},O);if(++n>40)clearInterval(i);},500);window.addEventListener('message',(e)=>{if(e.origin===O&&e.data==='orbisos-recebido')clearInterval(i);});})()`;

  const link = $derived(typeof location === 'undefined' ? '#' : codigo(location.origin));

  $effect(() =>
  {
    const ouvir = (e: MessageEvent) =>
    {
      const d = e.data as { tipo?: unknown; texto?: unknown; url?: unknown } | null;
      if (!d || d.tipo !== 'orbisos-captura' || typeof d.texto !== 'string' || !d.texto.trim()) return;
      // a confirmação não leva dado nenhum; '*' porque uma página sem origem (about:blank) não aceita o nome da origem
      (e.source as Window | null)?.postMessage('orbisos-recebido', '*');
      // o botão repete o envio até a confirmação: o mesmo texto entra uma vez só
      if (d.texto === ultima) return;
      ultima = d.texto;
      receber(d.texto, typeof d.url === 'string' ? d.url : e.origin);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  });
</script>

<details class="cartao um-clique">
  <summary><b>Captura em 1 clique</b> <span class="dica">ler a página do painel sem copiar nem printar</span></summary>
  <ol>
    <li>Arraste este botão para a barra de favoritos do navegador: <a class="botao favorito" href={link} onclick={(e) => e.preventDefault()} title="Arraste para a barra de favoritos">Enviar ao OrbisOS</a></li>
    <li>No painel do gestor, abra a lista ou o card que quer registrar e clique no favorito.</li>
    <li>O OrbisOS abre nesta tela com a página lida, igual a um Ctrl+C. Confira e salve o registro como sempre.</li>
  </ol>
  <p class="dica">O favorito roda só no seu navegador, já logado no painel: nenhuma senha passa para o OrbisOS. Ele copia também o valor dos campos (nome da etapa, responsável), que o Ctrl+C deixa de fora. Se o navegador bloquear, permita pop-ups do painel.</p>
</details>

<style>
  .um-clique
  {
    padding: var(--size-3) var(--size-4);
  }
  summary
  {
    display: flex;
    gap: var(--size-3);
    align-items: baseline;
    flex-wrap: wrap;
  }
  ol
  {
    margin: var(--size-3) 0;
    padding-left: var(--size-5);
    display: grid;
    gap: var(--size-2);
    font-size: 0.9rem;
  }
  .favorito
  {
    text-decoration: none;
    font-weight: 700;
    border-color: var(--marca);
    color: var(--marca);
    margin-left: var(--size-2);
    cursor: grab;
  }
</style>
