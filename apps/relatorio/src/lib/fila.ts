// ordem da fila de cada pessoa escolhida à mão no cronograma (arrastando as barras): pessoaId -> códigos, guardada por projeto

export type FilaManual = Record<string, string[]>;

const chave = (projeto: string, pessoaId: string) => `${projeto.toUpperCase()}|${pessoaId}`;

export function ordemManualDoProjeto(fila: FilaManual | undefined, projeto: string): Record<string, string[]>
{
  const prefixo = `${projeto.toUpperCase()}|`;
  return Object.fromEntries(
    Object.entries(fila ?? {})
      .filter(([k]) => k.startsWith(prefixo))
      .map(([k, codigos]) => [k.slice(prefixo.length), codigos]),
  );
}

export function guardarOrdem(fila: FilaManual | undefined, projeto: string, pessoaId: string, codigos: string[]): FilaManual
{
  return { ...(fila ?? {}), [chave(projeto, pessoaId)]: codigos };
}
