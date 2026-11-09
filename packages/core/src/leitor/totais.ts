import type { TotaisPainel } from '../tipos';
import { achatar } from './normalizar';

type Chave = keyof TotaisPainel;

// cada padrão lê um ou mais números; o primeiro que achar vence
const padroes: { re: RegExp; chaves: Chave[] }[] = [
  { re: /itens no cronograma (\d+)/, chaves: ['itensCronograma'] },
  { re: /(\d+) ainda em planejado/, chaves: ['aindaPlanejado'] },
  { re: /em execucao (\d+)/, chaves: ['emExecucao'] },
  { re: /vencem? em ate 15 dias (\d+)/, chaves: ['vencem15Dias'] },
  { re: /atrasados? (\d+)/, chaves: ['atrasadosVencimento'] },
  { re: /datas fixadas (\d+)/, chaves: ['datasFixadas'] },
  { re: /concluidos (\d+) (\d+)% do total/, chaves: ['concluidos', 'concluidosPct'] },
  { re: /concluidos? (\d+)/, chaves: ['concluidos'] },
  { re: /demandas em andamento (\d+)/, chaves: ['demandasEmAndamento'] },
  { re: /(\d+) com etapa rodando/, chaves: ['etapaRodando'] },
  { re: /(\d+) paradas entre etapas/, chaves: ['paradasEntreEtapas'] },
  { re: /(\d+) atrasadas (\d+) em risco (\d+) no ritmo/, chaves: ['ritmoAtrasadas', 'ritmoEmRisco', 'ritmoNoRitmo'] },
  { re: /em aberto agora (\d+)/, chaves: ['emAbertoAgora'] },
  { re: /(\d+) fora do prazo/, chaves: ['foraDoPrazo'] },
  { re: /dentro do prazo (\d+)%/, chaves: ['dentroDoPrazoPct'] },
  { re: /meta (\d+)%/, chaves: ['metaPct'] },
  { re: /(\d+) concluidas no periodo/, chaves: ['concluidasNoPeriodo'] },
  { re: /previsoes desta semana (\d+)/, chaves: ['previsoesSemana'] },
  { re: /(\d+) com previsao vencida/, chaves: ['previsaoVencida'] },
  { re: /(\d+) referencia/, chaves: ['eficiencia'] },
  { re: /prazo (\d+) vazao (\d+) qualidade (\d+)/, chaves: ['eficienciaPrazo', 'eficienciaVazao', 'eficienciaQualidade'] },
  { re: /qualidade: (\d+)%/, chaves: ['qualidadePct'] },
  { re: /ate 1 dia (\d+)/, chaves: ['idadeAte1Dia'] },
  { re: /\b1.3 dias (\d+)/, chaves: ['idade1a3Dias'] },
  { re: /\b3.7 dias (\d+)/, chaves: ['idade3a7Dias'] },
  { re: /\b7.15 dias (\d+)/, chaves: ['idade7a15Dias'] },
  { re: /\+ ?15 dias (\d+)/, chaves: ['idadeMais15Dias'] },
];

export function lerTotais(texto: string): TotaisPainel
{
  const plano = achatar(texto);
  const totais: TotaisPainel = {};
  for (const { re, chaves } of padroes)
  {
    if (chaves.every((c) => totais[c] !== undefined)) continue;
    const m = plano.match(re);
    if (!m) continue;
    chaves.forEach((c, i) =>
    {
      if (totais[c] === undefined) totais[c] = Number(m[i + 1]);
    });
  }
  return totais;
}

export const nomesTotais: Record<Chave, string> = {
  itensCronograma: 'Itens no cronograma',
  aindaPlanejado: 'Ainda em planejado',
  emExecucao: 'Em execução (cronograma)',
  vencem15Dias: 'Vencem em até 15 dias',
  atrasadosVencimento: 'Atrasados (vencimento passou)',
  datasFixadas: 'Datas fixadas',
  concluidos: 'Concluídos',
  concluidosPct: 'Concluídos (%)',
  demandasEmAndamento: 'Demandas em andamento',
  etapaRodando: 'Com etapa rodando',
  paradasEntreEtapas: 'Paradas entre etapas ou na fila',
  ritmoAtrasadas: 'Ritmo: atrasadas',
  ritmoEmRisco: 'Ritmo: em risco',
  ritmoNoRitmo: 'Ritmo: no ritmo',
  emAbertoAgora: 'Em aberto agora',
  foraDoPrazo: 'Fora do prazo',
  dentroDoPrazoPct: 'Dentro do prazo (%)',
  metaPct: 'Meta do painel (%)',
  concluidasNoPeriodo: 'Concluídas no período',
  previsoesSemana: 'Previsões desta semana',
  previsaoVencida: 'Com previsão vencida',
  eficiencia: 'Eficiência da área',
  eficienciaPrazo: 'Eficiência: prazo',
  eficienciaVazao: 'Eficiência: vazão',
  eficienciaQualidade: 'Eficiência: qualidade',
  qualidadePct: 'Qualidade (%)',
  idadeAte1Dia: 'Idade: até 1 dia',
  idade1a3Dias: 'Idade: 1 a 3 dias',
  idade3a7Dias: 'Idade: 3 a 7 dias',
  idade7a15Dias: 'Idade: 7 a 15 dias',
  idadeMais15Dias: 'Idade: mais de 15 dias',
};
