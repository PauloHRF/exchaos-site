/** Carregamento dos dados e montagem de parties sintéticas, usado pelos scripts. */
import { readFileSync } from 'node:fs';
import { exigenciaDaJornada, jornadaDoDia, sortearCandidatos } from '../src/motor.ts';
import { EIXOS, TAMANHO_PARTY } from '../src/regras.ts';
import { escolher } from '../src/rng.ts';
import type { BaseDeHerois, CatalogoDesafios, Desafio, Recrutado } from '../src/tipos.ts';

export const dbHerois: BaseDeHerois = JSON.parse(
  readFileSync(new URL('../public/data/guildas.json', import.meta.url), 'utf8'),
);

export const catalogo: CatalogoDesafios = JSON.parse(
  readFileSync(new URL('../public/data/desafios.json', import.meta.url), 'utf8'),
);

/**
 * `informado` é o jogador que sabe o que o dia cobra e monta contra isso — a
 * única habilidade que sobrou depois que todos os heróis passaram a somar os
 * mesmos 32 pontos. `guloso` e `aleatorio` viraram praticamente o mesmo
 * jogador, e é justamente por isso que servem de piso de comparação.
 */
export type Nivel = 'aleatorio' | 'guloso' | 'informado';

export const forcaBruta = (h: Recrutado) => EIXOS.reduce((s, e) => s + h[e], 0);

export interface Montagem {
  party: Recrutado[];
  resorteios: number;
  travou: boolean;
}

/**
 * Monta uma party como um jogador sintético montaria, respeitando o mesmo
 * fluxo da interface: quatro candidatos, resorteio quando todos recusam.
 */
export function montarParty(dia: string, nivel: Nivel, rnd: () => number): Montagem {
  const party: Recrutado[] = [];
  let resorteios = 0;

  for (let rodada = 0; rodada < TAMANHO_PARTY; rodada++) {
    let tentativa = 0;
    let legais = sortearCandidatos(dbHerois, dia, rodada, party, tentativa).filter((c) => !c.recusa);
    while (legais.length === 0 && tentativa < 12) {
      tentativa++;
      resorteios++;
      legais = sortearCandidatos(dbHerois, dia, rodada, party, tentativa).filter((c) => !c.recusa);
    }
    if (legais.length === 0) return { party, resorteios, travou: true };

    let escolha = legais[0];
    if (nivel === 'aleatorio') {
      escolha = escolher(rnd, legais);
    } else if (nivel === 'guloso') {
      escolha = legais.reduce((a, b) => (forcaBruta(b.heroi) > forcaBruta(a.heroi) ? b : a));
    } else {
      // Mede o quanto a party ainda deve ao pentágono exigido pelo dia, e
      // escolhe quem mais reduz essa dívida.
      const exigencia = exigenciaDaJornada(jornadaDoDia(catalogo, dia));
      const divida = (membros: Recrutado[]) =>
        EIXOS.reduce((s, e) => {
          const soma = membros.reduce((t, h) => t + h[e], 0);
          return s + Math.max(0, exigencia[e] - soma);
        }, 0);
      escolha = legais.reduce((a, b) =>
        divida([...party, b.heroi]) < divida([...party, a.heroi]) ? b : a,
      );
    }
    party.push(escolha.heroi);
  }

  return { party, resorteios, travou: false };
}

export function jornadaPara(dia: string): Desafio[] {
  return jornadaDoDia(catalogo, dia);
}
