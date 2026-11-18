import type { CardSnapshot, EtapaCard } from '@supervisao/core';

// o que as telas de card podem pedir à página (a página guarda os ajustes manuais e refaz os cálculos)
export interface AcoesCards
{
  atualizarHoras: (codigo: string, valor: string) => void;
  atualizarCampo: (codigo: string, parcial: Partial<CardSnapshot>) => void;
  alternarEtapa: (codigo: string, ordem: number) => void;
  atualizarSituacaoEtapa: (codigo: string, ordem: number, situacao: EtapaCard['situacao']) => void;
  atualizarDescricaoEtapa: (codigo: string, ordem: number, descricao: string) => void;
  adicionarEtapa: (codigo: string, nome: string, descricao: string) => void;
  removerEtapa: (codigo: string, ordem: number) => void;
  vincular: (codigo: string, outro: string) => void;
  desvincular: (codigo: string, outro: string) => void;
  reordenarFila: (pessoaId: string, codigos: string[]) => void;
}
