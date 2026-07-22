# Leif

![Painel do Leif no Obsidian](assets/leif-dashboard.jpg)

**A bússola do seu estudo.**

Leif é um plugin para [Obsidian](https://obsidian.md/) que organiza estudos para concursos em um único painel.

Ele reúne concursos, matérias, tópicos do edital, materiais e sessões de estudo para mostrar o que estudar agora e acompanhar o progresso sem sair do Obsidian.

## Installation

### Pelo Obsidian

Quando o Leif estiver disponível no diretório oficial, abra **Configurações → Plugins da comunidade → Explorar**, procure por **Leif**, selecione **Instalar** e depois **Ativar**.

### Instalação manual

1. Baixe `main.js`, `manifest.json` e `styles.css` da mesma versão na página de releases.
2. Crie a pasta `<seu-vault>/.obsidian/plugins/leif` e coloque os três arquivos nela.
3. Reinicie o Obsidian ou recarregue os plugins em **Configurações → Plugins da comunidade**.
4. Ative o **Leif**.

## Usage

Ative o Leif em **Plugins da comunidade** e abra o painel pelo ícone da faixa lateral ou pelo comando **Abrir painel**. Crie um concurso, organize suas matérias e recursos, registre cada sessão e consulte **Hoje** para seguir o ciclo.

Os dados ficam localmente no vault. O Leif não exige conta, não envia telemetria e não faz requisições de rede.

## Markdown aberto (Leif 2.0)

Concursos existentes continuam usando o armazenamento legado até você optar pela migração. Selecione o concurso e execute **Leif: Migrar concurso ativo para Markdown** na paleta de comandos.

Antes da primeira escrita do v2 em uma instalação existente, o Leif cria e relê um backup completo e identificado por checksum em `Leif/.backups/upgrades/`. Se não conseguir verificar esse arquivo, o plugin interrompe a inicialização antes de registrar qualquer interface que possa alterar os dados.

Antes de trocar a fonte, o Leif:

1. mostra uma prévia dos arquivos e dos problemas que bloqueariam a migração;
2. valida IDs e relacionamentos sem alterar os dados;
3. cria um backup imutável com checksum em `Leif/.backups/`;
4. escreve os arquivos em `Leif/.staging/`;
5. relê o Markdown e compara todos os campos, relações e ordens;
6. ativa o Markdown somente se a projeção for equivalente.

O conteúdo fica em `Leif/concursos/<concurso>/` como arquivos Markdown pequenos para concursos, matérias, itens, assuntos, recursos, mural e registros mensais. O JSON legado é mantido para recuperação e não recebe escrita dupla do conteúdo depois da ativação.

Leif cria também `Leif/AGENTS.md` e modelos em `Leif/templates/`. Agentes podem editar os mesmos arquivos sem executar o Obsidian, desde que preservem `leif-id`, block IDs e regiões `<!-- leif:... -->`. Texto, propriedades desconhecidas e notas fora das regiões gerenciadas são preservados.

Documentos com IDs duplicados, conflitos de merge, relações inválidas ou schemas futuros são bloqueados para escrita. O índice mantém a última projeção válida durante a sessão e mostra o conteúdo Markdown como autoridade; uma alteração posterior no JSON legado é detectada como possível downgrade ou conflito de sync.

Quando um arquivo inválido é encontrado, o painel mostra o caminho e o diagnóstico. Antes de substituir uma pasta Markdown, o Leif relê a fonte; se uma pessoa, agente, Git ou sync a tiver alterado durante o staging, a escrita é cancelada e a edição externa permanece intacta.

Para recuperação, execute **Leif: Voltar concurso ativo ao JSON legado**. O rollback só é permitido quando o snapshot legado ainda corresponde ao checksum original e nunca apaga os arquivos Markdown.

O contrato completo está em [`docs/markdown-storage-v1.md`](docs/markdown-storage-v1.md) e a decisão arquitetural em [`docs/adr/0001-markdown-is-the-study-content-authority.md`](docs/adr/0001-markdown-is-the-study-content-authority.md).
