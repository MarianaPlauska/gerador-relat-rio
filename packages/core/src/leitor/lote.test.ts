import { describe, expect, it } from 'vitest';
import type { CardSnapshot, EtapaCard } from '../tipos';
import { pessoasExemplo } from '../exemplo';
import { consolidarArvoreDeCards } from './correlacao';
import { CODIGO_ORFAO, correlacionarLote, costurarTextos, sobreposicaoTexto, unirEtapas, type EntradaLote } from './lote';
import { lerCards } from './cards';

const TEXTO_COMPLETO = 'Ajuste no BD:\nFazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;\nSe matrícula igual, então finaliza e não aceita subir essa pessoa;\nSe matrícula diferente, então verificar o cargo/função;\nAtenção em como exibir isso no cadastro de funcionários.';
const PARTE_1 = 'Ajuste no BD:\nFazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;\nSe matrícula igual, então finaliza e não aceita subir essa pessoa;';
const PARTE_2 = 'Se matrícula igual, então finaliza e não aceita subir essa pessoa;\nSe matrícula diferente, então verificar o cargo/função;\nAtenção em como exibir isso no cadastro de funcionários.';

const etapa = (ordem: number, nome: string, extra: Partial<EtapaCard> = {}): EtapaCard => ({ ordem, nome, pessoa: 'rodrigo-cinelli', situacao: 'rodando', origemEtapa: 'print', ...extra });

const base = (codigo: string, extra: Partial<CardSnapshot>): CardSnapshot => ({ codigo, responsaveis: [], origens: ['demandas'], ...extra });

// seis prints embaralhados: duas listas, o card com código (começo do pedido e etapas 1 e 2),
// a continuação do texto sem código e as etapas 3 e 4 sem código
const listaA: EntradaLote = {
  id: 'A', origem: 'demandas',
  cards: [
    base('DEV-274', { titulo: 'Ajuste no BD: Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo; Se matrícula...', responsaveis: ['rodrigo-cinelli'], responsavelEtapaAtual: 'rodrigo-cinelli', statusCard: 'Em andamento', situacao: 'em_execucao' }),
    base('DEV-284', { titulo: 'Colocar histórico do que cada usuário fez no sistema pelo menos dentro de 15 dias.', responsaveis: ['douglas-cerqueira'], responsavelEtapaAtual: 'douglas-cerqueira', statusCard: 'Novo', situacao: 'a_iniciar' }),
  ],
};
const listaB: EntradaLote = {
  id: 'B', origem: 'demandas',
  cards: [base('DEV-279', { titulo: 'Fazer comparativo das planilhas de credenciadas enviadas vs planilha da nossa própria página.', responsaveis: ['douglas-cerqueira'], responsavelEtapaAtual: 'douglas-cerqueira', statusCard: 'Novo', prioridadeCard: 'Crítica', criticidade: 3 })],
};
const cardAberto: EntradaLote = {
  id: 'P', origem: 'card',
  cards: [base('DEV-274', { origens: ['card'], descricaoCompleta: PARTE_1, etapas: [etapa(1, 'Validação dos requisitos'), etapa(2, 'Implementação')] })],
};
const continuacaoTexto: EntradaLote = {
  id: 'T', origem: 'card',
  cards: [{ codigo: CODIGO_ORFAO, responsaveis: [], origens: ['card'], titulo: 'Se matrícula igual', descricaoCompleta: PARTE_2 }],
};
const etapasFim: EntradaLote = {
  id: 'E', origem: 'card',
  cards: [{ codigo: CODIGO_ORFAO, responsaveis: [], origens: ['card'], etapas: [etapa(3, 'Testes'), etapa(4, 'Concluir', { situacao: 'nao_iniciada' })] }],
};

function permutacoes<T>(lista: T[]): T[][]
{
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => permutacoes([...lista.slice(0, i), ...lista.slice(i + 1)]).map((r) => [x, ...r]));
}

function resolver(ordem: EntradaLote[])
{
  const lote = correlacionarLote(ordem, [], pessoasExemplo);
  const porId = new Map(ordem.map((e) => [e.id, e]));
  const cards = lote.ordemProcessamento.flatMap((id) => lote.porCaptura.get(id)!.cards);
  void porId;
  return { lote, final: consolidarArvoreDeCards(cards) };
}

describe('correlação de prints fora de ordem', () =>
{
  const todas = [listaA, listaB, cardAberto, continuacaoTexto, etapasFim];

  it('costura o texto cortado entre dois prints sem repetir a linha em comum', () =>
  {
    expect(sobreposicaoTexto(PARTE_1, PARTE_2)).toBeGreaterThan(15);
    const texto = costurarTextos([PARTE_2, PARTE_1]);
    expect(texto.match(/Se matrícula igual/g)).toHaveLength(1);
    expect(texto.indexOf('Fazer as seguintes')).toBeLessThan(texto.indexOf('Atenção em como exibir'));
    expect(costurarTextos([TEXTO_COMPLETO, 'Ajuste no BD: Fazer as seguintes validações: se mesmo cpf...'])).toBe(TEXTO_COMPLETO);
  });

  it('une as etapas de prints diferentes pela numeração', () =>
  {
    expect(unirEtapas([[etapa(3, 'Testes')], [etapa(1, 'A'), etapa(2, 'B')]]).map((e) => e.ordem)).toEqual([1, 2, 3]);
  });

  it('o resultado é o mesmo em qualquer ordem de envio (120 ordens)', () =>
  {
    const resumo = (ordem: EntradaLote[]) =>
    {
      const { lote, final } = resolver(ordem);
      const c = final.find((x) => x.codigo === 'DEV-274')!;
      return {
        pendentes: [...lote.porCaptura.values()].reduce((a, s) => a + s.pendentes, 0),
        codigos: final.map((x) => x.codigo).sort(),
        texto: c.descricaoCompleta,
        etapas: c.etapas?.map((e) => `${e.ordem}:${e.nome}`),
      };
    };
    const referencia = resumo(todas);
    expect(referencia.pendentes).toBe(0);
    expect(referencia.codigos).toEqual(['DEV-274', 'DEV-279', 'DEV-284']);
    expect(referencia.etapas).toEqual(['1:Validação dos requisitos', '2:Implementação', '3:Testes', '4:Concluir']);
    expect(referencia.texto).toContain('Fazer as seguintes validações');
    expect(referencia.texto).toContain('Se matrícula diferente');
    expect(referencia.texto).toContain('Atenção em como exibir');
    expect(referencia.texto!.match(/Se matrícula igual/g)).toHaveLength(1);
    for (const ordem of permutacoes(todas)) expect(resumo(ordem)).toEqual(referencia);
  });

  it('o fragmento que chega antes do card com código espera e se liga quando o card aparece', () =>
  {
    const sozinho = correlacionarLote([etapasFim], [], pessoasExemplo);
    expect(sozinho.porCaptura.get('E')).toMatchObject({ pendentes: 1, cards: [] });
    const completo = correlacionarLote([etapasFim, cardAberto], [], pessoasExemplo);
    expect(completo.porCaptura.get('E')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
    expect(completo.porCaptura.get('E')!.cards[0]!.codigo).toBe('DEV-274');
  });

  it('encadeia fragmento em fragmento: o texto sem código se liga ao card pelo outro fragmento', () =>
  {
    const so = correlacionarLote([continuacaoTexto, etapasFim, cardAberto], [], pessoasExemplo);
    expect(so.porCaptura.get('T')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
    expect(so.porCaptura.get('E')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
  });

  it('não liga etapas de outra pessoa ao card errado', () =>
  {
    const outra: EntradaLote = { id: 'X', origem: 'card', cards: [{ codigo: CODIGO_ORFAO, responsaveis: [], origens: ['card'], etapas: [etapa(1, 'Modelagem', { pessoa: 'evandro-medeiros' })] }] };
    const lote = correlacionarLote([listaA, cardAberto, outra], [], pessoasExemplo);
    expect(lote.porCaptura.get('X')!.pendentes).toBe(1);
  });

  it('respeita o card pai escolhido na tela', () =>
  {
    const manual: EntradaLote = { ...etapasFim, id: 'M', cardPaiForcado: 'DEV-284' };
    const lote = correlacionarLote([listaA, manual], [], pessoasExemplo);
    expect(lote.porCaptura.get('M')).toMatchObject({ cardPaiVinculado: 'DEV-284', confiancaVinculoPct: 100 });
  });

  it('usa os cards já guardados como possíveis pais', () =>
  {
    const existente = base('DEV-274', { responsaveis: ['rodrigo-cinelli'], responsavelEtapaAtual: 'rodrigo-cinelli', titulo: 'Ajuste no BD', statusCard: 'Em andamento', situacao: 'em_execucao' });
    const lote = correlacionarLote([etapasFim], [existente], pessoasExemplo);
    expect(lote.porCaptura.get('E')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
  });

  it('listas e detalhes: o detalhe é mesclado por último', () =>
  {
    const lote = correlacionarLote([cardAberto, listaA, etapasFim, listaB], [], pessoasExemplo);
    expect(lote.ordemProcessamento).toEqual(['A', 'B', 'P', 'E']);
  });
});

describe('continuação de texto sem código na leitura do card aberto', () =>
{
  it('vira fragmento órfão quando o print foi marcado como card aberto', () =>
  {
    const texto = 'Se matrícula diferente, então verificar o cargo/função;\nSe diferentes, pessoa entra no BD com duas matrículas; Se iguais, cancelar.\n\nAtenção em como exibir isso no cadastro de funcionários.';
    const [card] = lerCards(texto, { prefixo: 'DEV', pessoas: pessoasExemplo, origem: 'card' });
    expect(card).toMatchObject({ codigo: CODIGO_ORFAO });
    expect(card!.descricaoCompleta).toContain('Atenção em como exibir');
    expect(lerCards(texto, { prefixo: 'DEV', pessoas: pessoasExemplo, origem: 'demandas' })).toEqual([]);
  });
});
