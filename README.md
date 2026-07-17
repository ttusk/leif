# Leif

![Versão](https://img.shields.io/badge/vers%C3%A3o-0.1.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0%2B-7c3aed)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)
![Testes](https://img.shields.io/badge/testes-Vitest-orange)

Leif é um plugin para [Obsidian](https://obsidian.md/) voltado ao acompanhamento de estudos para concursos públicos.

Ele organiza o estudo por concurso, matéria, item, assunto e sessão. A proposta é substituir controles dispersos em planilhas por um painel integrado ao vault, preservando um fluxo simples: escolher o concurso ativo, seguir o ciclo de matérias, registrar sessões e acompanhar progresso.

## Status do projeto

O projeto está em desenvolvimento inicial.

As funcionalidades principais já estão implementadas e cobertas por testes, mas o plugin ainda não foi publicado na lista oficial de plugins da comunidade do Obsidian.

## Funcionalidades

- Gestão de múltiplos concursos.
- Seleção de concurso ativo.
- Mural por concurso, com links, notas e informações de referência.
- Cadastro de matérias com ordem, tempo planejado, etapa e status no ciclo.
- Ciclo de estudo entre matérias ativas.
- Indicação da matéria e do item recomendados para estudo.
- Cadastro de itens de estudo por matéria.
- Associação de PDF, vídeo e link aos itens de estudo.
- Cadastro de assuntos por matéria.
- Associação de caderno de questões aos assuntos.
- Abertura do link do caderno no navegador.
- Registro manual de sessões de PDF, vídeo e questões.
- Acompanhamento de páginas lidas, questões resolvidas e acertos.
- Hoje com próxima atividade e resumo por matéria.
- Exportação de dados em CSV.
- Vault de exemplo com dados de demonstração.

## Instalação

### Instalação pela comunidade do Obsidian

O Leif ainda não está disponível na lista oficial de plugins da comunidade.

Quando for publicado, a instalação poderá ser feita por:

1. Abrir `Settings` no Obsidian.
2. Acessar `Community plugins`.
3. Procurar por `Leif`.
4. Instalar e ativar o plugin.

### Instalação manual

1. Baixe os arquivos gerados do plugin:

   - `main.js`
   - `styles.css`
   - `manifest.json`

2. Crie a pasta do plugin dentro do vault:

   ```text
   .obsidian/plugins/leif/
   ```

3. Copie os três arquivos para essa pasta.

4. Reinicie o Obsidian.

5. Ative o plugin em `Settings > Community plugins`.

### Instalação com BRAT

Se você usa o plugin [BRAT](https://github.com/TfTHacker/obsidian42-brat), adicione este repositório como plugin beta:

```text
https://github.com/ttusk/leif
```

Depois disso, ative o Leif na lista de plugins da comunidade.

## Como usar

Abra o painel principal pela faixa lateral esquerda ou pela paleta de comandos:

```text
Leif: Abrir painel do Leif
```

O painel é dividido pelas etapas principais do estudo:

- `Hoje`
- `Registros`
- `Matérias`
- `Edital`
- `Recursos`
- `Concursos`
- `Mural`

### Fluxo recomendado

1. Crie ou selecione um concurso.
2. Cadastre as matérias do concurso.
3. Defina a ordem e o status das matérias no ciclo.
4. Cadastre os itens de estudo de cada matéria.
5. Cadastre os assuntos e associe cadernos de questões quando necessário.
6. Use `Hoje` para ver a próxima atividade.
7. Registre sessões de estudo em `Registros` conforme avançar.
8. Acompanhe progresso e desempenho em `Hoje`.

## Conceitos principais

### Concurso

É a unidade principal de organização. Cada concurso possui seus próprios dados, incluindo matérias, itens, assuntos, sessões e mural.

### Matéria

Representa uma disciplina do concurso. Pode ser ativada ou desativada no ciclo e possui ordem, tempo planejado e etapa atual.

### Item

Representa uma unidade de estudo dentro de uma matéria. PDFs, vídeos e links pertencem aos itens.

### Assunto

Representa um tópico da matéria. Cadernos de questões pertencem aos assuntos.

### Sessão

Representa um registro manual de estudo. Pode ser de PDF, vídeo ou questões.

## Vault de demonstração

O repositório inclui um vault de exemplo em `sample-vault/`.

Ele já contém:

- Leif instalado e ativado.
- Três concursos de demonstração.
- Matérias, itens, assuntos, cadernos e sessões cadastrados.
- Dados suficientes para testar alternância entre concursos e visualização de progresso.

Para usar:

1. Abra o Obsidian.
2. Selecione `Open folder as vault`.
3. Escolha a pasta `sample-vault/`.
4. Abra o Leif pela faixa lateral ou pela paleta de comandos.

## Desenvolvimento

### Requisitos

- Node.js 20 ou superior.
- npm.
- Obsidian instalado para teste manual.

### Preparação

```bash
npm install
```

### Modo de desenvolvimento

```bash
npm run dev
```

### Build de produção

```bash
npm run build
```

O build copia automaticamente `main.js` e `styles.css` para:

```text
sample-vault/.obsidian/plugins/leif/
```

### Testes

```bash
npm test
```

## Estrutura do projeto

```text
src/
  domain/          Entidades, serviços de domínio e erros
  application/     Casos de uso, portas, validações e guards
  infrastructure/  Persistência, migrations, seed e adapters
  ui/              Comandos, view principal e componentes
```

## Comandos registrados

O plugin registra comandos auxiliares para uso e desenvolvimento:

- `Leif: Abrir painel do Leif`
- `Leif: Seed demo data`
- `Leif: Show active contest`
- `Leif: Switch active contest`
- `Leif: Show active contest subjects`
- `Leif: Reorder active contest subjects`
- `Leif: Toggle first subject active state`
- `Leif: Update first subject configuration`
- `Leif: Advance cycle`
- `Leif: Show cycle snapshot`
- `Leif: Show active contest wall`
- `Leif: Show active contest summary`
- `Leif: Register demo question session`
- `Leif: Register demo video session`
- `Leif: Reset plugin data`

## Roadmap

- Publicar o plugin na comunidade do Obsidian.
- Adicionar filtros e busca nas tabelas.
- Melhorar a visualização de estatísticas.
- Adicionar importação de CSV.
- Revisar a experiência mobile.
- Criar documentação com capturas de tela.

## Contribuição

Contribuições são bem-vindas.

Antes de abrir um pull request:

1. Descreva claramente o problema ou a melhoria.
2. Mantenha a alteração focada.
3. Inclua testes quando a mudança afetar comportamento.
4. Execute `npm test`.
5. Execute `npm run build`.

## Licença

Este projeto é de código aberto e está licenciado sob os termos da licença MIT.

Consulte o arquivo [LICENSE](LICENSE) para mais informações.
