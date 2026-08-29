/**
 * Iguala o total de pontos de todos os heróis, preservando o formato do
 * pentágono de cada um, e reescreve public/data/guildas.json.
 *
 * Sem preço no draft, total de pontos é poder de graça: um herói de 37 seria
 * quase sempre melhor que um de 22, e a escolha viraria "pegue o maior número".
 * Com todos no mesmo total, o que resta a decidir é o *formato* — qual lado do
 * pentágono a party ainda precisa cobrir — e a compatibilidade.
 *
 *   node scripts/normalizar.ts [total]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EIXOS, MAXIMO_POR_HEROI } from '../src/regras.ts';
import type { BaseDeHerois, Eixo, Heroi } from '../src/tipos.ts';

const TOTAL_ALVO = Number(process.argv[2] ?? 32);
const MINIMO = 2;

const caminho = new URL('../public/data/guildas.json', import.meta.url);
const db: BaseDeHerois = JSON.parse(readFileSync(caminho, 'utf8'));

const total = (h: Heroi) => EIXOS.reduce((s, e) => s + h[e], 0);

function normalizar(h: Heroi) {
  const atual = total(h);
  if (atual === TOTAL_ALVO) return;

  // Valores ideais mantendo as proporções; depois arredonda e corrige a sobra
  // no eixo em que o arredondamento mais afastou do ideal.
  const ideais = Object.fromEntries(
    EIXOS.map((e) => [e, (h[e] * TOTAL_ALVO) / atual]),
  ) as Record<Eixo, number>;

  for (const e of EIXOS) {
    h[e] = Math.min(MAXIMO_POR_HEROI, Math.max(MINIMO, Math.round(ideais[e])));
  }

  let sobra = TOTAL_ALVO - total(h);
  let guarda = 0;
  while (sobra !== 0 && guarda++ < 60) {
    const passo = sobra > 0 ? 1 : -1;
    // Ajusta onde o arredondamento mais deve ao ideal, para não deformar.
    const candidatos = EIXOS.filter((e) =>
      passo > 0 ? h[e] < MAXIMO_POR_HEROI : h[e] > MINIMO,
    ).sort((a, b) => (ideais[b] - h[b]) * passo - (ideais[a] - h[a]) * passo);
    if (candidatos.length === 0) break;
    h[candidatos[0]] += passo;
    sobra -= passo;
  }
}

for (const guilda of db.guildas) for (const heroi of guilda.herois) normalizar(heroi);

const heroiEmLinha = (h: Heroi) =>
  `{ "id": ${JSON.stringify(h.id)}, "nome": ${JSON.stringify(h.nome)}, ` +
  `"classe": ${JSON.stringify(h.classe)}, "moral": ${h.moral}, ` +
  EIXOS.map((e) => `"${e}": ${h[e]}`).join(', ') +
  `, "etiquetas": [${h.etiquetas.map((t) => JSON.stringify(t)).join(', ')}]` +
  `, "recusa": [${h.recusa.map((t) => JSON.stringify(t)).join(', ')}] }`;

const texto =
  `{\n  "versao": ${db.versao},\n  "guildas": [\n` +
  db.guildas
    .map(
      (g) =>
        `    {\n      "id": ${JSON.stringify(g.id)},\n      "nome": ${JSON.stringify(g.nome)},\n` +
        `      "era": ${JSON.stringify(g.era)},\n      "herois": [\n` +
        g.herois.map((h) => `        ${heroiEmLinha(h)}`).join(',\n') +
        `\n      ]\n    }`,
    )
    .join(',\n') +
  `\n  ]\n}\n`;

writeFileSync(caminho, texto, 'utf8');

const todos = db.guildas.flatMap((g) => g.herois);
const totais = todos.map(total);
console.log(`Total alvo: ${TOTAL_ALVO}`);
console.log(`Totais agora: de ${Math.min(...totais)} a ${Math.max(...totais)}`);
const canivetes = todos.filter((h) => EIXOS.filter((e) => h[e] >= 8).length >= 4);
console.log(`Heróis fortes em 4+ eixos: ${canivetes.length ? canivetes.map((h) => h.nome).join(', ') : 'nenhum'}`);
console.log('\nExemplos:');
for (const h of [todos[0], todos[9], todos[37], todos[62]]) {
  console.log(`  ${h.nome.padEnd(22)} ${EIXOS.map((e) => `${e.slice(0, 3)} ${h[e]}`).join(' · ')}`);
}
