import
{
  agoraLocal, dicionarioPadrao, migrarAta, migrarFluxograma, migrarLista, migrarMatriz, migrarPlanilha, migrarVivo,
  type Ata, type Fluxograma, type MatrizPriorizacao, type Planilha, type RelatorioVivo, pessoasExemplo, type Bloco, type ControleCard, type Lista, type Modelo, type CorSemaforo, type Pessoa, type PlanoSemana, type Promessa, type RegistroPainel, type Risco, type Snapshot,
} from '@supervisao/core';
import { agendarEnvio, baixarImagem, chaveDoEspaco, imagemConfirmada, iniciarNuvem, marcarLocal, nuvemPronta, somenteLeitura } from './nuvem.svelte.ts';
import { capturasSemImagem, separarImagens } from './imagens.ts';

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
  // código do link interativo já publicado, por modelo: publicar de novo atualiza o mesmo link
  links?: Record<string, string>;
}

// dados fixos que aparecem na capa e no termo de aprovação
export interface Identificacao
{
  area: string;
  elaboradoPor: string;
  cargo: string;
  destinatario: string;
}

// cada espaço compartilhado tem a própria cópia local; o espaço próprio mantém a chave de sempre
const chave = (): string => chaveDoEspaco('relatorio-semanal-v1');

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
  // fluxogramas de processo
  fluxos: Fluxograma[];
  // relatórios vivos: preenchidos aos poucos, todo dia
  vivos: RelatorioVivo[];
  // planilhas organizadas a partir de material solto, com orçamento
  planilhas: Planilha[];
  // atas de reunião e radar de combinados
  atas: Ata[];
  // matrizes de priorização (Impacto x Esforço e RICE)
  matrizes: MatrizPriorizacao[];
  // diário do painel: registros guardados por pasta, com dia, motivo, prints e comentários
  registros: RegistroPainel[];
  // opções personalizadas de tipo para "Entendi como"
  origensPersonalizadas?: string[];
  // lista de projetos / pastas criados na organização
  projetos?: string[];
  // ordem da fila de cada pessoa no cronograma, escolhida arrastando (chave PROJETO|pessoaId)
  filaManual?: Record<string, string[]>;
  // palavras ou frases que devem ser descartadas ao transcrever e interpretar prints
  regrasDescarte?: string[];
}

function padrao(): Dados
{
  return { pessoas: pessoasExemplo, prefixo: 'DEV', fotos: [], controle: {}, relatorios: {}, planos: [], riscos: [], promessas: [], identificacao: { area: 'Desenvolvimento', elaboradoPor: '', cargo: 'Supervisão de desenvolvimento', destinatario: 'Gestão' }, dicionario: dicionarioPadrao, modelos: [], ultimoModelo: 'semanal', listas: [], fluxos: [], vivos: [], planilhas: [], atas: [], matrizes: [], registros: [], origensPersonalizadas: [], projetos: ['DEV'], regrasDescarte: [] };
}

// campos que faltam ganham o padrão; listas antigas ganham fases e diário
function completar(bruto: Partial<Dados>): Dados
{
  const d = { ...padrao(), ...bruto };
  return {
    ...d,
    listas: d.listas.map(migrarLista),
    fluxos: d.fluxos.map(migrarFluxograma),
    vivos: d.vivos.map(migrarVivo),
    planilhas: d.planilhas.map(migrarPlanilha),
    atas: (d.atas ?? []).map(migrarAta),
    matrizes: (d.matrizes ?? []).map(migrarMatriz),
  };
}

function lerLocal(): Dados
{
  try
  {
    const bruto = localStorage.getItem(chave());
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
  const mudou = json !== localStorage.getItem(chave());
  // primeira vez nesta conta: o que havia só neste navegador vira um backup baixado antes de ser trocado
  const local = lerLocal();
  if (primeiraVez && mudou && (local.fotos.length || local.planos.length)) exportarJson(local);
  localStorage.setItem(chave(), json);
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
  // leitor não grava nada, nem no navegador: a tela mostra o que o dono tem
  if (somenteLeitura()) return;
  // com a nuvem conectada, as imagens saem do navegador e ficam só nos documentos de imagem (o localStorage tem ~5 MB)
  const { leve, imagens } = nuvemPronta() ? separarImagens(dados, imagemConfirmada) : { leve: dados, imagens: new Map<string, string>() };
  const json = JSON.stringify(leve);
  if (json === localStorage.getItem(chave()))
  {
    // dados iguais, mas pode haver imagem nova esperando para subir
    if (imagens.size) agendarEnvio(leve, imagens);
    return;
  }
  localStorage.setItem(chave(), json);
  marcarLocal();
  agendarEnvio(leve, imagens);
}

// as telas que mostram ou emitem prints (diário, relatório) chamam isto: baixa da nuvem as imagens que os dados
// apontam por imagemId e as coloca nos objetos da tela, que seguem reativos
const cacheImagens = new Map<string, string>();

export async function hidratarImagens(dados: Dados): Promise<void>
{
  const faltando = capturasSemImagem(dados);
  if (!faltando.length) return;
  const fila = [...faltando];
  const trabalhar = async () =>
  {
    for (let c = fila.shift(); c; c = fila.shift())
    {
      const id = c.imagemId!;
      const url = cacheImagens.get(id) ?? (await baixarImagem(id).catch(() => undefined));
      if (url)
      {
        cacheImagens.set(id, url);
        c.imagemDataUrl = url;
      }
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
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
