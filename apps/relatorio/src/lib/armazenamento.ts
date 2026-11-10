import
{
  dicionarioPadrao, pessoasExemplo, type Bloco, type ControleCard, type Modelo, type CorSemaforo, type Pessoa, type PlanoSemana, type Promessa, type Risco, type Snapshot,
} from '@supervisao/core';

// o que eu escrevo no relatório de cada foto
export interface NotasRelatorio
{
  semaforo?: CorSemaforo;
  resumo?: string;
  destaques?: string;
  decisoes?: string;
  proximosPassos?: string;
  // antigo: seções desmarcadas antes dos modelos; vale até o relatório ganhar blocos próprios
  secoesOcultas?: string[];
  frasesOcultas?: string[];
  // blocos mexidos neste relatório, por modelo; sem isso valem os do modelo
  blocos?: Record<string, Bloco[]>;
}

// dados fixos que aparecem na capa e no termo de aprovação
export interface Identificacao
{
  area: string;
  elaboradoPor: string;
  cargo: string;
  destinatario: string;
}

const CHAVE = 'relatorio-semanal-v1';

export interface Dados
{
  pessoas: Pessoa[];
  prefixo: string;
  fotos: Snapshot[];
  controle: Record<string, ControleCard>;
  relatorios: Record<string, NotasRelatorio>;
  planos: PlanoSemana[];
  riscos: Risco[];
  promessas: Promessa[];
  identificacao: Identificacao;
  // significado de cada indicador do painel do gestor, uma linha "Termo: definição" por item
  dicionario: string;
  // modelos criados pela supervisora; os prontos ficam no core
  modelos: Modelo[];
  ultimoModelo: string;
}

function padrao(): Dados
{
  return { pessoas: pessoasExemplo, prefixo: 'DEV', fotos: [], controle: {}, relatorios: {}, planos: [], riscos: [], promessas: [], identificacao: { area: 'Desenvolvimento', elaboradoPor: '', cargo: 'Supervisão de desenvolvimento', destinatario: 'Gestão' }, dicionario: dicionarioPadrao, modelos: [], ultimoModelo: 'semanal' };
}

export function carregar(): Dados
{
  try
  {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...padrao(), ...JSON.parse(bruto) } : padrao();
  }
  catch
  {
    return padrao();
  }
}

export function salvar(dados: Dados): void
{
  localStorage.setItem(CHAVE, JSON.stringify(dados));
}

export function exportarJson(dados: Dados): void
{
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importarJson(arquivo: File): Promise<Dados>
{
  return { ...padrao(), ...JSON.parse(await arquivo.text()) };
}
