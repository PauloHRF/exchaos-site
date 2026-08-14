/**
 * Remodela o roster no formato extremo e distribui os traços.
 *
 * Os 32 pontos continuam iguais para todos — é o que faz cada escolha ser uma
 * troca de verdade em vez de "pega o maior número". O que muda é a **forma**:
 * antes todo mundo era 8/7/6/6/5 e a soma da party dava sempre perto de 32 em
 * qualquer eixo, então composição nenhuma se distinguia do dado. Agora um herói
 * pode ter 11 num eixo e 2 noutro, e a party passa a ter picos e buracos.
 *
 * A ordem dos eixos de cada herói é preservada: quem era o mais forte em
 * Combate continua sendo, só que mais.
 *
 *   node scripts/remodelar.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EIXOS, TRACOS } from '../src/regras.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import type { BaseDeHerois, Eixo, Heroi, TracoId } from '../src/tipos.ts';

/** Formatos possíveis, todos somando 32, do mais pontudo ao mais redondo. */
const FORMATOS: { nome: string; pontos: number[]; peso: number }[] = [
  { nome: 'especialista', pontos: [11, 9, 6, 4, 2], peso: 34 },
  { nome: 'duplo', pontos: [11, 11, 6, 2, 2], peso: 22 },
  { nome: 'pontudo', pontos: [11, 8, 6, 5, 2], peso: 22 },
  { nome: 'amplo', pontos: [10, 8, 6, 5, 3], peso: 15 },
  { nome: 'redondo', pontos: [8, 7, 6, 6, 5], peso: 7 },
];

const TODOS_OS_TRACOS = Object.keys(TRACOS) as TracoId[];

/** Traços que combinam com quem é forte naquele eixo. */
const TRACO_DO_EIXO: Record<Eixo, TracoId[]> = {
  combate: ['duelista', 'veterano', 'vanguarda'],
  mobilidade: ['batedor', 'andarilho', 'retaguarda'],
  carisma: ['orador', 'diplomata', 'comandante'],
  intelecto: ['estudioso', 'decifrador', 'amuleto'],
  vigor: ['sentinela', 'teimoso', 'martir'],
};

const caminho = new URL('../public/data/guildas.json', import.meta.url);
const db: BaseDeHerois = JSON.parse(readFileSync(caminho, 'utf8'));

// Rodar de novo em cima do próprio resultado faria a identidade dos heróis
// derivar a cada passagem, porque a ordem dos eixos seria relida do arquivo já
// remodelado. Uma vez só.
if (db.guildas[0].herois[0].traco) {
  console.error('O roster já foi remodelado. Rodar de novo deformaria os heróis.');
  process.exit(1);
}

function escolherFormato(rnd: () => number) {
  const total = FORMATOS.reduce((s, f) => s + f.peso, 0);
  let alvo = rnd() * total;
  for (const f of FORMATOS) {
    alvo -= f.peso;
    if (alvo <= 0) return f;
  }
  return FORMATOS[0];
}

const contagemFormato: Record<string, number> = {};
const contagemTraco: Record<string, number> = {};
const herois = db.guildas.flatMap((g) => g.herois);

/*
 * Cotas. O roster escrito à mão pendia para Combate e Intelecto, e amplificar
 * o formato amplificava o desequilíbrio junto: um eixo com 41 especialistas e
 * outro com 12 faz o lado fraco da party ser sempre o mesmo, e some a tensão de
 * cobrir buraco. Cada eixo lidera em 16 heróis, cada traço aparece 5 vezes.
 */
const COTA_EIXO = Math.ceil(herois.length / EIXOS.length);
const COTA_TRACO = Math.ceil(herois.length / TODOS_OS_TRACOS.length);
const usoEixo: Record<string, number> = Object.fromEntries(EIXOS.map((e) => [e, 0]));
const usoTraco: Record<string, number> = Object.fromEntries(TODOS_OS_TRACOS.map((t) => [t, 0]));

for (const heroi of herois) {
  const rnd = mulberry32(hash(`forma:${heroi.id}`));
  const formato = escolherFormato(rnd);
  contagemFormato[formato.nome] = (contagemFormato[formato.nome] ?? 0) + 1;

  // A ordem original diz em que o herói é bom; a cota decide qual desses vira
  // o pico. Zelda não vira espadachim — no máximo lidera pelo segundo eixo dela.
  const ordem = EIXOS.slice().sort((a, b) => heroi[b] - heroi[a] || (a < b ? -1 : 1));
  const principal = ordem.find((e) => usoEixo[e] < COTA_EIXO) ?? ordem[0];
  usoEixo[principal]++;
  const resto = ordem.filter((e) => e !== principal);
  [principal, ...resto].forEach((eixo, i) => (heroi[eixo] = formato.pontos[i]));

  // O traço combina com o eixo principal, respeitando a cota do traço.
  const afins = TRACO_DO_EIXO[principal].filter((t) => usoTraco[t] < COTA_TRACO);
  const livres = TODOS_OS_TRACOS.filter((t) => usoTraco[t] < COTA_TRACO);
  const candidatos = afins.length > 0 && rnd() < 0.7 ? afins : livres.length > 0 ? livres : TODOS_OS_TRACOS;
  const traco = candidatos[Math.floor(rnd() * candidatos.length)];
  heroi.traco = traco;
  usoTraco[traco]++;
  contagemTraco[traco] = (contagemTraco[traco] ?? 0) + 1;
}

const heroiEmLinha = (h: Heroi) =>
  `{ "id": ${JSON.stringify(h.id)}, "nome": ${JSON.stringify(h.nome)}, ` +
  `"classe": ${JSON.stringify(h.classe)}, "moral": ${h.moral}, ` +
  EIXOS.map((e) => `"${e}": ${h[e]}`).join(', ') +
  `, "traco": ${JSON.stringify(h.traco)}` +
  `, "etiquetas": [${h.etiquetas.map((t) => JSON.stringify(t)).join(', ')}]` +
  `, "recusa": [${h.recusa.map((t) => JSON.stringify(t)).join(', ')}] }`;

const texto =
  `{\n  "versao": 4,\n  "guildas": [\n` +
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

console.log('Formatos:');
for (const [nome, n] of Object.entries(contagemFormato)) console.log(`  ${nome.padEnd(14)} ${n}`);

console.log('\nEspecialistas (9+) por eixo:');
for (const e of EIXOS) {
  console.log(`  ${e.padEnd(12)} ${herois.filter((h) => h[e] >= 9).length}`);
}

console.log('\nTraços:');
for (const t of TODOS_OS_TRACOS) {
  console.log(`  ${TRACOS[t].nome.padEnd(12)} ${contagemTraco[t] ?? 0}`);
}

const semTraco = herois.filter((h) => !h.traco);
console.log(`\nSem traço: ${semTraco.length}`);
console.log('\nExemplos:');
for (const h of [herois[0], herois[5], herois[24], herois[60]]) {
  console.log(
    `  ${h.nome.padEnd(22)} ${EIXOS.map((e) => `${e.slice(0, 3)} ${String(h[e]).padStart(2)}`).join(' · ')}  ${TRACOS[h.traco].nome}`,
  );
}
