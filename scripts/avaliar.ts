/**
 * Quanto vale uma companhia para quem **não sabe o que o dia vai cobrar**.
 *
 * Existe porque o README afirma uma coisa que a calibragem nunca mediu: que a
 * estratégia "nasce de dentro da companhia, não do encaixe com a jornada". Os
 * jogadores sintéticos que havia eram `aleatorio`, `guloso` — que ordena por
 * força bruta, inútil desde que todo herói passou a somar os mesmos 32 pontos —
 * e `informado`, que lê a exigência do dia e monta contra ela. Nenhum dos três
 * joga a estratégia que o jogo pede; o `informado` joga justamente a que o jogo
 * esconde.
 *
 * Este arquivo é o outro lado: uma avaliação que só olha para dentro da party.
 *
 * ## A moeda: lances esperados
 *
 * Tudo aqui é convertido em **quantos dos 21 lances da jornada a companhia deve
 * passar**. É a única unidade em que sinergia, traço e atributo são comparáveis,
 * e ela resolve sozinha uma armadilha: +1 num eixo só paga nos ~4 lances daquele
 * eixo, enquanto +1 de sinergia paga nos 21. Um ponto de sinergia vale cinco de
 * atributo, e nenhuma intuição entrega isso de graça.
 *
 * ## Por que não basta somar os eixos
 *
 * A soma dos cinco eixos de uma party é **sempre 160** — cinco heróis de 32
 * pontos cada. O draft não escolhe quanto poder a companhia tem; escolhe só o
 * formato do pentágono. Somar os eixos, portanto, não distingue party nenhuma:
 * é preciso uma função côncava, e ela precisa vir do modelo, não de um chute.
 *
 * A daqui é a chance real de passar um lance: dificuldade sorteada na faixa que
 * o catálogo usa, dado de −4 a +4, todos igualmente prováveis. A curva em S sai
 * disso sem nenhum parâmetro inventado — e é ela que faz um eixo murcho custar
 * mais do que um eixo alto rende.
 */
import { sinergia, somaDoGrupo } from '../src/motor.ts';
import {
  COMPOSICAO_DA_JORNADA,
  EIXOS,
  ETAPAS,
  FACES_DO_DADO,
  TAMANHO_PARTY,
  TRACOS,
} from '../src/regras.ts';
import type { CatalogoDesafios, Eixo, Recrutado, TipoDesafio } from '../src/tipos.ts';

export const LANCES_POR_PROVA = 3;
export const LANCES_DA_JORNADA = ETAPAS * LANCES_POR_PROVA;

/**
 * Quantos lances a jornada tem de cada tipo de prova. Sai da composição fixa:
 * três combates, um trono, e um de cada uma das outras três.
 */
const LANCES_POR_TIPO: Record<string, number> = {};
for (const tipo of COMPOSICAO_DA_JORNADA) {
  LANCES_POR_TIPO[tipo] = (LANCES_POR_TIPO[tipo] ?? 0) + LANCES_POR_PROVA;
}

/**
 * Medido em 68.435 lances de jornadas sintéticas: 30,2% deles acontecem depois
 * que a companhia já perdeu alguém. É o que vale o traço Vingança, que só
 * começa a pagar quando a conta já azedou.
 */
const FRACAO_APOS_BAIXA = 0.302;

/**
 * O que vale, em lances, o traço que salva uma vida em vez de somar número.
 *
 * Uma baixa tira ~6,4 de cada eixo (os 32 pontos do herói espalhados em cinco) e
 * devolve só +2 de luto, então custa ~4,4 de soma pelos ~30% de jornada que
 * ainda resta. É o bastante para virar um punhado de lances — mas o número é
 * estimativa, e por isso está aqui em cima, isolado, em vez de diluído na conta.
 * `--ablacao` zera este valor para mostrar que a conclusão do experimento não
 * depende dele.
 */
export let VALOR_DE_UMA_VIDA = 1.2;
export function zerarValorDaVida() {
  VALOR_DE_UMA_VIDA = 0;
}

/** A faixa de dificuldade que o catálogo realmente usa, já com o degrau da etapa. */
export interface Faixa {
  min: number;
  max: number;
}

/**
 * Sai do catálogo, não de um número escrito à mão: trocar `desafios.json` move a
 * faixa junto. É conhecimento agregado — a faixa que o jogo usa, do jeito que
 * quem joga várias vezes aprende —, nunca conhecimento do dia: nada aqui diz
 * qual eixo a jornada de hoje vai cobrar, nem em que prova.
 */
export function faixaDeDificuldade(catalogo: CatalogoDesafios, degrau: number[]): Faixa {
  const bases = catalogo.desafios.flatMap((d) => d.lances.map((l) => l.dificuldade));
  return {
    min: Math.min(...bases) + Math.min(...degrau),
    max: Math.max(...bases) + Math.max(...degrau),
  };
}

/**
 * Quantos lances de cada eixo a jornada de um dia deve cobrar.
 *
 * Não é a contagem do catálogo, e a diferença entre as duas é o que escondia o
 * problema: o dia sorteia **três** combates e só um de cada uma das outras
 * provas, então um lance escrito num desafio de combate pesa o triplo de um
 * escrito num de enigma. Contando o catálogo inteiro, vigor parecia só o mais
 * raro; contando o dia, era 1,50 lance contra 6,00 de combate — quatro vezes
 * menos.
 *
 * Um eixo cobrado quatro vezes menos que outro é atributo de descarte, e
 * atributo de descarte fura a premissa dos 32 pontos em formatos extremos: a
 * troca deixa de ser troca quando um dos lados não é cobrado.
 */
export function lancesPorEixoNoDia(catalogo: CatalogoDesafios): Record<Eixo, number> {
  const porDia = Object.fromEntries(EIXOS.map((e) => [e, 0])) as Record<Eixo, number>;
  for (const tipo of new Set(COMPOSICAO_DA_JORNADA)) {
    const doTipo = catalogo.desafios.filter((d) => d.tipo === tipo);
    if (doTipo.length === 0) continue;
    const provas = COMPOSICAO_DA_JORNADA.filter((t) => t === tipo).length;
    for (const desafio of doTipo) {
      for (const lance of desafio.lances) {
        porDia[lance.eixo] += provas / doTipo.length;
      }
    }
  }
  return porDia;
}

/**
 * A chance de um lance passar, dada a soma da companhia no eixo e os bônus que
 * ela carrega. Enumera as duas fontes de acaso — a dificuldade que vai cair e o
 * dado — em vez de aproximar por fórmula: são poucas dezenas de combinações, e o
 * resultado exato custa menos que a desconfiança de um valor aproximado.
 */
export function chanceDePassar(soma: number, modificadores: number, faixa: Faixa): number {
  const x = soma + modificadores;
  const piso = Math.floor(x);
  const frac = x - piso;
  if (frac > 0) {
    const a = chanceDePassar(piso, 0, faixa);
    return a + (chanceDePassar(piso + 1, 0, faixa) - a) * frac;
  }
  let passou = 0;
  let total = 0;
  for (let dificuldade = faixa.min; dificuldade <= faixa.max; dificuldade++) {
    for (let dado = -(FACES_DO_DADO >> 1); dado <= FACES_DO_DADO >> 1; dado++) {
      total++;
      if (soma + modificadores + dado >= dificuldade) passou++;
    }
  }
  return passou / total;
}

/**
 * O que os traços da companhia somam a cada eixo, em média por lance.
 *
 * Um traço que só vale na prova de negociação não some da conta: rende o valor
 * dele em 3 dos 21 lances, e é isso que entra. Assim Duelista (+4 num eixo) e
 * Diplomata (+6 numa prova) ficam comparáveis sem nenhum peso arbitrário.
 *
 * Amuleto, Teimoso e Mártir não aparecem aqui: eles não somam ao lance, salvam
 * uma vida. Entram por `VALOR_DE_UMA_VIDA`, em separado.
 */
export function modificadoresPorEixo(party: Recrutado[]): Record<Eixo, number> {
  const base = sinergia(party).bonus;
  const por = Object.fromEntries(EIXOS.map((e) => [e, base])) as Record<Eixo, number>;
  const paraTodos = (valor: number) => EIXOS.forEach((e) => (por[e] += valor));

  for (const heroi of party) {
    const efeito = TRACOS[heroi.traco].efeito;
    switch (efeito.tipo) {
      case 'sempre':
        paraTodos(efeito.valor);
        break;
      case 'eixo':
        por[efeito.eixo] += efeito.valor;
        break;
      case 'prova': {
        const lances = LANCES_POR_TIPO[efeito.prova as TipoDesafio] ?? 0;
        paraTodos((efeito.valor * lances) / LANCES_DA_JORNADA);
        break;
      }
      case 'primeiro-lance':
      case 'ultimo-lance':
        // Um lance em cada três, em toda prova.
        paraTodos(efeito.valor / LANCES_POR_PROVA);
        break;
      case 'apos-baixa':
        paraTodos(efeito.valor * FRACAO_APOS_BAIXA);
        break;
    }
  }
  return por;
}

/** Quantos dos traços da companhia pagam em vida em vez de em soma. */
function tracosQueSalvam(party: Recrutado[]): number {
  return party.filter((h) => {
    const t = TRACOS[h.traco].efeito.tipo;
    return t === 'amuleto' || t === 'teimoso' || t === 'martir';
  }).length;
}

/**
 * Quantos dos 21 lances esta companhia deve passar.
 *
 * Durante o draft a party ainda está incompleta, e comparar uma soma de dois
 * heróis com a dificuldade de um lance não diz nada. A projeção resolve: a soma
 * parcial é esticada para os cinco lugares, como se os que faltam viessem no
 * mesmo formato. É a única forma de o valor das rodadas 1 a 4 estar na mesma
 * escala do valor da rodada 5.
 */
export function lancesEsperados(party: Recrutado[], faixa: Faixa): number {
  if (party.length === 0) return 0;
  const projecao = TAMANHO_PARTY / party.length;
  const mods = modificadoresPorEixo(party);
  const porEixo = LANCES_DA_JORNADA / EIXOS.length;

  const dosAtributos = EIXOS.reduce((total, eixo) => {
    const soma = somaDoGrupo(party, eixo) * projecao;
    return total + porEixo * chanceDePassar(soma, mods[eixo] * projecao, faixa);
  }, 0);

  return dosAtributos + tracosQueSalvam(party) * VALOR_DE_UMA_VIDA * projecao;
}
