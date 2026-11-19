import { describe, expect, it } from 'vitest';
import { chaveDoNomeEtapa, gargaloDasEtapas, passosDasEtapas, tempoDoPasso, temposPorEtapa } from './etapas-tempo';
import { pessoasExemplo } from './exemplo';
import { coberturaDaLeitura } from './leitor/complemento';
import { duracaoDaEtapaFeita, lerCards, periodoDaEtapa } from './leitor/cards';
import type { CardSnapshot, Snapshot } from './tipos';

// tela de etapas de um card, como o botão "Enviar ao OrbisOS" entrega: texto da página com o valor dos campos no lugar (exemplo sintético)
const TELA_ETAPAS = [
  'DEV-901 Exemplo de card para teste',
  'Etapas',
  '3 de 5 concluídas · ocioso entre etapas: 0 min úteis (0%)',
  '#\tETAPA\tRESPONSÁVEL\tTEMPO',
  '1\t Front-end ',
  '+ o que vai fazer\t Mariana Coutinho \tfeita · 10 d',
  '09/11/26 → 19/11/26\tReabrir',
  '2\t Back-end ',
  '+ o que vai fazer\t Mariana Coutinho \tfeita · 7,9 d',
  '09/11/26 → 17/11/26\tReabrir',
  '3\t Testar o deploy ',
  '+ o que vai fazer\t Mariana Coutinho ',
  '+ pessoa\tnão iniciada\tStart\tSubtarefa',
  '4\t Tratar as diferenças ',
  '+ o que vai fazer\t Mariana Coutinho ',
  '+ pessoa\trodando há 2,3 d',
  'desde 17/11/2026 09:04\tConcluir\tSubtarefa',
  '5\t Concluir ',
  '+ o que vai fazer\t Mariana Coutinho \tnão iniciada\tConcluir card',
].join('\n');

const etapa = (nome: string, ordem: number, duracaoDias?: number, situacao: 'concluida' | 'rodando' = 'concluida') => ({ ordem, nome, situacao, ...(duracaoDias !== undefined ? { duracaoDias } : {}) });
const card = (codigo: string, etapas: ReturnType<typeof etapa>[]): CardSnapshot => ({ codigo, titulo: codigo, responsaveis: [], origens: ['card'], etapas } as CardSnapshot);
const foto = (data: string, cards: CardSnapshot[]): Snapshot => ({ data, totais: {}, cards } as Snapshot);

describe('etapa feita', () =>
{
  it('lê a duração e o período', () =>
  {
    expect(duracaoDaEtapaFeita('feita · 10 d')).toBe(10);
    expect(duracaoDaEtapaFeita('feita · 7,9 d')).toBe(7.9);
    expect(duracaoDaEtapaFeita('feita · 4 h')).toBe(0.5);
    expect(duracaoDaEtapaFeita('rodando há 2 d')).toBeUndefined();
    expect(periodoDaEtapa('09/11/26 → 19/11/26')).toEqual({ inicio: '2026-11-09', fim: '2026-11-19' });
  });

  it('a tela de etapas entregue pelo botão vira etapas com duração', () =>
  {
    const [c] = lerCards(TELA_ETAPAS, { prefixo: 'DEV', pessoas: pessoasExemplo });
    const etapas = c!.etapas!;
    expect(etapas.map((e) => e.nome)).toEqual(['Front-end', 'Back-end', 'Testar o deploy', 'Tratar as diferenças', 'Concluir']);
    expect(etapas[0]).toMatchObject({ situacao: 'concluida', duracaoDias: 10, inicio: '2026-11-09', fim: '2026-11-19' });
    expect(etapas[1]).toMatchObject({ duracaoDias: 7.9, fim: '2026-11-17' });
    expect(etapas[3]).toMatchObject({ situacao: 'rodando' });
    expect(etapas[2]!.situacao).toBe('nao_iniciada');
  });

  it('a cobertura conta o que o leitor não entendeu', () =>
  {
    const c = coberturaDaLeitura('DEV-901 algo\nUma linha que ninguém entende aqui\nOutra linha estranha sem card', 'DEV');
    expect(c.naoEntendidas).toBe(2);
    expect(c.pct).toBeLessThan(50);
    expect(coberturaDaLeitura('', 'DEV').pct).toBe(100);
  });
});

describe('tempo por etapa', () =>
{
  const fotos = [
    foto('2026-11-10', [card('DEV-1', [etapa('Front-end', 1, 2), etapa('Testes', 2, 9)])]),
    foto('2026-11-17', [
      card('DEV-1', [etapa('Front-end', 1, 3), etapa('Testes', 2, 9)]),
      card('DEV-2', [etapa('Front-end', 1, 5), etapa('Testes', 2, 1)]),
      card('DEV-3', [etapa('Front end', 1, 4), etapa('Testes', 2, undefined, 'rodando')]),
    ]),
  ];

  it('mede p50 e p85 por etapa, com a leitura mais recente de cada card', () =>
  {
    const t = temposPorEtapa(fotos);
    const front = t.find((x) => x.chave === 'front end')!;
    expect(front).toMatchObject({ n: 3, p50: 4 });
    const testes = t.find((x) => x.chave === 'testes')!;
    expect(testes).toMatchObject({ n: 2, rodandoAgora: 1, p50: 5 });
    expect(gargaloDasEtapas(t)!.chave).toBe('testes');
  });

  it('liga o passo do fluxograma à etapa e monta os passos na ordem', () =>
  {
    const t = temposPorEtapa(fotos);
    expect(tempoDoPasso(t, 'Front-end')!.chave).toBe('front end');
    expect(tempoDoPasso(t, 'Fazer os testes finais')!.chave).toBe('testes');
    expect(tempoDoPasso(t, 'Fim')).toBeUndefined();
    expect(passosDasEtapas(t)).toBe('Front-end\nTestes\nFim');
    expect(chaveDoNomeEtapa('Validação  dos-Requisitos')).toBe('validacao dos requisitos');
  });
});
