/**
 * Calibragem do modelo de lances.
 *
 * Alvo: um jogador que monta contra o que o dia cobra salva o mundo com
 * frequência razoável, mas chegar sem baixas continua raro; quem monta no impulso fica
 * pelo meio do caminho.
 *
 *   node scripts/tune.ts            distribuição por nível e tática
 *   node scripts/tune.ts --perfil   onde caem as somas da party por eixo
 *   node scripts/tune.ts --varrer   varre degrau da etapa × margem do grave
 */
import { simularCampanha, somaDoGrupo } from '../src/motor.ts';
import { DEGRAU_DA_ETAPA, EIXOS, TATICAS } from '../src/regras.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import type { Tatica } from '../src/tipos.ts';
import { jornadaPara, montarParty, type Nivel } from './comum.ts';

function medir(nivel: Nivel, tatica: Tatica, amostras: number) {
  const histograma = new Array(8).fill(0);
  let perfeitas = 0;
  let salvou = 0;
  let baixas = 0;

  for (let i = 0; i < amostras; i++) {
    const dia = `sim-${i}`;
    const { party } = montarParty(dia, nivel, mulberry32(hash(`${nivel}:${dia}`)));
    const c = simularCampanha(party, tatica, dia, jornadaPara(dia));
    histograma[c.vitorias]++;
    baixas += c.baixas;
    if (c.vitorias === 7) salvou++;
    if (c.perfeita) perfeitas++;
  }

  return {
    histograma,
    salvou: (salvou / amostras) * 100,
    perfeitas: (perfeitas / amostras) * 100,
    baixas: baixas / amostras,
  };
}

const AMOSTRAS = 2000;

/**
 * Onde as somas da party realmente caem em cada eixo. É daqui que sai a faixa
 * de dificuldade dos lances — em vez de chutar números e ver no que dá.
 */
if (process.argv.includes('--perfil')) {
  console.log('Soma da party por eixo (máximo 50; a party sempre tem 160 pontos no total)\n');
  console.log('nível         ' + EIXOS.map((e) => e.slice(0, 6).padStart(9)).join(''));
  for (const nivel of ['aleatorio', 'guloso', 'informado'] as Nivel[]) {
    const porEixo: Record<string, number[]> = Object.fromEntries(EIXOS.map((e) => [e, []]));
    for (let i = 0; i < 1500; i++) {
      const dia = `perfil-${i}`;
      const { party } = montarParty(dia, nivel, mulberry32(hash(`${nivel}:${dia}`)));
      for (const e of EIXOS) porEixo[e].push(somaDoGrupo(party, e));
    }
    for (const p of [10, 50, 90]) {
      const linha = EIXOS.map((e) => {
        const ord = porEixo[e].slice().sort((a, b) => a - b);
        return String(ord[Math.floor((p / 100) * (ord.length - 1))]).padStart(9);
      }).join('');
      console.log(`${nivel.slice(0, 10).padEnd(10)} p${p}`.padEnd(14) + linha);
    }
    console.log('');
  }
  process.exit(0);
}

if (process.argv.includes('--varrer')) {
  const base = DEGRAU_DA_ETAPA.slice();
  const graveBase = {
    agressiva: TATICAS.agressiva.margemGrave,
    equilibrada: TATICAS.equilibrada.margemGrave,
    defensiva: TATICAS.defensiva.margemGrave,
  };

  // Os dois parâmetros são acoplados na direção oposta: baixar o degrau ganha
  // etapas, apertar a margem do fracasso grave tira as jornadas inteiras sem tirar as
  // vitórias. É o par que decide o jogo.
  const TATICAS_POSSIVEIS: Tatica[] = ['agressiva', 'equilibrada', 'defensiva'];

  // Mede sempre a **melhor** tática, não uma escolhida a dedo: é essa que o
  // jogador vai jogar, e calibrar olhando outra foi como eu deixei a defensiva
  // virar dominante sem perceber.
  console.log('Varredura: degrau da etapa × margem do fracasso grave\n');
  console.log('degrau grave | melhor p/ salvar   melhor p/ inteiras | casual salva\n');
  for (const desloca of [-11, -9, -7, -5, -3]) {
    for (const apertaGrave of [0]) {
      base.forEach((v, i) => (DEGRAU_DA_ETAPA[i] = v + desloca));
      for (const t of Object.keys(graveBase) as Tatica[]) {
        TATICAS[t].margemGrave = graveBase[t] + apertaGrave;
      }
      const porTatica = TATICAS_POSSIVEIS.map((t) => ({ t, ...medir('informado', t, 600) }));
      const paraSalvar = porTatica.reduce((a, b) => (b.salvou > a.salvou ? b : a));
      const parainteiras = porTatica.reduce((a, b) => (b.perfeitas > a.perfeitas ? b : a));
      const casual = Math.max(
        ...TATICAS_POSSIVEIS.map((t) => medir('aleatorio', t, 400).salvou),
      );
      console.log(
        ` ${desloca.toString().padStart(4)}  ${apertaGrave.toString().padStart(4)} | ` +
          `${paraSalvar.t.padStart(12)} ${paraSalvar.salvou.toFixed(1).padStart(5)}% ` +
          `${parainteiras.t.padStart(13)} ${parainteiras.perfeitas.toFixed(1).padStart(5)}% | ` +
          `${casual.toFixed(1).padStart(11)}%`,
      );
    }
  }
  base.forEach((v, i) => (DEGRAU_DA_ETAPA[i] = v));
  for (const t of Object.keys(graveBase) as Tatica[]) TATICAS[t].margemGrave = graveBase[t];
  process.exit(0);
}

console.log(`\nCalibragem — ${AMOSTRAS} jornadas por linha\n`);
for (const nivel of ['aleatorio', 'guloso', 'informado'] as Nivel[]) {
  for (const tatica of ['agressiva', 'equilibrada', 'defensiva'] as Tatica[]) {
    const r = medir(nivel, tatica, AMOSTRAS);
    const pct = (n: number) => ((n / AMOSTRAS) * 100).toFixed(1).padStart(5) + '%';
    console.log(
      `${nivel.padEnd(11)} ${tatica.padEnd(12)} ` +
        `${r.histograma.map((n, v) => `${v}:${pct(n)}`).join(' ')} | ` +
        `salvou: ${r.salvou.toFixed(1).padStart(5)}% | inteiras: ${r.perfeitas.toFixed(1).padStart(5)}% | ` +
        `baixas: ${r.baixas.toFixed(2)}`,
    );
  }
  console.log('');
}

console.log('Táticas:');
for (const t of Object.keys(TATICAS) as Tatica[]) {
  console.log(
    `  ${TATICAS[t].nome.padEnd(12)} bônus ${TATICAS[t].bonus >= 0 ? '+' : ''}${TATICAS[t].bonus}` +
      ` · morre quem falha por ${Math.abs(TATICAS[t].margemGrave) + 1} ou mais`,
  );
}
