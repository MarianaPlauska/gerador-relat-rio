import { describe, expect, it } from 'vitest';
import { itensDoTexto, modelosDeLista, novaLista, progressoDaLista, situacaoDoItem } from './checklist';

describe('listas de checagem', () =>
{
  it('cria a lista com as etapas do modelo', () =>
  {
    const m = modelosDeLista[0]!;
    const l = novaLista(m.nome, m.etapas);
    expect(l.etapas.map((e) => e.nome)).toEqual(['Verificar se há agendamentos', 'Baixar a planilha', 'Subir no sistema da empresa', 'Organizar cada um na sua aba']);
  });

  it('lê o que vem do Excel: nome e marcador separados por tabulação, sem repetir', () =>
  {
    const itens = itensDoTexto('AAXIS AI BRASIL\tSó escritório\nCAA BRANDS\tRisco baixo\n\nAAXIS AI BRASIL\tSó escritório', ['caa brands']);
    expect(itens.map((i) => [i.nome, i.marcador])).toEqual([['AAXIS AI BRASIL', 'Só escritório']]);
  });

  it('lê o texto de um print: número da linha, etiqueta embaixo e contadores no fim', () =>
  {
    const itens = itensDoTexto(`1 AAXIS AI BRASIL SERVICOS EM TECNOLOGIA 1 Em andamento
SÓ ESCRITÓRIO 4/9 etapas
2 CLÍNICA COPACABANA 1
RISCO MÉDIO
9 COMBA TELECOM 2
COMPLEXO`);
    expect(itens.map((i) => [i.nome, i.marcador])).toEqual([
      ['AAXIS AI BRASIL SERVICOS EM TECNOLOGIA', 'Só escritório'],
      ['CLÍNICA COPACABANA', 'Risco médio'],
      ['COMBA TELECOM', 'Complexo'],
    ]);
  });

  it('situação e progresso pelas etapas marcadas', () =>
  {
    const l = novaLista('Teste', ['a', 'b']);
    l.itens = itensDoTexto('X\nY\nZ');
    l.itens[0]!.feitas = { [l.etapas[0]!.id]: '2026-11-13', [l.etapas[1]!.id]: '2026-11-13' };
    l.itens[1]!.feitas = { [l.etapas[0]!.id]: '2026-11-13' };
    expect(situacaoDoItem(l, l.itens[1]!)).toEqual({ feitas: 1, total: 2, situacao: 'em_andamento' });
    expect(progressoDaLista(l)).toEqual({ concluidos: 1, emAndamento: 1, naoIniciados: 1, total: 3, pct: 33 });
  });
});

// texto que a leitura de imagem tirou do print real da lista (13/11/26)
const printReal = `1 AAXIS Al BRASIL SERVICOS EM TECNOLOGIA 1 [e | [| [| [| Em andame
SÓ ESCRITÓRIO - - - - 4/9 etapas

7 AFS INTERCULTURA BRASIL 1 [| [>| [| [| [>| [>| [| Em andame
" SÓ ESCRITÓRIO 7/9 etapas

n BARBEARIA SOLA GRATIA SERVICOS E COSMETICOS 1 [| | v| | v | [> | | | [> | Em andame
RISCO BAIXO - - - - - - 6/9 etapas

Gusta) ' 8 3 8 9 8 Bs qu
SÓ ESCRITÓRIO 6/9 etapas

" CLÍNICA COPACABANA 1 [| | v| | v | | | Em andame
RISCO MÉDIO - - - - 4/9 etapas

” Dezesseis Dezoito Gestão de Recursos LTDA 1 [e | [| [| [| [| Em andame
" SÓ ESCRITÓRIO - - - - - 5/9 etapas`;

describe('print real da lista', () =>
{
  it('limpa as caixas e descarta a linha ilegível sem passar a etiqueta dela para outro item', () =>
  {
    expect(itensDoTexto(printReal).map((i) => [i.nome, i.marcador])).toEqual([
      ['AAXIS Al BRASIL SERVICOS EM TECNOLOGIA', 'Só escritório'],
      ['AFS INTERCULTURA BRASIL', 'Só escritório'],
      ['BARBEARIA SOLA GRATIA SERVICOS E COSMETICOS', 'Risco baixo'],
      ['CLÍNICA COPACABANA', 'Risco médio'],
      ['Dezesseis Dezoito Gestão de Recursos LTDA', 'Só escritório'],
    ]);
  });
});
