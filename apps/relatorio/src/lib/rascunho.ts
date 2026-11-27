import type { Ajustes, CapturaLida } from '@supervisao/core';

// o que a pessoa já estruturou na tela de Novo registro e ainda não guardou
export interface Rascunho
{
  salvoEm: string;
  capturas: CapturaLida[];
  ajustes: Ajustes;
  motivo: string;
  dataRegistro: string;
  pasta: string;
  caixa: string;
}

const CHAVE = 'orbisos-rascunho-painel-v1';
// fica guardado por 72 h (o pedido era no mínimo 48 h)
const HORAS_GUARDADO = 72;

export function lerRascunho(): Rascunho | null
{
  try
  {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as Rascunho;
    if (Date.now() - new Date(r.salvoEm).getTime() > HORAS_GUARDADO * 3600_000 || !r.capturas?.length && !r.motivo?.trim())
    {
      apagarRascunho();
      return null;
    }
    return r;
  }
  catch
  {
    return null;
  }
}

export function salvarRascunho(r: Omit<Rascunho, 'salvoEm'>)
{
  const completo: Rascunho = { ...r, salvoEm: new Date().toISOString() };
  try
  {
    localStorage.setItem(CHAVE, JSON.stringify(completo));
  }
  catch
  {
    // sem espaço: guarda sem as imagens, o texto lido e os ajustes são o que importa
    try
    {
      localStorage.setItem(CHAVE, JSON.stringify({ ...completo, capturas: completo.capturas.map(({ imagemDataUrl: _imagem, ...resto }) => resto) }));
    }
    catch
    {
      // navegador bloqueado ou cheio: o rascunho só não é guardado
    }
  }
}

export function apagarRascunho()
{
  try
  {
    localStorage.removeItem(CHAVE);
  }
  catch
  {
    // sem acesso ao armazenamento
  }
}

export function haQuantoTempo(iso: string): string
{
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? 'dia' : 'dias'}`;
}
