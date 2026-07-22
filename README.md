# Leif

![Painel do Leif no Obsidian](assets/leif-dashboard.jpg)

**A bússola do seu estudo.**

Leif é um plugin para [Obsidian](https://obsidian.md/) que organiza estudos para concursos em um único painel. Ele reúne concursos, matérias, assuntos do edital, recursos e registros de estudo para mostrar o que estudar agora — e, desde a versão 2.0, guarda o conteúdo como **Markdown aberto** dentro do seu vault.

## Funcionalidades

- **Hoje**: a recomendação do que estudar agora, seguindo o ciclo do concurso ativo. Registrar o estudo e avançar o ciclo acontecem no mesmo gesto.
- **Concursos**: cada concurso tem ciclo, matérias e progresso próprios; alternar entre concursos é instantâneo.
- **Matérias**: organize as matérias do ciclo, os assuntos do edital e os recursos de estudo (PDFs, vídeos e links).
- **Registros**: o histórico de cada registro de estudo, com feedback visual direto no painel.
- **Mural**: links oficiais e notas de planejamento do concurso, sempre à mão.

## Markdown aberto

No Leif 2.0, o conteúdo de estudo pode viver como Markdown legível no vault, em `Leif/concursos/<concurso>/` — arquivos pequenos para concursos, matérias, itens, assuntos, recursos, mural e registros mensais. Você edita no Obsidian, em outro editor ou com um agente de IA, dentro ou fora do Obsidian.

Concursos existentes continuam no armazenamento legado até você optar pela migração, que é feita por concurso: selecione o concurso e execute **Leif: Migrar concurso ativo para Markdown** na paleta de comandos.

Antes da primeira escrita do v2 em uma instalação existente, o Leif cria e relê um backup completo identificado por checksum em `Leif/.backups/upgrades/`. Se não conseguir verificar esse arquivo, o plugin interrompe a inicialização antes de registrar qualquer interface que possa alterar os dados.

Antes de trocar a fonte, o Leif:

1. mostra uma prévia dos arquivos e dos problemas que bloqueariam a migração;
2. valida IDs e relacionamentos sem alterar os dados;
3. cria um backup imutável com checksum em `Leif/.backups/`;
4. escreve os arquivos em `Leif/.staging/`;
5. relê o Markdown e compara todos os campos, relações e ordens;
6. ativa o Markdown somente se a projeção for equivalente.

Leif cria também `Leif/AGENTS.md` e modelos em `Leif/templates/`. Agentes podem editar os mesmos arquivos sem executar o Obsidian, desde que preservem `leif-id`, block IDs `^leif-ref-...` e regiões `<!-- leif:... -->`. Texto, propriedades desconhecidas e notas fora das regiões gerenciadas são preservados.

Documentos com IDs duplicados, conflitos de merge, relações inválidas ou schemas futuros são bloqueados para escrita. Se uma pessoa, agente, Git ou sync alterar a fonte durante o staging, a escrita é cancelada e a edição externa permanece intacta. Uma alteração posterior no JSON legado é detectada como possível downgrade ou conflito de sync.

Para recuperação, execute **Leif: Voltar concurso ativo ao JSON legado**. O rollback só é permitido quando o snapshot legado ainda corresponde ao checksum original e nunca apaga os arquivos Markdown.

## Installation

### Pelo Obsidian

Quando o Leif estiver disponível no diretório oficial, abra **Configurações → Plugins da comunidade → Explorar**, procure por **Leif**, selecione **Instalar** e depois **Ativar**.

### Instalação manual

1. Baixe `main.js`, `manifest.json` e `styles.css` da mesma versão na página de releases.
2. Crie a pasta `<seu-vault>/.obsidian/plugins/leif` e coloque os três arquivos nela.
3. Reinicie o Obsidian ou recarregue os plugins em **Configurações → Plugins da comunidade**.
4. Ative o **Leif**.

## Usage

Ative o Leif em **Plugins da comunidade** e abra o painel pelo ícone da faixa lateral ou pelo comando **Abrir painel**. Crie um concurso, organize suas matérias e recursos, registre cada estudo e consulte **Hoje** para seguir o ciclo.

## Privacidade

Os dados ficam localmente no vault. O Leif não exige conta, não envia telemetria e não faz requisições de rede.

## Desenvolvimento

```bash
npm install
npm run dev             # build em modo watch
npm test                # testes
npm run release:check   # lint, testes, formato, build e verificação de release
```

## Documentação

- [Contrato de armazenamento Markdown](docs/markdown-storage-v1.md)
- [ADR: Markdown como autoridade do conteúdo de estudo](docs/adr/0001-markdown-is-the-study-content-authority.md)
- [Design system](docs/design-system.md)
- [Changelog](CHANGELOG.md)
- [Notas da versão 2.0](release-notes/2.0.0.md)

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
