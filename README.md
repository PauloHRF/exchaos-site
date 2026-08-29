# ExChaos — site

Portal de jogos de navegador. Deploy no Cloudflare Pages (push-to-deploy).

## Estrutura

```
.
├─ index.html            # landing
├─ 404.html              # página de erro (no tema)
├─ assets/brand/         # a marca, num lugar só
│  ├─ exchaos.css        # tokens (cores, fontes) + componentes base
│  ├─ exchaos-favicon.svg / -32.png / -180.png
│  └─ exchaos-mark.svg / -mono.svg
├─ jogos/
│  ├─ index.html         # o portal: lista os jogos (lê jogos.json)
│  ├─ jogos.json         # catálogo — adicione entradas aqui
│  ├─ exemplo/           # jogo estático: só um HTML
│  └─ ate-o-trono/       # jogo com build: tem package.json
└─ scripts/construir.mjs # monta o dist/
```

## O build

O portal é estático e continua sendo. O que mudou é que passou a existir jogo
com cadeia de build própria, e um jogo desses não pode ser só copiado.

A regra é uma só:

> **Pasta dentro de `jogos/` que tem `package.json` é construída. Todo o resto é
> copiado como está.**

Jogo estático continua sendo um HTML solto, sem pagar pedágio de build. Jogo com
build é construído pelo **próprio** `npm run build` dele, e só então a saída é
copiada para `dist/jogos/<slug>/` — o que mantém cada jogo construível sozinho,
fora do monorepo, e deixa o orquestrador sem precisar saber qual ferramenta cada
um usa.

```
npm install     # instala as dependências de todos os jogos (workspaces)
npm run build   # monta o dist/
npm run preview # constrói e serve o dist/ para conferir
```

Cada jogo com build tem os seus próprios comandos, rodados de dentro da pasta
dele. No Até o Trono: `npm run conferir` (as checagens) e `npm run despachar`
(a calibragem).

**No Cloudflare Pages:** *build command* `npm run build`, *output directory*
`dist`. Se o build falhar, o Pages mantém o último deploy bem-sucedido no ar —
ele não derruba o site, apenas não atualiza.

## Adicionar um jogo

**Estático:** duplique `jogos/exemplo/` para `jogos/<slug>/` e construa dentro.

**Com build:** crie `jogos/<slug>/` com o `package.json` do jogo, cujo
`npm run build` precisa deixar a saída em `<slug>/dist/`. Acrescente o caminho
em `workspaces`, no `package.json` da raiz.

Nos dois casos, adicione a entrada em `jogos/jogos.json`:

```json
{
  "slug": "<slug>",
  "titulo": "Nome do Jogo",
  "descricao": "Uma linha sobre o jogo.",
  "status": "no-ar",
  "tags": []
}
```

`status`: `"no-ar"` quando estiver jogável, `"em-breve"` enquanto não.

## Caminhos

As páginas do portal referenciam a marca por caminho **absoluto**
(`/assets/brand/...`), então só funcionam servindo a pasta como raiz — é por
isso que o `npm run preview` existe, e por isso abrir o HTML direto (`file://`)
não funciona.

Cada jogo, ao contrário, usa caminhos **relativos** internamente, porque vive
num subcaminho (`/jogos/<slug>/`) e precisa funcionar de lá. No Até o Trono isso
é o `base: './'` do Vite.

## Marca

**`assets/brand/tokens.css` é a definição canônica.** É o único lugar do
repositório onde uma cor ou fonte da identidade tem valor literal. Mudar a
identidade é mexer nesse arquivo, e mais nenhum.

Quem consome:

- **`assets/brand/exchaos.css`** — junta aos tokens os componentes base do
  portal (`body`, `.btn`, `.wrap`, `.seal`). É o que as páginas do portal
  importam.
- **`jogos/ate-o-trono/src/estilo.css`** — importa os tokens por caminho
  relativo e os apelida para os nomes em português que o jogo usa, derivando os
  tons que só ele precisa. Não define nenhuma cor da marca.
- **`jogos/ate-o-trono/src/cartao.ts`** — canvas não entende variável CSS, mas
  o navegador entende: o cartão lê os tokens com `getComputedStyle` na hora de
  desenhar. Os literais continuam lá como reserva, para o cartão não sair preto
  se for desenhado antes de a folha de estilo valer.

Isso existe porque a identidade já esteve em três cópias, e cópia apaga: o
commit que vestiu o jogo com a marca não tocou no cartão, que passou semanas em
sépia quente enquanto o site já era obsidiana — algo que só aparece quando os
dois estão lado a lado, que é exatamente o que compartilhar faz.

**As fontes não são compartilhadas**, de propósito. Os tokens do portal
(`--fd`, `--fb`, `--fm`) já terminam em `serif`/`monospace`, então encaixá-los
numa pilha maior mata tudo o que vem depois. O nome da família é o da marca; a
pilha de reserva é decisão de cada consumidor.

O guia de estilo completo está no pacote da marca, fora deste repositório.
