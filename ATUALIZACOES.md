# Atualizacoes e Regras do Sistema (OrbisOS)

Registro de diretrizes visuais, regras de negocio e funcionalidades implementadas no OrbisOS por Mariana Coutinho (Plauska).

## 1. Regras de Interface e Design System (`app.css`)

1. **Sem emojis e sem travessoes**:
   - A interface nao deve utilizar emojis nem travessoes em titulos, botoes, atalhos ou rodape.
   - Indicadores visuais devem ser construidos com CSS puro (pontos de semaforo, pilulas, bordas coloridas e tipografia monoespacada `Courier Prime` combinada com `IBM Plex Sans`).
2. **Fundo quadriculado (grade tecnica)**:
   - O fundo da tela inicial e do sistema mantem o padrao de papel quadriculado discreto (`28px x 28px` via `--grade-fundo`), adaptando-se ao tema escuro e ao tema claro.
3. **Tema escuro suave e barras de progresso**:
   - O tema escuro utiliza tons ardosia confortaveis (`--fundo: #232a36`, `--superficie: #2c3442`, `--superficie-2: #353f4f`), evitando preto puro cansativo.
   - As barras de carregamento (`<progress>` e `.kpi-barra`) seguem a variavel `--cor-barra`:
     - **Modo claro**: verde tecnologico (`#12a454` sobre `#dceee3`).
     - **Modo escuro**: verde-ardosia suave (`#5b9e84` sobre `#1e2530`) que nao cansa a vista.
4. **Cursor pointer em elementos clicaveis**:
   - Todo elemento interativo (`a`, `button`, `.botao`, `select`, `summary`, `[role="button"]`, `[role="tab"]`, `input[type="checkbox"]`, `input[type="radio"]`, `label` clicavel) utiliza `cursor: pointer`.
5. **Menu da conta enxuto**:
   - O menu do usuario no topo contem apenas: `Meu perfil`, `Baixar backup`, alternancia de `Tema` e `Sair`.
6. **Rodape (Footer) compacto e profissional**:
   - Exibe de forma concisa a definicao do OrbisOS, links rapidos de navegacao, autoria de `Mariana Coutinho (Plauska)` e acesso direto ao repositorio no GitHub (`https://github.com/MarianaPlauska/gerador-relat-rio`).

---

## 2. Multiplos Projetos e Equipes Dinamicas

1. **Seletor e criacao de Projetos (Pastas)**:
   - O sistema suporta multiplos projetos alem do `DEV` (ex.: `COMERCIAL`, `SUPORTE`, `INFRA`).
   - Tanto a tela inicial quanto o Diario do painel permitem alternar entre projetos ou criar um novo projeto rapidamente.
2. **Colaboradores por Projeto**:
   - Cada projeto possui sua propria equipe vinculada (`Pessoa.pastas`).
   - Novos colaboradores podem ser adicionados diretamente na tela inicial ou no Diario do painel para o projeto ativo.
   - Caso um print ou CSV traga nomes de responsaveis ainda nao cadastrados, o sistema os identifica e vincula automaticamente a equipe daquele projeto.

---

## 3. Visao Executiva na Tela Inicial (`/`)

1. **Mascote interativo (Cobrinha do GitHub -> Orbi)**:
   - Ao abrir a tela inicial, uma grade inspirada nos commits do GitHub anima a cobrinha percorrendo as celulas e, ao concluir, transforma-se no mascote grafico **Orbi** (feito em CSS/SVG, sem emojis), com animacao de olhos e interacao ao clique.
2. **Quatro indicadores chave (KPIs)**:
   - **Saude da semana**: semaforo calculado (`No caminho`, `Atencao`, `Fora da meta`) e percentual dentro do prazo.
   - **Plano da semana**: entregas concluidas versus planejadas com barra de progresso.
   - **Atencao imediata**: contagem de demandas atrasadas e em risco no projeto ativo.
   - **Diario do projeto**: total de registros arquivados e data da ultima leitura.
3. **Tarefas da semana sem repeticao de nomes**:
   - A coluna de tarefas da semana lista apenas o codigo do card, frente/sistema, etapa atual, titulo, status e datas (previsao/vencimento), sem poluir cada linha com o nome da pessoa.
4. **Expansao por pessoa na Equipe (clique para expandir)**:
   - Ao clicar em qualquer colaborador na coluna **Equipe e rendimento**, o cartao expande exibindo:
     - **O que esta fazendo**: lista de tarefas atribuidas a pessoa na semana.
     - **Etapas em andamento e Frentes**: tags com as etapas ativas e os sistemas/frentes em que atua.
     - **Disponibilidade na semana**: calculo automatico de quando a pessoa ficara livre na semana com base nas datas de previsao/vencimento e volume de demandas ativas.
     - **Sugestoes para apoiar a equipe**: recomendacoes automaticas cruzando quem fica livre mais cedo com colegas que possuem cards atrasados, em risco ou itens aguardando na fila.
     - **Percentual de rendimento semanal e acumulado**:
       - Percentual de rendimento na semana em relacao ao restante da equipe do projeto.
       - Percentual de rendimento acumulado ao longo de todas as semanas registradas no projeto (com contagem de entregas no prazo versus total historico).

---

## 4. Diario do Painel (`/painel`) e Tabela de Cards

1. **Area de upload compacta**:
   - Quando ainda nao ha prints, exibe uma caixa enxuta de colagem (`Ctrl+V`), arraste ou selecao de imagens/CSV.
   - Apos enviar o primeiro print, recolhe-se automaticamente em uma barra horizontal compacta no topo para nao ocupar espaco de rolagem.
2. **Opcoes personalizadas em "Entendi como"**:
   - Alem das opcoes padrao (`Quem esta cuidando de que`, `Fila de demandas a iniciar`, `Cronograma`, `Lista de demandas`, `Card aberto`), permite criar novas classificacoes personalizadas (`+ Criar nova opcao...`), que ficam salvas no navegador (`dados.origensPersonalizadas`).
3. **Divisao por pessoa sem repetir nomes**:
   - Na leitura dos prints, agrupa automaticamente as demandas por responsavel no formato: `Mariana Coutinho -> DEV-101, DEV-105`.
4. **Campo de Comentario direto na Tabela de Cards (`TabelaCards.svelte`)**:
   - Substituida a coluna numerica `Etapas (X/Y)` pelo campo direto de **Comentario** (`card.comentario`), permitindo anotar observacoes rapidas por card sem precisar conferir quantidades de etapas no painel externo.
5. **Simplificacao do fechamento do registro e destaque do PDF**:
   - Reduzido de tres para dois campos de texto no fechamento: apenas **Motivo ou titulo deste registro** (com data) e **Texto do registro** (unido automaticamente a partir dos prints e comentarios).
   - O botao **Guardar e emitir PDF deste registro** possui destaque visual nitido ao lado do botao de guardar no projeto.

---

## 5.Editor Visual de Fluxos de Processo (`/fluxos`)

1. **Criacao a partir de tres origens**:
   - **Texto solto (primeira opcao)**: transforma qualquer texto corrido, lista de passos, orientacoes com `// detalhes`, decisoes (`Pergunta? sim: A / nao: B`) ou codigo Mermaid em fluxograma.
   - **Do dia / Da semana**: gera o fluxo a partir do plano da semana ou das demandas ativas de hoje.
   - **Dos relatorios / Diario**: gera o fluxo a partir de um registro salvo no Diario do painel ou de uma lista de checagem.
2. **Painel lateral de inspecao do no**:
   - Ao selecionar um passo, abre o painel a direita permitindo alterar o tipo (`Inicio`, `Acao`, `Decisao`, `Fim`), editar o texto do no, preencher **Detalhes (aparecem ao percorrer)**, configurar conexoes de **Proximo passo** e **Ramificar**.
3. **Indicador de lacunas e Modo Percorrer**:
   - Alerta no topo caso existam nos sem saida, orfaos ou decisoes incompletas.
   - Botao **Percorrer** abre o guia passo a passo interativo, destacando o no atual no diagrama, exibindo as orientacoes da etapa e permitindo escolher os caminhos de decisao.

---

## 6. Correlacao por Vetores e Arvore entre Imagens + Modelo Probabilistico (`correlacao.ts`)

1. **Hierarquia Vetor Pai (Lista) -> Vetor Filho (Pedido) -> Vetor Filho (Etapas)**:
   - **Imagem tipo 1 (Lista Geral da Semana)**: extrai cards (`DEV-274`, `DEV-047`, `DEV-284`...), prioridades (`Critica`, `Alta`, `Media`, `Baixa`), status (`Em andamento`, `Resolvido`, `Novo`) e descricoes truncadas.
   - **Imagem tipo 2 (Detalhe do Card / O que foi pedido)**: correlaciona por ID explicito ou por similaridade vetorial (cosseno de termos + prefixo truncado) e preenche `descricaoCompleta`, regras de validacao e horario exato de abertura (`18/11/2026 11:32`).
   - **Imagem tipo 3 (Etapas Internas sem ID visivel no recorte)**: mesmo quando o print mostra apenas a tabela `Etapas` sem o codigo do card no topo, o motor vincula automaticamente ao card pai correto cruzando sequencia do envio, vetor de responsavel (`Rodrigo Cinelli`) e consistencia de status (`Em andamento` compativel com `rodando ha 15,8 h`).
2. **Visualizacao sem repetir nomes e Arvore por Pessoa**:
   - Na visao geral da semana e do envio, exibe apenas o resumo das tarefas (codigo, assunto, prioridade, etapas e tempo estipulado), sem repetir o nome do responsavel em cada linha.
   - Ao clicar no nome da pessoa, expande a arvore completa com cada tarefa dela, o texto integral do pedido (`O que foi pedido`) e as etapas internas com tempos (`Etapas`).
3. **Calculo de Tempo Estipulado, Nivel de Entrega, Demora e Probabilidade de Mais Servicos**:
   - **Tempo estipulado (`horasEstimadas`)**: calculado automaticamente pela prioridade, quantidade de regras condicionais (`se ... entao`) no pedido e etapas restantes (com edicao manual disponivel).
   - **Nivel de entrega (`nivelEntregaPct`) e Demora (`nivelDemora`)**: avalia a proporcao de itens concluidos/avancando e alerta gargalos quando ha etapas rodando ha muitas horas (ex.: `15,8 h` desde `16/11`).
   - **Probabilidade de absorver mais servicos (`probabilidadeMaisServicosPct`)**: calcula de 0% a 100% a chance de alocar novas demandas para a pessoa na semana e sugere quantos servicos/horas extras cabem na agenda dela.

## 7. Persistencia de Projetos, Modais Ampliados, Painel Lateral de Etapas, Gestao de Pessoas e Grafico em Linha

1. **Persistencia Automatica de Novos Projetos (`dados.projetos`)**:
   - Projetos criados pelo botao `+ Projeto` (tanto no Diario do Painel quanto na Visao Executiva) sao gravados imediatamente no armazenamento local e sincronizados, permanecendo salvos mesmo antes do primeiro registro.
2. **Modal Ampliado da Captura (`<article class="captura">`)**:
   - Clicar na miniatura do print ou em `Ver em modal` abre uma janela modal ampla com zoom de 100% na imagem, cards identificados clicaveis, divisao por pessoa, comentario e texto OCR editavel.
3. **Painel Lateral a Direita + Modal da Tarefa + Etapas Automaticas Ticaveis**:
   - Clicar em qualquer item de `Resumo das tarefas identificadas` ou dentro da arvore da pessoa abre o **Painel de Inspecao a Direita** (com botao `Ampliar em modal`).
   - Cada card recebe automaticamente etapas estruturadas com a descricao do que a pessoa vai fazer (`gerarEtapasAutomaticasCard`), permitindo ticar (`checkbox`) o que ja foi feito ou sera feito, adicionar novas etapas, anotar observacoes e vincular/correlacionar com outras demandas futuras da semana (`calcularRelacoesEImpactoSemana`).
4. **Organizador Inteligente de Tarefas (`ordenarCardsResumidos`)**:
   - Permite ordenar o resumo das tarefas por: Prioridade e tempo (maior para menor), Codigo do card (`DEV-xxx` do maior para o menor ou menor para o maior), Assuntos/nomes parecidos (agrupamento por similaridade de cosseno) e Datas proximas.
5. **Gerenciamento de Pessoas da Organizacao e Modal de Alerta de Remocao**:
   - Modal dedicado para bater o rendimento semanal e acumulado da equipe, ajustar capacidade de horas e remover pessoas do projeto ou da organizacao.
   - Ao remover uma pessoa, exibe um modal de confirmacao informando que a pessoa sera desativada para novos envios mantendo preservado o historico registrado do **dia X ao dia Y** (`calcularPeriodoHistoricoPessoa`).
6. **Calculo Automatico de Indicadores, Pontos de Atencao, Gargalos e Grafico em Linha**:
   - Calcula automaticamente os indicadores da pasta (`em risco`, `atrasadas`, `media de horas por demanda`, `tempo mediano por etapa`, `etapas concluidas`), reorganiza por prioridades, aponta onde estao demorando mais e plota um **Grafico em Linha SVG interativo** comparando Tempo Estipulado (h) vs Tempo Rodando/Consumido (h).

## 8. Modularizacao de Arquivos Reutilizaveis e Tema Escuro Carbono-Esmeralda

1. **Divisao e Modularizacao do Core (`@supervisao/core`)**:
   - `packages/core/src/leitor/vetor.ts`: utilitarios puros de vetorizacao de texto, similaridade de cosseno e extracao de assunto.
   - `packages/core/src/leitor/etapas-auto.ts`: geracao automatica de etapas descritas, estimativa de horas, impacto na semana e organizador multicriterio.
   - `packages/core/src/leitor/metricas-auto.ts`: motor automatico de KPIs, gargalos de demora, pontos de atencao e serie de grafico em linha.
   - `packages/core/src/leitor/equipe-analise.ts`: agrupamento sem repeticao de nomes, gestao de equipe por projeto, historico de remocao (Dia X ao Dia Y) e analise probabilistica.
2. **Componentes Reutilizaveis de Painel (`apps/relatorio/src/lib/painel/`)**:
   - `GraficoLinhaDemandas.svelte`: grafico em linha SVG reutilizavel.
   - `PainelMetricasAutomaticas.svelte`: painel de KPIs automaticos, pontos de atencao, gargalos e grafico.
   - `InspetorTarefaCard.svelte`: inspetor unificado para painel lateral a direita e modal detalhado da tarefa.
   - `ModalCapturaAmpliada.svelte`: modal ampliado de print e OCR.
   - `ModalGerenciarEquipe.svelte`: modal de gerenciamento de pessoas, batimento de rendimento e alerta de remocao preservando historico.

---

## 9. Refinamento do Tema Escuro Cibernetico, Leitura Integral da Descricao de Cards e Alerta de Sobrecarga Critica

1. **Ajuste Fino do Modo Escuro Tecnologico (`app.css`)**:
   - Eliminado o tom de verde musgo/oliva envelhecido e o tom azulado em favor de uma paleta refinada em **carbono-obsidiana neutro com esmeralda neon de alta tecnologia**:
     - `--fundo: #0b0e11` (grafite-obsidiana limpo e profundo, sem reflexos azulados e sem aparencia de verde militar).
     - `--superficie: #12161a` e `--superficie-2: #181e24` (superficies contrastadas e sofisticadas).
     - `--borda: #252e37` e `--borda-forte: #364350`.
     - `--marca: #00e599` (verde neon tecnologico vibrante e moderno).
     - `--grade-fundo: rgb(0 229 153 / 11%)` com `radial-gradient(ellipse at 50% 0%, rgb(0 229 153 / 7%), transparent 70%)`: a grade geometrica de quadrados de `28px x 28px` destaca-se com nitidez, estilo telemetria cyber-tech e total conforto visual.
2. **Correcao e Extracao Integral da Descricao nos Prints (`packages/core/src/leitor/cards.ts`)**:
   - Corrigido o leitor de demandas (`lerDemanda`): anteriormente o parser olhava apenas para as duas primeiras linhas de cada bloco de card; quando o OCR lia o selo de prioridade (`• Crítico`) ou data sob o ID, o titulo ficava corrompido e a descricao vazia.
   - Agora, o leitor filtra todas as linhas puras de metadados (datas, selos, tracos, nomes de pessoas, tempos, status e cabecalhos), isola o tipo de sistema (`Suporte Kitu` / `Kitu Sistema`), remove ruidos periféricos e extrai a **coluna de descricao completa da tarefa** (ex.: `Outros — Erro cadastro de candidatos/funcionários • Kitu Sistema > Funcionários Descrição do solicitante: Ao...` ou `Ajuste no BD: Fazer as seguintes validações: se mesmo cpf, então passar para o próximo campo; Se matrícula...`).
   - Popula simultaneamente `card.descricaoCompleta` e `card.titulo`, alimentando o `<textarea>` do inspetor e permitindo edicao em tempo real.
   - No leitor de card aberto (`lerCardAberto`), o bloco `O QUE FOI PEDIDO` agora captura o texto integral multiline mesmo com botoes `[Editar]` ou icone na tela.
3. **Alerta de Sobrecarga Critica (`[Sobrecarga crítica]`)**:
   - Em `packages/core/src/leitor/equipe-analise.ts`, foi implementada a deteccao automatica de sobrecarga: alerta quando uma pessoa acumula multiplas demandas criticas simultaneas, etapas rodando ha mais de 14h (ou acumuladas ha semanas) ou horas estipuladas acima da capacidade semanal.
   - O selo pulsante `[Sobrecarga crítica]` e exibido tanto no cabecalho da pessoa na arvore do envio quanto na Visao Executiva da Home, sugerindo no diagnostico a redistribuicao ou pareamento com colegas disponiveis.
4. **Ergonomia Visual do Passo 2 e Rolagem Independente de Tarefas**:
   - O container de **Resumo das tarefas identificadas** (`.lista-tarefas-resumo`) e a lista de pessoas (`.lista-pessoas-arvore`) receberam rolagem interna suave com `max-height: 440px` e scrollbar customizada tecnologica.
   - O painel de indicadores e checklist completa (`.painel-inteligencia-auto`) inicia recolhido por padrao (sem `open`), reduzindo o consumo vertical do Passo 2 e permitindo chegar rapidamente ao Passo 3 (**Motivo e resumo do registro**) e Passo 4 (**Guardar no diario**).
   - O grafico de linhas de demandas (`GraficoLinhaDemandas`) agora so e renderizado quando existem pontos de dados identificados.





---

## 10. Prints fora de ordem, Cronograma (Gantt), Calibração pelo histórico, Imagens na nuvem e Leitura mais robusta

1. **Correlação de prints fora de ordem (`packages/core/src/leitor/lote.ts`)**:
   - Antes, cada print era ligado só aos anteriores; um print sem código (etapas ou continuação do pedido) enviado antes do card com código era descartado.
   - Agora todos os prints são analisados juntos (`correlacionarLote`) e a ordem de envio não muda o resultado (teste com as 120 ordens possíveis de 5 prints). Cada print vira *âncoras* (cards com código) e *fragmentos* (etapas ou texto do pedido sem código).
   - Os fragmentos procuram o card pelo conjunto de sinais: texto parecido (cosseno e prefixo), texto que continua de um print no outro (sobreposição no fim e no começo), etapas que seguem a numeração (1 e 2 num print, 3 e 4 no outro), mesmo responsável, status compatível e proximidade de envio. O par mais forte liga primeiro e o card ganha o texto e as etapas do fragmento, então o fragmento seguinte consegue se ligar *por intermédio* dele (encadeamento).
   - O texto cortado entre dois prints é costurado sem repetir a linha em comum (`costurarTextos`); as etapas de prints diferentes são unidas pela numeração (`unirEtapas`).
   - Fragmento sem card ainda fica pendente, com aviso na tela, e se liga sozinho quando o print com o código chegar. Há seletor "Pertence ao card" para decidir à mão (`cardPaiManual`), que vale sobre o cálculo.
   - Listas e cards com código são mesclados antes dos prints de detalhe, para o detalhe sempre vencer.
   - Print só com texto do pedido (cortado entre imagens) é aceito quando marcado como "Card aberto".
2. **Cronograma semanal (Gantt)** (`gantt.ts` e `GanttSemana.svelte`): fila de cada pessoa por prioridade e prazo, em jornadas de 8 h (capacidade/5), com quando termina cada tarefa, quando a pessoa fica livre, o que passa do prazo, o que não cabe na semana e conflitos entre tarefas relacionadas de pessoas diferentes. Aparece na Home e no Passo 2 do Diário.
3. **Probabilidade calibrada pelo histórico** (`calibracao.ts`): horas realmente fechadas por semana (tempo real do painel, ou estimativa), média e desvio das últimas semanas. A probabilidade mistura a folga da jornada com a chance estatística (normal) de caber mais um serviço, e o peso do histórico cresce até 4 semanas (confiança 100%). A tela mostra a base de cálculo e a confiança.
4. **Imagens e registros na nuvem**: `usuarios/{uid}/registros/{id}` e `usuarios/{uid}/imagens/{id}` (JPEG sempre abaixo de 1 MB). O documento geral deixa de carregar registros e imagens. O localStorage guarda só o `imagemId` quando a imagem já está confirmada na nuvem. Cache local do Firestore (IndexedDB) para uso offline. Fotos de projetos diferentes no mesmo dia não se sobrescrevem mais. O link publicado limita as imagens a um orçamento total.
5. **Leitura de imagem (OCR)**: se a primeira leitura sair fraca, tenta também a imagem em preto e branco (limiar de Otsu e limiar adaptativo local) e fica com a melhor, usando a confiança do próprio leitor. Só gasta passadas extras quando precisa.
6. **Interface**: rodapé em todas as páginas (nas telas abertas, sem os atalhos do app); botão de IA sem textos repetidos, com um único botão para os três campos da supervisão.
