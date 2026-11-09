export type Colado = { tipo: 'texto'; texto: string } | { tipo: 'imagem'; imagem: Blob };

// tabela html vira texto com tab entre colunas; sem tabela, devolve null e usa o texto simples
function tabelaParaTexto(html: string): string | null
{
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const linhas = doc.querySelectorAll('tr');
  if (linhas.length === 0) return null;
  return [...linhas]
    .map((tr) => [...tr.querySelectorAll('th,td')].map(textoDaCelula).join('\t'))
    .join('\n');
}

// mantém separadas as linhas de dentro da célula (ex.: sistema e descrição)
function textoDaCelula(celula: Element): string
{
  const folhas = [...celula.querySelectorAll('*')].filter((el) => el.children.length === 0);
  const partes = (folhas.length ? folhas : [celula])
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return partes.join('\n');
}

export function lerColagem(evento: ClipboardEvent): Colado | null
{
  const dados = evento.clipboardData;
  if (!dados) return null;
  for (const item of dados.items)
  {
    if (item.type.startsWith('image/'))
    {
      const imagem = item.getAsFile();
      if (imagem) return { tipo: 'imagem', imagem };
    }
  }
  const html = dados.getData('text/html');
  const tabela = html ? tabelaParaTexto(html) : null;
  if (tabela) return { tipo: 'texto', texto: tabela };
  const texto = dados.getData('text/plain');
  return texto ? { tipo: 'texto', texto } : null;
}
