import type { MLCEngine } from '@mlc-ai/web-llm';

// IA que roda no navegador (WebLLM, WebGPU): grátis, sem servidor, nada sai do computador.
// O modelo baixa uma vez (cerca de 1 GB) e fica guardado no navegador. Ela só escreve; os números vêm do pacote conferido.
export const modeloIa = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export const iaDisponivel = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

let motor: MLCEngine | undefined;

export async function carregarMotor(progresso: (pct: number, texto: string) => void): Promise<MLCEngine>
{
  if (motor) return motor;
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  motor = await CreateMLCEngine(modeloIa, { initProgressCallback: (p) => progresso(Math.round(p.progress * 100), p.text) });
  return motor;
}

const sistema = [
  'Você escreve textos curtos, em português do Brasil, para relatórios de supervisão de desenvolvimento de software.',
  'Use SOMENTE os fatos e números do material recebido. Nunca invente número, data, nome ou causa.',
  'Escreva direto, sem introdução e sem despedida. Responda só com o texto pedido.',
].join(' ');

// o modelo local tem janela de 4 mil tokens: os fatos passam de 7000 caracteres? corta
export async function escreverComIa(instrucao: string, fatos: string, aoReceber: (parcial: string) => void, progresso: (pct: number, texto: string) => void): Promise<string>
{
  const m = await carregarMotor(progresso);
  const fluxo = await m.chat.completions.create({
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: `# Material conferido\n\n${fatos.slice(0, 7000)}\n\n# Pedido\n\n${instrucao}` },
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 450,
  });
  let texto = '';
  for await (const parte of fluxo)
  {
    texto += parte.choices[0]?.delta.content ?? '';
    aoReceber(texto);
  }
  return texto.trim();
}
