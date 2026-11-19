import { describe, expect, it } from 'vitest';
import { pessoasExemplo } from '../exemplo';
import { lerCards } from './cards';
import { linhasNaoReconhecidas } from './complemento';
import {
  adicionarRegrasDescarte,
  aplicarRegrasDescarte,
  extrairRegrasDeTexto,
  removerRegraDescarte,
} from './descarte';

describe('regras de descarte nos prints', () =>
{
  it('extrai regras de texto digitado ou OCR protegendo códigos de card e datas', () =>
  {
    const texto = [
      '• Descrição do solicitante:',
      'DEV-289',
      '17/11/26',
      'Kitu Sistema > Funcionários; Registros filtrados',
      'a',
      '1234',
      'Descrição do solicitante:',
    ].join('\n');

    expect(extrairRegrasDeTexto(texto, 'DEV')).toEqual([
      'Descrição do solicitante:',
      'Kitu Sistema > Funcionários',
      'Registros filtrados',
    ]);
  });

  it('adiciona e remove regras sem duplicar por maiúsculas ou acentos', () =>
  {
    const comDuas = adicionarRegrasDescarte(['Descrição do solicitante:'], ['descricao do solicitante:', 'Outros']);
    expect(comDuas).toEqual(['Descrição do solicitante:', 'Outros']);

    const aposRemocao = removerRegraDescarte(comDuas, 'Descrição do solicitante:');
    expect(aposRemocao).toEqual(['Outros']);
  });

  it('remove frases descartadas com tolerância a acentos e separadores sem cortar meio de palavra', () =>
  {
    const regras = ['Descricao do solicitante:', 'Kitu Sistema > Funcionarios', 'Outros'];
    const linha = 'Outros — Erro cadastro de candidatos/funcionários • Kitu Sistema › Funcionários Descrição do solicitante: Ao cadastrar exibe erro.';
    const limpo = aplicarRegrasDescarte(linha, regras);

    expect(limpo).toBe('Erro cadastro de candidatos/funcionários Ao cadastrar exibe erro.');
    // palavra semelhante ("coutros") não pode ser mutilada por "Outros"
    expect(aplicarRegrasDescarte('Valor em coutros casos continua', ['Outros'])).toBe('Valor em coutros casos continua');
  });

  it('preserva tabulações em texto copiado por Ctrl+C ao aplicar regras de descarte', () =>
  {
    const colado = 'DEV-289\t17/11/26\tSuporte Kitu\tOutros — Erro cadastro\tMariana Coutinho\t15 min\tEm andamento';
    const limpo = aplicarRegrasDescarte(colado, ['Outros']);
    expect(limpo).toBe('DEV-289\t17/11/26\tSuporte Kitu\tErro cadastro\tMariana Coutinho\t15 min\tEm andamento');
  });

  it('lerCards remove trechos descartados da descrição das demandas reais sem quebrar os metadados', () =>
  {
    const ocrPainel = [
      'ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
      'DEV-289 — Suporte Kitu Outros — Erro cadastro de candidatos/funcionários •',
      '• Crítico Kitu Sistema > Funcionários Descrição do solicitante: Ao Mariana Coutinho 15 min • Em andamento',
      '17/11/26 tentar salvar trava',
      'DEV-288 — Suporte Kitu Erro no sistema e NÃO consigo seguir • Kitu Sistema >',
      '• Crítico Agendamento Descrição do solicitante: Agendamento de Mariana Coutinho 20 min • Em andamento',
      '17/11/26 exame falhando',
    ].join('\n');

    const regras = [
      'Outros',
      'Kitu Sistema > Funcionários',
      'Kitu Sistema > Agendamento',
      'Descrição do solicitante:',
    ];

    const cards = lerCards(ocrPainel, {
      prefixo: 'DEV',
      pessoas: pessoasExemplo,
      regrasDescarte: regras,
    });

    expect(cards).toHaveLength(2);
    const dev289 = cards.find((c) => c.codigo === 'DEV-289')!;
    expect(dev289.sistema).toBe('Suporte Kitu');
    expect(dev289.prioridadeCard).toBe('Crítica');
    expect(dev289.statusCard).toBe('Em andamento');
    expect(dev289.tempoTotalMin).toBe(15);
    expect(dev289.responsaveis).toContain('mariana-coutinho');
    expect(dev289.descricaoCompleta).toBe('Erro cadastro de candidatos/funcionários Ao tentar salvar trava');

    const dev288 = cards.find((c) => c.codigo === 'DEV-288')!;
    expect(dev288.descricaoCompleta).toBe('Erro no sistema e NÃO consigo seguir Agendamento de exame falhando');
  });

  it('linhasNaoReconhecidas também ignora linhas descartadas pelas regras', () =>
  {
    const texto = [
      'DEV-289 Erro cadastro',
      'Registros filtrados no painel lateral',
      'Menu de navegação rápido',
    ].join('\n');

    expect(linhasNaoReconhecidas(texto, 'DEV', ['Menu de navegação rápido'])).toEqual([
      'Registros filtrados no painel lateral',
    ]);
  });
});
