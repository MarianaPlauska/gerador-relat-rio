import { describe, expect, it } from 'vitest';
import type { CardSnapshot } from '../tipos';
import { pessoasExemplo } from '../exemplo';
import { lerCards } from './cards';
import { consolidarArvoreDeCards } from './correlacao';
import { CODIGO_ORFAO, correlacionarLote, type EntradaLote } from './lote';

// Prints reais da usuária (semana de 17 e 18/11/2026) transformados em casos de teste.
//
// Cada print aparece de duas formas, sempre identificadas:
//   OCR_*           saída REAL do Tesseract (tesseract.js 7, idioma 'por'), rodada direto no arquivo da imagem em Node.
//                   Não houve o pré-processamento do navegador (binarizar/ampliar no canvas), então o texto está bem mais
//                   sujo do que o do app. Só foram retirados espaços no fim das linhas e linhas vazias no fim do texto.
//   TRANSCRICAO_*   transcrição FEITA À MÃO a partir do print, no formato linha a linha que um OCR bom produziria.
//                   NÃO é saída de OCR: serve para testar as regras de leitura sem o ruído do reconhecimento.
// Os dois conjuntos entram nos testes. O OCR sujo só tem as afirmações que ele permite (limites descritos em cada teste).
//
// Imagens de origem (pasta .user_uploaded da conversa):
//   media_1794914088339_71744b3f.jpg  lista de Demandas (DEV-274 ... DEV-279)
//   media_1794914167883_922f8c78.png  card DEV-274 aberto: cabeçalho e "O que foi pedido"
//   media_1794914469484_f6acec24.png  card DEV-274 aberto: tabela de Etapas
//   media_1794944499518_9ffc7e52.jpg  lista de Demandas (DEV-289, DEV-288, DEV-282, DEV-223, DEV-040)
//   media_1794853548600_19705e5f.png  editor de fluxograma do Veredo: não tem card nenhum, ficou de fora dos testes

// SAIDA REAL do Tesseract (ver cabecalho do arquivo)
const OCR_LISTA_SEMANA = [
  'isa SULECIATANTES — TAPO DESCRIÇÃO: RESPONSAVELT  TENERS SiS',
  'DEV-274 = — Kitu Sistema Ajuste no BD: Fazer as seguintes validações: semesmo — — Rodrigo Cinelli Bmin e Emandamento',
  '18/12/26 cpf, então passar para o próximo campo; Se matrícula...',
  'DEV-6A7 = — Kitu Sistema CNPI alfanumérico O sistema já está preparado panos — = Rodrigo Cinelli Bmin e Resolvido',
  '18/11/26 CNP3s alfanuméricos (ref.: Receita Federal — CNPJ...',
  'DEV28A = — Kitu Sistema Colocar histórico do que cada usuário fez no sistema (no — Douglas min (eNoo',
  '17/12/26 painel incial do DEV) pelo menos dentro de 15 dias. Cerqueira',
  'DEV-2863— — Kitu Sistema Na tela inicial (ogin) quando clicamos em suporte, tem — — Douglas min (eNoo',
  '17/21/26 campos muito fracos. Colocar ali o octadesk também, e... Cerqueira',
  'DEV-280 = — Kitu Sistema Na página de clientes, não está buscando de fato pelo Douglas min (eno',
  '17/12/26 Baixa nome fantasia ou qualquer informação que case na... Cerqueira',
  'DEV-281 = — Kitu Sistema Ajustar em agendamento, montagem e riscos no Douglas min (enowo',
  '17/19/26 ambiente: Agen: COlocar novamente a opção de poder... Cerqueira',
  'DEV — Kitu Sistema Trocar o local do botão onde exportamos as informações — Douglas min (eNovo',
  '17/11/26 do sistema Cerqueira',
  'DEV-2T7 — Kitu Sistema FAZER O FLUXO DO AGENDAMENTO SEGUNDO O FLUXO — Douglas omin (eNovo',
  '17/14/26 Fe Cerqueira',
  'DEV-279— — Kitu Sistema Fazer comparativo das planilhas de credenciadas Douglas Bmin (enovo',
  '17/11/26 —— Wewiadas ve Planilha da nosss próprs página: Precisaens —  Conquelia',
].join('\n');

const OCR_CARD_PEDIDO = [
  'DEV-274 DEV x',
  'TIME ABERTURA',
  'DEV — Desenvolvedores 18/11/2026 11:32',
  'Travada: o card já teve alteração. Só o gestor corrige a abertura.',
  'TIPO DE DEMANDA',
  'Kitu Sistema v',
  'O tipo carrega as etapas-modelo; o prazo vem do nível de dificuldade.',
  'O QUE FOI PEDIDO 7 ear',
  'Ajuste no BD:',
  'Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;',
  'Se matrícula igual, então finaliza e não aceita subir essa pessoa;',
  'Se matrícula diferente, então verificar o cargo/função;',
  'Se diferentes, pessoa entra no BD com duas matrículas; Se iguais, cancelar.',
  'Atenção em como exibir isso no cadastro de funcionários.',
].join('\n');

const OCR_CARD_ETAPAS = [
  'Etapas 0 de 3 concluídas - ocioso entre etapas: O min úteis (0%)',
  'E ETAPA RESPONSÁVEL TEMPO',
  '2 fes is são Cinott € rodando há15,8 4 subtareta',
  'Validação dos requisitos Rodrigo Cinelli v',
  'rea ” desde 16/11/2026 16:25',
  '2 , são cineti é rodando ná 15.8 EE',
  'Implementação Rodrigo Cinelli v',
  'á o desde 16/11/2026 16:25',
  '——— + pessoa',
  '; - — Esse concluir eard',
  'Concluir Rodrigo Cinelli v',
].join('\n');

const OCR_TABELA_DEV_289 = [
  'E) SOLICITANTE! — TIPO DESCRIÇÃO RESPONSÁVEL TEMPO?! STATUS',
  '',
  'DEV-289 - SuporteKitu — Outros — Erro cadastro de candidatos/funcionários - Kitu Mariana Coutinho 158in (e Emandamento',
  '',
  'e crítico critica Sistema > Funcionários Descrição do solicitante: Ao.',
  '',
  'a7112/26',
  '',
  'DEV-288 - SuporteKitu — Erro nosistema e NÃO consigo seguir - Kitu Sistema» Mariana Coutinho 20 min e Emandamento',
  '* crítico eta) Agendamento Descrição do solicitante: Agendamento d...',
  '',
  '7111/26',
  '',
  'DEV-282 - KituSistema — CAMPANHA: - poder selecionar manualmente os Mariana Coutinho B,2h e Emandamento',
  '',
  '17/11/26 funcionários (verificar se isso funciona); - informar que,',
  '',
  'DEV-223 - KituSistema — Jádeixaro PCMSO preenchido nos cronogramas. FAZER O Mariana Coutinho T1d (e Emandamento',
  '',
  '10/11/26 COMPARATIVO ENTRE UM PCMSO E OUTRO, E...',
  '',
  'DEV-640 - KituSistema — CIPA votação eletrônica Funcionalidade de Mariana Coutinho 14,4d e Emandamento',
  '',
  '68/21/26 acompanhamento da CIPA com votação eletrônica...',
].join('\n');

// TRANSCRICAO feita a partir do print media_1794914088339_71744b3f.jpg (lista de Demandas, 9 cards)
const TRANSCRICAO_LISTA_SEMANA = [
  'ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
  'DEV-274 — Kitu Sistema Ajuste no BD: Fazer as seguintes validações: se mesmo — Rodrigo Cinelli 0 min • Em andamento',
  '18/11/26 cpf, então passar para o próximo campo; Se matrícula...',
  'DEV-047 — Kitu Sistema CNPJ alfanumérico O sistema já está preparado para os — Rodrigo Cinelli 0 min • Resolvido',
  '18/11/26 CNPJs alfanuméricos (ref.: Receita Federal — CNPJ...',
  'DEV-284 — Kitu Sistema Colocar histórico do que cada usuário fez no sistema (no — Douglas 0 min • Novo',
  '17/11/26 painel incial do DEV) pelo menos dentro de 15 dias. Cerqueira',
  'DEV-283 — Kitu Sistema Na tela inicial (login) quando clicamos em suporte, tem — Douglas 0 min • Novo',
  '17/11/26 campos muito fracos. Colocar ali o octadesk também, e... Cerqueira',
  'DEV-280 — Kitu Sistema Na página de clientes, não está buscando de fato pelo Douglas 0 min • Novo',
  '17/11/26 Baixa nome fantasia ou qualquer informação que case na... Cerqueira',
  'DEV-281 — Kitu Sistema Ajustar em agendamento, montagem e riscos no Douglas 0 min • Novo',
  '17/11/26 ambiente: Agen: COlocar novamente a opção de poder... Cerqueira',
  'DEV-278 — Kitu Sistema Trocar o local do botão onde exportamos as informações — Douglas 0 min • Novo',
  '17/11/26 do sistema Cerqueira',
  'DEV-277 — Kitu Sistema FAZER O FLUXO DO AGENDAMENTO SEGUNDO O FLUXO — Douglas 0 min • Novo',
  '17/11/26 Alta Cerqueira',
  'DEV-279 — Kitu Sistema Fazer comparativo das planilhas de credenciadas Douglas 0 min • Novo',
  '17/11/26 Crítica enviadas vs Planilha da nossa própria página. Precisam... Cerqueira',
].join('\n');

// TRANSCRICAO feita a partir do print media_1794944499518_9ffc7e52.jpg (lista de Demandas com chamados de suporte e tempos em h e d)
const TRANSCRICAO_TABELA_DEV_289 = [
  'ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
  'DEV-289 — Suporte Kitu Outros — Erro cadastro de candidatos/funcionários · Kitu Mariana Coutinho 15 min • Em andamento',
  '• Crítico Crítica Sistema › Funcionários Descrição do solicitante: Ao...',
  '17/11/26',
  'DEV-288 — Suporte Kitu Erro no sistema e NÃO consigo seguir · Kitu Sistema › Mariana Coutinho 20 min • Em andamento',
  '• Crítico Crítica Agendamento Descrição do solicitante: Agendamento d...',
  '17/11/26',
  'DEV-282 — Kitu Sistema CAMPANHA: - poder selecionar manualmente os Mariana Coutinho 8,2 h • Em andamento',
  '17/11/26 funcionários (verificar se isso funciona); - informar que,...',
  'DEV-223 — Kitu Sistema Já deixar o PCMSO preenchido nos cronogramas. FAZER O Mariana Coutinho 7,1 d • Em andamento',
  '10/11/26 COMPARATIVO ENTRE UM PCMSO E OUTRO, E...',
  'DEV-040 — Kitu Sistema CIPA — votação eletrônica Funcionalidade de Mariana Coutinho 14,4 d • Em andamento',
  '03/11/26 acompanhamento da CIPA com votação eletrônica....',
].join('\n');

// TRANSCRICAO feita a partir do print media_1794914167883_922f8c78.png (card DEV-274 aberto, parte de cima).
// O print mostra o botão "Editar" ao lado de "O que foi pedido" e uma linha em branco antes de "Atenção".
const TRANSCRICAO_CARD_PEDIDO = [
  'DEV-274 DEV x',
  'TIME ABERTURA',
  'DEV — Desenvolvedores 18/11/2026 11:32',
  'Travada: o card já teve alteração. Só o gestor corrige a abertura.',
  'TIPO DE DEMANDA',
  'Kitu Sistema v',
  'O tipo carrega as etapas-modelo; o prazo vem do nível de dificuldade.',
  'O QUE FOI PEDIDO Editar',
  'Ajuste no BD:',
  'Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;',
  'Se matrícula igual, então finaliza e não aceita subir essa pessoa;',
  'Se matrícula diferente, então verificar o cargo/função;',
  'Se diferentes, pessoa entra no BD com duas matrículas; Se iguais, cancelar.',
  '',
  'Atenção em como exibir isso no cadastro de funcionários.',
].join('\n');

// TRANSCRICAO feita a partir do print media_1794914469484_f6acec24.png (card DEV-274 aberto, tabela de Etapas, sem o código do card).
// A ordem das linhas imita a do Tesseract: número e selo de tempo, depois o nome da etapa com o responsável, depois "desde ...".
const TRANSCRICAO_CARD_ETAPAS = [
  'Etapas 0 de 3 concluídas · ocioso entre etapas: 0 min úteis (0%)',
  '# ETAPA RESPONSÁVEL TEMPO',
  '1 • rodando há 15,8 h Concluir Subtarefa',
  'Validação dos requisitos Rodrigo Cinelli v',
  '+ o que vai fazer desde 16/11/2026 16:25',
  '+ pessoa',
  '2 • rodando há 15,8 h Concluir Subtarefa',
  'Implementação Rodrigo Cinelli v',
  '+ o que vai fazer desde 16/11/2026 16:25',
  '+ pessoa',
  '3 não iniciada Concluir card',
  'Concluir Rodrigo Cinelli v',
  '+ o que vai fazer',
].join('\n');

// Cortes DERIVADOS (não são prints novos): o pedido do DEV-274 cabe inteiro num print, mas o de quem rola a tela sai em dois.
// O primeiro print com código termina na linha "Se matrícula igual" e a continuação (sem código) recomeça nela, como no overlap de uma rolagem.
function cortarPedido(texto: string): { comCodigo: string; continuacao: string }
{
  const linhas = texto.split('\n');
  const fim = linhas.findIndex((l) => l.startsWith('Se matrícula igual'));
  return { comCodigo: linhas.slice(0, fim + 1).join('\n'), continuacao: linhas.slice(fim).join('\n') };
}
const corteTranscricao = cortarPedido(TRANSCRICAO_CARD_PEDIDO);
const corteOcr = cortarPedido(OCR_CARD_PEDIDO);

// 120 ordens com consolidação completa: sozinho leva ~1,5 s, mas com a suíte inteira em paralelo passa dos 5 s padrão do vitest
const TEMPO_LIMITE = 60_000;

const ler = (texto: string, origem: 'demandas' | 'card') => lerCards(texto, { prefixo: 'DEV', pessoas: pessoasExemplo, origem });
const porCodigo = (cards: CardSnapshot[]) => new Map(cards.map((c) => [c.codigo, c]));

const PEDIDO_COMPLETO = [
  'Ajuste no BD:',
  'Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo;',
  'Se matrícula igual, então finaliza e não aceita subir essa pessoa;',
  'Se matrícula diferente, então verificar o cargo/função;',
  'Se diferentes, pessoa entra no BD com duas matrículas; Se iguais, cancelar.',
  'Atenção em como exibir isso no cadastro de funcionários.',
].join('\n');

describe('print real: lista de Demandas da semana (transcrição do print)', () =>
{
  const cards = ler(TRANSCRICAO_LISTA_SEMANA, 'demandas');
  const mapa = porCodigo(cards);

  it('acha os 9 cards, na ordem do print, sem avisos de leitura', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-274', 'DEV-047', 'DEV-284', 'DEV-283', 'DEV-280', 'DEV-281', 'DEV-278', 'DEV-277', 'DEV-279']);
    for (const c of cards) expect(c.avisosLeitura, c.codigo).toEqual([]);
  });

  it.each([
    ['DEV-274', 'rodrigo-cinelli', 'Em andamento', 'em_execucao', '2026-11-18', undefined],
    ['DEV-047', 'rodrigo-cinelli', 'Resolvido', 'concluido', '2026-11-18', undefined],
    ['DEV-284', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', undefined],
    ['DEV-283', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', undefined],
    ['DEV-280', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', 'Baixa'],
    ['DEV-281', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', undefined],
    ['DEV-278', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', undefined],
    ['DEV-277', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', 'Alta'],
    ['DEV-279', 'douglas-cerqueira', 'Novo', 'a_iniciar', '2026-11-17', 'Crítica'],
  ])('%s: responsável, status, abertura e prioridade', (codigo, responsavel, status, situacao, abertura, prioridade) =>
  {
    const c = mapa.get(codigo)!;
    expect(c.responsaveis).toEqual([responsavel]);
    expect(c.responsavelEtapaAtual).toBe(responsavel);
    expect(c.statusCard).toBe(status);
    expect(c.situacao).toBe(situacao);
    expect(c.abertura).toBe(abertura);
    expect(c.prioridadeCard).toBe(prioridade);
    expect(c.sistema).toBe('Kitu Sistema');
    expect(c.origens).toEqual(['demandas']);
    expect(c.tempoTotalMin).toBe(0);
  });

  it.each([
    ['DEV-274', 'Ajuste no BD: Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo; Se matrícula...'],
    ['DEV-047', 'CNPJ alfanumérico O sistema já está preparado para os CNPJs alfanuméricos (ref.: Receita Federal — CNPJ...'],
    ['DEV-284', 'Colocar histórico do que cada usuário fez no sistema (no painel incial do DEV) pelo menos dentro de 15 dias.'],
    ['DEV-283', 'Na tela inicial (login) quando clicamos em suporte, tem campos muito fracos. Colocar ali o octadesk também, e...'],
    ['DEV-280', 'Na página de clientes, não está buscando de fato pelo nome fantasia ou qualquer informação que case na...'],
    ['DEV-281', 'Ajustar em agendamento, montagem e riscos no ambiente: Agen: COlocar novamente a opção de poder...'],
    ['DEV-278', 'Trocar o local do botão onde exportamos as informações do sistema'],
    ['DEV-277', 'FAZER O FLUXO DO AGENDAMENTO SEGUNDO O FLUXO'],
    ['DEV-279', 'Fazer comparativo das planilhas de credenciadas enviadas vs Planilha da nossa própria página. Precisam...'],
  ])('%s: a descrição é o texto do card, sem selo, data, nome nem tempo', (codigo, descricao) =>
  {
    const c = mapa.get(codigo)!;
    expect(c.titulo).toBe(descricao);
    expect(c.descricaoCompleta).toBe(descricao);
  });

  it('a descrição nunca vira selo ("e Crítico"), data ou nome de coluna', () =>
  {
    for (const c of cards)
    {
      expect(c.titulo, c.codigo).not.toMatch(/^(e\s+)?(cr[ií]tic|alta|baixa)/i);
      expect(c.titulo, c.codigo).not.toMatch(/\d{2}\/\d{2}\/\d{2}/);
      expect(c.titulo, c.codigo).not.toMatch(/Cerqueira|Cinelli|\bmin\b/);
    }
  });
});

describe('print real: lista de Demandas com chamados de suporte (transcrição do print)', () =>
{
  const cards = ler(TRANSCRICAO_TABELA_DEV_289, 'demandas');
  const mapa = porCodigo(cards);

  it('acha os 5 cards sem avisos de leitura', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-289', 'DEV-288', 'DEV-282', 'DEV-223', 'DEV-040']);
    for (const c of cards) expect(c.avisosLeitura, c.codigo).toEqual([]);
  });

  it.each([
    ['DEV-289', 'Suporte Kitu', 'Crítica', 3, 15, '2026-11-17', 'Outros — Erro cadastro de candidatos/funcionários · Kitu Sistema › Funcionários Descrição do solicitante: Ao...'],
    ['DEV-288', 'Suporte Kitu', 'Crítica', 3, 20, '2026-11-17', 'Erro no sistema e NÃO consigo seguir · Kitu Sistema › Agendamento Descrição do solicitante: Agendamento d...'],
    ['DEV-282', 'Kitu Sistema', undefined, undefined, 492, '2026-11-17', 'CAMPANHA: - poder selecionar manualmente os funcionários (verificar se isso funciona); - informar que,...'],
    ['DEV-223', 'Kitu Sistema', undefined, undefined, 3408, '2026-11-10', 'Já deixar o PCMSO preenchido nos cronogramas. FAZER O COMPARATIVO ENTRE UM PCMSO E OUTRO, E...'],
    ['DEV-040', 'Kitu Sistema', undefined, undefined, 6912, '2026-11-03', 'CIPA — votação eletrônica Funcionalidade de acompanhamento da CIPA com votação eletrônica....'],
  ])('%s: tipo, prioridade, tempo, abertura e descrição', (codigo, sistema, prioridade, criticidade, tempo, abertura, descricao) =>
  {
    const c = mapa.get(codigo)!;
    expect(c.responsaveis).toEqual(['mariana-coutinho']);
    expect(c.statusCard).toBe('Em andamento');
    expect(c.situacao).toBe('em_execucao');
    expect(c.sistema).toBe(sistema);
    expect(c.prioridadeCard).toBe(prioridade);
    expect(c.criticidade).toBe(criticidade);
    expect(c.tempoTotalMin).toBe(tempo);
    expect(c.abertura).toBe(abertura);
    expect(c.titulo).toBe(descricao);
    expect(c.titulo).not.toMatch(/^(e\s+)?cr[ií]tic/i);
  });
});

describe('print real: card DEV-274 aberto (transcrição dos prints)', () =>
{
  it('lê o cabeçalho e o texto de "O que foi pedido"', () =>
  {
    const [card, ...resto] = ler(TRANSCRICAO_CARD_PEDIDO, 'card');
    expect(resto).toEqual([]);
    expect(card).toMatchObject({
      codigo: 'DEV-274',
      abertura: '2026-11-18',
      aberturaHora: '11:32',
      sistema: 'Kitu Sistema',
      origens: ['card'],
      descricaoCompleta: PEDIDO_COMPLETO,
    });
    expect(card!.fontesCorrelacionadas).toContain('pedido');
  });

  it('lê as etapas sem código como fragmento órfão, com responsável, tempo rodando e início', () =>
  {
    const [card, ...resto] = ler(TRANSCRICAO_CARD_ETAPAS, 'card');
    expect(resto).toEqual([]);
    expect(card!.codigo).toBe(CODIGO_ORFAO);
    expect(card!.etapas).toEqual([
      { ordem: 1, nome: 'Validação dos requisitos', pessoa: 'rodrigo-cinelli', situacao: 'rodando', origemEtapa: 'print', tempoRodandoHoras: 15.8, desde: '2026-11-16T16:25' },
      { ordem: 2, nome: 'Implementação', pessoa: 'rodrigo-cinelli', situacao: 'rodando', origemEtapa: 'print', tempoRodandoHoras: 15.8, desde: '2026-11-16T16:25' },
      { ordem: 3, nome: 'Concluir', pessoa: 'rodrigo-cinelli', situacao: 'nao_iniciada', origemEtapa: 'print' },
    ]);
    expect(card).toMatchObject({ etapasTotal: 3, etapasConcluidas: 0, ociosoEtapasMin: 0, etapaAtual: 'Validação dos requisitos', etapaAtualStatus: 'rodando', responsavelEtapaAtual: 'rodrigo-cinelli' });
  });

  it('a continuação do texto cortado vira fragmento órfão com o resto do pedido', () =>
  {
    const [card, ...resto] = ler(corteTranscricao.continuacao, 'card');
    expect(resto).toEqual([]);
    expect(card!.codigo).toBe(CODIGO_ORFAO);
    expect(card!.descricaoCompleta).toContain('Atenção em como exibir isso no cadastro de funcionários.');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// correlação fora de ordem

function permutacoes<T>(lista: T[]): T[][]
{
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => permutacoes([...lista.slice(0, i), ...lista.slice(i + 1)]).map((r) => [x, ...r]));
}

function entrada(id: string, texto: string, origem: 'demandas' | 'card'): EntradaLote
{
  return { id, origem, cards: ler(texto, origem) };
}

// o que o app faz com um lote: correlaciona, mescla na ordem de ordemProcessamento e consolida
function resolver(ordem: EntradaLote[])
{
  const lote = correlacionarLote(ordem, [], pessoasExemplo);
  const cards = lote.ordemProcessamento.flatMap((id) => lote.porCaptura.get(id)!.cards);
  const pendentes = [...lote.porCaptura.values()].reduce((soma, s) => soma + s.pendentes, 0);
  const final = consolidarArvoreDeCards(cards).sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { lote, pendentes, final };
}

describe('prints reais fora de ordem: transcrição dos prints (5 capturas, 120 ordens)', () =>
{
  const capturas = [
    entrada('lista-semana', TRANSCRICAO_LISTA_SEMANA, 'demandas'),
    entrada('lista-suporte', TRANSCRICAO_TABELA_DEV_289, 'demandas'),
    entrada('card-aberto', corteTranscricao.comCodigo, 'card'),
    entrada('card-continuacao', corteTranscricao.continuacao, 'card'),
    entrada('card-etapas', TRANSCRICAO_CARD_ETAPAS, 'card'),
  ];
  const referencia = resolver(capturas);
  const dev274 = referencia.final.find((c) => c.codigo === 'DEV-274')!;

  it('monta as capturas esperadas: duas listas, um card com código e dois fragmentos sem código', () =>
  {
    expect(capturas.map((c) => c.cards.map((x) => x.codigo))).toEqual([
      ['DEV-274', 'DEV-047', 'DEV-284', 'DEV-283', 'DEV-280', 'DEV-281', 'DEV-278', 'DEV-277', 'DEV-279'],
      ['DEV-289', 'DEV-288', 'DEV-282', 'DEV-223', 'DEV-040'],
      ['DEV-274'],
      [CODIGO_ORFAO],
      [CODIGO_ORFAO],
    ]);
  });

  it('o DEV-274 fica com o pedido completo, as 3 etapas e o responsável certo', () =>
  {
    expect(referencia.pendentes).toBe(0);
    expect(referencia.final.map((c) => c.codigo)).toEqual(['DEV-040', 'DEV-047', 'DEV-223', 'DEV-274', 'DEV-277', 'DEV-278', 'DEV-279', 'DEV-280', 'DEV-281', 'DEV-282', 'DEV-283', 'DEV-284', 'DEV-288', 'DEV-289']);
    expect(dev274.descricaoCompleta).toBe(PEDIDO_COMPLETO);
    expect(dev274.descricaoCompleta!.match(/Se matrícula igual/g)).toHaveLength(1);
    expect(dev274.etapas?.map((e) => `${e.ordem}:${e.nome}`)).toEqual(['1:Validação dos requisitos', '2:Implementação', '3:Concluir']);
    expect(dev274.etapas?.every((e) => e.pessoa === 'rodrigo-cinelli')).toBe(true);
    expect(dev274.responsaveis).toEqual(['rodrigo-cinelli']);
    expect(dev274).toMatchObject({ statusCard: 'Em andamento', abertura: '2026-11-18', etapasTotal: 3, etapasConcluidas: 0, etapaAtual: 'Validação dos requisitos' });
  });

  it('os fragmentos sem código se ligam ao DEV-274 e não ao DEV-289 (outra pessoa) nem a outro card', () =>
  {
    expect(referencia.lote.porCaptura.get('card-etapas')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
    expect(referencia.lote.porCaptura.get('card-continuacao')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
  });

  it('a lista não perde o que só ela sabe (prioridade, tempo, responsável dos outros cards)', () =>
  {
    const mapa = porCodigo(referencia.final);
    expect(mapa.get('DEV-279')).toMatchObject({ prioridadeCard: 'Crítica', responsaveis: ['douglas-cerqueira'] });
    expect(mapa.get('DEV-289')).toMatchObject({ prioridadeCard: 'Crítica', tempoTotalMin: 15, responsaveis: ['mariana-coutinho'] });
    expect(mapa.get('DEV-047')).toMatchObject({ statusCard: 'Resolvido', situacao: 'concluido' });
  });

  it('o resultado é idêntico em qualquer ordem de envio', () =>
  {
    const ordens = permutacoes(capturas);
    expect(ordens).toHaveLength(120);
    for (const ordem of ordens)
    {
      const r = resolver(ordem);
      expect(r.pendentes, ordem.map((e) => e.id).join(' > ')).toBe(0);
      expect(r.final, ordem.map((e) => e.id).join(' > ')).toEqual(referencia.final);
    }
  }, TEMPO_LIMITE);
});


// ---------------------------------------------------------------------------------------------------------------------
// SAIDA REAL do Tesseract (sem pré-processamento do navegador)
//
// O texto abaixo está bem pior do que o do app: códigos como "DEV-6A7", "DEV28A" e "DEV" sozinho, datas como "17/21/26",
// tempos como "Bmin" e "158in", status como "(eNoo". Os testes afirmam o que o leitor consegue tirar disso e registram com
// it.fails o que o OCR perdeu de verdade (o it.fails passa enquanto o problema existir e quebra quando alguém resolver, para
// avisar que a afirmação já pode virar um it normal).

describe('print real: lista de Demandas da semana (saída real do Tesseract)', () =>
{
  const cards = ler(OCR_LISTA_SEMANA, 'demandas');
  const mapa = porCodigo(cards);

  it('lê os cards cujo código o Tesseract acertou ou errou só um pouco, na ordem do print', () =>
  {
    // DEV-047 saiu "DEV-6A7", DEV-283 saiu "DEV-2863", DEV-277 saiu "DEV-2T7"; DEV-284 ("DEV28A") e DEV-278 ("DEV") ficaram sem código
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-274', 'DEV-6A7', 'DEV-2863', 'DEV-280', 'DEV-281', 'DEV-2T7', 'DEV-279']);
  });

  it('DEV-274: responsável, status e descrição sem as colunas Tempo e Status', () =>
  {
    const c = mapa.get('DEV-274')!;
    expect(c.responsaveis).toEqual(['rodrigo-cinelli']);
    expect(c.statusCard).toBe('Em andamento');
    expect(c.situacao).toBe('em_execucao');
    expect(c.sistema).toBe('Kitu Sistema');
    // "semesmo" é erro do OCR (no print está "se mesmo")
    expect(c.titulo).toBe('Ajuste no BD: Fazer as seguintes validações: semesmo cpf, então passar para o próximo campo; Se matrícula...');
    expect(c.avisosLeitura).toEqual([]);
  });

  it('DEV-280: o selo Baixa vira prioridade e não entra na descrição', () =>
  {
    const c = mapa.get('DEV-280')!;
    expect(c.responsaveis).toEqual(['douglas-cerqueira']);
    expect(c.prioridadeCard).toBe('Baixa');
    expect(c.criticidade).toBe(1);
    expect(c.titulo).toBe('Na página de clientes, não está buscando de fato pelo nome fantasia ou qualquer informação que case na...');
    // o status saiu "(eno": ilegível, e o leitor avisa em vez de chutar
    expect(c.statusCard).toBeUndefined();
    expect(c.avisosLeitura).toContain('sem status');
  });

  it('DEV-281: status lido e aviso de que o card de baixo (sem código) ficou misturado no trecho', () =>
  {
    const c = mapa.get('DEV-281')!;
    expect(c.responsaveis).toEqual(['douglas-cerqueira']);
    expect(c.statusCard).toBe('Novo');
    expect(c.situacao).toBe('a_iniciar');
    expect(c.titulo).toContain('Ajustar em agendamento, montagem e riscos no ambiente');
    expect(c.avisosLeitura).toContain('mais de um card no mesmo trecho, confira');
  });

  it('DEV-6A7 (o DEV-047): código ilegível e a linha do DEV-284, sem código, avisada como misturada', () =>
  {
    const c = mapa.get('DEV-6A7')!;
    expect(c.statusCard).toBe('Resolvido');
    expect(c.situacao).toBe('concluido');
    expect(c.avisosLeitura).toEqual(expect.arrayContaining(['código ilegível', 'mais de um card no mesmo trecho, confira']));
  });

  it('DEV-279: o status é lido, mas o selo Crítica o OCR leu como "——" e não vira prioridade', () =>
  {
    expect(mapa.get('DEV-279')).toMatchObject({ statusCard: 'Novo', situacao: 'a_iniciar' });
    expect(mapa.get('DEV-279')!.prioridadeCard).toBeUndefined();
  });

  it('nenhuma descrição leva nome do responsável, tempo, status ou selo (exceto o DEV-279, ver it.fails abaixo)', () =>
  {
    for (const c of cards.filter((x) => x.codigo !== 'DEV-279'))
    {
      expect(c.titulo, c.codigo).not.toMatch(/Cinelli|Cerqueira|Douglas|\bmin\b|andamento|resolvido|\(e/i);
      expect(c.titulo, c.codigo).not.toMatch(/^(e\s+)?(cr[ií]tic|alta|baixa)/i);
      expect(c.titulo, c.codigo).not.toMatch(/\d{2}\/\d{2}\/\d{2}/);
    }
  });

  it.fails('lê os 9 códigos do print (o OCR sem pré-processamento perde DEV-047, DEV-283, DEV-284, DEV-278 e DEV-277)', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-274', 'DEV-047', 'DEV-284', 'DEV-283', 'DEV-280', 'DEV-281', 'DEV-278', 'DEV-277', 'DEV-279']);
  });

  it.fails('DEV-279: acha o responsável e o selo Crítica mesmo com o sobrenome lido como "Conquelia" e o selo como "——"', () =>
  {
    // só "Douglas" ficou legível; aceitar um primeiro nome sozinho arrisca confundir menções no texto com o responsável
    expect(mapa.get('DEV-279')!.responsaveis).toEqual(['douglas-cerqueira']);
    expect(mapa.get('DEV-279')!.titulo).not.toMatch(/Douglas/);
    expect(mapa.get('DEV-279')!.prioridadeCard).toBe('Crítica');
  });
});

describe('print real: lista de Demandas com chamados de suporte (saída real do Tesseract)', () =>
{
  const cards = ler(OCR_TABELA_DEV_289, 'demandas');
  const mapa = porCodigo(cards);

  it('lê os 5 cards, todos de Mariana Coutinho, Em andamento', () =>
  {
    // DEV-040 saiu "DEV-640"
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-289', 'DEV-288', 'DEV-282', 'DEV-223', 'DEV-640']);
    for (const c of cards)
    {
      expect(c.responsaveis, c.codigo).toEqual(['mariana-coutinho']);
      expect(c.statusCard, c.codigo).toBe('Em andamento');
      expect(c.situacao, c.codigo).toBe('em_execucao');
    }
  });

  it('DEV-289 e DEV-288: tipo Suporte Kitu e prioridade Crítica; a descrição não vira "e Crítico" nem leva responsável e status', () =>
  {
    for (const codigo of ['DEV-289', 'DEV-288'])
    {
      const c = mapa.get(codigo)!;
      expect(c.sistema, codigo).toBe('Suporte Kitu');
      expect(c.prioridadeCard, codigo).toBe('Crítica');
      expect(c.criticidade, codigo).toBe(3);
      expect(c.titulo, codigo).not.toMatch(/^(e\s+)?cr[ií]tic/i);
      expect(c.titulo, codigo).not.toMatch(/Mariana|Coutinho|andamento/i);
    }
    expect(mapa.get('DEV-289')!.titulo).toBe('Outros — Erro cadastro de candidatos/funcionários - Kitu Sistema > Funcionários Descrição do solicitante: Ao. a7112/26');
    expect(mapa.get('DEV-288')!.tempoTotalMin).toBe(20);
  });

  it('DEV-282, DEV-223 e DEV-040: tipo Kitu Sistema (lido como "KituSistema") e descrição sem as colunas finais', () =>
  {
    for (const codigo of ['DEV-282', 'DEV-223', 'DEV-640'])
    {
      expect(mapa.get(codigo)!.sistema, codigo).toBe('Kitu Sistema');
      expect(mapa.get(codigo)!.titulo, codigo).not.toMatch(/Mariana|Coutinho|andamento|KituSistema/i);
    }
    expect(mapa.get('DEV-282')!.titulo).toBe('CAMPANHA: - poder selecionar manualmente os funcionários (verificar se isso funciona); - informar que,');
    expect(mapa.get('DEV-223')!.titulo).toContain('COMPARATIVO ENTRE UM PCMSO E OUTRO, E...');
    expect(mapa.get('DEV-640')!.titulo).toBe('CIPA votação eletrônica Funcionalidade de acompanhamento da CIPA com votação eletrônica...');
  });

  it.fails('lê o código DEV-040 e o tempo de cada card (o OCR leu "DEV-640", "158in", "B,2h" e "T1d")', () =>
  {
    expect(mapa.has('DEV-040')).toBe(true);
    expect(mapa.get('DEV-289')!.tempoTotalMin).toBe(15);
    expect(mapa.get('DEV-282')!.tempoTotalMin).toBe(492);
    expect(mapa.get('DEV-223')!.tempoTotalMin).toBe(3408);
  });
});

describe('print real: card DEV-274 aberto (saída real do Tesseract)', () =>
{
  it('lê o cabeçalho e o pedido completo, linha por linha', () =>
  {
    const [card, ...resto] = ler(OCR_CARD_PEDIDO, 'card');
    expect(resto).toEqual([]);
    expect(card).toMatchObject({ codigo: 'DEV-274', abertura: '2026-11-18', aberturaHora: '11:32', sistema: 'Kitu Sistema', origens: ['card'], descricaoCompleta: PEDIDO_COMPLETO });
  });

  it('lê as etapas sem código: nomes, responsável, situação rodando e o "desde"', () =>
  {
    const [card, ...resto] = ler(OCR_CARD_ETAPAS, 'card');
    expect(resto).toEqual([]);
    expect(card!.codigo).toBe(CODIGO_ORFAO);
    expect(card!.etapas).toMatchObject([
      { ordem: 1, nome: 'Validação dos requisitos', pessoa: 'rodrigo-cinelli', situacao: 'rodando', desde: '2026-11-16T16:25' },
      { ordem: 2, nome: 'Implementação', pessoa: 'rodrigo-cinelli', situacao: 'rodando', desde: '2026-11-16T16:25' },
      { ordem: 3, nome: 'Concluir', pessoa: 'rodrigo-cinelli' },
    ]);
    expect(card).toMatchObject({ etapasTotal: 3, etapasConcluidas: 0, etapaAtual: 'Validação dos requisitos', responsavelEtapaAtual: 'rodrigo-cinelli' });
  });

  it('a continuação do pedido (corte derivado do OCR real) vira fragmento órfão', () =>
  {
    const [card] = ler(corteOcr.continuacao, 'card');
    expect(card!.codigo).toBe(CODIGO_ORFAO);
    expect(card!.descricaoCompleta).toContain('Atenção em como exibir isso no cadastro de funcionários.');
  });

  it.fails('lê o tempo rodando (15,8 h) e a situação "não iniciada" da etapa 3 (o OCR leu "há15,8 4", "ná 15.8 EE" e perdeu "não iniciada")', () =>
  {
    const [card] = ler(OCR_CARD_ETAPAS, 'card');
    expect(card!.etapas![0]!.tempoRodandoHoras).toBe(15.8);
    expect(card!.etapas![1]!.tempoRodandoHoras).toBe(15.8);
    expect(card!.etapas![2]!.situacao).toBe('nao_iniciada');
  });
});

describe('prints reais fora de ordem: saída real do Tesseract (5 capturas, 120 ordens)', () =>
{
  const capturas = [
    entrada('lista-semana', OCR_LISTA_SEMANA, 'demandas'),
    entrada('lista-suporte', OCR_TABELA_DEV_289, 'demandas'),
    entrada('card-aberto', corteOcr.comCodigo, 'card'),
    entrada('card-continuacao', corteOcr.continuacao, 'card'),
    entrada('card-etapas', OCR_CARD_ETAPAS, 'card'),
  ];
  const referencia = resolver(capturas);
  const dev274 = referencia.final.find((c) => c.codigo === 'DEV-274')!;

  it('o DEV-274 fica com o pedido completo, as 3 etapas e o responsável certo, apesar do ruído das listas', () =>
  {
    expect(referencia.pendentes).toBe(0);
    expect(dev274.descricaoCompleta).toBe(PEDIDO_COMPLETO);
    expect(dev274.etapas?.map((e) => `${e.ordem}:${e.nome}`)).toEqual(['1:Validação dos requisitos', '2:Implementação', '3:Concluir']);
    expect(dev274.responsaveis).toEqual(['rodrigo-cinelli']);
    expect(dev274).toMatchObject({ statusCard: 'Em andamento', etapasTotal: 3, etapasConcluidas: 0, etapaAtual: 'Validação dos requisitos' });
    expect(referencia.lote.porCaptura.get('card-etapas')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
    expect(referencia.lote.porCaptura.get('card-continuacao')).toMatchObject({ pendentes: 0, cardPaiVinculado: 'DEV-274' });
  });

  it('o resultado é idêntico em qualquer ordem de envio', () =>
  {
    const ordens = permutacoes(capturas);
    expect(ordens).toHaveLength(120);
    for (const ordem of ordens)
    {
      const r = resolver(ordem);
      expect(r.pendentes, ordem.map((e) => e.id).join(' > ')).toBe(0);
      expect(r.final, ordem.map((e) => e.id).join(' > ')).toEqual(referencia.final);
    }
  }, TEMPO_LIMITE);
});

describe('prints reais fora de ordem: listas reais do Tesseract com card e etapas transcritos', () =>
{
  const capturas = [
    entrada('lista-semana', OCR_LISTA_SEMANA, 'demandas'),
    entrada('card-aberto', corteTranscricao.comCodigo, 'card'),
    entrada('card-continuacao', corteTranscricao.continuacao, 'card'),
    entrada('card-etapas', TRANSCRICAO_CARD_ETAPAS, 'card'),
  ];

  it('o resultado é idêntico nas 24 ordens e o DEV-274 sai completo', () =>
  {
    const referencia = resolver(capturas);
    const dev274 = referencia.final.find((c) => c.codigo === 'DEV-274')!;
    expect(dev274.descricaoCompleta).toBe(PEDIDO_COMPLETO);
    expect(dev274.etapas).toHaveLength(3);
    const ordens = permutacoes(capturas);
    expect(ordens).toHaveLength(24);
    for (const ordem of ordens) expect(resolver(ordem).final, ordem.map((e) => e.id).join(' > ')).toEqual(referencia.final);
  }, TEMPO_LIMITE);
});

describe('lista de Demandas com pessoa ainda não cadastrada', () =>
{
  it('lê o nome que vem antes do tempo como responsável', () =>
  {
    const texto = 'DEV-501 — Kitu Sistema Ajustar o relatório de exames Ana Paula Souza 3,2 d • Novo\n21/11/26 continuação da descrição.\nDEV-502 — Kitu Sistema Revisar importador Bruno Lima 5 h • Em andamento';
    const cards = ler(texto, 'demandas');
    expect(cards.find((c) => c.codigo === 'DEV-501')?.responsaveis).toEqual(['Ana Paula Souza']);
    expect(cards.find((c) => c.codigo === 'DEV-502')?.responsaveis).toEqual(['Bruno Lima']);
    expect(cards.find((c) => c.codigo === 'DEV-501')?.titulo).not.toContain('Ana Paula');
  });
});
