import { describe, expect, it } from 'vitest';
import { pessoasExemplo, fotoVazia } from '../exemplo';
import { detectarOrigem, lerCards } from './cards';
import { lerTotais } from './totais';
import { mesclarNaFoto } from './mesclar';
import { lerOndas } from './ondas';

// textos transcritos dos prints de 09/11/26; trocar pelo ctrl+c real quando chegar

const operacao = `91
Referência
Eficiência da área · DEV
Prazo
87
Vazão
90
Qualidade
99
POSITIVO	Qualidade: 99% das etapas concluídas sem reabrir.
DEMANDAS EM ANDAMENTO
42
6 com etapa rodando agora
36 paradas entre etapas ou na fila
RITMO X PRAZO
3
atrasadas
11 em risco · 28 no ritmo · compara etapas feitas com o prazo já gasto
EM ABERTO AGORA
42
▲ 37 vs 30 dias anteriores · 3 fora do prazo
idade: até 1 dia 26 · 1–3 dias 5 · 3–7 dias 8 · 7–15 dias 2 · +15 dias 1
DENTRO DO PRAZO
70%
▼ 30 p.p. vs 30 dias anteriores
meta 85% · faltam 15 p.p. · 110 concluídas no período
PREVISÕES DESTA SEMANA
20
próximos 5 dias úteis
1 com previsão vencida`;

const conjunto = `ITENS NO CRONOGRAMA
212
53 ainda em Planejado
EM EXECUÇÃO
4
começaram e não vencem nos próximos 15 dias
VENCEM EM ATÉ 15 DIAS
25
atenção da semana
ATRASADOS
1
vencimento já passou
DATAS FIXADAS
49
★ previsão ajustada à mão ou card já assumido
CONCLUÍDOS
125
59% do total`;

const emExecucao = `CARD	DEMANDA	NÍVEL · CRITICIDADE	ETAPA ATUAL · QUEM	ETAPAS	PREVISÃO	RITMO
DEV-218	Kitu Sistema
Realizar um agendamento novo com um CPF aleatório até o fim	1	Testes
Douglas Cerqueira · rodando há 2,9 d	13/15	10/11/26	no ritmo
DEV-219	Kitu Sistema
Checar que tipo de bug é esse que identifica CPF inválido em	1	Concluir
Rodrigo Cinelli · aguardando Start	14/15	10/11/26	no ritmo
DEV-172	Kitu Sistema
Melhorar o layout: Dashboard de supervisão medicina, supervi	—	Implementação
Douglas Cerqueira · rodando há 12,8 d	1/6	11/11/26	em risco
DEV-198	Kitu Sistema
Na central do funcionário ter a opção de visualizar os exame	2	Modelagem
Mariana Coutinho · rodando há 3,7 d	2/15	11/11/26	em risco`;

const cronograma = `DEV-018	Ajustar padrões de cores, formatos de ícones e...	Kitu Sistema	06/10/26	23/10/26 ★	Concluído
DEV-041	O.S — página própria após Gestão de EPI	SST-127	14/10/26	15/10/26 ★	Concluído
DEV-111	Disponibilização de ajuda/guia de orientação n...	Kitu Sistema	30/10/26	03/11/26 ★	Atrasado`;

const opcoes = { prefixo: 'DEV', pessoas: pessoasExemplo };

describe('totais do painel', () =>
{
  it('lê operação do time', () =>
  {
    expect(lerTotais(operacao)).toMatchObject({
      eficiencia: 91, eficienciaPrazo: 87, eficienciaVazao: 90, eficienciaQualidade: 99, qualidadePct: 99,
      demandasEmAndamento: 42, etapaRodando: 6, paradasEntreEtapas: 36,
      ritmoAtrasadas: 3, ritmoEmRisco: 11, ritmoNoRitmo: 28,
      emAbertoAgora: 42, foraDoPrazo: 3,
      idadeAte1Dia: 26, idade1a3Dias: 5, idade3a7Dias: 8, idade7a15Dias: 2, idadeMais15Dias: 1,
      dentroDoPrazoPct: 70, metaPct: 85, concluidasNoPeriodo: 110,
      previsoesSemana: 20, previsaoVencida: 1,
    });
  });

  it('lê painel do conjunto de projetos', () =>
  {
    expect(lerTotais(conjunto)).toEqual({
      itensCronograma: 212, aindaPlanejado: 53, emExecucao: 4, vencem15Dias: 25,
      atrasadosVencimento: 1, datasFixadas: 49, concluidos: 125, concluidosPct: 59,
    });
  });

  it('lê as etiquetas de situação', () =>
  {
    const chips = 'Concluído 125 Atrasado 1 Vence em até 15 dias 25 A iniciar 54 Em execução 4 Sem data 3';
    expect(lerTotais(chips)).toMatchObject({ concluidos: 125, atrasadosVencimento: 1, vencem15Dias: 25, emExecucao: 4 });
  });

  it('não confunde ritmo atrasadas com atrasados por vencimento', () =>
  {
    expect(lerTotais('RITMO X PRAZO 3 atrasadas 11 em risco · 28 no ritmo').atrasadosVencimento).toBeUndefined();
  });
});

describe('cards em execução', () =>
{
  const cards = lerCards(emExecucao, opcoes);

  it('detecta a origem', () =>
  {
    expect(detectarOrigem(emExecucao)).toBe('em_execucao');
    expect(detectarOrigem(cronograma)).toBe('cronograma');
  });

  it('acha os quatro cards', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-218', 'DEV-219', 'DEV-172', 'DEV-198']);
  });

  it('lê etapas, previsão, ritmo, pessoa e status', () =>
  {
    expect(cards[0]).toMatchObject({
      sistema: 'Kitu Sistema',
      titulo: 'Realizar um agendamento novo com um CPF aleatório até o fim',
      criticidade: 1,
      etapaAtual: 'Testes',
      responsavelEtapaAtual: 'douglas-cerqueira',
      etapaAtualStatus: 'rodando',
      etapaAtualRodandoHaDias: 2.9,
      etapasConcluidas: 13,
      etapasTotal: 15,
      previsao: '2026-11-10',
      ritmoPainel: 'no_ritmo',
    });
    expect(cards[1]).toMatchObject({ etapaAtual: 'Concluir', etapaAtualStatus: 'aguardando_start', responsavelEtapaAtual: 'rodrigo-cinelli' });
    expect(cards[2]).toMatchObject({ etapaAtual: 'Implementação', ritmoPainel: 'em_risco', etapasTotal: 6 });
    expect(cards[2]!.criticidade).toBeUndefined();
    expect(cards[3]).toMatchObject({ responsavelEtapaAtual: 'mariana-coutinho', ritmoPainel: 'em_risco' });
  });

  it('funciona com texto de leitura de imagem em linha única', () =>
  {
    const ocr = 'DEV-207 Kitu Sistema 2 Implementação Rodrigo Cinelli · rodando há 3,6 d 7/15 11/11/26 em risco';
    const [c] = lerCards(ocr, { ...opcoes, origem: 'em_execucao' });
    expect(c).toMatchObject({
      codigo: 'DEV-207', etapasConcluidas: 7, etapasTotal: 15, previsao: '2026-11-11',
      ritmoPainel: 'em_risco', responsavelEtapaAtual: 'rodrigo-cinelli', etapaAtualRodandoHaDias: 3.6,
    });
  });
});

// saída real do tesseract.js sobre o print de 09/11/26, sem pré-processamento
const ocrReal = `Quem está cuidando de quê 7 em execução - ordenado pela previsão
caro DEMANDA NÍVEL - CRITICIDADE ETAPA ATUAL: QUEM ETAPAS — PREVISÃO RITMO
DEV-NS Kitu Sistema 1. Testes 13/15 10/11/26 enoritmo
Realizar um agendamento novo com um CPF aleatório até o fim Douglas Cerqueira - rodando há 2,9 d
DEV-219 Kitu Sistema 1. Concluir 14/15 10/11/26 e noritmo
(Checar que tipo de bug é esse que identifica CPF inválido em Rodrigo Cinelli - aguardando Start
DEV-IT2 Kitu Sistema — Implementação 1/6 11/01/26 (eemrisco)
Melhorar o layout: Dashboard de supervisão medicina, supervi Douglas Cerqueira - rodando há 12,8 d
DEV-198 Kitu Sistema 2 Modelagem 2/15 11/11/26 (eemrisco )
Na central do funcionário ter a opção de visualizar os exame. Mariana Coutinho - rodando há 3,7d
DEV-207 Kitu Sistema 2 Implementação 715 14/01/26 (eemrisco)
Continuar checando os envios em produção com o Davi para ver Rodrigo Cinelli - rodando há 3,6 d
DEV-040 Kitu Sistema 3 Modelagem 3/13 13/11/26 (e emrisco)
CIPA — votação eletrônica Funcionalidade de acompanhamento Mariana Coutinho - rodando há 5,7 d
DEV-206 Kitu Sistema 1. Validação dos requisitos 1/15. 12/02/27 e noritmo
Permitir que a autenticação do certificado digital, seja fei Rodrigo Cinelli - rodando há 3,6 d
Fila — demandas a iniciar 35 - ordenadas pela abertura`;

describe('leitura de imagem real', () =>
{
  const cards = lerCards(ocrReal, { ...opcoes, hoje: '2026-11-09' });
  const porCodigo = (c: string) => cards.find((x) => x.codigo === c)!;

  it('mantém os 7 cards, mesmo com código ilegível', () =>
  {
    expect(detectarOrigem(ocrReal)).toBe('em_execucao');
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-NS', 'DEV-219', 'DEV-IT2', 'DEV-198', 'DEV-207', 'DEV-040', 'DEV-206']);
    expect(porCodigo('DEV-NS').avisosLeitura).toContain('código ilegível');
  });

  it('lê o card completo quando a imagem está boa', () =>
  {
    expect(porCodigo('DEV-198')).toMatchObject({
      sistema: 'Kitu Sistema', criticidade: 2, etapaAtual: 'Modelagem',
      titulo: 'Na central do funcionário ter a opção de visualizar os exame.',
      etapasConcluidas: 2, etapasTotal: 15, previsao: '2026-11-11', ritmoPainel: 'em_risco',
      responsavelEtapaAtual: 'mariana-coutinho', etapaAtualRodandoHaDias: 3.7, avisosLeitura: [],
    });
    expect(porCodigo('DEV-219')).toMatchObject({ ritmoPainel: 'no_ritmo', etapaAtual: 'Concluir', etapaAtualStatus: 'aguardando_start' });
    expect(porCodigo('DEV-IT2')).toMatchObject({ etapaAtual: 'Implementação', ritmoPainel: 'em_risco' });
  });

  it('não leva o título da próxima seção para o último card', () =>
  {
    expect(porCodigo('DEV-206').titulo).toBe('Permitir que a autenticação do certificado digital, seja fei');
  });

  it('avisa o que a imagem leu errado', () =>
  {
    expect(porCodigo('DEV-207').avisosLeitura).toEqual(['sem etapas', 'previsão estranha']);
    expect(porCodigo('DEV-IT2').avisosLeitura).toContain('previsão estranha');
  });
});

describe('cronograma', () =>
{
  const cards = lerCards(cronograma, opcoes);

  it('lê início, vencimento, estrela e situação', () =>
  {
    expect(cards[0]).toMatchObject({
      codigo: 'DEV-018', inicio: '2026-10-06', vencimento: '2026-10-23', dataFixada: true,
      situacao: 'concluido', sistema: 'Kitu Sistema',
    });
    expect(cards[2]!.situacao).toBe('atrasado');
    expect(cards[2]!.ritmoPainel).toBeUndefined();
  });

  it('não trata o id do item (SST-127) como card', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-018', 'DEV-041', 'DEV-111']);
    expect(cards[1]!.sistema).toBe('SST-127');
  });
});

describe('foto do dia', () =>
{
  it('soma leituras sem perder dados', () =>
  {
    let foto = fotoVazia('2026-11-09');
    foto = mesclarNaFoto(foto, lerTotais(conjunto), lerCards(cronograma, opcoes));
    foto = mesclarNaFoto(foto, lerTotais(operacao), lerCards('DEV-111\t1/3\t05/11/26\tem risco', { ...opcoes, origem: 'em_execucao' }));
    const c = foto.cards.find((x) => x.codigo === 'DEV-111');
    expect(c).toMatchObject({ vencimento: '2026-11-03', etapasTotal: 3, ritmoPainel: 'em_risco', origens: ['cronograma', 'em_execucao'] });
    expect(foto.totais).toMatchObject({ itensCronograma: 212, demandasEmAndamento: 42 });
  });
});

// saída real da leitura de imagem dos prints de 10/11/26
const vencimentosImagem = `ITEM VENC. CARD ONDA SITUAÇÃO

Continuar plano de staging e modo 10/11/26 DEV-192 1 e Vence em até 15 dias
desenvolvedor/homologação *

Kitu Sistema

Acompanhar o eSocial * 10/11/26 DEV-225 1 e Vence em até 15 dias
Kitu Sistema

Erro no sistema MAS consigo seguir - Kitu Sistema > 10/11/26 DEV-236 = e Vence em até 15 dias
Cadastros

Suporte Kitu

Nos cadastros de serviços contratados, quando for 13/11/26 DEV-235 1 e Vence em até 1

um caso de todos os municípios do estado *`;

const cronogramaImagem = `SITUAÇÃO - DESMARQUE O QUE NÃO QUER VER
| MW Concluído 138 )/ Mw Atrasado O )/ MW Venceematé15dias 25 ) | MW Ainiciar 53 // MW Emexecução 5 | | Semdata 4 ) Desmarcar todas
CARD ITEM ID INÍCIO VENC. SITUAÇÃO —
DEV-136 Formatação da página de absenteísmo. Kitu Sistema 23/10/26 28/10/26 * e Concluído DR
DEV-O080 — Hub do Cliente — busca e download de docum.. — SST-686 23/10/26 06/11/26 *k e Concluído Pr
DEV-016 Verificar seoPGR está emitindo páginas a mais... Kitu Sistema 82/11/26 64/11/26 *k e Concluído '
DEV-196  COlocar visão geral para a Dani, como matriz d... Kitu Sistema 03/11/26 03/11/26 * e Concluído [+
DEV-948  Logodosclientes SST-096 63/11/26 05/11/26 * e Concluído [
DEV-192 Continuar plano de staging e modo desenvolve... Kitu Sistema 63/11/26 10/11/26 * e Vence em até 15 dias *
DEV-040 CIPA votação eletrônica SSsT-037 63/11/26 16/11/26 *k e Vence em até 15 dias * |`;

describe('próximos 10 vencimentos (imagem)', () =>
{
  const cards = lerCards(vencimentosImagem, opcoes);

  it('liga cada título ao seu card', () =>
  {
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-192', 'DEV-225', 'DEV-236', 'DEV-235']);
    expect(cards[0]).toMatchObject({ titulo: 'Continuar plano de staging e modo desenvolvedor/homologação', sistema: 'Kitu Sistema', vencimento: '2026-11-10', dataFixada: true, situacao: 'vence_15_dias' });
    expect(cards[1]).toMatchObject({ titulo: 'Acompanhar o eSocial', sistema: 'Kitu Sistema' });
    expect(cards[2]).toMatchObject({ titulo: 'Erro no sistema MAS consigo seguir - Kitu Sistema > Cadastros', sistema: 'Suporte Kitu' });
    expect(cards[3]).toMatchObject({ titulo: 'Nos cadastros de serviços contratados, quando for um caso de todos os municípios do estado', sistema: undefined, vencimento: '2026-11-13' });
  });

  it('não lê a onda como criticidade', () =>
  {
    expect(cards.every((c) => c.criticidade === undefined)).toBe(true);
  });
});

describe('lista do cronograma (imagem)', () =>
{
  const cards = lerCards(cronogramaImagem, opcoes);
  const card = (codigo: string) => cards.find((c) => c.codigo === codigo)!;

  it('é cronograma mesmo com o filtro "A iniciar" na tela', () =>
  {
    expect(detectarOrigem(cronogramaImagem)).toBe('cronograma');
  });

  it('separa título e sistema na mesma linha', () =>
  {
    expect(card('DEV-136')).toMatchObject({ titulo: 'Formatação da página de absenteísmo', sistema: 'Kitu Sistema', inicio: '2026-10-23', vencimento: '2026-10-28', situacao: 'concluido', dataFixada: true });
    expect(card('DEV-040')).toMatchObject({ titulo: 'CIPA votação eletrônica', sistema: 'SSsT-037', situacao: 'vence_15_dias' });
  });

  it('corrige o que a imagem troca e avisa', () =>
  {
    expect(card('DEV-080')).toMatchObject({ titulo: 'Hub do Cliente — busca e download de docum', sistema: 'SST-686' });
    expect(card('DEV-080').avisosLeitura).toContain('código corrigido, confira');
    expect(card('DEV-016')).toMatchObject({ inicio: '2026-11-02', vencimento: '2026-11-04' });
    expect(card('DEV-016').avisosLeitura).toContain('data corrigida, confira');
    expect(card('DEV-948').avisosLeitura).toContain('código estranho, confira');
    expect(card('DEV-136').avisosLeitura).toEqual([]);
  });
});

const demandasImagem = `29 registros filtrados de 228 - clique na linha para abrir
MM Aguardando Time Comercial 9 OD Resotvido 48 M Cancelado O Marcar todas
ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS SAT.
DEV-079 = Kitu Sistema SLA Controlar ações pendentes da equipe Mariana O min * Planejado - começa 22/03/27 = 2 O
22/03/27 técnica para ajustes, aprovações dos... Coutinho
DEV-113 — Kitu Sistema Solicitação de criação de função pelo cliente Mariana O min e Novo - 2 O
15/03/27 Coutinho
DEV -077 = Kitu Sistema Relatório DE-PARA Toda vez que emitimos um Mariana O min * Planejado - começa 09/03/27 = 2 OB
09/03/27 novo PCMSO e houver alteração no protocolo ... Coutinho
DEV-005 = Kitu Sistema Alterar a Fonte total dos documentos emitidos Mariana O min e Novo A valedestacar OQ
10/02/27 Baixa pelo sistema para Roboto. Coutinho`;

describe('lista de demandas (imagem)', () =>
{
  const cards = lerCards(demandasImagem, opcoes);
  const card = (codigo: string) => cards.find((c) => c.codigo === codigo)!;

  it('reconhece a tela e junta o código separado', () =>
  {
    expect(detectarOrigem(demandasImagem)).toBe('demandas');
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-079', 'DEV-113', 'DEV-077', 'DEV-005']);
  });

  it('lê abertura, tipo, descrição, pessoa e status', () =>
  {
    expect(card('DEV-079')).toMatchObject({
      abertura: '2027-03-22', sistema: 'Kitu Sistema', titulo: 'SLA Controlar ações pendentes da equipe técnica para ajustes, aprovações dos...',
      responsaveis: ['mariana-coutinho'], statusCard: 'Planejado', planejadoPara: '2027-03-22', avisosLeitura: [],
    });
    expect(card('DEV-113')).toMatchObject({ statusCard: 'Novo', titulo: 'Solicitação de criação de função pelo cliente', abertura: '2027-03-15' });
    expect(card('DEV-005')).toMatchObject({ statusCard: 'Novo', titulo: 'Alterar a Fonte total dos documentos emitidos pelo sistema para Roboto.' });
  });

  it('não confunde "novo" da descrição com o status', () =>
  {
    expect(card('DEV-077').statusCard).toBe('Planejado');
  });

  it('lê a versão com tabulação', () =>
  {
    const [c] = lerCards('ID\tSOLICITANTE\tTIPO\tDESCRIÇÃO\nDEV-079\n22/03/27\t—\tKitu Sistema\tSLA Controlar ações\tMariana Coutinho\t0 min\tPlanejado · começa 22/03/27\t—', opcoes);
    expect(c).toMatchObject({ abertura: '2027-03-22', titulo: 'SLA Controlar ações', statusCard: 'Planejado', responsaveis: ['mariana-coutinho'] });
  });
});

describe('números novos da operação do time', () =>
{
  it('lê etapas concluídas, tempo mediano, ocioso e tempo limpo', () =>
  {
    const texto = `ETAPAS CONCLUÍDAS
599
▲ 210 vs 30 dias anteriores
tempo mediano por etapa: 0 min (= estável)
OCIOSO ENTRE ETAPAS
1%
23,9 h úteis parados
TEMPO LIMPO · MEDIANA
19,4 h
▼ 13 h vs 30 dias anteriores
média 2,5 d · média muito acima da mediana`;
    expect(lerTotais(texto)).toMatchObject({
      etapasConcluidas: 599, etapasConcluidasVariacao: 210, tempoMedianoEtapaMin: 0, ociosoPct: 1, ociosoHoras: 23.9,
      tempoLimpoMedianaH: 19.4, tempoLimpoVariacaoH: -13, tempoLimpoMediaDias: 2.5,
    });
  });

  it('não lê o "etapas concluídas 0%" do card aberto', () =>
  {
    expect(lerTotais('Etapas concluídas 0% · prazo consumido 0%').etapasConcluidas).toBeUndefined();
  });
});

describe('resumo por onda', () =>
{
  it('lê a imagem, mesmo com 0 lido como letra', () =>
  {
    const ondas = lerOndas(`ONDA INÍCIO FIM ITENS CONCL.  *%CONCLUÍDO  PRÓX.VENC. SITUAÇÃO ITEM VENC. CARD ONDA SITUAÇÃO
M Prioridade 1 01/11/26 — 30/01/27 86 51 —— 10/11/26 * Em curso Continuar plano de staging e modo 10/11/26 poços 1 io E EE
e Prioridade 2 01/02/27 30/04/27 23 [o] o% 04/02/27 e Não iniciada
mM Prioridade3 — 01/05/27 31/07/27 18 o x 03/05/27 * Não iniciada Kitu Sistema
W Prioridade 5'=—=01/11/27 31/01/28 2 (e) 0% 07/01/28 e Não iniciada`);
    expect(ondas).toEqual([
      { nome: 'Prioridade 1', inicio: '2026-11-01', fim: '2027-01-30', itens: 86, concluidos: 51, pct: undefined, proximoVencimento: '2026-11-10', situacao: 'Em curso' },
      { nome: 'Prioridade 2', inicio: '2027-02-01', fim: '2027-04-30', itens: 23, concluidos: 0, pct: 0, proximoVencimento: '2027-02-04', situacao: 'Não iniciada' },
      { nome: 'Prioridade 3', inicio: '2027-05-01', fim: '2027-07-31', itens: 18, concluidos: 0, pct: undefined, proximoVencimento: '2027-05-03', situacao: 'Não iniciada' },
      { nome: 'Prioridade 5', inicio: '2027-11-01', fim: '2028-01-31', itens: 2, concluidos: 0, pct: 0, proximoVencimento: '2028-01-07', situacao: 'Não iniciada' },
    ]);
  });

  it('lê a versão com tabulação e guarda na foto', () =>
  {
    const ondas = lerOndas('Prioridade 1\t01/11/26\t30/01/27\t86\t51\t59%\t10/11/26\tEm curso');
    expect(ondas[0]).toMatchObject({ itens: 86, concluidos: 51, pct: 59, situacao: 'Em curso' });
    expect(mesclarNaFoto(fotoVazia('2026-11-10'), {}, [], ondas).ondas).toHaveLength(1);
  });
});
