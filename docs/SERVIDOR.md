# Etapa com servidor: desenho para o futuro

Hoje o OrbisOS não tem servidor próprio. O app é TypeScript de ponta a ponta (SvelteKit estático na Vercel) e o "backend" é o Firebase (Authentication e Firestore) protegido por regras. Isso atende enquanto cada conta usa o sistema sozinha. As cinco funções abaixo exigem algo que roda fora do navegador, e ficam registradas aqui para quando forem feitas.

## Como fazer: uma linguagem só

Manter TypeScript e reaproveitar `packages/core` (a lógica de leitura e cálculo roda igual no servidor). Duas opções, sem excluir uma à outra:

- **Cloud Functions do Firebase (TypeScript):** a mais natural, pois a conta já existe. Exige o plano Blaze (cartão cadastrado, com cota gratuita mensal). Tem agendador (`onSchedule`) e Secret Manager para segredos.
- **Rotas de servidor do SvelteKit na Vercel:** só para o que precisar. Troca o adaptador estático por um que permita funções, ou mantém o site estático e cria funções separadas.

Python, Java ou Go não trazem ganho aqui. Só entram se um dia houver aprendizado de máquina pesado.

## 1. Coleta automática diária do painel

- **Objetivo:** guardar uma foto do painel por dia sem colar print. Isso alimenta o histórico, e a calibração da probabilidade e a estimativa de horas aprendida melhoram com semanas de dados.
- **Desenho:** função agendada (dias úteis, de manhã) que busca a exportação do painel do gestor (CSV ou API, a definir com a fonte real), usa `lerCsvDemandas`/`lerCards` do core e grava `usuarios/{uid}/fotos/{id}` no mesmo formato que o app já usa.
- **Segredo:** credenciais do painel no Secret Manager, nunca no navegador nem no repositório.
- **Pendência:** definir a fonte de dados. Sem API ou exportação agendável, a coleta não é possível sem automatizar o navegador, o que é frágil e deve ser evitado.

## 2. Avisos (Teams ou e-mail) e relatório semanal automático

- **Objetivo:** avisar quando `estagioCritico` for verdadeiro para alguém, e enviar o relatório da semana sozinho.
- **Desenho:** função agendada que reaproveita `analisarTimeNoProjeto` e `montarGanttSemana`, e envia por webhook do Teams ou provedor de e-mail. Guardar o que já foi avisado (por pessoa e por dia) para não repetir.
- **Segredo:** URL do webhook ou chave do e-mail no Secret Manager.
- **Dado necessário:** preferência de aviso por conta (canal, horário, o que avisar) em `usuarios/{uid}/geral/dados`.

## 3. Link interativo mais seguro

- **Hoje:** o código de 24 letras mais as regras (`publicados/{codigo}`). Qualquer pessoa com o link cria respostas, até 1000 caracteres cada, sem limite de quantidade.
- **Falta:** limite de respostas por link e por pessoa, validação mais forte do conteúdo e proteção contra abuso automatizado.
- **Desenho:** as respostas passam a ser criadas por uma função (e não direto pelo navegador), que valida o tamanho, aplica o limite com um contador no documento do link e ativa o App Check do Firebase. As regras deixam de aceitar criação direta de respostas.

## 4. Convites e papéis, fase 2

A fase 1 já existe (veja o README, "Espaços compartilhados, convites e papéis"): papéis dono, supervisor e leitor, convites por e-mail e espaços compartilhados, tudo por regras do Firestore. Fica para o servidor:

- **Convite com verificação:** hoje o app não exige e-mail verificado; quem criar conta com o e-mail convidado primeiro receberia o convite. A função verifica o e-mail e envia o convite por e-mail.
- **Pastas liberadas valendo de verdade:** hoje são só guardadas. Impor por regra é complexo; no servidor vira uma verificação simples.
- **Edição simultânea:** hoje vale a última gravação entre dono e supervisor. Precisa de versão por documento e mesclagem.

## 5. OCR no servidor

- **Hoje:** Tesseract no navegador (privado, mas lento), com pré-processamento em preto e branco quando a leitura sai fraca.
- **Servidor:** um serviço de OCR (por exemplo Google Cloud Vision) lê mais rápido e com mais precisão, mas o print sai do computador. Só vale se os prints não tiverem dado sensível, e deve ser uma opção por conta, desligada por padrão.
- **Desenho:** o navegador envia a imagem a uma função, que devolve o texto no mesmo formato que `lerImagem` devolve hoje; o resto do fluxo (`lerCards`, correlação em lote) não muda.

## Ordem sugerida

1. Definir a fonte de dados do painel (destrava a coleta e acelera o histórico).
2. Coleta automática, depois avisos e relatório semanal (usam a mesma estrutura de agendamento).
3. Link mais seguro (a única que reduz um risco que já existe hoje).
4. Convites fase 2, depois OCR no servidor (opcional).
