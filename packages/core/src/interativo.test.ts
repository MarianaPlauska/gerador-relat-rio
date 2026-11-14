import { describe, expect, it } from 'vitest';
import { codigoValido, marcasAtuais, novoCodigo, pontosDoRelatorio, resumirRetornos, type RelatorioInterativo, type RespostaInterativa } from './interativo';

const relatorio: RelatorioInterativo = {
  titulo: 'Relatório para Validação',
  subtitulo: 'Desenvolvimento',
  periodo: '09/11 a 13/11',
  geradoEm: '2026-11-14T10:00:00',
  secoes: [
    { id: 's1', tipo: 'texto', titulo: 'Resumo', paragrafos: ['Semana abaixo da meta.'] },
    { id: 's2', tipo: 'itens', titulo: 'Riscos', itens: [{ id: 'i1', texto: 'DEV-198 pode atrasar' }, { id: 'i2', texto: 'Falta acesso' }] },
  ],
};

const r = (nome: string, secaoId: string, itemId: string | undefined, marca: RespostaInterativa['marca'], em: string, texto = ''): RespostaInterativa => ({ nome, secaoId, itemId, marca, texto, em });

describe('relatório interativo', () =>
{
  it('o código do link é longo, válido e diferente a cada vez', () =>
  {
    const a = novoCodigo();
    expect(a).toHaveLength(24);
    expect(codigoValido(a)).toBe(true);
    expect(novoCodigo()).not.toBe(a);
    expect(codigoValido('../etc')).toBe(false);
    expect(codigoValido(null)).toBe(false);
  });

  it('lista os pontos marcáveis: itens um a um, as outras seções inteiras', () =>
  {
    expect(pontosDoRelatorio(relatorio).map((p) => [p.secaoId, p.itemId])).toEqual([['s1', undefined], ['s2', 'i1'], ['s2', 'i2']]);
  });

  it('vale a marca mais recente de cada pessoa em cada ponto', () =>
  {
    const respostas = [
      r('Ana', 's2', 'i1', 'duvida', '2026-11-14T10:00:00', 'qual o prazo?'),
      r('Ana', 's2', 'i1', 'concordo', '2026-11-14T11:00:00'),
      r('ana ', 's2', 'i2', 'ciente', '2026-11-14T10:30:00'),
      r('Bruno', 's2', 'i1', 'duvida', '2026-11-14T12:00:00', 'e a equipe?'),
    ];
    expect(marcasAtuais(respostas).map((m) => `${m.nome.trim()}:${m.itemId}:${m.marca}`).sort()).toEqual(['Bruno:i1:duvida', 'ana:i2:ciente', 'Ana:i1:concordo'].sort());
  });

  it('resume pessoas, marcas, comentários, dúvidas e o que é novo', () =>
  {
    const respostas = [
      r('Ana', 's2', 'i1', 'duvida', '2026-11-14T10:00:00', 'qual o prazo?'),
      r('Ana', 's2', 'i1', 'concordo', '2026-11-14T11:00:00'),
      r('Bruno', 's2', 'i1', 'duvida', '2026-11-14T12:00:00', 'e a equipe?'),
      r('Bruno', 's1', undefined, undefined, '2026-11-14T12:05:00', 'ótimo resumo'),
    ];
    const x = resumirRetornos(respostas, '2026-11-14T11:30:00');
    expect(x.pessoas).toEqual(['Ana', 'Bruno']);
    expect(x.marcas).toEqual({ ciente: 0, concordo: 1, duvida: 1 });
    expect(x.comentarios).toBe(3);
    expect(x.duvidas.map((d) => d.nome)).toEqual(['Bruno']);
    expect(x.novas).toBe(2);
  });
});
