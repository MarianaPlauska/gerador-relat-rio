import { describe, expect, it } from 'vitest';
import
{
  calcularPontuacao,
  classificarQuadrante,
  criarIniciativa,
  criarMatriz,
  matrizExemploDiretoria,
  ranquearIniciativas,
  resumoPriorizacaoTeams,
  validarMatrizImportada,
} from './priorizacao';

describe('priorizacao', () =>
{
  it('classifica quadrantes corretamente e ranqueia por Impacto x Esforço e RICE', () =>
  {
    expect(classificarQuadrante(5, 1)).toBe('ganho_rapido');
    expect(classificarQuadrante(5, 4)).toBe('projeto_estrategico');
    expect(classificarQuadrante(2, 2)).toBe('preenchimento');
    expect(classificarQuadrante(2, 5)).toBe('evitar');

    const exemplo = matrizExemploDiretoria();
    const resumo = ranquearIniciativas(exemplo);
    expect(resumo.ranqueadas).toHaveLength(5);
    expect(resumo.contagem.ganho_rapido).toBe(2);
    expect(resumo.ranqueadas[0]?.quadrante).toBe('ganho_rapido');
    // item descartado vai para o final
    expect(resumo.ranqueadas.at(-1)?.item.situacao).toBe('descartado');

    const item = criarIniciativa({ impacto: 5, esforco: 2, urgencia: 4, alcance: 10, confianca: 0.8 });
    expect(calcularPontuacao(item, 'impacto_esforco')).toBe(7);
    expect(calcularPontuacao(item, 'rice')).toBe(20);

    const teams = resumoPriorizacaoTeams(exemplo);
    expect(teams).toContain('**PRIORIZAÇÃO — Prioridades do trimestre — Diretoria**');
    expect(teams).toContain('**Ranking de prioridades**');
  });

  it('importa JSON da IA e rejeita payload inválido', () =>
  {
    const invalido = validarMatrizImportada('não é json');
    expect(invalido.erros.length).toBeGreaterThan(0);

    const ok = validarMatrizImportada('{"nome":"Q1","modo":"rice","itens":[{"titulo":"Item A","impacto":5,"esforco":2,"alcance":8,"confianca":1}]}');
    expect(ok.erros).toHaveLength(0);
    expect(ok.matriz?.modo).toBe('rice');
    expect(ok.matriz?.itens[0]?.titulo).toBe('Item A');

    const vazia = criarMatriz({ nome: 'Teste' });
    expect(ranquearIniciativas(vazia).ranqueadas).toHaveLength(0);
  });
});
