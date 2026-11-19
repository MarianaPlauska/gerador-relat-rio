import { describe, expect, it } from 'vitest';
import { planilhaDeHoras } from './horas';
import { aplicarCortes, foraDoTotal, lerValor, migrarPlanilha, ocupacao, pedidoDePlanilha, sugestaoDeCortes, totaisPorGrupo, totalGeral, validarPlanilha } from './index';

const material = 'Quero geladeira https://loja.exemplo/geladeira e sofa https://loja.exemplo/sofa/';

const resposta = {
  nome: 'Casa nova',
  moeda: true,
  orcamento: 'R$ 10.000,00',
  grupos: ['Sala', 'Cozinha'],
  linhas: [
    { grupo: 'Cozinha', item: 'geladeira', qtd: 1, min: 2000, ref: 2400, max: 2800, situacao: 'Verificado', prioridade: 'essencial', link: 'https://loja.exemplo/geladeira' },
    { grupo: 'Sala', item: 'sofá', qtd: 2, ref: '1.500,50', prioridade: 'desejavel', link: 'https://loja.exemplo/sofa' },
    { grupo: 'Sala', item: 'tapete', qtd: 1, ref: 800, prioridade: 'importante', incluir: false },
    { grupo: 'Cozinha', item: 'fogão', ref: 1200, prioridade: 'importante' },
  ],
  alternativas: [{ item: 'geladeira', opcao: 'Modelo maior', valor: 2600, data: '17/11/2026' }],
  notas: { atencao: ['Confirmar tensão'] },
};
const lida = () => validarPlanilha(JSON.stringify(resposta), material, true).planilha!;

describe('ler valores', () =>
{
  it('entende reais, milhar e decimais', () =>
  {
    expect(lerValor('R$ 1.234,56')).toBe(1234.56);
    expect(lerValor('1.234')).toBe(1234);
    expect(lerValor('2,5')).toBe(2.5);
    expect(lerValor('1234.56')).toBe(1234.56);
    expect(lerValor(-3)).toBeUndefined();
    expect(lerValor('abc')).toBeUndefined();
  });
});

describe('validar a resposta da IA', () =>
{
  it('aceita cercas de código e mantém a ordem dos grupos e das linhas', () =>
  {
    const r = validarPlanilha('```json\n' + JSON.stringify(resposta) + '\n```', material, true);
    expect(r.erros).toEqual([]);
    expect(r.planilha!.grupos).toEqual(['Sala', 'Cozinha']);
    expect(r.planilha!.linhas.map((l) => l.item)).toEqual(['geladeira', 'sofá', 'tapete', 'fogão']);
    expect(r.planilha!.orcamento).toBe(10000);
    expect(r.planilha!.alternativas[0]!.data).toBe('2026-11-17');
  });

  it('aplica os padrões e interpreta situação, prioridade e incluir', () =>
  {
    const [geladeira, sofa, tapete] = lida().linhas;
    expect(geladeira).toMatchObject({ situacao: 'verificado', prioridade: 'essencial', incluir: true });
    expect(sofa).toMatchObject({ situacao: 'estimativa', prioridade: 'desejavel', ref: 1500.5, qtd: 2 });
    expect(tapete!.incluir).toBe(false);
  });

  it('descarta as alternativas quando a aba não foi pedida', () =>
  {
    const r = validarPlanilha(JSON.stringify(resposta), material);
    expect(r.planilha!.comAlternativas).toBe(false);
    expect(r.planilha!.alternativas).toEqual([]);
    expect(r.avisos.join(' ')).toContain('Alternativas não foi pedida');
  });

  it('JSON inválido e resposta sem linhas viram erro', () =>
  {
    expect(validarPlanilha('isto não é json').erros[0]).toContain('JSON válido');
    expect(validarPlanilha('{"nome":"x","linhas":[]}').erros.join(' ')).toContain('Nenhuma linha válida');
    expect(validarPlanilha('{"nome":"x"}').erros[0]).toContain('"linhas"');
  });

  it('descarta só a linha ruim e avisa sobre link fora do material ou inválido', () =>
  {
    const r = validarPlanilha(JSON.stringify({ linhas: [{ item: 'a', link: 'https://inventado.com/x' }, { grupo: 'G' }, { item: 'b', link: 'ftp://x' }] }), material);
    expect(r.planilha!.linhas).toHaveLength(2);
    expect(r.erros.join(' ')).toContain('Linha 2');
    expect(r.avisos.join(' ')).toContain('não aparece no material');
    expect(r.avisos.join(' ')).toContain('link inválido');
    expect(r.planilha!.linhas[1]!.link).toBeUndefined();
  });

  it('aceita link do material com ou sem barra no fim', () =>
  {
    expect(validarPlanilha(JSON.stringify({ linhas: [{ item: 'a', link: 'https://loja.exemplo/sofa' }] }), material).avisos).toEqual([]);
  });
});

describe('totais e orçamento', () =>
{
  it('soma só o que está incluído, por grupo e no total', () =>
  {
    const p = lida();
    const g = totaisPorGrupo(p);
    expect(g.map((x) => x.grupo)).toEqual(['Sala', 'Cozinha']);
    expect(g[0]).toMatchObject({ itens: 1, ref: 3001, estimado: 3001, pctEstimado: 100 });
    expect(g[1]).toMatchObject({ itens: 2, min: 3200, ref: 3600, max: 4000, estimado: 1200, pctEstimado: 33 });
    expect(totalGeral(p)).toMatchObject({ itens: 3, ref: 6601 });
    expect(foraDoTotal(p)).toBe(800);
  });

  it('mostra quanto do orçamento está ocupado e quanto sobra', () =>
  {
    const o = ocupacao(lida())!;
    expect(o.ref).toEqual({ usado: 6601, pct: 66, diferenca: 3399, estoura: false });
    expect(o.porGrupo[0]).toMatchObject({ grupo: 'Sala', pctDoOrcamento: 30 });
    expect(ocupacao({ ...lida(), orcamento: undefined })).toBeUndefined();
  });

  it('sugere cortes do desejável ao importante, nunca o essencial', () =>
  {
    const p = { ...lida(), orcamento: 4000 };
    const s = sugestaoDeCortes(p);
    expect(s.cortes.map((l) => l.item)).toEqual(['sofá']);
    expect(s).toMatchObject({ novoTotal: 3600, cabe: true });
    const apertado = sugestaoDeCortes({ ...p, orcamento: 2000 });
    expect(apertado.cortes.map((l) => l.item)).toEqual(['sofá', 'fogão']);
    expect(apertado).toMatchObject({ novoTotal: 2400, cabe: false });
    aplicarCortes(p, s.cortes.map((l) => l.id));
    expect(p.linhas.find((l) => l.item === 'sofá')!.incluir).toBe(false);
    expect(sugestaoDeCortes(p).cabe).toBe(true);
  });
});

describe('orçamento de horas', () =>
{
  it('cada pessoa vira um grupo com a capacidade como orçamento', () =>
  {
    const pessoas = [{ id: 'ana', nome: 'Ana', capacidadeHorasSemana: 40 }, { id: 'bia', nome: 'Bia', capacidadeHorasSemana: 20 }];
    const cards = [
      { codigo: 'DEV-1', titulo: 'a', responsaveis: ['ana'], origens: ['demandas'], horasEstimadas: 30, origemHoras: 'manual', prioridadeCard: 'Alta' },
      { codigo: 'DEV-2', titulo: 'b', responsaveis: ['ana'], origens: ['demandas'], horasEstimadas: 16, prioridadeCard: 'Baixa' },
      { codigo: 'DEV-3', titulo: 'c', responsaveis: ['bia'], origens: ['demandas'], horasEstimadas: 8, statusCard: 'Resolvido' },
      { codigo: 'DEV-4', titulo: 'd', responsaveis: ['bia'], origens: ['demandas'], horasEstimadas: 12 },
    ] as unknown as Parameters<typeof planilhaDeHoras>[0];
    const p = planilhaDeHoras(cards, pessoas, 'Semana');
    expect(p.grupos).toEqual(['Ana', 'Bia']);
    expect(p.linhas.map((l) => l.item)).toEqual(['DEV-1', 'DEV-2', 'DEV-4']);
    expect(p.linhas[0]).toMatchObject({ situacao: 'verificado', prioridade: 'essencial' });
    expect(p.orcamento).toBe(60);
    const o = ocupacao(p)!;
    expect(o.porGrupo[0]).toMatchObject({ grupo: 'Ana', ref: 46, orcamentoDoGrupo: 40, pctDoGrupo: 115, estoura: true });
    expect(o.porGrupo[1]).toMatchObject({ grupo: 'Bia', pctDoGrupo: 60, estoura: false });
    expect(sugestaoDeCortes(p).cabe).toBe(true);
  });
});

describe('pedido e migração', () =>
{
  it('o pedido leva a ordem, o orçamento e o material', () =>
  {
    const t = pedidoDePlanilha({ material: 'minha lista https://x.com', ordem: 'cozinha primeiro', orcamento: 12000, moeda: true });
    expect(t).toContain('SOMENTE com um JSON');
    expect(t).toContain('cozinha primeiro');
    expect(t).toContain('12.000');
    expect(t).toContain('minha lista https://x.com');
    expect(t.indexOf('Ordem que eu quero')).toBeLessThan(t.indexOf('Meu material'));
    expect(t).toContain('NÃO inclua a chave "alternativas"');
    expect(t).not.toContain('Modelo 377 L');
    const com = pedidoDePlanilha({ material: 'x', ordem: '', moeda: true, comAlternativas: true });
    expect(com).toContain('outras opções comparadas');
    expect(com).toContain('Modelo 377 L');
  });

  it('migrar completa os campos que faltam', () =>
  {
    const p = migrarPlanilha({ nome: 'x', linhas: [] });
    expect(p.notas).toEqual({ comoLer: [], premissas: [], atencao: [] });
    expect(p.moeda).toBe(true);
    expect(p.comAlternativas).toBe(false);
    expect(migrarPlanilha({ alternativas: [{ id: '1', item: 'a', opcao: 'b', loja: '', observacao: '' }] }).comAlternativas).toBe(true);
    expect(p.id).toBeTruthy();
  });
});
