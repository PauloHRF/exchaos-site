/**
 * Calibragem do motor de despacho.
 *
 * O jogo antigo tinha uma pergunta central — *o draft é decisão ou cerimônia?* —
 * e um par de jogadores sintéticos para respondê-la. Este jogo tem **duas**
 * decisões, e portanto duas perguntas:
 *
 *   1. o **draft** ainda importa, agora que os cinco não jogam juntos?
 *   2. o **despacho** é decisão? (`pessimo` × o melhor, na mesma party)
 *
 * A segunda é a nova, e é a que este arquivo existe para responder. Ela é
 * medida com o draft **fixo**: mesma party, mesmo dia, mesma seed, só muda
 * quem é mandado. Sem isso o efeito do despacho ficaria embolado com o do
 * draft, que é o erro que a versão anterior deste projeto quase cometeu.
 *
 *   node scripts/despachar.ts            a tabela de despacho × tática
 *   node scripts/despachar.ts --cansaco  o cansaço está cobrando alguma coisa?
 *   node scripts/despachar.ts --varrer   varre o fator da exigência
 */
import {
  definirFatorDaExigencia,
  definirImune,
  definirPesoDoCansaco,
  definirTronoPorFalha,
  simularJornada,
} from '../src/despacho.ts';
import { NOMES, POLITICAS } from './politicas.ts';
import { EIXOS } from '../src/regras.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import { NIVEIS, jornadaPara, montarParty, type Nivel } from './comum.ts';


/* -------------------------------------------------------------------- medição */

const AMOSTRAS = 2000;

/**
 * O draft ainda importa?
 *
 * A pergunta do jogo antigo, refeita para o novo: com o **despacho fixo** no
 * melhor que a companhia permite, quanto o draft sozinho move o resultado? Se
 * não mover, montar os cinco virou cerimônia e só o despacho é jogo.
 */
function medirDraft(nivel: Nivel, amostras = AMOSTRAS) {
  let salvou = 0;
  let baixas = 0;
  for (let i = 0; i < amostras; i++) {
    const dia = `draft-${i}`;
    const { party, travou } = montarParty(dia, nivel, mulberry32(hash(`d:${nivel}:${dia}`)));
    if (travou) continue;
    const j = simularJornada(party, dia, jornadaPara(dia), POLITICAS.zeloso);
    baixas += j.baixas;
    if (j.salvou) salvou++;
  }
  return { salvou: (salvou / amostras) * 100, baixas: baixas / amostras };
}

if (process.argv.includes('--draft')) {
  console.log('O draft ainda importa? Despacho fixo no zeloso, so o draft varia.');
  console.log('');
  console.log('draft         salvou   baixas');
  for (const nivel of NIVEIS) {
    const m = medirDraft(nivel);
    console.log(`${nivel.padEnd(12)} ${m.salvou.toFixed(1).padStart(6)}%   ${m.baixas.toFixed(2).padStart(6)}`);
  }
  process.exit(0);
}

function medir(politica: string, amostras = AMOSTRAS) {
  let salvou = 0;
  let perfeitas = 0;
  let inteiros = 0;
  let vitorias = 0;
  let baixas = 0;

  for (let i = 0; i < amostras; i++) {
    const dia = `desp-${i}`;
    // O draft é o mesmo para todas as políticas: o que varia é só o despacho.
    const { party, travou } = montarParty(dia, 'sinergico', mulberry32(hash(`draft:${dia}`)));
    if (travou) continue;
    const j = simularJornada(party, dia, jornadaPara(dia), POLITICAS[politica]);
    vitorias += j.vitorias;
    baixas += j.baixas;
    if (j.salvou) salvou++;
    if (j.perfeita) perfeitas++;
    if (j.salvouInteiro) inteiros++;
  }

  return {
    salvou: (salvou / amostras) * 100,
    perfeitas: (perfeitas / amostras) * 100,
    inteiros: (inteiros / amostras) * 100,
    vitorias: vitorias / amostras,
    baixas: baixas / amostras,
  };
}

if (process.argv.includes('--exemplo')) {
  const dia = process.argv[process.argv.indexOf('--exemplo') + 1] ?? 'exemplo-7';
  const { party } = montarParty(dia, 'sinergico', mulberry32(hash(`draft:${dia}`)));
  const jornada = jornadaPara(dia);
  console.log('Companhia: ' + party.map((h) => `${h.nome} (${h.jogo})`).join(', '));
  console.log('');

  const relatos = simularJornada(party, dia, jornada, POLITICAS.zeloso);
  for (const r of relatos.relatos) {
    const pent = EIXOS.filter((e) => r.exigencia[e] > 0)
      .map((e) => `${e.slice(0, 4)} ${String(r.somas[e]).padStart(2)}/${r.exigencia[e]}${r.dados[e] >= 0 ? '+' : ''}${r.dados[e]}`)
      .join('  ');
    console.log(`${r.numero}. ${r.desafio.nome}  [${r.esquadrao.map((h) => h.nome).join(', ')}]`);
    console.log(`   ${pent}   margem ${r.margem >= 0 ? '+' : ''}${r.margem} -> ${r.resultado}`);
    console.log(`   ${r.narracao}${r.caido ? `  (cai ${r.caido.nome})` : ''}`);
    console.log('');
  }
  console.log(
    `${relatos.vitorias} missoes vencidas, ${relatos.falhas} perdidas, ${relatos.baixas} baixas` +
      (relatos.salvou ? ' -- o mundo esta salvo.' : ' -- o trono continua ocupado.'),
  );
  process.exit(0);
}

if (process.argv.includes('--peso')) {
  console.log('Quanto cada ponto de cansaco deve descontar de cada atributo');
  console.log('');
  console.log('peso   zeloso   miope   vantagem   baixas(zeloso)');
  for (const v of [0, 1, 2, 3]) {
    definirPesoDoCansaco(v);
    const z = medir('zeloso');
    const m = medir('miope');
    const vant = m.salvou > 0 ? (z.salvou / m.salvou).toFixed(2) : '-';
    console.log(
      `${String(v).padStart(4)}   ${z.salvou.toFixed(1).padStart(6)}%  ${m.salvou.toFixed(1).padStart(5)}%   ${vant.padStart(8)}x   ${z.baixas.toFixed(2).padStart(6)}`,
    );
  }
  process.exit(0);
}

if (process.argv.includes('--inteiro')) {
  console.log('A margem imune ao azar: o que ela faz com chegar inteiro');
  console.log('');
  console.log('imune   zeloso salvou   inteiras   inteiras/salvou   baixas');
  for (const v of [4, 6, 8, 10, 12, 99]) {
    definirImune(v);
    const z = medir('zeloso');
    const razao = z.salvou > 0 ? ((z.perfeitas / z.salvou) * 100).toFixed(0) : '-';
    console.log(
      `${String(v).padStart(5)}   ${z.salvou.toFixed(1).padStart(12)}%   ${z.perfeitas.toFixed(1).padStart(7)}%   ${razao.padStart(14)}%   ${z.baixas.toFixed(2).padStart(6)}`,
    );
  }
  process.exit(0);
}

if (process.argv.includes('--varrer')) {
  console.log('Fator da exigência: o que ele faz com cada jeito de despachar\n');
  console.log('fator   zeloso   miope   bruto   aleat   pessimo   baixas(zeloso)');
  for (const fator of [0.40, 0.44, 0.48, 0.52, 0.56, 0.60]) {
    definirFatorDaExigencia(fator);
    const z = medir('zeloso', 800);
    const m = medir('miope', 800);
    const b = medir('bruto', 800);
    const a = medir('aleatorio', 800);
    const p = medir('pessimo', 800);
    console.log(
      `${fator.toFixed(2)}  ${z.salvou.toFixed(1).padStart(6)}%  ${m.salvou.toFixed(1).padStart(5)}%  ${b.salvou.toFixed(1).padStart(5)}%  ${a.salvou.toFixed(1).padStart(5)}%  ${p.salvou.toFixed(1).padStart(7)}%   ${z.baixas.toFixed(2).padStart(6)}`,
    );
  }
  process.exit(0);
}

if (process.argv.includes('--trono')) {
  console.log('Quanto cada missão perdida deve engrossar o pentágono do trono');
  console.log('');
  console.log('por falha   zeloso   miope   bruto   aleat   (fator 0.60)');
  definirFatorDaExigencia(0.6);
  for (const p of [0, 1, 2, 3]) {
    definirTronoPorFalha(p);
    const z = medir('zeloso', 800);
    const m = medir('miope', 800);
    const b = medir('bruto', 800);
    const a = medir('aleatorio', 800);
    console.log(
      `${String(p).padStart(6)}      ${z.salvou.toFixed(1).padStart(6)}%  ${m.salvou.toFixed(1).padStart(5)}%  ${b.salvou.toFixed(1).padStart(5)}%  ${a.salvou.toFixed(1).padStart(5)}%`,
    );
  }
  process.exit(0);
}

if (process.argv.includes('--cansaco')) {
  console.log('O cansaco cobra? miope queima o time A, zeloso guarda gente.');
  console.log('');
  console.log('politica    salvou   s/baixa   perfeita   missoes   baixas');
  for (const pol of ['miope', 'zeloso'] as const) {
    const m = medir(pol);
    console.log(
      `${pol.padEnd(10)} ${m.salvou.toFixed(1).padStart(6)}%  ${m.inteiros.toFixed(1).padStart(6)}%   ${m.perfeitas.toFixed(1).padStart(6)}%   ${m.vitorias.toFixed(2).padStart(7)}   ${m.baixas.toFixed(2).padStart(6)}`,
    );
  }
  process.exit(0);
}

console.log(`Despacho - ${AMOSTRAS} jornadas por linha, draft fixo (sinergico)`);
console.log('');
console.log('politica    salvou   s/baixa   perfeita   missoes   baixas');
for (const pol of NOMES) {
  const m = medir(pol);
  console.log(
    `${pol.padEnd(10)} ${m.salvou.toFixed(1).padStart(6)}%  ${m.inteiros.toFixed(1).padStart(6)}%   ${m.perfeitas.toFixed(1).padStart(6)}%   ${m.vitorias.toFixed(2).padStart(7)}   ${m.baixas.toFixed(2).padStart(6)}`,
  );
}
