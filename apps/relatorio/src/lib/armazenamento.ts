import
{
  agoraLocal, dicionarioPadrao, migrarLista, pessoasExemplo, type Bloco, type ControleCard, type Lista, type Modelo, type CorSemaforo, type Pessoa, type PlanoSemana, type Promessa, type Risco, type Snapshot,
} from '@supervisao/core';
import { agendarEnvio, iniciarNuvem, marcarLocal } from './nuvem.svelte.ts';

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
  // listas de checagem (ex.: teste de agendamentos por empresa)
  listas: Lista[];
}

function padrao(): Dados
{
  return { pessoas: pessoasExemplo, prefixo: 'DEV', fotos: [], controle: {}, relatorios: {}, planos: [], riscos: [], promessas: [], identificacao: { area: 'Desenvolvimento', elaboradoPor: '', cargo: 'Supervisão de desenvolvimento', destinatario: 'Gestão' }, dicionario: dicionarioPadrao, modelos: [], ultimoModelo: 'semanal', listas: [] };
}

// campos que faltam ganham o padrão; listas antigas ganham fases e diário
function completar(bruto: Partial<Dados>): Dados
{
  const d = { ...padrao(), ...bruto };
  return { ...d, listas: d.listas.map(migrarLista) };
}

function lerLocal(): Dados
{
  try
  {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? completar(JSON.parse(bruto) as Partial<Dados>) : padrao();
  }
  catch
  {
    return padrao();
  }
}

// a versão mais nova da nuvem substitui a deste navegador e a tela recarrega com ela
function receberDaNuvem(dados: Dados, quando: string, primeiraVez: boolean): void
{
  const json = JSON.stringify(completar(dados));
  const mudou = json !== localStorage.getItem(CHAVE);
  // primeira vez nesta conta: o que havia só neste navegador vira um backup baixado antes de ser trocado
  const local = lerLocal();
  if (primeiraVez && mudou && (local.fotos.length || local.planos.length)) exportarJson(local);
  localStorage.setItem(CHAVE, json);
  marcarLocal(quando);
  if (mudou) location.reload();
}

export function carregar(): Dados
{
  iniciarNuvem(receberDaNuvem, lerLocal);
  return lerLocal();
}

export function salvar(dados: Dados): void
{
  const json = JSON.stringify(dados);
  if (json === localStorage.getItem(CHAVE)) return;
  localStorage.setItem(CHAVE, json);
  marcarLocal();
  agendarEnvio(dados);
}

export function exportarJson(dados: Dados): void
{
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio-semanal-${agoraLocal().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importarJson(arquivo: File): Promise<Dados>
{
  return completar(JSON.parse(await arquivo.text()) as Partial<Dados>);
}
