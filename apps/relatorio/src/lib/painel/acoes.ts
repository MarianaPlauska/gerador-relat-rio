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

// prints presos a uma tarefa: a inspeção manda ler e pergunta o que já está preso nela
export interface AnexosCard
{
  colar: (codigo: string, e: ClipboardEvent) => void;
  soltar: (codigo: string, e: DragEvent) => void;
  escolher: (codigo: string, imagem: Blob) => void;
  listar: (codigo: string) => { id: string; nome: string; imagemDataUrl?: string | undefined }[];
  remover: (id: string) => void;
  progresso: () => number | null;
}
