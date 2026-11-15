import { describe, expect, it } from 'vitest';
import { numerosForaDoPacote } from './pacote';

const pacote = 'Dentro do prazo: 70% (meta 85%). Concluídos: 125 de 212. Vence em 13/11. Horas: 44h de 40h. Taxa 91,5%.';

describe('números fora do pacote', () =>
{
  it('aceita só números que estão no pacote, com data, vírgula e zero à esquerda', () =>
  {
    expect(numerosForaDoPacote('Prazo em 70%, meta de 85%. Entrega em 13/11 (taxa de 91,5%).', pacote)).toEqual([]);
    expect(numerosForaDoPacote('Vence em 09/11 e 13/11.', pacote)).toEqual(['9']);
  });

  it('aponta número inventado e ignora marcadores de lista', () =>
  {
    const texto = '1. Prazo em 70%\n2) Subimos 12 pontos\n- 125 concluídos, 300 no total';
    expect(numerosForaDoPacote(texto, pacote)).toEqual(['12', '300']);
  });
});
