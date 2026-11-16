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

## 5. Editor Visual de Fluxos de Processo (`/fluxos`)

1. **Criacao a partir de tres origens**:
   - **Texto solto (primeira opcao)**: transforma qualquer texto corrido, lista de passos, orientacoes com `// detalhes`, decisoes (`Pergunta? sim: A / nao: B`) ou codigo Mermaid em fluxograma.
   - **Do dia / Da semana**: gera o fluxo a partir do plano da semana ou das demandas ativas de hoje.
   - **Dos relatorios / Diario**: gera o fluxo a partir de um registro salvo no Diario do painel ou de uma lista de checagem.
2. **Painel lateral de inspecao do no**:
   - Ao selecionar um passo, abre o painel a direita permitindo alterar o tipo (`Inicio`, `Acao`, `Decisao`, `Fim`), editar o texto do no, preencher **Detalhes (aparecem ao percorrer)**, configurar conexoes de **Proximo passo** e **Ramificar**.
3. **Indicador de lacunas e Modo Percorrer**:
   - Alerta no topo caso existam nos sem saida, orfaos ou decisoes incompletas.
   - Botao **Percorrer** abre o guia passo a passo interativo, destacando o no atual no diagrama, exibindo as orientacoes da etapa e permitindo escolher os caminhos de decisao.
