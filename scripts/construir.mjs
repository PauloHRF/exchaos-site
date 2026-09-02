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
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
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

  console.log('\nsite montado em dist/');
}

await main();
