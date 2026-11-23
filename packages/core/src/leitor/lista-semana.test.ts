import { describe, expect, it } from 'vitest';
import { pessoasExemplo } from '../exemplo';
import { coberturaDaLeitura } from './complemento';
import { detectarOrigem, lerCards } from './cards';

// lista de demandas como o OCR entrega o print da semana (linha a linha, cabeçalho sujo); conteúdo de exemplo
const LISTA = [
  'ID SOLICITANTE! — TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
  'DEV-205 — Kitu Sistema Área no Portal do cliente com os eventos por CNPJ Rodrigo Cinelli 46,4 h • Novo',
  '21/11/26 organizado por data e tipo de evento.',
  'DEV-285 — Kitu Sistema O importador da matrícula apenas verifica se houve Rodrigo Cinelli 5,9 d • Novo · 3,3 d de atraso',
  '17/11/26 Alta uma atualização n...',
  'DEV-282 — Kitu Sistema CAMPANHA: poder selecionar manualmente os Mariana Coutinho 6 d • Em andamento · 3,3 d de atraso',
  '17/11/26 funcionários (verificar se isso funciona)...',
  'DEV-268 — Kitu Sistema Checar por que temos tantos EPIs sobre a mesma Douglas Cerqueira 6,9 d • Novo',
  '16/11/26 Baixa coisa; verificar se a regra funciona...',
  'DEV-204 — Kitu Sistema No agendamento ter a opção de no ASO já sair com a data Rodrigo Cinelli 6,9 d • Novo',
  '16/11/26 do agendamento do exame...',
  'DEV-845 — Kitu Sistema Vacina, módulo com dashboard Douglas Cerqueira 7 d • Planejado',
  '16/11/26 Cada lançamento é de uma pessoa, numa empresa...',
  'DEV-8061 — Kitu Sistema Auditoria no Hub para o cliente ver os serviços Rodrigo Cinelli 7 d • Planejado · 2,3 d de atraso',
  '16/11/26 contratados x serviços...',
].join('\n');

const ler = (texto: string, codigosConhecidos?: string[]) => lerCards(texto, { prefixo: 'DEV', pessoas: pessoasExemplo, codigosConhecidos });

describe('lista de demandas da semana', () =>
{
  it('reconhece a lista mesmo com o cabeçalho sujo pelo OCR', () =>
  {
    expect(detectarOrigem(LISTA)).toBe('demandas');
  });

  it('lê cada card com o seu responsável, tempo, status e atraso', () =>
  {
    const cards = ler(LISTA, ['DEV-045']);
    expect(cards.map((c) => c.codigo)).toEqual(['DEV-205', 'DEV-285', 'DEV-282', 'DEV-268', 'DEV-204', 'DEV-045', 'DEV-061']);
    const por = Object.fromEntries(cards.map((c) => [c.codigo, c]));
    expect(por['DEV-282']).toMatchObject({ responsaveis: ['mariana-coutinho'], statusCard: 'Em andamento', atrasoDias: 3.3, tempoTotalMin: 6 * 480 });
    expect(por['DEV-268']!.responsaveis).toEqual(['douglas-cerqueira']);
    expect(por['DEV-205']).toMatchObject({ tempoTotalMin: Math.round(46.4 * 60), statusCard: 'Novo' });
    expect(por['DEV-205']!.atrasoDias).toBeUndefined();
    expect(por['DEV-061']).toMatchObject({ statusCard: 'Planejado', atrasoDias: 2.3 });
    expect(por['DEV-285']!.prioridadeCard).toBe('Alta');
    expect(por['DEV-061']!.avisosLeitura).toContain('código corrigido, confira');
  });

  it('sem saber os códigos, só corrige o que tem 4 dígitos', () =>
  {
    const codigos = ler(LISTA).map((c) => c.codigo);
    expect(codigos).toContain('DEV-061');
    expect(codigos).toContain('DEV-845');
  });

  it('a segunda linha da descrição e o cabeçalho contam como entendidos', () =>
  {
    const cards = ler(LISTA, ['DEV-045']);
    expect(coberturaDaLeitura(LISTA, 'DEV', [], cards, pessoasExemplo).pct).toBeGreaterThanOrEqual(80);
  });

  it('tabela lida em colunas: os nomes vão para os cards na ordem', () =>
  {
    const colunas = [
      'ID SOLICITANTE TIPO DESCRIÇÃO RESPONSÁVEL TEMPO STATUS',
      'DEV-205', 'DEV-285', 'DEV-282',
      'Área no Portal do cliente', 'O importador da matrícula', 'CAMPANHA: poder selecionar',
      'Rodrigo Cinelli', 'Douglas Cerqueira', 'Mariana Coutinho',
      '46,4 h', '5,9 d', '6 d', 'Novo', 'Novo', 'Em andamento',
    ].join('\n');
    const cards = ler(colunas);
    expect(cards.map((c) => c.responsaveis[0])).toEqual(['rodrigo-cinelli', 'douglas-cerqueira', 'mariana-coutinho']);
    expect(cards[0]!.avisosLeitura).toContain('tabela lida em colunas, confira o responsável e a descrição');
  });
});
