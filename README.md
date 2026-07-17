# Leif

**A bússola do seu estudo.**

Leif é um plugin para [Obsidian](https://obsidian.md/) feito para acompanhar estudos para concursos.

O nome vem de Leif Eriksson, navegador que cruzou mares antes de muita gente saber o caminho. A ideia é essa: ajudar você a se orientar no edital, no ciclo e no que falta estudar.

## O que ele faz

Leif organiza o estudo em uma estrutura simples:

- concursos;
- matérias;
- itens de estudo;
- assuntos do edital;
- cadernos de questões;
- sessões estudadas.

Com isso, você consegue ver o que estudar hoje, registrar o que fez e acompanhar o avanço por matéria.

## Para quem é

Para quem estuda para concurso e quer sair de planilhas soltas, anotações perdidas e controle manual em excesso.

Leif não tenta estudar por você. Ele só mantém o mapa em ordem.

## Como usar

Abra o painel pela faixa lateral do Obsidian ou pela paleta de comandos:

```text
Leif: Abrir painel do Leif
```

Fluxo básico:

1. Crie ou selecione um concurso.
2. Cadastre as matérias.
3. Organize o ciclo em `Matérias`.
4. Mapeie assuntos em `Edital`.
5. Cadastre materiais em `Recursos`.
6. Registre sessões em `Registros`.
7. Use `Hoje` para se orientar.

## Instalação

O Leif ainda não está publicado na lista oficial de plugins da comunidade do Obsidian.

### Manual

Baixe ou gere estes arquivos:

```text
main.js
styles.css
manifest.json
```

Copie para:

```text
.obsidian/plugins/leif/
```

Depois reinicie o Obsidian e ative o plugin em `Settings > Community plugins`.

### BRAT

Se usa [BRAT](https://github.com/TfTHacker/obsidian42-brat), adicione este repositório:

```text
https://github.com/ttusk/leif
```

## Vault de demonstração

O repositório inclui um vault de exemplo em `sample-vault/`.

Para testar:

1. Abra o Obsidian.
2. Escolha `Open folder as vault`.
3. Selecione `sample-vault/`.
4. Abra o Leif pela faixa lateral.

## Desenvolvimento

Requisitos:

- Node.js 20+
- npm
- Obsidian

Instale as dependências:

```bash
npm install
```

Rode em desenvolvimento:

```bash
npm run dev
```

Gere o build:

```bash
npm run build
```

Rode os testes:

```bash
npm test
```

O build copia `main.js` e `styles.css` para o vault de demonstração.

## Licença

MIT. Veja [LICENSE](LICENSE).
