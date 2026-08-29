import type {
  Eixo,
  Etiqueta,
  ResultadoLance,
  Tatica,
  TipoDesafio,
  Traco,
  TracoId,
} from './tipos.ts';

export const TAMANHO_PARTY = 5;
export const CANDIDATOS_POR_RODADA = 4;
export const ETAPAS = 7;

/** Escala dos atributos: 0 a 10 por herói, logo 0 a 50 somando a party. */
export const MAXIMO_POR_HEROI = 11;
export const MAXIMO_DA_PARTY = TAMANHO_PARTY * MAXIMO_POR_HEROI;

/** Distância moral máxima que um herói tolera dentro da própria party. */
export const TOLERANCIA_MORAL = 3;

/** Ordem do pentágono: topo e depois no sentido horário. */
export const EIXOS: Eixo[] = ['vigor', 'mobilidade', 'carisma', 'intelecto', 'combate'];

export const ROTULO_EIXO: Record<Eixo, string> = {
  vigor: 'Vigor',
  mobilidade: 'Mobilidade',
  carisma: 'Carisma',
  intelecto: 'Intelecto',
  combate: 'Combate',
};

export const ICONE_EIXO: Record<Eixo, string> = {
  vigor: '🛡️',
  mobilidade: '🏃',
  carisma: '💬',
  intelecto: '🧠',
  combate: '⚔️',
};

export const ROTULO_ETIQUETA: Record<Etiqueta, string> = {
  sacro: 'sacro',
  'magia-negra': 'magia negra',
  'morto-vivo': 'morto-vivo',
  'fora-da-lei': 'fora da lei',
  realeza: 'realeza',
  besta: 'besta',
  maquina: 'máquina',
  mercenario: 'mercenário',
};

export const ROTULO_TIPO: Record<TipoDesafio, string> = {
  combate: 'Combate',
  negociacao: 'Negociação',
  enigma: 'Enigma',
  travessia: 'Travessia',
  trono: 'Rei Demônio',
};

export const ICONE_TIPO: Record<TipoDesafio, string> = {
  combate: '⚔️',
  negociacao: '🗣️',
  enigma: '🗝️',
  travessia: '🏔️',
  trono: '👑',
};

/**
 * O dado do lance: −4 a +4, todos os nove resultados igualmente prováveis.
 * Numa escala em que o grupo chega a 50, isso vira lances que estavam no fio,
 * mas não salva party mal montada.
 */
export const FACES_DO_DADO = 9;
export const rolarDado = (rnd: () => number) => Math.floor(rnd() * FACES_DO_DADO) - 4;

/**
 * Os traços.
 *
 * Cada herói carrega um. Valem todos por volta de 4 pontos de atributo, mas
 * cobram esse valor em momentos diferentes — e é essa diferença que dá decisão
 * ao draft sem o jogador precisar saber o que o dia vai pedir: a estratégia
 * nasce de dentro da companhia, não do encaixe com a jornada.
 *
 * **Todo traço é único na companhia.** Só há um comandante, um mártir, um
 * duelista — é a exigência que o próprio traço traz, e ela resolve de brinde o
 * problema de empilhar o mesmo efeito cinco vezes.
 */
export const TRACOS: Record<TracoId, Traco> = {
  comandante: {
    id: 'comandante',
    nome: 'Comandante',
    descricao: '+2 em todo lance da companhia.',
    efeito: { tipo: 'sempre', valor: 2 },
    recusaEtiquetas: [],
  },
  vanguarda: {
    id: 'vanguarda',
    nome: 'Vanguarda',
    descricao: '+5 no primeiro lance de cada prova.',
    efeito: { tipo: 'primeiro-lance', valor: 5 },
    recusaEtiquetas: [],
  },
  retaguarda: {
    id: 'retaguarda',
    nome: 'Retaguarda',
    descricao: '+5 no último lance de cada prova.',
    efeito: { tipo: 'ultimo-lance', valor: 5 },
    recusaEtiquetas: [],
  },
  vinganca: {
    id: 'vinganca',
    nome: 'Vingança',
    descricao: '+5 em todo lance depois que alguém da companhia cai.',
    efeito: { tipo: 'apos-baixa', valor: 5 },
    recusaEtiquetas: ['sacro'],
  },
  martir: {
    id: 'martir',
    nome: 'Mártir',
    descricao: 'Uma vez, tomba no lugar de quem cairia.',
    efeito: { tipo: 'martir' },
    recusaEtiquetas: [],
  },
  teimoso: {
    id: 'teimoso',
    nome: 'Teimoso',
    descricao: 'Não tomba no primeiro fracasso grave que o atingir.',
    efeito: { tipo: 'teimoso' },
    recusaEtiquetas: [],
  },
  amuleto: {
    id: 'amuleto',
    nome: 'Amuleto',
    descricao: 'Uma vez na jornada, o pior resultado do dado vira zero.',
    efeito: { tipo: 'amuleto' },
    recusaEtiquetas: ['magia-negra'],
  },
  duelista: {
    id: 'duelista',
    nome: 'Duelista',
    descricao: '+4 nos lances de Combate.',
    efeito: { tipo: 'eixo', eixo: 'combate', valor: 4 },
    recusaEtiquetas: [],
  },
  batedor: {
    id: 'batedor',
    nome: 'Batedor',
    descricao: '+4 nos lances de Mobilidade.',
    efeito: { tipo: 'eixo', eixo: 'mobilidade', valor: 4 },
    recusaEtiquetas: [],
  },
  sentinela: {
    id: 'sentinela',
    nome: 'Sentinela',
    descricao: '+4 nos lances de Vigor.',
    efeito: { tipo: 'eixo', eixo: 'vigor', valor: 4 },
    recusaEtiquetas: [],
  },
  orador: {
    id: 'orador',
    nome: 'Orador',
    descricao: '+4 nos lances de Carisma.',
    efeito: { tipo: 'eixo', eixo: 'carisma', valor: 4 },
    recusaEtiquetas: ['besta'],
  },
  estudioso: {
    id: 'estudioso',
    nome: 'Estudioso',
    descricao: '+4 nos lances de Intelecto.',
    efeito: { tipo: 'eixo', eixo: 'intelecto', valor: 4 },
    recusaEtiquetas: [],
  },
  veterano: {
    id: 'veterano',
    nome: 'Veterano',
    descricao: '+5 em toda prova de combate.',
    efeito: { tipo: 'prova', prova: 'combate', valor: 5 },
    recusaEtiquetas: [],
  },
  diplomata: {
    id: 'diplomata',
    nome: 'Diplomata',
    descricao: '+6 na prova de negociação.',
    efeito: { tipo: 'prova', prova: 'negociacao', valor: 6 },
    recusaEtiquetas: ['fora-da-lei'],
  },
  andarilho: {
    id: 'andarilho',
    nome: 'Andarilho',
    descricao: '+6 na prova de travessia.',
    efeito: { tipo: 'prova', prova: 'travessia', valor: 6 },
    recusaEtiquetas: ['realeza'],
  },
  decifrador: {
    id: 'decifrador',
    nome: 'Decifrador',
    descricao: '+6 na prova de enigma.',
    efeito: { tipo: 'prova', prova: 'enigma', valor: 6 },
    recusaEtiquetas: [],
  },
};

/**
 * Margem acima da qual o lance sai brilhante — e, por ser folgado demais, fica
 * imune ao fracasso crítico. Quanto mais baixa, mais lances ficam protegidos
 * do azar e mais a jornada sem baixas vem de brinde junto com as sete vitórias.
 */
export const MARGEM_BRILHANTE = 10;

/**
 * Tudo é somado, nada é multiplicado: nesta escala um multiplicador vira
 * número quebrado e o jogador perde a conta de cabeça.
 *
 * Três regras governam as baixas, e é aí que mora o dilema:
 *
 * - `dadoFatal` é o fracasso crítico: com o dado nesse valor ou abaixo, alguém
 *   fica pelo caminho mesmo que o lance seja vencido. É azar puro, e existe
 *   justamente porque tudo o mais no modelo depende da força da party — sem
 *   isso, quem é forte o bastante para vencer as sete etapas nunca perde
 *   ninguém, e chegar inteiro viria de graça junto com chegar ao trono.
 * - `margemImune` protege as vitórias folgadas desse azar. É o que dá à
 *   defensiva o nicho de perder pouca gente sem torná-la imortal — porque
 *   tática imune a azar chega inteira, por construção, sempre que chega ao fim.
 * - `margemGrave` é o quanto se pode falhar antes de perder alguém.
 */
export const TATICAS: Record<
  Tatica,
  {
    nome: string;
    descricao: string;
    bonus: number;
    dadoFatal: number;
    /** Vitória com margem igual ou maior que esta não pode ser cobrada em vida. */
    margemImune: number;
    margemGrave: number;
  }
> = {
  agressiva: {
    nome: 'Agressiva',
    descricao: '+4 em todo lance, e vence muito mais. Só que o pior dado cobra uma vida mesmo numa vitória folgada.',
    bonus: 4,
    dadoFatal: -4,
    margemImune: 99,
    margemGrave: -2,
  },
  equilibrada: {
    nome: 'Equilibrada',
    descricao: 'Sem bônus e sem desconto. O pior dado cobra uma vida, a não ser que a vitória tenha sido folgada.',
    bonus: 0,
    dadoFatal: -4,
    margemImune: MARGEM_BRILHANTE,
    margemGrave: -5,
  },
  defensiva: {
    nome: 'Defensiva',
    descricao: '−4 em todo lance, e vence bem menos. Em troca, só perde gente quando passa raspando.',
    bonus: -4,
    dadoFatal: -4,
    margemImune: 3,
    margemGrave: -9,
  },
};

/** Composição fixa da jornada: quatro combates (contando o trono) e três provas. */
export const COMPOSICAO_DA_JORNADA: TipoDesafio[] = [
  'combate',
  'negociacao',
  'combate',
  'enigma',
  'combate',
  'travessia',
  'trono',
];

/**
 * Os desafios são escritos com dificuldade neutra; a posição na jornada soma
 * o degrau. Assim o mesmo catálogo serve para a 1ª e para a 6ª etapa, e a
 * conta continua sendo de cabeça.
 */
export const DEGRAU_DA_ETAPA = [-4, -3, -2, -1, 0, 1, 2];

/** Quanto a moral média da party soma num desafio que favorece um lado. */
export const PESO_MORAL_NO_DESAFIO = 1;

/**
 * O luto: cada herói caído dá isto de bônus a quem sobrou. Sem esse
 * amortecedor, perder alguém derruba a soma do grupo e a party não volta mais
 * a vencer — e aí toda jornada de sete vitórias acaba sendo, por construção,
 * uma jornada sem baixas. É o que separa chegar de chegar inteiro.
 */
export const BONUS_POR_CAIDO = 2;

export const SINERGIA = {
  /** Por herói extra da mesma guilda. */
  mesmaGuilda: 1,
  /** Party com amplitude moral de até 1 ponto: gente que se entende. */
  coesaoMoral: 2,
  /** Nenhum eixo da party abaixo deste total: ninguém tem um lado murcho. */
  semLadoMurcho: 2,
  pisoDoLadoMurcho: 25,
};

/**
 * Frases de desfecho por eixo e resultado. Duas variantes cada, escolhidas
 * pela seed — o suficiente para não parecer repetição na mesma campanha.
 * `{h}` vira o nome do protagonista.
 *
 * As frases são escritas sem adjetivo nem particípio concordando com {h}: o
 * roster tem heróis dos dois gêneros e não carrega essa informação, então
 * "abre caminho" serve para todo mundo e "abre caminho sozinho" não serve.
 */
export const NARRACAO: Record<Eixo, Record<ResultadoLance, string[]>> = {
  combate: {
    brilhante: [
      '{h} abre caminho, e ninguém precisa cobrir.',
      '{h} termina antes de o resto sacar a arma.',
      'Quando a poeira assenta, só {h} continua de pé no meio.',
      '{h} não dá o segundo golpe. Não precisou.',
      'O inimigo recua só de ver {h} avançar.',
    ],
    sucesso: [
      '{h} segura a linha até a pressão ceder.',
      '{h} troca golpe por golpe e sai por cima.',
      '{h} apanha o quanto precisa e devolve um pouco mais.',
      'Custou três tentativas, e na terceira {h} derruba.',
      '{h} vence sem elegância nenhuma. Vence.',
    ],
    custoso: [
      '{h} derruba o último e cai junto.',
      '{h} abre a brecha com o próprio corpo. Os outros passam.',
      'O caminho fica livre. {h} fica no caminho.',
      '{h} troca a própria vida pelo avanço, e o avanço acontece.',
      'A última coisa que {h} faz é garantir que deu certo.',
    ],
    falha: [
      '{h} recua sangrando, e a linha cede junto.',
      '{h} erra o tempo do golpe e paga caro.',
      'A guarda de {h} abre, e o resto vai atrás.',
      '{h} volta ao ponto de partida, agora com pressa.',
      'Não havia o que fazer daquele ângulo, e {h} tentou mesmo assim.',
    ],
    grave: [
      '{h} cobre a retirada dos outros e não volta.',
      '{h} cai antes de conseguir gritar.',
      'Ninguém vê o golpe que acerta {h}.',
      'A linha cede, e {h} cede com ela.',
      '{h} não larga a arma. Larga o resto.',
    ],
  },
  intelecto: {
    brilhante: [
      '{h} enxerga a saída antes de haver problema.',
      '{h} desmonta a coisa toda como quem desata um nó.',
      'O que era enigma vira instrução, na voz de {h}.',
      '{h} responde antes de a pergunta terminar.',
      'Faltava uma peça. {h} sabia qual, e onde.',
    ],
    sucesso: [
      '{h} acha a brecha na terceira tentativa.',
      '{h} entende o truque a tempo.',
      '{h} erra duas vezes e acerta na que importava.',
      'A conta de {h} fecha por pouco, e fechar é o que interessa.',
      '{h} lê o que estava nas entrelinhas, com esforço.',
    ],
    custoso: [
      '{h} acerta a resposta tarde demais para si.',
      '{h} resolve o problema, e não sai da sala.',
      'A saída aparece. {h} fica para segurar a porta.',
      '{h} entende tudo, inclusive o que ia acontecer consigo.',
      'O enigma cede, e cobra {h} como pagamento.',
    ],
    falha: [
      '{h} lê errado o que tinha diante dos olhos.',
      '{h} cai no engano óbvio.',
      '{h} segue a pista falsa até o fim dela.',
      'A resposta de {h} faz todo o sentido, e está errada.',
      '{h} pensa demais, e o tempo era o problema.',
    ],
    grave: [
      '{h} erra o cálculo, e não há segunda chance.',
      '{h} descobre como aquilo funciona do jeito ruim.',
      'A armadilha estava exatamente onde {h} não olhou.',
      '{h} testa a hipótese com o próprio corpo.',
      'A última dedução de {h} estava certa, e chegou tarde.',
    ],
  },
  carisma: {
    brilhante: [
      '{h} fala, e a sala inteira muda de ideia.',
      '{h} consegue mais do que a companhia tinha vindo pedir.',
      'Ninguém lembra do que {h} disse. Todos lembram que concordaram.',
      '{h} não pede nada: deixa que ofereçam.',
      'A palavra de {h} vale mais que o papel que assinam.',
    ],
    sucesso: [
      '{h} arranca o acordo no fio.',
      '{h} convence quem não queria ser convencido.',
      '{h} cede no pouco para levar o muito.',
      'Custa três concessões, e {h} paga sem reclamar.',
      '{h} fala o suficiente, e cala na hora certa.',
    ],
    custoso: [
      '{h} fecha o acordo, e o preço do acordo é {h}.',
      '{h} convence todo mundo a sair. Menos {h}.',
      'A palavra dada por {h} vale uma vida. A de {h}.',
      '{h} assina embaixo sabendo o que estava assinando.',
      'O trato se cumpre. A parte de {h} era ficar.',
    ],
    falha: [
      '{h} escolhe a palavra errada, e ela fica no ar.',
      '{h} não engana ninguém, e a proposta morre ali.',
      'Metade da sala já tinha decidido antes de {h} falar.',
      '{h} promete o que não pode, e percebem.',
      'O silêncio depois da fala de {h} diz tudo.',
    ],
    grave: [
      '{h} ofende quem não devia, e paga na frente de todos.',
      '{h} sustenta o blefe até o fim. Até o fim mesmo.',
      'A resposta ao que {h} disse não vem em palavras.',
      '{h} descobre onde ficava o limite ao cruzá-lo.',
      'Mandam calar {h}, e é o que fazem.',
    ],
  },
  mobilidade: {
    brilhante: [
      '{h} passa por onde ninguém tinha visto passagem.',
      '{h} chega antes de o problema começar.',
      'Ninguém vê {h} atravessar. Só vê que já atravessou.',
      '{h} atravessa e volta, só para conferir o caminho.',
      'O vão se fecha atrás de {h}, e se fecha vazio.',
    ],
    sucesso: [
      '{h} sai da frente no último instante.',
      '{h} atravessa primeiro e abre caminho para os outros.',
      '{h} passa raspando, e passar era o que contava.',
      'Sobra um palmo, e {h} usa o palmo.',
      '{h} escolhe o caminho mais longo, e chega antes.',
    ],
    custoso: [
      '{h} segura a passagem aberta até o último passar.',
      '{h} atravessa todo mundo. Todo mundo menos {h}.',
      'A ponte aguentava quatro, e {h} sabia disso ao ficar por último.',
      '{h} empurra o penúltimo para a frente e não tem tempo de seguir.',
      'O caminho se fecha com {h} do lado errado.',
    ],
    falha: [
      '{h} perde o tempo da passagem.',
      '{h} escorrega no pior momento possível.',
      '{h} hesita meio segundo, e meio segundo bastava.',
      'O chão cede sob {h}, e a travessia volta ao começo.',
      '{h} calcula o salto errado por um palmo.',
    ],
    grave: [
      '{h} não sai a tempo.',
      '{h} salta, e não alcança o outro lado.',
      'A passagem se fecha com {h} dentro.',
      '{h} corre na direção certa e chega no instante errado.',
      'Ninguém sabe dizer onde {h} errou o pé.',
    ],
  },
  vigor: {
    brilhante: [
      '{h} atravessa e ainda volta para carregar quem ficou.',
      '{h} não sente o caminho que derrubou os outros.',
      'Onde os outros param para respirar, {h} espera.',
      '{h} carrega o dobro e reclama da metade.',
      'A marcha acaba antes de {h} acabar.',
    ],
    sucesso: [
      '{h} aguenta a marcha e puxa o grupo junto.',
      '{h} chega do outro lado sem uma queixa.',
      '{h} para três vezes e segue nas três.',
      'O caminho cobra caro, e {h} tem com que pagar.',
      '{h} chega por último. Chega.',
    ],
    custoso: [
      '{h} carrega o grupo até o fim e não segue adiante.',
      '{h} aguenta o bastante. Só o bastante.',
      '{h} entrega a última água e faz o trecho sem ela.',
      'O grupo passa porque {h} para de andar.',
      '{h} chega ao outro lado e senta. É onde fica.',
    ],
    falha: [
      '{h} cede no pior trecho, e o grupo perde o passo.',
      '{h} não tem fôlego para o último trecho.',
      'As pernas de {h} decidem antes da cabeça.',
      '{h} pede um minuto que o caminho não dá.',
      'O peso vence {h} antes da distância.',
    ],
    grave: [
      '{h} senta para descansar e não levanta.',
      '{h} fica para trás, e ninguém consegue voltar.',
      'A marcha continua. {h} não.',
      '{h} promete alcançar o grupo adiante.',
      'Ninguém vê {h} parar. Só notam a ausência, depois.',
    ],
  },
};

/**
 * Epílogos. O desfecho não repete a última prova: fecha a jornada com um texto
 * escrito para aquele tipo de fim.
 *
 * `{caidos}` vira a lista de quem ficou pelo caminho, `{n}` o número de baixas
 * e `{prova}` o nome da prova em que a companhia parou.
 */
export type ChaveEpilogo =
  | 'perfeita'
  | 'salvou-inteiro'
  | 'salvou-com-uma-baixa'
  | 'salvou-com-baixas'
  | 'dizimada'
  | 'caiu-no-trono'
  | 'quase-la'
  | 'meio-caminho'
  | 'jornada-curta';

export const EPILOGOS: Record<ChaveEpilogo, { titulo: string; textos: string[] }> = {
  perfeita: {
    titulo: 'Todos voltaram',
    textos: [
      'Sete provas, sete vitórias, e cinco nomes que voltaram inteiros. O Rei Demônio caiu sem levar ninguém junto — e é por isso que esta companhia vira canção, e não lápide.',
      'Contaram cinco na saída e cinco na volta. Quem já tentou sabe que a segunda contagem é a difícil.',
      'O trono está vazio e a estrada de volta tem cinco pares de pegadas. Não há muito mais a dizer, e é justamente esse o feito.',
      'Não sobrou cova nenhuma para cavar. Numa história dessas, é a parte que ninguém acredita.',
    ],
  },
  /**
   * O fim que só o modelo de despacho produz: o trono caiu e a companhia
   * voltou inteira, mas nem toda missão foi vencida. No jogo antigo isso era
   * impossível — falhar uma prova encerrava a jornada.
   */
  'salvou-inteiro': {
    titulo: 'Todos voltaram',
    textos: [
      'O trono caiu e os cinco voltaram. Pelo caminho ficaram missões, não gente — e das duas coisas que se pode perder, perderam a que se recupera.',
      'Nem toda porta se abriu, e algumas cidades vão lembrar disso. Mas quem marchou marchou de volta, e é a conta que a companhia queria fechar.',
      'Falharam onde deu para falhar e venceram onde não dava. Cinco saíram, cinco voltaram, e o Rei Demônio não está mais sentado.',
      'Deixaram promessas por cumprir pela estrada. Não deixaram ninguém.',
    ],
  },
  'salvou-com-uma-baixa': {
    titulo: 'O mundo está salvo',
    textos: [
      'O trono caiu. {ultimoCaido} não voltou para ver. O mundo vai lembrar do feito; quem marchou vai lembrar da conta.',
      'Quatro atravessaram a porta na volta. O quinto se chamava {ultimoCaido}, e o mundo que ele salvou nunca vai saber o nome.',
      'Deu certo. Custou {ultimoCaido}, e ninguém dos quatro vai chamar isso de barato.',
      'A coroa rolou pelo chão do salão. {ultimoCaido} não estava lá para ver rolar.',
    ],
  },
  'salvou-com-baixas': {
    titulo: 'O mundo está salvo',
    textos: [
      'O Rei Demônio caiu, e {n} ficaram pelo caminho: {caidos}. Salvaram o mundo com o que sobrou de si mesmos.',
      'Saíram cinco, voltaram {sobreviventes}. O mundo continua girando por causa disso, e é pouco consolo para quem carrega a lista.',
      'A conta fechou: um mundo inteiro por {n} nomes. Quem fez a conta não estava em condições de discutir o preço.',
      'Venceram. {caidos} pagaram por isso, e {sobreviventes} vão passar o resto da vida sabendo disso.',
    ],
  },
  dizimada: {
    titulo: 'Ninguém voltou',
    textos: [
      'A companhia inteira ficou em {prova}. Não há quem conte o que aconteceu lá — só o que ficou por fazer.',
      'Cinco entraram em {prova}. A estrada seguiu vazia depois disso.',
      'Em {prova} a companhia acabou de uma vez. {primeiroCaido} foi o primeiro; depois disso a ordem deixou de importar.',
    ],
  },
  'caiu-no-trono': {
    titulo: 'Ao pé do trono',
    textos: [
      'Chegaram ao salão. Chegaram até a coroa descer. Foi o mais perto que alguém chegou em muito tempo, e não foi o bastante.',
      'Chegaram ao salão dele com o que sobrou da companhia. O Rei Demônio nem precisou levantar do trono para receber.',
      'Faltava um passo. Vão contar essa história muitas vezes, sempre parando no mesmo ponto.',
      'A porta do salão se abriu para eles. Foi a única coisa que se abriu.',
    ],
  },
  'quase-la': {
    titulo: 'A estrada acabou antes',
    textos: [
      'A companhia parou em {prova}, a um par de passos do fim. Faltou pouco — e pouco também é falta.',
      'Venceram {provas} provas. A seguinte se chamava {prova}, e é onde a história para de avançar.',
      'Dava para ver o fim daqui. Em {prova} deixou de dar.',
    ],
  },
  'meio-caminho': {
    titulo: 'Metade do caminho',
    textos: [
      'Em {prova} a marcha parou. Chegaram longe o bastante para o Rei Demônio ouvir falar deles, e perto demais do começo para que isso importe.',
      'Meio caminho é o pior lugar para parar: longe demais para voltar, perto demais para ter valido.',
      '{provas} provas vencidas e uma perdida, que é a única que a estrada guarda.',
    ],
  },
  'jornada-curta': {
    titulo: 'Jornada curta',
    textos: [
      'Acabou em {prova}, antes de a estrada virar história. Alguns nomes o mundo nem chega a aprender.',
      'A companhia se desfez em {prova}. Levaram mais tempo escolhendo quem viria do que marchando.',
      'Nem deu tempo de a estrada aprender os nomes deles.',
    ],
  },
};

/** Fecho de acordo com a moral da companhia, acrescentado ao epílogo. */
export const SELO_DO_EPILOGO: Record<string, string[]> = {
  'Party luminosa': [
    'Vão contar esta direito, com os nomes certos.',
    'É o tipo de história que se conta para criança dormir.',
    'Ninguém vai precisar omitir nada ao repetir.',
  ],
  'Party cinzenta': [
    'Ninguém vai perguntar como foi feito.',
    'A história fica melhor sem alguns detalhes, e todos concordam nisso.',
    'Vão contar do jeito que der menos trabalho explicar.',
  ],
  'Party sombria': [
    'Vão lembrar dos métodos. Do nome, talvez não.',
    'Salvar o mundo não limpa o que veio antes.',
    'A canção existe, mas ninguém canta em voz alta.',
  ],
};

export const ROTULO_RESULTADO: Record<ResultadoLance, string> = {
  brilhante: 'Brilhante',
  sucesso: 'Sucesso',
  custoso: 'Vencido a um custo',
  falha: 'Falha',
  grave: 'Fracasso grave',
};

export const MARCADOR_LANCE: Record<ResultadoLance, string> = {
  brilhante: '★',
  sucesso: '●',
  custoso: '◍',
  falha: '○',
  grave: '✝',
};
