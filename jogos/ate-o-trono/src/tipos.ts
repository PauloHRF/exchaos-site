/** Os cinco eixos, na ordem em que aparecem no pentágono (topo, horário). */
export type Eixo = 'vigor' | 'mobilidade' | 'carisma' | 'intelecto' | 'combate';

/** Etiquetas que um herói carrega — e que outros podem recusar. */
export type Etiqueta =
  | 'sacro'
  | 'magia-negra'
  | 'morto-vivo'
  | 'fora-da-lei'
  | 'realeza'
  | 'besta'
  | 'maquina'
  | 'mercenario';

export type TipoDesafio = 'combate' | 'negociacao' | 'enigma' | 'travessia' | 'trono';

/** O traço que o herói traz — o que ele faz de diferente, e o que ele cobra. */
export type TracoId =
  | 'comandante'
  | 'vanguarda'
  | 'retaguarda'
  | 'vinganca'
  | 'martir'
  | 'teimoso'
  | 'amuleto'
  | 'duelista'
  | 'batedor'
  | 'sentinela'
  | 'orador'
  | 'estudioso'
  | 'veterano'
  | 'diplomata'
  | 'andarilho'
  | 'decifrador';

/**
 * O que o traço faz. Todos valem mais ou menos o mesmo — perto de 4 pontos de
 * atributo —, mas cobram esse valor em momentos diferentes, e é daí que vem a
 * decisão de qual combina com a companhia que já está montada.
 */
export type EfeitoTraco =
  | { tipo: 'sempre'; valor: number }
  | { tipo: 'eixo'; eixo: Eixo; valor: number }
  | { tipo: 'prova'; prova: TipoDesafio; valor: number }
  | { tipo: 'primeiro-lance'; valor: number }
  | { tipo: 'ultimo-lance'; valor: number }
  | { tipo: 'apos-baixa'; valor: number }
  /** Uma vez na jornada, o pior resultado do dado vira zero. */
  | { tipo: 'amuleto' }
  /** Não tomba no primeiro fracasso grave que o atingiria. */
  | { tipo: 'teimoso' }
  /** Tomba no lugar de quem cairia, uma vez. */
  | { tipo: 'martir' };

export interface Traco {
  id: TracoId;
  nome: string;
  descricao: string;
  efeito: EfeitoTraco;
  /** Etiquetas que este traço não aceita na companhia. */
  recusaEtiquetas: Etiqueta[];
}

export interface Heroi {
  id: string;
  nome: string;
  /** Rótulo de sabor no card. Não tem efeito mecânico. */
  classe: string;
  /** De -3 (vilão) a +3 (santo). */
  moral: number;
  vigor: number;
  mobilidade: number;
  carisma: number;
  intelecto: number;
  combate: number;
  etiquetas: Etiqueta[];
  /** Não marcha ao lado de quem carrega estas etiquetas. */
  recusa: Etiqueta[];
  traco: TracoId;
}

/**
 * Um grupo de heróis da mesma origem. `nome` é o nome do **jogo** — é o que
 * aparece na tela, porque "Hyrule" não diz nada a quem não jogou e
 * "The Legend of Zelda" diz tudo. `id` continua sendo o agrupamento que a
 * sinergia usa.
 */
export interface Guilda {
  id: string;
  nome: string;
  era: string;
  herois: Heroi[];
}

export interface BaseDeHerois {
  versao: number;
  guildas: Guilda[];
}

export interface Recrutado extends Heroi {
  guildaId: string;
  /** O jogo de onde o herói veio, para mostrar na tela. */
  jogo: string;
}

/** Por que um candidato não pode entrar nesta party. */
export interface Recusa {
  motivo: 'moral' | 'etiqueta' | 'etiqueta-deles' | 'traco';
  texto: string;
}

/** Um lance é um momento do desafio: um eixo posto à prova. */
export interface Lance {
  /** O que está acontecendo, antes de saber quem age. */
  cena: string;
  eixo: Eixo;
  /** Na mesma escala da soma do grupo: 0 a 50. */
  dificuldade: number;
}

export interface Desafio {
  id: string;
  nome: string;
  tipo: TipoDesafio;
  abertura: string;
  /** Moral que o desafio favorece: 'luz', 'trevas' ou nada. */
  favorece?: 'luz' | 'trevas';
  lances: Lance[];
}

export interface CatalogoDesafios {
  versao: number;
  desafios: Desafio[];
}

/**
 * `custoso` é o lance que se vence pagando: o objetivo é cumprido e o
 * protagonista fica pelo caminho. Sem essa faixa, morrer só acontece quando se
 * perde feio — e aí quem é forte o bastante para vencer as sete etapas nunca
 * perde ninguém, o que faria chegar inteiro vir de graça.
 */
export type ResultadoLance = 'brilhante' | 'sucesso' | 'custoso' | 'falha' | 'grave';

export interface RelatoLance {
  numero: number;
  cena: string;
  eixo: Eixo;
  /** Quem a narração acompanha. Não entra na conta — o grupo é que resolve. */
  protagonista: Recrutado;
  resultado: ResultadoLance;
  somaDoGrupo: number;
  modificadores: number;
  dado: number;
  valor: number;
  dificuldade: number;
  margem: number;
  narracao: string;
  caido: Recrutado | null;
}

export type ResultadoEtapa = 'vitoria-limpa' | 'vitoria-custosa' | 'derrota' | 'nao-jogada';

export interface RelatoEtapa {
  numero: number;
  desafio: Desafio;
  lances: RelatoLance[];
  sucessos: number;
  resultado: ResultadoEtapa;
  caidos: Recrutado[];
}

export interface Campanha {
  etapas: RelatoEtapa[];
  vitorias: number;
  baixas: number;
  perfeita: boolean;
  moralDaParty: number;
}
