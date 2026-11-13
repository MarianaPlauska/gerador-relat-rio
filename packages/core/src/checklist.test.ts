import { describe, expect, it } from 'vitest';
import {
  anotar, avisosDeFase, diarioDoPeriodo, estadoDaCelula, importarPlanilha, itensDoTexto, linhasDoTexto, listaParaCsv, marcarEtapa, mensagemDoDia,
  migrarLista, modelosDeLista, moverParaFase, novaLista, pendenciasPorEtapa, previaDaPlanilha, progressoDaLista, situacaoDaFase, situacaoDoItem,
  type Lista,
} from './checklist';

describe('listas de checagem', () =>
{
  it('cria a lista com as etapas e fases do modelo', () =>
  {
    const m = modelosDeLista[1]!;
    const l = novaLista(m.nome, m.etapas, '', '2026-11-13', m.fases);
    expect(l.etapas).toHaveLength(9);
    expect(l.fases.map((f) => f.nome)).toEqual(['Fase 1', 'Fase 2', 'Fase 3']);
  });

  it('converte lista antiga: "feitas" vira marca feito', () =>
  {
    const antiga = { id: 'x', nome: 'Antiga', descricao: '', etapas: [{ id: 'e1', nome: 'a' }], itens: [{ id: 'i', nome: 'A', feitas: { e1: '2026-11-10' }, notas: '', atualizadoEm: '2026-11-10' }], criadaEm: '2026-11-10' } as unknown as Lista;
    const l = migrarLista(antiga);
    expect(l.itens[0]!.marcas).toEqual({ e1: { estado: 'feito', em: '2026-11-10' } });
    expect(l.fases).toEqual([]);
    expect(l.diario).toEqual([]);
  });

  it('lê o texto de um print: número da linha, etiqueta embaixo e contadores no fim', () =>
  {
    const itens = itensDoTexto(`1 AAXIS AI BRASIL SERVICOS EM TECNOLOGIA 1 Em andamento
SÓ ESCRITÓRIO 4/9 etapas
Gusta) ' 8 3 8 9 8 Bs qu
SÓ ESCRITÓRIO 6/9 etapas
" CLÍNICA COPACABANA 1 [| | v| | v | | | Em andame
RISCO MÉDIO - - - - 4/9 etapas`);
    expect(itens.map((i) => [i.nome, i.marcador])).toEqual([['AAXIS AI BRASIL SERVICOS EM TECNOLOGIA', 'Só escritório'], ['CLÍNICA COPACABANA', 'Risco médio']]);
  });
});

describe('situações, fases e diário', () =>
{
  const montar = () =>
  {
    const l = novaLista('Implantação', ['Cliente', 'Contrato', 'Ex. amb.'], '', '2026-11-01', ['Fase 1', 'Fase 2']);
    l.itens = itensDoTexto('AFS\nCAA\nCOMBA');
    const [f1, f2] = l.fases;
    l.itens[0]!.faseId = f1!.id;
    l.itens[1]!.faseId = f2!.id;
    l.itens[2]!.faseId = f2!.id;
    f1!.data = '2026-11-10';
    f2!.data = '2026-11-16';
    return l;
  };

  it('não se aplica sai da conta e travado tem situação própria', () =>
  {
    const l = montar();
    const [cliente, contrato, exAmb] = l.etapas;
    const afs = l.itens[0]!;
    marcarEtapa(l, afs, cliente!.id, 'feito', '', '2026-11-13T10:00:00');
    marcarEtapa(l, afs, contrato!.id, 'feito', '', '2026-11-13T10:01:00');
    marcarEtapa(l, afs, exAmb!.id, 'nao_se_aplica', 'só escritório', '2026-11-13T10:02:00');
    expect(situacaoDoItem(l, afs)).toEqual({ feitas: 2, total: 2, travadas: 0, situacao: 'concluido' });
    const caa = l.itens[1]!;
    marcarEtapa(l, caa, cliente!.id, 'travado', 'aguardando contrato assinado', '2026-11-13T11:00:00');
    expect(situacaoDoItem(l, caa).situacao).toBe('travado');
    expect(caa.marcas[cliente!.id]).toMatchObject({ estado: 'travado', motivo: 'aguardando contrato assinado' });
    expect(progressoDaLista(l)).toMatchObject({ total: 3, concluidos: 1, travados: 1, naoIniciados: 1, pct: 33 });
  });

  it('situação da fase pela data e pelo progresso, e aviso de fase vencendo', () =>
  {
    const l = montar();
    expect(situacaoDaFase(l, l.fases[0]!, '2026-11-13')).toBe('atrasada');
    expect(situacaoDaFase(l, l.fases[1]!, '2026-11-13')).toBe('prevista');
    for (const e of l.etapas) marcarEtapa(l, l.itens[0]!, e.id, 'feito');
    expect(situacaoDaFase(l, l.fases[0]!, '2026-11-13')).toBe('concluida');
    expect(avisosDeFase([l], '2026-11-13')).toEqual([{ lista: 'Implantação', fase: 'Fase 2', data: '2026-11-16', pendentes: 2, nivel: 'medio' }]);
  });

  it('pendências por etapa e mover de fase', () =>
  {
    const l = montar();
    marcarEtapa(l, l.itens[1]!, l.etapas[0]!.id, 'feito');
    expect(pendenciasPorEtapa(l).map((p) => [p.etapa.nome, p.pendentes.length])).toEqual([['Cliente', 2], ['Contrato', 3], ['Ex. amb.', 3]]);
    moverParaFase(l, [l.itens[2]!], l.fases[0]!.id, '2026-11-13T12:00:00');
    expect(l.itens[2]!.faseId).toBe(l.fases[0]!.id);
    expect(l.diario.at(-1)).toMatchObject({ tipo: 'moveu', texto: 'para Fase 1' });
  });

  it('diário do dia em todas as listas e mensagem para o Teams', () =>
  {
    const l = montar();
    marcarEtapa(l, l.itens[0]!, l.etapas[0]!.id, 'feito', 'cadastro conferido', '2026-11-13T09:00:00');
    marcarEtapa(l, l.itens[1]!, l.etapas[1]!.id, 'travado', 'cliente não assinou', '2026-11-13T10:00:00');
    anotar(l, 'ligar para o RH amanhã', l.itens[1]!.id, undefined, '2026-11-13T11:00:00');
    anotar(l, 'nota de outro dia', undefined, undefined, '2026-11-12T11:00:00');
    const dia = diarioDoPeriodo([l], '2026-11-13', '2026-11-13');
    expect(dia.map((r) => r.tipo)).toEqual(['nota', 'travado', 'feito']);
    expect(dia[0]).toMatchObject({ lista: 'Implantação', item: 'CAA' });
    const msg = mensagemDoDia([l], '2026-11-13');
    expect(msg).toContain('Implantação: 0/3 concluídos (0%), 1 travado');
    expect(msg).toContain('- 1 etapa concluída hoje');
    expect(msg).toContain('- AFS / Cliente: feito - cadastro conferido');
    expect(msg).toContain('- CAA / Contrato: travado - cliente não assinou');
    expect(msg).toContain('- CAA: ligar para o RH amanhã');
    expect(msg).not.toContain('outro dia');
  });
});

describe('planilha', () =>
{
  const colado = `#\tEmpresa\tFase\tEtiqueta\tCNPJs\tCliente\tContrato\tEx. Amb.\tBD
1\tAAXIS AI BRASIL\tFase 2\tSó escritório\t1\tx\tsim\tN/A\t
2\tCOMBA TELECOM\tFase 2\tComplexo\t2\tx\ttravado: falta assinatura\t\tok
3\t\t\t\t\t\t\t\t`;

  it('reconhece separador e células', () =>
  {
    expect(linhasDoTexto('a;b;c\n1;2;3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(linhasDoTexto(colado)[1]![1]).toBe('AAXIS AI BRASIL');
    expect(estadoDaCelula('X')).toEqual({ estado: 'feito' });
    expect(estadoDaCelula('não se aplica')).toEqual({ estado: 'nao_se_aplica' });
    expect(estadoDaCelula('Travado: falta assinatura')).toEqual({ estado: 'travado', motivo: 'falta assinatura' });
    expect(estadoDaCelula('')).toBeUndefined();
    expect(estadoDaCelula('não')).toBeUndefined();
  });

  it('prévia mostra etapas e fases novas sem mexer na lista', () =>
  {
    const l = novaLista('Implantação', ['Cliente', 'Contrato', 'Ex. amb.'], '', '2026-11-13');
    const p = previaDaPlanilha(linhasDoTexto(colado), l);
    expect(p).toMatchObject({ etapasNovas: ['BD'], fasesNovas: ['Fase 2'], novos: 2, atualizados: 0, ignoradas: 1 });
    expect(l.etapas).toHaveLength(3);
  });

  it('importa: cria o que falta, marca as etapas e atualiza quem já existe', () =>
  {
    const l = novaLista('Implantação', ['Cliente', 'Contrato', 'Ex. amb.'], '', '2026-11-13');
    l.itens = itensDoTexto('COMBA TELECOM');
    importarPlanilha(linhasDoTexto(colado), l, '2026-11-13T15:00:00');
    expect(l.etapas.map((e) => e.nome)).toEqual(['Cliente', 'Contrato', 'Ex. amb.', 'BD']);
    expect(l.itens).toHaveLength(2);
    const [comba, aaxis] = l.itens;
    expect(aaxis).toMatchObject({ nome: 'AAXIS AI BRASIL', marcador: 'Só escritório', cnpjs: 1, faseId: l.fases[0]!.id });
    expect(situacaoDoItem(l, aaxis!)).toMatchObject({ feitas: 2, total: 3 });
    expect(comba!.marcas[l.etapas[1]!.id]).toMatchObject({ estado: 'travado', motivo: 'falta assinatura' });
    expect(comba!.cnpjs).toBe(2);
    expect(l.diario.at(-1)!.texto).toBe('Planilha importada: 1 novos, 1 atualizados.');
  });

  it('exporta CSV para o Excel com ponto e vírgula', () =>
  {
    const l = novaLista('Implantação', ['Cliente'], '', '2026-11-13', ['Fase 1']);
    l.itens = itensDoTexto('AFS\tSó escritório');
    l.itens[0]!.faseId = l.fases[0]!.id;
    marcarEtapa(l, l.itens[0]!, l.etapas[0]!.id, 'feito');
    const csv = listaParaCsv(l);
    expect(csv.startsWith('﻿"Fase";"Empresa"')).toBe(true);
    expect(csv).toContain('"Fase 1";"AFS";"Só escritório";"";"";"Feito";"Concluído (1/1)";""');
  });
});
