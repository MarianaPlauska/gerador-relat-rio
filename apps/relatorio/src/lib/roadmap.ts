export type SituacaoRoadmap = 'pronto' | 'andando' | 'planejado';

export interface ItemRoadmap
{
  titulo: string;
  texto: string;
  situacao: SituacaoRoadmap;
}

export interface EtapaRoadmap
{
  periodo: string;
  itens: ItemRoadmap[];
}

export const roadmap: EtapaRoadmap[] = [
  {
    periodo: '2026: entregue',
    itens: [
      { titulo: 'Leitura do painel', texto: 'Colar com Ctrl+C, ler print por OCR e importar o CSV de Demandas. O painel é a fonte dos números.', situacao: 'pronto' },
      { titulo: 'Plano, alertas e fluxo', texto: 'Plano semanal por pessoa, alertas do que passa do painel, previsão da meta e demandas paradas.', situacao: 'pronto' },
      { titulo: 'Relatórios em PDF', texto: 'Mais de dez modelos, período livre, blocos inseríveis, fluxogramas e modelos criados por você.', situacao: 'pronto' },
      { titulo: 'Listas e fluxogramas', texto: 'Checklists com fases e diário, editor de fluxo de arrastar e ligar.', situacao: 'pronto' },
      { titulo: 'Conta e link interativo', texto: 'Entrar com e-mail e senha, guardar na nuvem e enviar relatório por link com marcas e comentários.', situacao: 'pronto' },
      { titulo: 'Checklist diário, visão do mês e 1:1', texto: 'Relatório preenchido todo dia, visão mensal e uma página por pessoa para a conversa 1:1.', situacao: 'pronto' },
      { titulo: 'Paleta de comandos', texto: 'Ctrl+K abre qualquer tela, lista, fluxo ou card.', situacao: 'pronto' },
      { titulo: 'Planilhas', texto: 'Organizar material solto (prompt e links) em planilha com orçamento, ocupação e .xlsx, usando uma IA gratuita.', situacao: 'pronto' },
      { titulo: 'Escrever com IA local', texto: 'Rascunho de texto gerado no seu navegador, sem pagar nem enviar dados. Exige Chrome ou Edge com WebGPU.', situacao: 'andando' },
    ],
  },
  {
    periodo: '2027, primeiro trimestre',
    itens: [
      { titulo: 'Lembretes', texto: 'Avisos dentro do sistema, no computador: colar o painel, fechar a semana e registrar o dia.', situacao: 'planejado' },
      { titulo: 'Testes automáticos', texto: 'Rodar os testes no GitHub a cada envio, antes de publicar.', situacao: 'planejado' },
    ],
  },
  {
    periodo: '2027, segundo trimestre',
    itens: [
      { titulo: 'Previsão com incerteza', texto: 'Simulação de Monte Carlo para dizer a chance de bater a meta do mês.', situacao: 'planejado' },
      { titulo: 'Sugestão de capacidade', texto: 'Sugerir o plano da semana pela carga e pelo histórico de cada pessoa.', situacao: 'planejado' },
      { titulo: 'Metas de 2027', texto: 'Cadastrar as metas do ano e acompanhar mês a mês.', situacao: 'planejado' },
    ],
  },
  {
    periodo: '2027, segundo semestre',
    itens: [
      { titulo: 'Equipe na mesma conta', texto: 'Mais de uma pessoa editando o mesmo checklist diário. A base (papéis, convites e espaços compartilhados) já existe; falta a edição simultânea sem sobrescrever.', situacao: 'andando' },
      { titulo: 'Visão anual', texto: 'O ano em uma tela: meses, entregas, riscos e decisões.', situacao: 'planejado' },
    ],
  },
  {
    periodo: 'Futuro: etapa com servidor',
    itens: [
      { titulo: 'Coleta automática diária do painel', texto: 'Buscar o painel todo dia sem colar print, para o histórico (e a calibração da probabilidade) crescer sozinho. Precisa de agendador e de credenciais guardadas fora do navegador.', situacao: 'planejado' },
      { titulo: 'Avisos e relatório semanal automático', texto: 'Aviso no Teams ou por e-mail quando alguém entrar em sobrecarga crítica, e relatório semanal enviado sozinho. Precisa de agendador e de um segredo (webhook ou chave de e-mail).', situacao: 'planejado' },
      { titulo: 'Link interativo mais seguro', texto: 'Limite de respostas por link, validação mais forte e proteção contra abuso. Hoje a proteção é o código de 24 letras mais as regras.', situacao: 'planejado' },
      { titulo: 'Convites e papéis, fase 2', texto: 'Convite por e-mail com verificação, pastas liberadas por pessoa valendo de verdade e mesclagem de edições simultâneas.', situacao: 'planejado' },
      { titulo: 'OCR no servidor', texto: 'Leitura de imagem mais rápida e precisa fora do navegador. Só vale se a privacidade dos prints não for um problema.', situacao: 'planejado' },
    ],
  },
];
