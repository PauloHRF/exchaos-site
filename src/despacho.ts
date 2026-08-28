/**
 * O motor de despacho.
 *
 * O jogo antigo mandava os cinco heróis a todas as sete provas e resolvia lance
 * a lance. Este resolve **forma contra forma**: a missão mostra o pentágono do
 * que exige, o jogador despacha 2 ou 3 da companhia, e a comparação entre os
 * dois pentágonos decide a missão inteira num só lance.
 *
 * As quatro decisões que dão forma a tudo aqui:
 *
 * - **O draft continua cego.** Os cinco são escolhidos antes de qualquer missão
 *   aparecer. O que passou a ser informado é o *despacho*, não a montagem — e é
 *   por isso que a medição que dizia "esconder a exigência do dia esconde uma
 *   armadilha, não a estratégia boa" continua valendo: ela era sobre o draft.
 *
 * - **O cansaço pesa, não tranca.** Foi a única forma de o despacho continuar
 *   sendo decisão: com cinco heróis e esquadrões de 2 ou 3, tirar de circulação
 *   quem acabou de trabalhar faz a escala se resolver sozinha — mandei 3 na
 *   primeira, sobram exatamente 2 para a segunda, e a partir daí a jornada
 *   inteira é forçada. Cansaço que desconta atributo mantém a escolha aberta:
 *   dá para insistir no time A e pagar por isso.
 *
 * - **Falhar não encerra.** Cada missão perdida sobe o pentágono do Rei
 *   Demônio. O erro vira dívida a administrar em vez de tela de fim, que é o
 *   que dá espaço para o despacho existir — num jogo de fim súbito, a primeira
 *   missão decidiria quase tudo.
 *
 * - **Sinergia e traços contam só entre os despachados.** É o que faz o draft
 *   conversar com o despacho: recrutar dois da mesma franquia só paga se você
 *   os mandar juntos.
 */
import {
  EIXOS,

  NARRACAO,
  PESO_MORAL_NO_DESAFIO,
  SINERGIA,
  TAMANHO_PARTY,
  TRACOS,
  rolarDado,
  type ChaveEpilogo,
} from './regras.ts';
import { hash, mulberry32 } from './rng.ts';
import type {
  Campanha,
  Desafio,
  Eixo,
  Recrutado,
  RelatoEtapa,
  RelatoLance,
  ResultadoLance,
} from './tipos.ts';

/* ---------------------------------------------------------------- os números */

/** Tamanhos de esquadrão que uma missão comum aceita. A final leva todo mundo. */
export const ESQUADRAO_MINIMO = 2;
export const ESQUADRAO_MAXIMO = 3;

/**
 * A escala do pentágono na tela: três heróis de 11 mais o que sinergia e traços
 * ainda somam. Fica fixa entre as missões porque é a comparação entre elas que
 * o jogador precisa fazer de relance.
 */
export const MAXIMO_DO_ESQUADRAO = 40;

/**
 * O catálogo de desafios foi escrito para a soma dos **cinco** heróis, que fica
 * perto de 32 por eixo. Um esquadrão de três chega a 25 no eixo que ele mira e
 * a uns 19 nos outros, então a exigência inteira desce por este fator em vez de
 * o catálogo ser reescrito. É um número de calibragem: `--varrer` mexe nele.
 */
export let FATOR_DA_EXIGENCIA = 0.57;

/** Só a calibragem mexe nisto; o jogo roda sempre com o valor acima. */
export function definirFatorDaExigencia(valor: number) {
  FATOR_DA_EXIGENCIA = valor;
}

/**
 * O quanto sobrar num eixo ainda conta. Sem teto, um pico enorme num eixo
 * cobriria um buraco noutro e a missão viraria soma bruta — exatamente o que o
 * `avaliar.ts` argumenta que não pode acontecer. Com teto, faltar dói mais do
 * que sobrar ajuda, que é a concavidade que o jogo precisa.
 */
export const TETO_DA_SOBRA = 4;

/** Cada ponto de cansaço desconta isto de cada atributo do herói. */
export let PESO_DO_CANSACO = 2;

/** So a calibragem mexe nisto. */
export function definirPesoDoCansaco(valor: number) {
  PESO_DO_CANSACO = valor;
}

/** Teto do cansaço: além disso o herói já não piora, só não melhora. */
export const CANSACO_MAXIMO = 5;

/** Ganho de cansaço de quem foi despachado, e alívio de quem ficou. */
export const CANSACO_POR_MISSAO = 1;
export const DESCANSO_POR_MISSAO = 1;

/** O quanto cada missão perdida engrossa o pentágono do Rei Demônio. */
export let TRONO_POR_FALHA = 2;

/** Só a calibragem mexe nisto. */
export function definirTronoPorFalha(valor: number) {
  TRONO_POR_FALHA = valor;
}

/**
 * As margens da missão.
 *
 * Não dá para reusar as de `TATICAS`: aquelas foram escritas para a margem de
 * **um lance**, e aqui a margem é a soma dos saldos dos eixos cobrados — três,
 * quase sempre. Com as antigas, falhar por 3 pontos no total já era fracasso
 * grave, e o jogador desatento morria em toda missão.
 *
 * **Não há mais três jogos de margem porque não há mais táticas.** Elas eram um
 * menu com resposta certa: medida a jornada inteira, a agressiva salvava o
 * mundo em 30,7% das vezes contra 5,9% da defensiva. Escolha em que uma opção
 * é cinco vezes melhor não é decisão, é pegadinha — e o despacho já pôs seis
 * decisões de verdade no lugar de uma falsa.
 *
 * Ao sumirem, sobrou o dial que elas gastavam: `IMUNE` e `DADO_FATAL` existiam
 * em três versões só para dar identidade a cada tática, e agora respondem
 * sozinhos por quanto "chegar inteiro" é alcançável.
 */
export const BRILHANTE = 8;
export const GRAVE = -12;

/**
 * Vitória com margem igual ou maior que esta não pode ser cobrada em vida.
 * É o número que decide se chegar inteiro é objetivo ou anomalia.
 */
export let IMUNE = 8;

/** Só a calibragem mexe nisto. */
export function definirImune(valor: number) {
  IMUNE = valor;
}

/**
 * O fracasso crítico: com o pior dado da missão neste valor, alguém fica pelo
 * caminho mesmo num lance vencido. Existe porque tudo o mais depende da força
 * do esquadrão — sem azar puro, quem é forte para vencer as sete nunca perde
 * ninguém, e chegar inteiro viria de graça.
 */
export const DADO_FATAL = -4;

/* ------------------------------------------------------------------- exigência */

export type Exigencia = Record<Eixo, number>;

const zerado = (): Exigencia =>
  Object.fromEntries(EIXOS.map((e) => [e, 0])) as Exigencia;

/**
 * O pentágono que a missão cobra.
 *
 * Sai dos três lances que o desafio já tinha escritos: cada lance era um eixo e
 * uma dificuldade, e é isso que vira espeto no pentágono. Os eixos que o
 * desafio não citava ficam em zero — e têm de ficar, porque o esquadrão mais
 * parelho que cabe numa party de cinco só chega a 17 no seu eixo mais fraco.
 * Missão que cobrasse os cinco eixos seria impossível por construção.
 */
export function exigenciaDaMissao(desafio: Desafio, etapa: number, falhas = 0): Exigencia {
  const exigencia = zerado();
  for (const lance of desafio.lances) {
    const valor = Math.round(lance.dificuldade * FATOR_DA_EXIGENCIA);
    if (valor > exigencia[lance.eixo]) exigencia[lance.eixo] = valor;
  }
  // O trono é a última etapa, e é onde as missões perdidas voltam para cobrar.
  if (desafio.tipo === 'trono' && falhas > 0) {
    for (const e of EIXOS) {
      if (exigencia[e] > 0) exigencia[e] += TRONO_POR_FALHA * falhas;
    }
  }
  // O degrau da etapa continua existindo: a mesma missão pesa mais no fim.
  const degrau = Math.round(etapa * 0.5);
  for (const e of EIXOS) if (exigencia[e] > 0) exigencia[e] += degrau;
  return exigencia;
}

/** Os eixos que a missão realmente cobra. Só eles entram na conta. */
export const eixosCobrados = (exigencia: Exigencia): Eixo[] =>
  EIXOS.filter((e) => exigencia[e] > 0);

/* --------------------------------------------------------------------- cansaço */

export type Cansaco = Record<string, number>;

/** O atributo que o herói ainda tem hoje, já descontado o cansaço. */
export function atributoEfetivo(heroi: Recrutado, eixo: Eixo, cansaco: Cansaco): number {
  return Math.max(0, heroi[eixo] - (cansaco[heroi.id] ?? 0) * PESO_DO_CANSACO);
}

export function somaDoEsquadrao(esquadrao: Recrutado[], eixo: Eixo, cansaco: Cansaco): number {
  return esquadrao.reduce((s, h) => s + atributoEfetivo(h, eixo, cansaco), 0);
}

/** Depois da missão: quem foi cansa, quem ficou respira. */
export function avancarCansaco(
  cansaco: Cansaco,
  vivos: Recrutado[],
  despachados: Recrutado[],
): Cansaco {
  const foi = new Set(despachados.map((h) => h.id));
  const proximo: Cansaco = { ...cansaco };
  for (const h of vivos) {
    const atual = proximo[h.id] ?? 0;
    proximo[h.id] = foi.has(h.id)
      ? Math.min(CANSACO_MAXIMO, atual + CANSACO_POR_MISSAO)
      : Math.max(0, atual - DESCANSO_POR_MISSAO);
  }
  return proximo;
}

/* -------------------------------------------------------------------- sinergia */

/**
 * A sinergia do esquadrão despachado — não da party inteira.
 *
 * O piso do lado murcho não cabe aqui: ele foi escrito para cinco heróis e uma
 * soma de 32 por eixo. No esquadrão o que faz as vezes dele é o teto da sobra,
 * que já pune buraco mais do que premia pico.
 */
export function sinergiaDoEsquadrao(esquadrao: Recrutado[]): { bonus: number; motivos: string[] } {
  const motivos: string[] = [];
  let bonus = 0;
  if (esquadrao.length === 0) return { bonus, motivos };

  const porGuilda = new Map<string, Recrutado[]>();
  for (const h of esquadrao) {
    const lista = porGuilda.get(h.guildaId) ?? [];
    lista.push(h);
    porGuilda.set(h.guildaId, lista);
  }
  for (const [, membros] of porGuilda) {
    if (membros.length >= 2) {
      bonus += SINERGIA.mesmaGuilda * (membros.length - 1);
      motivos.push(`${membros.length} de ${membros[0].jogo} já lutaram juntos`);
    }
  }

  const morais = esquadrao.map((h) => h.moral);
  if (Math.max(...morais) - Math.min(...morais) <= 1) {
    bonus += SINERGIA.coesaoMoral;
    motivos.push('gente que enxerga o mundo do mesmo jeito');
  }

  return { bonus, motivos };
}

/* ---------------------------------------------------------------------- traços */

export interface ContextoDaMissao {
  prova: Desafio['tipo'];
  numero: number;
  totalDeMissoes: number;
  houveBaixa: boolean;
}

/**
 * O que os traços do **esquadrão** somam a cada eixo cobrado.
 *
 * Dois traços mudaram de significado ao a prova deixar de ter três lances:
 * Vanguarda e Retaguarda passaram do primeiro e do último lance para as
 * primeiras e as últimas missões da jornada. É a leitura que sobrevive à
 * resolução de cena única, e a que mantém os dois valendo perto do que valiam.
 */
export function bonusDosTracosNaMissao(
  esquadrao: Recrutado[],
  ctx: ContextoDaMissao,
): { porEixo: Record<Eixo, number>; nomes: string[] } {
  const porEixo = zerado() as Record<Eixo, number>;
  const nomes: string[] = [];
  const paraTodos = (v: number) => EIXOS.forEach((e) => (porEixo[e] += v));

  for (const heroi of esquadrao) {
    const traco = TRACOS[heroi.traco];
    const e = traco.efeito;
    let usou = true;

    if (e.tipo === 'sempre') paraTodos(e.valor);
    else if (e.tipo === 'eixo') porEixo[e.eixo] += e.valor;
    else if (e.tipo === 'prova' && e.prova === ctx.prova) paraTodos(e.valor);
    else if (e.tipo === 'primeiro-lance' && ctx.numero <= 2) paraTodos(e.valor);
    else if (e.tipo === 'ultimo-lance' && ctx.numero >= ctx.totalDeMissoes - 1) paraTodos(e.valor);
    else if (e.tipo === 'apos-baixa' && ctx.houveBaixa) paraTodos(e.valor);
    else usou = false;

    if (usou) nomes.push(traco.nome);
  }

  return { porEixo, nomes };
}

/* -------------------------------------------------------------------- resolução */

export interface RelatoMissao {
  numero: number;
  desafio: Desafio;
  esquadrao: Recrutado[];
  exigencia: Exigencia;
  /** O que o esquadrão pôs em cada eixo, já com cansaço e modificadores. */
  somas: Record<Eixo, number>;
  /** Sobra (com teto) ou falta em cada eixo cobrado. É o que a bolinha desenha. */
  saldos: Record<Eixo, number>;
  /** Onde o esquadrão ficou mais devendo. É quem a narração acompanha. */
  eixoCritico: Eixo;
  margem: number;
  /** O dado que caiu em cada eixo cobrado. É o que a bolinha anima. */
  dados: Record<Eixo, number>;
  /** O pior deles: é o que a tática confere para o fracasso crítico. */
  dado: number;
  modificadores: number;
  resultado: ResultadoLance;
  protagonista: Recrutado;
  narracao: string;
  caido: Recrutado | null;
  venceu: boolean;
}

/**
 * A mesma classificação do motor antigo: a vitória custosa existe para que
 * chegar inteiro não venha de graça junto com chegar ao trono.
 */
function classificar(margem: number, dado: number): ResultadoLance {
  if (margem >= 0) {
    // O azar é conferido antes da folga: é a margem imune, e não o brilho da
    // missão, que decide quem está protegido.
    if (dado <= DADO_FATAL && margem < IMUNE) return 'custoso';
    return margem >= BRILHANTE ? 'brilhante' : 'sucesso';
  }
  if (margem > GRAVE) return 'falha';
  return 'grave';
}

function bonusMoral(desafio: Desafio, media: number): number {
  if (!desafio.favorece) return 0;
  const sinal = desafio.favorece === 'trevas' ? -1 : 1;
  return Math.round(PESO_MORAL_NO_DESAFIO * sinal * media);
}

/**
 * Quem a narração acompanha: sorteado dentro do esquadrão, com peso pelo eixo
 * que decidiu a missão. O atributo dele não entra na conta — o esquadrão é que
 * resolve —, mas quem é bom naquilo tende a ser quem aparece.
 */
function sortearProtagonista(rnd: () => number, esquadrao: Recrutado[], eixo: Eixo): Recrutado {
  const pesos = esquadrao.map((h) => Math.pow(Math.max(h[eixo], 1), 2));
  const total = pesos.reduce((a, b) => a + b, 0);
  let alvo = rnd() * total;
  for (let i = 0; i < esquadrao.length; i++) {
    alvo -= pesos[i];
    if (alvo <= 0) return esquadrao[i];
  }
  return esquadrao[esquadrao.length - 1];
}

export interface EntradaDaMissao {
  esquadrao: Recrutado[];
  desafio: Desafio;
  exigencia: Exigencia;
  cansaco: Cansaco;
  moralDaParty: number;
  ctx: ContextoDaMissao;
}

/**
 * A conta da missão, sem nenhum acaso: é o que a interface mostra **antes** de
 * o jogador confirmar o despacho, e é o que o avaliador usa para comparar
 * esquadrões. Separada de `resolverMissao` justamente para que as duas nunca
 * possam discordar.
 */
export function contaDaMissao(
  entrada: EntradaDaMissao,
  dados: Partial<Record<Eixo, number>> = {},
): {
  somas: Record<Eixo, number>;
  saldos: Record<Eixo, number>;
  margemSemDado: number;
  margem: number;
  modificadores: number;
  eixoCritico: Eixo;
} {
  const { esquadrao, exigencia, cansaco, moralDaParty, ctx, desafio } = entrada;
  const cobrados = eixosCobrados(exigencia);

  const dosTracos = bonusDosTracosNaMissao(esquadrao, ctx);
  /**
   * O que a companhia e, eixo a eixo. A tatica **nao** entra aqui: ela e
   * postura de risco, nao capacidade, e somada a cada eixo cobrado viraria +/-12
   * de margem, mais do que todo o resto junto. Com ela por eixo a equilibrada
   * salvava o mundo em 1,3% das jornadas e a defensiva em 0,0% -- e a defensiva
   * ainda perdia mais gente que a agressiva, por perder missao demais.
   */
  const base = sinergiaDoEsquadrao(esquadrao).bonus + bonusMoral(desafio, moralDaParty);

  const somas = zerado() as Record<Eixo, number>;
  const saldos = zerado() as Record<Eixo, number>;
  let margemSemDado = 0;
  for (const e of cobrados) {
    somas[e] = somaDoEsquadrao(esquadrao, e, cansaco) + base + dosTracos.porEixo[e];
    // O dado entra **antes** do teto: sorte num eixo que ja estava folgado e
    // desperdicada. E o que faz o esquadrao bem montado ser mais previsivel que
    // o mal montado, em vez de so mais forte.
    saldos[e] = Math.min(somas[e] + (dados[e] ?? 0) - exigencia[e], TETO_DA_SOBRA);
    margemSemDado += Math.min(somas[e] - exigencia[e], TETO_DA_SOBRA);
  }

  const margem = cobrados.reduce((s, e) => s + saldos[e], 0);
  const eixoCritico = cobrados.reduce((pior, e) => (saldos[e] < saldos[pior] ? e : pior), cobrados[0]);

  return { somas, saldos, margemSemDado, margem, modificadores: base, eixoCritico };
}

export function resolverMissao(
  entrada: EntradaDaMissao,
  rnd: () => number,
  frasesUsadas: Set<string>,
  amuletoDisponivel: boolean,
): { relato: RelatoMissao; amuletoGasto: boolean } {
  const cobrados = eixosCobrados(entrada.exigencia);

  /**
   * Um dado por eixo cobrado, não um pela missão inteira.
   *
   * Com um dado só, a missão virava quase determinística — a soma de três
   * saldos contra um acaso de ±4 — e a calibragem caía de um penhasco: um ponto
   * de dificuldade mexia três de margem. Três dados somados dão uma curva de
   * sino: o resultado de costume é o esperado, e o desastre existe sem ser
   * rotina. É também o que a bolinha desenha, visitando cada espeto.
   */
  const dados = Object.fromEntries(cobrados.map((e) => [e, rolarDado(rnd)])) as Record<Eixo, number>;

  // O Amuleto queima uma carga para transformar o pior dado da missão em zero.
  let amuletoGasto = false;
  const amuleto = entrada.esquadrao.find((h) => h.traco === 'amuleto');
  if (amuleto && amuletoDisponivel) {
    const pior = cobrados.reduce((a, e) => (dados[e] < dados[a] ? e : a), cobrados[0]);
    if (dados[pior] === -4) {
      dados[pior] = 0;
      amuletoGasto = true;
    }
  }

  const conta = contaDaMissao(entrada, dados);
  const margem = conta.margem;
  /** O azar que a tática confere é o pior dado da missão. */
  const dado = cobrados.reduce((pior, e) => Math.min(pior, dados[e]), 4);
  const resultado = classificar(margem, dado);
  const protagonista = sortearProtagonista(rnd, entrada.esquadrao, conta.eixoCritico);

  const variantes = NARRACAO[conta.eixoCritico][resultado];
  const inedita = variantes.filter((v) => !frasesUsadas.has(v));
  const pool = inedita.length > 0 ? inedita : variantes;
  const frase = pool[Math.floor(rnd() * pool.length)];
  frasesUsadas.add(frase);

  return {
    relato: {
      numero: entrada.ctx.numero,
      desafio: entrada.desafio,
      esquadrao: entrada.esquadrao,
      exigencia: entrada.exigencia,
      somas: conta.somas,
      saldos: conta.saldos,
      eixoCritico: conta.eixoCritico,
      margem,
      dados,
      dado,
      modificadores: conta.modificadores,
      resultado,
      protagonista,
      narracao: frase.replaceAll('{h}', protagonista.nome),
      caido: null,
      venceu: resultado !== 'falha' && resultado !== 'grave',
    },
    amuletoGasto,
  };
}

/* ------------------------------------------------------------------ as baixas */

/**
 * As cargas que se gastam **uma vez por jornada**. Ficam num objeto só porque
 * quem conduz a jornada — o simulador ou a interface — precisa carregá-las de
 * missão em missão, e três variáveis soltas viram três oportunidades de
 * esquecer uma.
 */
export interface Cargas {
  amuletoDisponivel: boolean;
  martirGasto: boolean;
  teimosoUsado: Set<string>;
}

export const cargasNovas = (): Cargas => ({
  amuletoDisponivel: true,
  martirGasto: false,
  teimosoUsado: new Set(),
});

/**
 * Quem realmente tomba quando a missão cobra uma vida, e a anotação no relato.
 *
 * Mora aqui, e não no laço da jornada, porque há dois laços: o simulador do
 * `despachar.ts` e a interface, que avança missão a missão conforme o jogador
 * clica. Enquanto esta regra viveu dentro do `simularJornada`, a interface
 * rodava sem ela — sete fracassos graves e a companhia inteira voltava viva.
 *
 * Devolve quem caiu, ou `null` quando ninguém cai.
 */
export function cobrarBaixa(
  relato: RelatoMissao,
  vivos: Recrutado[],
  cargas: Cargas,
): Recrutado | null {
  if (relato.resultado !== 'grave' && relato.resultado !== 'custoso') return null;

  const alvo = relato.protagonista;
  // O Teimoso escapa da primeira vez que seria atingido.
  if (alvo.traco === 'teimoso' && !cargas.teimosoUsado.has(alvo.id)) {
    cargas.teimosoUsado.add(alvo.id);
    return null;
  }
  // O Mártir toma o lugar de outro, uma vez.
  const martir = vivos.find((h) => h.traco === 'martir' && h.id !== alvo.id);
  const caido = martir && !cargas.martirGasto ? ((cargas.martirGasto = true), martir) : alvo;

  relato.caido = caido;
  return caido;
}

/* ---------------------------------------------------------------------- jornada */

/**
 * Quem o jogador (ou o jogador sintético) manda. Recebe tudo o que a interface
 * mostra e nada além disso — é a assinatura que garante que um jogador
 * sintético não enxerga mais do que uma pessoa enxergaria.
 */
export type Politica = (estado: {
  vivos: Recrutado[];
  cansaco: Cansaco;
  desafio: Desafio;
  exigencia: Exigencia;
  ctx: ContextoDaMissao;
  moralDaParty: number;
}) => Recrutado[];

export interface JornadaDespachada {
  relatos: RelatoMissao[];
  vitorias: number;
  falhas: number;
  baixas: number;
  salvou: boolean;
  /** Venceu as sete e nao perdeu ninguem. O feito raro. */
  perfeita: boolean;
  /** Salvou o mundo sem perder ninguem, mesmo tendo falhado missoes no meio. */
  salvouInteiro: boolean;
  sobreviventes: Recrutado[];
}

/** Todos os esquadrões de 2 e de 3 que dá para formar com quem está de pé. */
export function esquadroesPossiveis(vivos: Recrutado[]): Recrutado[][] {
  const saida: Recrutado[][] = [];
  const combinar = (inicio: number, atual: Recrutado[]) => {
    if (atual.length >= ESQUADRAO_MINIMO && atual.length <= ESQUADRAO_MAXIMO) {
      saida.push(atual.slice());
    }
    if (atual.length === ESQUADRAO_MAXIMO) return;
    for (let i = inicio; i < vivos.length; i++) {
      atual.push(vivos[i]);
      combinar(i + 1, atual);
      atual.pop();
    }
  };
  combinar(0, []);
  return saida;
}

export function simularJornada(
  party: Recrutado[],
  dia: string,
  jornada: Desafio[],
  politica: Politica,
): JornadaDespachada {
  const rnd = mulberry32(hash(`despacho:${dia}:${party.map((h) => h.id).join(',')}`));
  const media = party.reduce((s, h) => s + h.moral, 0) / party.length;
  const frasesUsadas = new Set<string>();

  let vivos = party.slice();
  let cansaco: Cansaco = Object.fromEntries(party.map((h) => [h.id, 0]));
  const cargas = cargasNovas();

  const relatos: RelatoMissao[] = [];
  let vitorias = 0;
  let falhas = 0;
  let baixas = 0;

  jornada.forEach((desafio, indice) => {
    const numero = indice + 1;
    const ultima = numero === jornada.length;
    // Sem gente de pé não há missão: a jornada segue registrando as derrotas.
    if (vivos.length < (ultima ? 1 : ESQUADRAO_MINIMO)) {
      falhas++;
      return;
    }

    const exigencia = exigenciaDaMissao(desafio, indice, falhas);
    const ctx: ContextoDaMissao = {
      prova: desafio.tipo,
      numero,
      totalDeMissoes: jornada.length,
      houveBaixa: vivos.length < party.length,
    };

    // A última leva todo mundo que sobrou; nas outras, quem a política mandar.
    const esquadrao = ultima
      ? vivos.slice()
      : politica({ vivos, cansaco, desafio, exigencia, ctx, moralDaParty: media });

    const { relato, amuletoGasto } = resolverMissao(
      { esquadrao, desafio, exigencia, cansaco, moralDaParty: media, ctx },
      rnd,
      frasesUsadas,
      cargas.amuletoDisponivel,
    );
    if (amuletoGasto) cargas.amuletoDisponivel = false;

    const caido = cobrarBaixa(relato, vivos, cargas);
    if (caido) {
      vivos = vivos.filter((h) => h.id !== caido.id);
      baixas++;
    }

    if (relato.venceu) vitorias++;
    else falhas++;

    cansaco = avancarCansaco(cansaco, vivos, esquadrao);
    relatos.push(relato);
  });

  const salvou = relatos.length === jornada.length && relatos[relatos.length - 1].venceu;

  return {
    relatos,
    vitorias,
    falhas,
    baixas,
    salvou,
    perfeita: baixas === 0 && falhas === 0,
    salvouInteiro: salvou && baixas === 0,
    sobreviventes: vivos,
  };
}

/* ------------------------------------------------------- ponte com o antigo */

/**
 * A jornada de despacho na forma de `Campanha`.
 *
 * Existe para o epílogo, o texto de compartilhamento e o cartão continuarem
 * valendo sem reescrita: os três leem `Campanha`, e uma missão encaixa nela
 * como uma etapa de **um lance só** — o do eixo que decidiu a missão. Não é
 * remendo, é a mesma informação noutra forma: onde a prova antiga tinha três
 * lances, esta tem um, e todo campo tem origem exata no relato.
 */
export function comoCampanha(
  relatos: RelatoMissao[],
  party: Recrutado[],
  jornada: Desafio[],
): Campanha {
  const etapas: RelatoEtapa[] = jornada.map((desafio, i) => {
    const r = relatos[i];
    if (!r) {
      return { numero: i + 1, desafio, lances: [], sucessos: 0, resultado: 'nao-jogada', caidos: [] };
    }
    const eixo = r.eixoCritico;
    const lance: RelatoLance = {
      numero: 1,
      cena: desafio.abertura,
      eixo,
      protagonista: r.protagonista,
      resultado: r.resultado,
      somaDoGrupo: r.somas[eixo],
      modificadores: r.modificadores,
      dado: r.dados[eixo] ?? 0,
      valor: r.somas[eixo] + (r.dados[eixo] ?? 0),
      dificuldade: r.exigencia[eixo],
      margem: r.margem,
      narracao: r.narracao,
      caido: r.caido,
    };
    return {
      numero: i + 1,
      desafio,
      lances: [lance],
      sucessos: r.venceu ? 1 : 0,
      resultado: r.venceu ? (r.caido ? 'vitoria-custosa' : 'vitoria-limpa') : 'derrota',
      caidos: r.caido ? [r.caido] : [],
    };
  });

  const baixas = relatos.filter((r) => r.caido).length;
  const vitorias = relatos.filter((r) => r.venceu).length;
  return {
    etapas,
    vitorias,
    baixas,
    perfeita: baixas === 0 && vitorias === jornada.length,
    moralDaParty: party.reduce((s, h) => s + h.moral, 0) / party.length,
  };
}

/**
 * Qual epílogo esta jornada merece.
 *
 * As chaves antigas supunham fim súbito — `quase-la`, `meio-caminho` e
 * `jornada-curta` descreviam *onde a estrada parou*, e aqui ela nunca para: a
 * companhia sempre chega ao sétimo. O que passou a existir no lugar delas é o
 * fim que o modelo antigo não conseguia produzir, `salvou-inteiro`: o trono
 * caiu, ninguém morreu, e ainda assim missões ficaram para trás.
 */
export function chaveDoEpilogo(campanha: Campanha, total: number): ChaveEpilogo {
  const venceuTrono = campanha.etapas[total - 1]?.resultado !== 'derrota'
    && campanha.etapas[total - 1]?.resultado !== 'nao-jogada';
  if (!venceuTrono) return campanha.baixas >= TAMANHO_PARTY ? 'dizimada' : 'caiu-no-trono';
  if (campanha.perfeita) return 'perfeita';
  if (campanha.baixas === 0) return 'salvou-inteiro';
  return campanha.baixas === 1 ? 'salvou-com-uma-baixa' : 'salvou-com-baixas';
}
