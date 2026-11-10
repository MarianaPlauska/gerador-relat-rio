# OrbisOS

Ferramenta de supervisão do time de desenvolvimento. Transforma o que o painel do gestor mostra (Ctrl+C ou print da tela) em acompanhamento semanal e em relatórios em PDF.

![Central do OrbisOS](docs/orbisos.png)

## O nome

*Orbis* é "mundo" em latim, e *OS* vem de *operating system*. O OrbisOS é o sistema operacional do meu mundo de trabalho: painel, plano, riscos e relatório num lugar só. Tudo gira em volta da semana, como uma órbita, com o mesmo ciclo de segunda a sexta.

## Ideia

- O painel do gestor é a fonte da verdade. O OrbisOS só lê e compara os números; nunca recalcula o que o painel já mostra.
- Não existe export do painel. A entrada é um Ctrl+C da tela ou um print, lido no navegador pelo tesseract.js.
- Roda só no navegador, sem servidor e sem conta. Os dados ficam no localStorage, e o backup é um arquivo .json.
- Tudo gratuito: nenhuma API paga e nenhuma IA paga. A ponte com IA é opcional: copiar um texto e colar num chat gratuito.

## Como funciona

```mermaid
flowchart LR
  P[Painel do gestor] -->|Ctrl+C ou print| L[Leitor<br/>totais e cards]
  L --> F[(Foto do dia<br/>localStorage)]
  PL[Plano da semana<br/>por pessoa] --> A
  F --> A[Comparação e análise<br/>semana x anterior ou período]
  A --> C[Central<br/>o que fazer hoje, alertas, time]
  A --> S{Saídas}
  M[Modelo de relatório<br/>lista de blocos] --> S
  S --> PDF[PDF oficial]
  S --> T[Mensagem do Teams]
  S --> IA[Pacote para IA gratuita]
```

A semana segue o ciclo da central: segunda cola o painel e confirma o plano; terça a quinta acompanha; sexta cola de novo e fecha. O relatório sai de um **modelo**: uma lista de blocos (seções prontas, texto, gráfico, tabela, quebra de página). Os modelos prontos são Semanal completo, Executivo e Período (do dia X ao dia Y).

## Estrutura

```
packages/core      regras puras em TypeScript, sem DOM, com testes (vitest)
  src/leitor/      lê o texto do painel: totais, cards, normalização
  src/modelo.ts    modelos de relatório prontos e validação de modelos importados
apps/relatorio     SvelteKit (Svelte 5, adapter-static)
  routes/          central, colar painel, cards, semana, relatório, modelos
  lib/pdf.ts       monta o PDF com pdfmake, bloco por bloco
  lib/ocr.ts       prepara o print e roda o tesseract.js
```

Cálculo fica no core; o app só exibe e grava.

## Rodar

```
npm install
npm run dev       # app em http://localhost:5173
npm test          # testes do core
npm run check     # tipos (tsc e svelte-check)
npm run build     # site estático em apps/relatorio/build
```

## Convenções

- Nomes em português, chaves de bloco na linha de baixo, TypeScript estrito sem `any`.
- Modelo de relatório novo por código: mais um objeto em `modelosProntos` ([packages/core/src/modelo.ts](packages/core/src/modelo.ts)).
- Leitura de tela nova: acrescente o caso nos testes de [packages/core/src/leitor](packages/core/src/leitor) com o texto real colado do painel.
