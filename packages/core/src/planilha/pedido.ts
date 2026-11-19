export interface EntradaPedidoPlanilha
{
  // o que a usuária colou: prompt, ideias soltas, links
  material: string;
  // como ela quer a ordem dos grupos e dos itens
  ordem: string;
  orcamento?: number | undefined;
  moeda: boolean;
  // sem isso o pedido nem fala de alternativas
  comAlternativas?: boolean | undefined;
}

const exemplo = {
  nome: 'Mudança para a casa nova',
  objetivo: 'Comprar o essencial para morar',
  moeda: true,
  orcamento: 25000,
  grupos: ['Cozinha', 'Sala'],
  linhas: [
    { grupo: 'Cozinha', item: 'geladeira', detalhe: 'Modelo 340 L branca 127V', qtd: 1, loja: 'Loja A', min: 2389.9, ref: 2399, max: 2599, situacao: 'verificado', prioridade: 'essencial', incluir: true, link: 'https://exemplo.com/geladeira', observacao: 'À vista no Pix' },
    { grupo: 'Sala', item: 'sofá', detalhe: '3 lugares', qtd: 1, loja: '', min: 1500, ref: 2000, max: 3000, situacao: 'estimativa', prioridade: 'importante', incluir: true, observacao: 'Faixa típica, não pesquisada' },
  ],
  alternativas: [{ item: 'geladeira', opcao: 'Modelo 377 L', loja: 'Loja B', valor: 2599, data: '2026-11-17', link: 'https://exemplo.com/outra', observacao: 'Mais capacidade' }],
  notas: { comoLer: ['Preço de referência é o anunciado hoje.'], premissas: ['Tensão 127V.'], atencao: ['Confirme os preços perto da compra.'] },
};

// texto para colar numa IA gratuita com busca; ela devolve o JSON que o OrbisOS valida
export function pedidoDePlanilha(e: EntradaPedidoPlanilha): string
{
  const alternativas = e.comAlternativas === true;
  const { alternativas: _alt, ...semAlternativas } = exemplo;
  return [
    'Você organiza material de pesquisa em uma planilha. Responda SOMENTE com um JSON válido, sem texto antes nem depois e, se possível, sem cercas de código.',
    '',
    '## Formato',
    '',
    '- nome, objetivo: textos curtos.',
    `- moeda: ${e.moeda ? 'true (valores em reais)' : 'false (os números são quantidades ou pontos, não dinheiro)'}.`,
    '- orcamento: número (opcional).',
    '- grupos: lista com a ordem dos grupos (setores, categorias, etapas).',
    '- linhas: cada item, com grupo, item, detalhe (produto ou descrição escolhida), qtd (número, padrão 1), loja (fonte), min, ref, max (valor unitário: menor, de referência e maior), situacao ("verificado" ou "estimativa"), prioridade ("essencial", "importante" ou "desejavel"), incluir (true ou false), link e observacao.',
    alternativas
      ? '- alternativas: outras opções comparadas, com item, opcao, loja, valor, data (AAAA-MM-DD), link e observacao.'
      : '- NÃO inclua a chave "alternativas": a aba de alternativas não foi pedida.',
    '- notas: comoLer, premissas e atencao, cada uma uma lista de frases.',
    '',
    '## Regras',
    '',
    '- Agrupe os itens soltos e mantenha a ordem pedida abaixo, tanto dos grupos quanto dos itens.',
    '- Um link por linha, exatamente como aparece nas fontes. NUNCA invente link nem preço: se não achou, deixe o link de fora e use situacao "estimativa", dizendo na observacao que não foi pesquisado.',
    '- Só use "verificado" quando viu o valor em uma página ou comparador.',
    '- Números como número (2399.9), nunca como texto com R$.',
    '- Sugestões fora do que foi pedido entram com incluir false.',
    '- Escreva em português do Brasil.',
    '',
    '## Exemplo do formato',
    '',
    JSON.stringify(alternativas ? exemplo : semAlternativas, null, 2),
    '',
    '## Ordem que eu quero',
    '',
    e.ordem.trim() || 'A ordem em que os assuntos aparecem no material.',
    ...(e.orcamento !== undefined ? ['', '## Orçamento', '', `Meu orçamento é ${e.orcamento.toLocaleString('pt-BR')}. Coloque em "orcamento".`] : []),
    '',
    '## Meu material',
    '',
    e.material.trim(),
  ].join('\n');
}
