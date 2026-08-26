/** Carregamento dos dados e montagem de parties sintéticas, usado pelos scripts. */
import { readFileSync } from 'node:fs';
import { exigenciaDaJornada, jornadaDoDia, sortearCandidatos } from '../src/motor.ts';
import { DEGRAU_DA_ETAPA, EIXOS, TAMANHO_PARTY } from '../src/regras.ts';
import { escolher } from '../src/rng.ts';
import type { BaseDeHerois, CatalogoDesafios, Desafio, Recrutado } from '../src/tipos.ts';
import { faixaDeDificuldade, lancesEsperados } from './avaliar.ts';

export const dbHerois: BaseDeHerois = JSON.parse(
  readFileSync(new URL('../public/data/guildas.json', import.meta.url), 'utf8'),
);

export const catalogo: CatalogoDesafios = JSON.parse(
  readFileSync(new URL('../public/data/desafios.json', import.meta.url), 'utf8'),
);

/** A faixa de dificuldade do catálogo, calculada uma vez e reusada a cada draft. */
export const FAIXA = faixaDeDificuldade(catalogo, DEGRAU_DA_ETAPA);

/**
 * Os jogadores sintéticos, e o que cada um serve para medir.
 *
 * - `pessimo` escolhe sempre o **pior** candidato pela mesma régua do
 *   `sinergico`. É o controle do experimento: se o jogo é decisão de verdade,
 *   existe uma distância clara entre ele e quem escolhe bem. Se não existe, o
 *   draft é decoração — foi assim que a versão de atributos equilibrados foi
 *   pega, e é a única medida que pega esse tipo de erro.
 * - `aleatorio` escolhe entre os compatíveis sem critério. O jogador de primeira
 *   vez.
 * - `guloso` ordena por força bruta. Desde que todo herói soma os mesmos 32
 *   pontos, é ruído puro — fica no conjunto para provar isso a cada rodagem.
 * - `sinergico` joga a estratégia que o jogo diz pedir: sinergia, traços que
 *   pagam, nenhum lado murcho no pentágono. **Não sabe o que o dia cobra.**
 * - `informado` lê a exigência da jornada e monta contra ela.
 *
 * A pergunta que o par `pessimo` × `sinergico` responde é se a estratégia
 * interna paga sem o oráculo do dia. Nenhuma medida anterior perguntava isso, e
 * a resposta foi mais forte que a tese: o `sinergico` salva o mundo em 29,8% das
 * jornadas contra 20,0% do `informado`. **Saber o que o dia cobra vale menos que
 * montar a companhia direito** — o oráculo persegue o pentágono de um dia só e,
 * ao fazer isso, aceita um lado murcho que o dia seguinte cobraria. Era o
 * contrário do que eu esperava ao escrever este arquivo, e é o resultado que
 * justifica a interface esconder a exigência da jornada: ela não estava
 * escondendo a estratégia boa, estava escondendo uma armadilha.
 */
export type Nivel = 'pessimo' | 'aleatorio' | 'guloso' | 'sinergico' | 'informado';

export const NIVEIS: Nivel[] = ['pessimo', 'aleatorio', 'guloso', 'sinergico', 'informado'];

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
    } else if (nivel === 'sinergico' || nivel === 'pessimo') {
      // A mesma régua para os dois, lida em direções opostas: um busca o topo,
      // o outro o fundo. Medir os dois com critérios diferentes não diria nada
      // sobre o jogo — só sobre a diferença entre os critérios.
      const valor = (c: (typeof legais)[number]) => lancesEsperados([...party, c.heroi], FAIXA);
      escolha = legais.reduce((a, b) =>
        nivel === 'sinergico'
          ? valor(b) > valor(a)
            ? b
            : a
          : valor(b) < valor(a)
            ? b
            : a,
      );
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
