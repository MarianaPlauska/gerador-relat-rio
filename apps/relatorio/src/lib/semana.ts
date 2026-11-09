import
{
  alertasDoPlano, analisarSemana, compararSemanas, definicoesPadrao, fotoDaSemana, segundaDaSemana, somarDias,
  type DadosSemana,
} from '@supervisao/core';
import type { Dados } from './armazenamento.ts';

export const hoje = () => new Date().toISOString().slice(0, 10);

export function semanasDisponiveis(dados: Dados): string[]
{
  const atual = segundaDaSemana(hoje());
  return [...new Set([atual, ...dados.fotos.map((f) => segundaDaSemana(f.data)), ...dados.planos.map((p) => p.inicio)])].sort().reverse();
}

export function contextoDaSemana(dados: Dados, inicio: string, inicioAnterior = somarDias(inicio, -7))
{
  const atual: DadosSemana = { inicio, foto: fotoDaSemana(dados.fotos, inicio), plano: dados.planos.find((p) => p.inicio === inicio) };
  const candidato: DadosSemana = {
    inicio: inicioAnterior,
    foto: fotoDaSemana(dados.fotos, inicioAnterior),
    plano: dados.planos.find((p) => p.inicio === inicioAnterior),
  };
  const anterior = candidato.foto || candidato.plano ? candidato : undefined;
  const comp = compararSemanas(atual, anterior, dados.pessoas);
  const meta = atual.foto?.totais.metaPct ?? definicoesPadrao.metas.dentroDoPrazoPorMes[inicio.slice(0, 7)];
  const promessasAnteriores = dados.promessas.filter((p) => p.semana === inicioAnterior);
  const frases = analisarSemana(comp, atual, anterior, promessasAnteriores, meta);
  const alertas = atual.plano ? alertasDoPlano(atual.plano, atual.foto?.cards ?? [], dados.pessoas) : [];
  return { atual, anterior, comp, frases, meta, alertas, promessasAnteriores, sexta: somarDias(inicio, 4) };
}

export const dataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-');
export const dataMedia = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '-');
