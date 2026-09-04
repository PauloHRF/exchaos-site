# ExChaos — site

Portal de jogos de navegador. Deploy no Cloudflare **Workers** (push-to-deploy):
um Worker só de arquivos estáticos, configurado no `wrangler.jsonc` — é por
isso que o painel não mostra campo de *output directory*.

## Estrutura

```
.
├─ index.html            # landing
├─ 404.html              # página de erro (no tema)
├─ robots.txt            # a parte que é nossa; a Cloudflare anexa a dela
├─ assets/brand/         # a marca, num lugar só
│  ├─ exchaos.css        # tokens (cores, fontes) + componentes base
│  ├─ exchaos-favicon.svg / -32.png / -180.png
│  ├─ exchaos-mark.svg / -mono.svg
│  └─ og/                # cartões de compartilhamento (1200x630)
├─ jogos/
│  ├─ index.html         # o portal: lista os jogos (lê jogos.json)
│  ├─ jogos.json         # catálogo — adicione entradas aqui
│  ├─ cifra/             # jogo estático: HTML, CSS e JS soltos
│  └─ ate-o-trono/       # jogo com build: tem package.json
└─ scripts/
   ├─ construir.mjs      # monta o dist/ (e o sitemap, e o catálogo)
   ├─ cartoes-og.py      # desenha os cartões de compartilhamento (à mão)
   └─ cifra-palavras.mjs # gera o vocabulário da Cifra (roda à mão)
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

**No Cloudflare:** *build command* `npm run build`; a pasta publicada é a que o
`wrangler.jsonc` declara (`./dist`), não um campo do painel. Se o build falhar,
o último deploy bem-sucedido continua no ar — ele não derruba o site, apenas
não atualiza.

## Ser encontrado

O site é pequeno demais para ranquear sozinho; o que existe aqui é a parte que
não pode faltar, para o Google não ter desculpa e para um link compartilhado
render.

- **`robots.txt`** (raiz) — nosso conteúdo é praticamente só a linha `Sitemap:`.
  As regras dos robôs de IA **não estão aqui**: a Cloudflare anexa o bloco dela
  a este arquivo, e aquilo se mexe no painel dela.
- **`sitemap.xml`** — gerado pelo `construir.mjs` a partir do `jogos.json`, e só
  com jogo que já tem página em `dist/`. Jogo novo entra sozinho. Sem `lastmod`:
  a única data que o build teria é a do próprio build, e sitemap que jura que
  tudo mudou hoje é sitemap em que o Google para de acreditar.
- **`<link rel="canonical">`** em toda página — sem ela, cada forma de chegar
  na mesma página (com e sem barra, com parâmetro de campanha no fim) vira uma
  página diferente aos olhos do Google, e a força se divide entre cópias.
- **Dados estruturados** (`application/ld+json`) — `Organization` + `WebSite` na
  home, `CollectionPage` gerado no catálogo, e `VideoGame` + `BreadcrumbList`
  escrito na página de cada jogo. Só o catálogo é gerado, porque a lista de
  jogos não pode divergir do `jogos.json`; o resto é pouco e fica à mão.
- **Cartões de compartilhamento** — `assets/brand/og/*.png`, 1200x630, com
  `twitter:card` `summary_large_image`. Desenhados pelo
  `scripts/cartoes-og.py`, que **não faz parte do build**: jogo novo, cartão
  novo, rodado à mão.
- **O catálogo vai pronto no HTML.** A grade de `/jogos/` era montada com
  `fetch` no navegador, e quem lê a página sem rodar JS — o Googlebot na
  primeira passada, o robô que faz a prévia do link no WhatsApp — recebia a
  única página que lista os jogos vazia. O `construir.mjs` escreve os cartões
  no lugar da marca `<!--CARTOES-->`; o script da página só age se achar a
  grade vazia, que é o caso de quem abre o arquivo sem build.

O `404.html` é `noindex`: página de erro não é conteúdo.

## Adicionar um jogo

**Estático:** crie `jogos/<slug>/` com um `index.html` e o que mais ele precisar.
Não há molde a duplicar: o mínimo é uma página. Referencie a marca por caminho
**absoluto** (`/assets/brand/...`) e tudo que for seu por caminho **relativo** —
a Cifra serve de referência viva dessa divisão.

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
