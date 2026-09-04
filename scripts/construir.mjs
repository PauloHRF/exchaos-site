/**
 * O build do site.
 *
 * O portal é estático e sempre foi: HTML, CSS e o `jogos.json`. O que mudou é
 * que passou a existir jogo com cadeia de build própria, e um jogo desses não
 * pode ser só copiado.
 *
 * A regra é uma só, e está no `ehJogoConstruido()`: **pasta dentro de `jogos/`
 * que tem `package.json` é construída; todo o resto é copiado como está.** Um
 * jogo estático futuro continua sendo um HTML solto, sem pagar pedágio de
 * build — que é a coisa que o repositório não podia perder ao ganhar isto.
 *
 * Cada jogo é construído pelo **próprio** `npm run build`, e só então a saída
 * dele é copiada para dentro do `dist`. Assim o jogo continua construível
 * sozinho, fora do monorepo, e este arquivo não precisa saber nada sobre a
 * ferramenta que cada um usa.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const saida = join(raiz, 'dist');

/** O que nunca vai para o site: ferramentas, dependências e a própria saída. */
const FORA_DO_SITE = new Set([
  '.git',
  '.github',
  '.gitignore',
  // Configuração de deploy e cache local do wrangler: dizem respeito a *como*
  // o site sobe, não ao site. Iam publicados junto, servidos em
  // `/wrangler.jsonc` e `/.wrangler/`.
  // A configuração do editor e do preview local: é ferramenta, não site.
  '.claude',
  '.wrangler',
  'wrangler.jsonc',
  'node_modules',
  'dist',
  'scripts',
  'package.json',
  'package-lock.json',
  'README.md',
]);

const ehJogoConstruido = (dir) => existsSync(join(dir, 'package.json'));

/** O endereço do site no ar: é dele que saem as URLs absolutas do sitemap. */
const SITE = 'https://exchaos.com.br';

const lerCatalogo = async () =>
  JSON.parse(await readFile(join(raiz, 'jogos', 'jogos.json'), 'utf8'));

/** Os textos do catálogo são escritos à mão e vão para dentro de HTML. */
const escapar = (t) =>
  String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Os cartões do catálogo, escritos no HTML em tempo de build.
 *
 * A página montava a lista com `fetch` no navegador. Quem lê a página sem rodar
 * JS — o Googlebot na primeira passada, o robô que faz a prévia de um link no
 * WhatsApp — recebia a única página que lista os jogos **vazia**. Agora os
 * cartões já vão no HTML, e o script da página só age se achar a grade vazia,
 * que é o caso de quem abre o arquivo direto, sem passar por aqui.
 *
 * A marcação tem que casar com a que o script monta; se uma mudar, muda a
 * outra.
 */
function cartoes(jogos) {
  return jogos
    .map((j) => {
      const estado = j.status === 'no-ar' ? 'no-ar' : 'em-breve';
      const rotulo = estado === 'no-ar' ? 'Jogar' : 'Em breve';
      return `<a class="card" href="/jogos/${escapar(j.slug)}/">
        <h3>${escapar(j.titulo || j.slug)}</h3>
        <p>${escapar(j.descricao)}</p>
        <span class="status status--${estado}">${rotulo}</span></a>`;
    })
    .join('\n      ');
}

/**
 * O mesmo catálogo em dados estruturados.
 *
 * Só o catálogo é gerado: a lista de jogos não pode divergir do `jogos.json`.
 * O `VideoGame` de cada jogo fica escrito na página do próprio jogo — são
 * poucas, e injetar dentro delas exigiria mexer na saída de um build alheio.
 */
function dadosDoCatalogo(jogos) {
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Jogos — ExChaos',
    url: `${SITE}/jogos/`,
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: jogos.map((j, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: j.titulo || j.slug,
        url: `${SITE}/jogos/${j.slug}/`,
      })),
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(dados)}</script>`;
}

async function montarCatalogo(jogos) {
  const arquivo = join(saida, 'jogos', 'index.html');
  let html = await readFile(arquivo, 'utf8');

  for (const [marca, conteudo] of [
    ['<!--CARTOES-->', cartoes(jogos)],
    ['<!--DADOS-->', dadosDoCatalogo(jogos)],
  ]) {
    if (!html.includes(marca)) {
      throw new Error(`jogos/index.html perdeu a marca ${marca} — o catálogo sairia incompleto`);
    }
    html = html.replace(marca, conteudo);
  }

  await writeFile(arquivo, html);
  console.log(`\n· catálogo montado com ${jogos.length} jogo(s)`);
}

/**
 * O sitemap.
 *
 * Sem `lastmod` de propósito: a única data que o build teria para escrever é a
 * do próprio build, que muda a cada deploy sem que a página tenha mudado. Data
 * errada é pior que data nenhuma — sitemap que jura que tudo mudou hoje é
 * sitemap em que o Google para de acreditar.
 *
 * Só entra jogo que tem página de verdade em `dist`: link de sitemap que dá 404
 * é erro no Search Console.
 */
async function escreverSitemap(jogos) {
  const urls = [`${SITE}/`, `${SITE}/jogos/`];

  for (const j of jogos) {
    if (existsSync(join(saida, 'jogos', j.slug, 'index.html'))) {
      urls.push(`${SITE}/jogos/${j.slug}/`);
    } else {
      console.log(`  · fora do sitemap: ${j.slug} (ainda não tem página)`);
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(join(saida, 'sitemap.xml'), xml);
  console.log(`· sitemap com ${urls.length} URLs`);
}

async function copiarEstatico() {
  for (const nome of await readdir(raiz)) {
    if (FORA_DO_SITE.has(nome)) continue;
    const origem = join(raiz, nome);

    // `jogos/` é o único lugar onde a cópia precisa escolher o que leva: as
    // pastas de jogo com build entram construídas, mais adiante.
    if (nome === 'jogos' && (await stat(origem)).isDirectory()) {
      await mkdir(join(saida, 'jogos'), { recursive: true });
      for (const item of await readdir(origem)) {
        const caminho = join(origem, item);
        const info = await stat(caminho);
        if (info.isDirectory() && ehJogoConstruido(caminho)) continue;
        // O `README.md` de um jogo é o repasse dele, escrito para quem mexe no
        // código — não para quem joga. Na raiz ele já era excluído; aqui dentro
        // não era, e ia parar em `/jogos/<slug>/README.md`, no ar.
        await cp(caminho, join(saida, 'jogos', item), {
          recursive: true,
          filter: (de) => !de.endsWith('README.md'),
        });
      }
      continue;
    }

    await cp(origem, join(saida, nome), { recursive: true });
  }
}

function construirJogo(slug, dir) {
  console.log(`\n· construindo ${slug}`);
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    throw new Error(`o build de ${slug} falhou com código ${r.status}`);
  }
}

async function main() {
  await rm(saida, { recursive: true, force: true });
  await mkdir(saida, { recursive: true });
  await copiarEstatico();

  const pastaDeJogos = join(raiz, 'jogos');
  for (const slug of await readdir(pastaDeJogos)) {
    const dir = join(pastaDeJogos, slug);
    if (!(await stat(dir)).isDirectory() || !ehJogoConstruido(dir)) continue;

    construirJogo(slug, dir);
    const construido = join(dir, 'dist');
    if (!existsSync(construido)) {
      throw new Error(`${slug} construiu sem deixar dist/ — a saída mudou de lugar?`);
    }
    await cp(construido, join(saida, 'jogos', slug), { recursive: true });
    console.log(`  → dist/jogos/${slug}`);
  }

  // Depois dos jogos: o catálogo só sabe quais páginas existem quando elas
  // existem, e o sitemap só promete URL que já está em dist/.
  const jogos = await lerCatalogo();
  await montarCatalogo(jogos);
  await escreverSitemap(jogos);

  console.log('\nsite montado em dist/');
}

await main();
