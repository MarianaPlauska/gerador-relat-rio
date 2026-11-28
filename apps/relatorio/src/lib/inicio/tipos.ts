export interface ItemResumo
{
  rotulo: string;
  valor: string;
  sub?: string;
  detalhe: string;
  numero?: boolean;
  ponto?: 'verde' | 'amarelo' | 'vermelho';
  tom?: 'vermelho' | 'amarelo';
  barra?: number;
}
