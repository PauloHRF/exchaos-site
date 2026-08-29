/**
 * Os jogadores sintéticos do despacho.
 *
 * Ficam num módulo à parte porque **dois arquivos precisam deles**: o
 * `despachar.ts`, que calibra, e o `conferir.ts`, que guarda a calibragem
 * contra regressão. Uma cópia em cada um significaria duas réguas medindo o
 * mesmo jogo e divergindo em silêncio — que é exatamente o defeito que a
 * paleta da marca teve, e que a regra de quem tomba teve antes disso.
 */
import { contaDaMissao, esquadroesPossiveis, type Cansaco, type Politica } from '../src/despacho.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import type { Recrutado } from '../src/tipos.ts';

/**
 * A régua única: quanto de margem o esquadrão põe na missão antes do dado. É a
 * mesma conta que a interface mostra ao jogador, o que garante que nenhum
 * jogador sintético enxerga o que uma pessoa não enxergaria.
 */
function margemDe(esquadrao: Recrutado[], estado: Parameters<Politica>[0]): number {
  return contaDaMissao({
    esquadrao,
    desafio: estado.desafio,
    exigencia: estado.exigencia,
    cansaco: estado.cansaco,
    moralDaParty: estado.moralDaParty,
    ctx: estado.ctx,
  }).margemSemDado;
}

const cansacoDo = (esq: Recrutado[], c: Cansaco) => esq.reduce((s, h) => s + (c[h.id] ?? 0), 0);

/**
 * `miope` e `zeloso` são o experimento do cansaço.
 *
 * O `miope` manda sempre o melhor esquadrão possível para a missão da vez, sem
 * olhar para o que vem depois — é o jogador que descobre o time A e o queima.
 * O `zeloso` manda o **mais barato que ainda deve passar**, guardando gente
 * descansada para o trono. Se o cansaço estiver cobrando de verdade, o zeloso
 * ganha; se o miope ganhar, o cansaço é decoração e o número precisa subir.
 */
const FOLGA_ALVO = 2;

export const POLITICAS: Record<string, Politica> = {
  pessimo: (estado) => {
    const op = esquadroesPossiveis(estado.vivos);
    return op.reduce((a, b) => (margemDe(b, estado) < margemDe(a, estado) ? b : a));
  },

  aleatorio: (estado) => {
    const op = esquadroesPossiveis(estado.vivos);
    const rnd = mulberry32(hash(`pol:${estado.ctx.numero}:${estado.vivos.map((h) => h.id).join(',')}`));
    return op[Math.floor(rnd() * op.length)];
  },

  // Manda sempre três, os de maior atributo bruto no eixo mais cobrado. É o
  // jogador que não leu o pentágono direito, só viu "mais é melhor".
  bruto: (estado) => {
    const eixo = (Object.keys(estado.exigencia) as (keyof typeof estado.exigencia)[]).reduce(
      (a, b) => (estado.exigencia[b] > estado.exigencia[a] ? b : a),
    );
    return estado.vivos.slice().sort((a, b) => b[eixo] - a[eixo]).slice(0, 3);
  },

  miope: (estado) => {
    const op = esquadroesPossiveis(estado.vivos);
    return op.reduce((a, b) => (margemDe(b, estado) > margemDe(a, estado) ? b : a));
  },

  zeloso: (estado) => {
    const op = esquadroesPossiveis(estado.vivos);
    const suficientes = op.filter((e) => margemDe(e, estado) >= FOLGA_ALVO);
    if (suficientes.length === 0) {
      return op.reduce((a, b) => (margemDe(b, estado) > margemDe(a, estado) ? b : a));
    }
    // Entre os que devem passar, o que gasta menos: menos gente, e gente mais
    // descansada guardada para depois.
    return suficientes.reduce((a, b) => {
      const custo = (e: Recrutado[]) => e.length * 2 + cansacoDo(e, estado.cansaco);
      return custo(b) < custo(a) ? b : a;
    });
  },
};

export const NOMES = ['pessimo', 'aleatorio', 'bruto', 'miope', 'zeloso'] as const;
