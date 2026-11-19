import { agoraLocal, idCurto } from '../checklist';
import type { LinhaPlanilha, Planilha } from './tipos';

export function novaPlanilha(nome: string, moeda = true): Planilha
{
  const agora = agoraLocal();
  return { id: idCurto(), nome: nome.trim() || 'Planilha sem nome', objetivo: '', criadoEm: agora, atualizadoEm: agora, moeda, comAlternativas: false, grupos: [], linhas: [], alternativas: [], notas: { comoLer: [], premissas: [], atencao: [] } };
}

export function novaLinha(grupo: string): LinhaPlanilha
{
  return { id: idCurto(), grupo, item: '', detalhe: '', qtd: 1, loja: '', situacao: 'estimativa', prioridade: 'importante', incluir: true, observacao: '' };
}

// dados antigos ou de outra versão ganham os campos que faltam
export function migrarPlanilha(p: Partial<Planilha>): Planilha
{
  const base = novaPlanilha(p.nome ?? '', p.moeda ?? true);
  return {
    ...base,
    ...p,
    id: p.id ?? base.id,
    comAlternativas: p.comAlternativas ?? (p.alternativas?.length ?? 0) > 0,
    grupos: p.grupos ?? [],
    linhas: p.linhas ?? [],
    alternativas: p.alternativas ?? [],
    notas: { comoLer: p.notas?.comoLer ?? [], premissas: p.notas?.premissas ?? [], atencao: p.notas?.atencao ?? [] },
  };
}
