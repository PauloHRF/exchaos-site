/**
 * Soma um valor a todas as dificuldades do catálogo e reescreve
 * public/data/desafios.json, mantendo o formato de uma linha por lance.
 *
 * Serve para incorporar o resultado da calibragem no próprio catálogo, em vez
 * de carregar um deslocamento embutido no degrau da etapa.
 *
 *   node scripts/reescalar.ts -7
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { CatalogoDesafios } from '../src/tipos.ts';

const AJUSTE = Number(process.argv[2] ?? 0);
if (!Number.isInteger(AJUSTE)) {
  console.error('Informe um inteiro. Exemplo: node scripts/reescalar.ts -7');
  process.exit(1);
}

const caminho = new URL('../public/data/desafios.json', import.meta.url);
const catalogo: CatalogoDesafios = JSON.parse(readFileSync(caminho, 'utf8'));

for (const desafio of catalogo.desafios) {
  for (const lance of desafio.lances) lance.dificuldade += AJUSTE;
}

const lanceEmLinha = (l: CatalogoDesafios['desafios'][number]['lances'][number]) =>
  `{ "cena": ${JSON.stringify(l.cena)}, "eixo": ${JSON.stringify(l.eixo)}, ` +
  `"dificuldade": ${l.dificuldade} }`;

const texto =
  `{\n  "versao": ${catalogo.versao},\n  "desafios": [\n` +
  catalogo.desafios
    .map(
      (d) =>
        `    {\n      "id": ${JSON.stringify(d.id)},\n      "nome": ${JSON.stringify(d.nome)},\n` +
        `      "tipo": ${JSON.stringify(d.tipo)},\n      "abertura": ${JSON.stringify(d.abertura)},\n` +
        (d.favorece ? `      "favorece": ${JSON.stringify(d.favorece)},\n` : '') +
        `      "lances": [\n` +
        d.lances.map((l) => `        ${lanceEmLinha(l)}`).join(',\n') +
        `\n      ]\n    }`,
    )
    .join(',\n') +
  `\n  ]\n}\n`;

writeFileSync(caminho, texto, 'utf8');

const todas = catalogo.desafios.flatMap((d) => d.lances.map((l) => l.dificuldade));
console.log(`Ajuste de ${AJUSTE >= 0 ? '+' : ''}${AJUSTE} aplicado a ${todas.length} lances.`);
console.log(`Dificuldades agora: de ${Math.min(...todas)} a ${Math.max(...todas)}`);
