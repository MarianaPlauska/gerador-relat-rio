import { describe, expect, it } from 'vitest';
import { novaLista } from './checklist';
import { fluxoDaLista, fluxoDoMermaid, fluxoDosPassos, lerFluxo, organizar, paraMermaid, pedidoDeFluxo } from './fluxograma';

const textos = (r: { nos: { id: string; texto: string }[]; ligacoes: { de: string; para: string; rotulo?: string | undefined }[] }) =>
{
  const t = (id: string) => r.nos.find((n) => n.id === id)!.texto;
  return r.ligacoes.map((l) => `${t(l.de)} -> ${t(l.para)}${l.rotulo ? ` (${l.rotulo})` : ''}`);
};

describe('fluxograma por passos em texto', () =>
{
  it('liga os passos em ordem, com início e fim automáticos', () =>
  {
    const r = fluxoDosPassos('1. Receber pedido\n2. Conferir CNPJs\n\n3) Treinar equipe');
    expect(r.nos.map((n) => n.tipo)).toEqual(['inicio', 'passo', 'passo', 'passo', 'fim']);
    expect(textos(r)).toEqual(['Início -> Receber pedido', 'Receber pedido -> Conferir CNPJs', 'Conferir CNPJs -> Treinar equipe', 'Treinar equipe -> Fim']);
  });

  it('decisão com dois ramos que voltam a se juntar no próximo passo', () =>
  {
    const r = fluxoDosPassos('Receber pedido\nSe faltar documento? sim: Pedir ao responsável / não: Agendar implantação\nTreinar equipe\nFim');
    expect(r.nos.find((n) => n.tipo === 'decisao')!.texto).toBe('Faltar documento?');
    expect(textos(r)).toEqual([
      'Início -> Receber pedido',
      'Receber pedido -> Faltar documento?',
      'Faltar documento? -> Pedir ao responsável (sim)',
      'Faltar documento? -> Agendar implantação (não)',
      'Pedir ao responsável -> Treinar equipe',
      'Agendar implantação -> Treinar equipe',
      'Treinar equipe -> Fim',
    ]);
  });

  it('ramo para o fim, ramo que volta e ramo não escrito', () =>
  {
    const r = fluxoDosPassos('Início\nConferir dados\nDados ok? não: voltar para conferir dados\nAprovado pelo cliente? não: fim\nLiberar acesso\nNota: avisar o Teams');
    expect(textos(r)).toEqual([
      'Início -> Conferir dados',
      'Conferir dados -> Dados ok?',
      'Dados ok? -> Aprovado pelo cliente? (sim)',
      'Aprovado pelo cliente? -> Fim (não)',
      'Aprovado pelo cliente? -> Liberar acesso (sim)',
      'Liberar acesso -> Fim',
      'Dados ok? -> Conferir dados (não)',
    ]);
    expect(r.nos.filter((n) => n.tipo === 'fim')).toHaveLength(1);
    expect(r.nos.find((n) => n.tipo === 'nota')!.texto).toBe('avisar o Teams');
  });
});

describe('fluxograma em Mermaid', () =>
{
  const mermaid = [
    '```mermaid',
    'flowchart TD',
    '  inicio(["Início"]) --> p1["Receber pedido do cliente"]',
    '  p1 --> d1{"Documentos completos?"}',
    '  d1 -->|sim| p2["Agendar implantação"]',
    '  d1 -- não --> p3[Pedir documentos<br/>ao responsável]',
    '  p3 --> d1',
    '  p2 --> fim(["Fim"])',
    '  style p1 fill:#fff',
    '```',
  ].join('\n');

  it('lê formas, rótulos e voltas', () =>
  {
    const r = fluxoDoMermaid(mermaid.replace(/```\w*/g, ''));
    expect(r.nos.map((n) => `${n.tipo}:${n.texto}`)).toEqual([
      'inicio:Início', 'passo:Receber pedido do cliente', 'decisao:Documentos completos?', 'passo:Agendar implantação', 'passo:Pedir documentos ao responsável', 'fim:Fim',
    ]);
    expect(textos(r)).toContain('Documentos completos? -> Pedir documentos ao responsável (não)');
    expect(textos(r)).toContain('Pedir documentos ao responsável -> Documentos completos?');
  });

  it('lerFluxo reconhece o formato e organiza de cima para baixo', () =>
  {
    const f = lerFluxo(mermaid);
    expect(f.formato).toBe('mermaid');
    const y = (t: string) => f.nos.find((n) => n.texto === t)!.y;
    expect(y('Início')).toBeLessThan(y('Receber pedido do cliente'));
    expect(y('Documentos completos?')).toBeLessThan(y('Agendar implantação'));
    expect(y('Agendar implantação')).toBeLessThan(y('Fim'));
    // os dois ramos da decisão lado a lado
    expect(y('Agendar implantação')).toBe(y('Pedir documentos ao responsável'));
    expect(lerFluxo('Passo um\nPasso dois').formato).toBe('passos');
  });

  it('volta para o Mermaid sem perder nós nem rótulos', () =>
  {
    const f = lerFluxo(mermaid);
    const de_novo = lerFluxo(paraMermaid(f));
    expect(de_novo.nos.map((n) => `${n.tipo}:${n.texto}`)).toEqual(f.nos.map((n) => `${n.tipo}:${n.texto}`));
    expect(textos(de_novo)).toEqual(textos(f));
  });
});

describe('organizar e outras entradas', () =>
{
  it('nota solta vai para a coluna ao lado', () =>
  {
    const r = fluxoDosPassos('Passo A\nNota: lembrete');
    const o = organizar(r.nos, r.ligacoes);
    const nota = o.nos.find((n) => n.tipo === 'nota')!;
    expect(nota.x).toBeGreaterThan(Math.max(...o.nos.filter((n) => n.tipo !== 'nota').map((n) => n.x)));
  });

  it('as etapas de uma lista viram um fluxo', () =>
  {
    const l = novaLista('Implantação', ['Cliente', 'Contrato', 'Acessos'], 'Por empresa', '2026-11-14');
    const f = fluxoDaLista(l, '2026-11-14T10:00:00');
    expect(f.nome).toBe('Implantação');
    expect(textos(f)).toEqual(['Início -> Cliente', 'Cliente -> Contrato', 'Contrato -> Acessos', 'Acessos -> Fim']);
    expect(f.nos.find((n) => n.tipo === 'nota')!.texto).toBe('Por empresa');
  });

  it('o pedido para IA traz as regras e o processo', () =>
  {
    const t = pedidoDeFluxo('Implantação de um cliente novo');
    expect(t).toContain('flowchart TD');
    expect(t).toContain('Implantação de um cliente novo');
  });

  it('detecta lacunas no fluxo e extrai detalhes nos passos', async () =>
  {
    const { detectarLacunas, fluxoDaSemana, fluxoDosCards, fluxoDoRegistroPainel } = await import('./fluxograma');
    const fIncompleto = {
      nos: [
        { id: 'n1', tipo: 'inicio' as const, texto: 'Início', x: 0, y: 0 },
        { id: 'n2', tipo: 'passo' as const, texto: 'Passo sem destino', x: 0, y: 0 },
        { id: 'n3', tipo: 'decisao' as const, texto: 'Aprovado?', x: 0, y: 0 },
      ],
      ligacoes: [
        { id: 'l1', de: 'n1', para: 'n2' },
      ],
    };
    const lacunas = detectarLacunas(fIncompleto);
    expect(lacunas.length).toBeGreaterThanOrEqual(2);
    expect(lacunas.some((l) => l.noId === 'n2')).toBe(true);

    const fSemana = fluxoDaSemana({
      inicio: '2026-11-16',
      fim: '2026-11-20',
      pessoas: [
        { pessoaId: 'p1', itens: [{ id: 'i1', descricao: 'Homologar módulo', cardCodigo: 'CARD-10' }] },
      ],
    }, () => 'Mariana Coutinho');
    expect(fSemana.nos.length).toBe(3);
    expect(fSemana.nos[1]!.detalhes).toContain('Mariana Coutinho');

    const fReg = fluxoDoRegistroPainel({
      data: '2026-11-16',
      motivo: 'Falha no login',
      pasta: 'DEV',
      capturas: [
        { etapa: 'Tela inicial', comentario: 'Botão não responde' },
      ],
    });
    expect(fReg.nome).toContain('DEV');
    expect(fReg.nos[1]!.texto).toBe('Tela inicial');
    expect(fReg.nos[1]!.detalhes).toBe('Botão não responde');
  });
});
