/**
 * Conferências do modelo: integridade do roster, determinismo e — o mais
 * importante — que a compatibilidade nunca deixe o draft sem saída.
 *
 *   node scripts/conferir.ts
 */
import { perfilDaParty, textoDeCompartilhamento, todosOsHerois } from '../src/motor.ts';
import {
  COMPOSICAO_DA_JORNADA,
  EIXOS,
  ETAPAS,
  MAXIMO_POR_HEROI,
  TAMANHO_PARTY,
  TRACOS,
} from '../src/regras.ts';
import {
  ESQUADRAO_MAXIMO,
  ESQUADRAO_MINIMO,
  PESO_DO_CANSACO,
  TETO_DA_SOBRA,
  definirPesoDoCansaco,
  eixosCobrados,
  exigenciaDaMissao,
  simularJornada,
  comoCampanha,
} from '../src/despacho.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import { catalogo, dbHerois, jornadaPara, montarParty } from './comum.ts';
import { lancesPorEixoNoDia } from './avaliar.ts';
import { POLITICAS } from './politicas.ts';

let falhas = 0;
const conferir = (nome: string, ok: boolean, detalhe = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
};

const herois = todosOsHerois(dbHerois);

conferir('16 guildas', dbHerois.guildas.length === 16, `${dbHerois.guildas.length}`);
conferir(
  'toda guilda tem 5 heróis',
  dbHerois.guildas.every((g) => g.herois.length === 5),
);
const ids = herois.map((h) => h.id);
conferir('ids únicos', new Set(ids).size === ids.length, `${ids.length} heróis`);

const foraDaEscala = herois.filter((h) =>
  EIXOS.some((e) => h[e] < 0 || h[e] > MAXIMO_POR_HEROI || !Number.isInteger(h[e])),
);
conferir(
  `todos os atributos são inteiros de 0 a ${MAXIMO_POR_HEROI}`,
  foraDaEscala.length === 0,
  foraDaEscala.map((h) => h.nome).join(', '),
);

// Todo herói carrega exatamente um traço, e todo traço do pool é usado.
const semTraco = herois.filter((h) => !h.traco || !(h.traco in TRACOS));
conferir('todo herói tem um traço válido', semTraco.length === 0, semTraco.map((h) => h.nome).join(', '));
const tracosUsados = new Set(herois.map((h) => h.traco));
const ociosos = (Object.keys(TRACOS) as (keyof typeof TRACOS)[]).filter((t) => !tracosUsados.has(t));
conferir('todo traço do pool aparece no roster', ociosos.length === 0, ociosos.join(', '));

// Ninguém pode ser bom em quase tudo: sem preço, um herói assim é escolha óbvia.
const canivetes = herois.filter((h) => EIXOS.filter((e) => h[e] >= 8).length >= 4);
conferir(
  'nenhum herói é forte em 4+ eixos',
  canivetes.length === 0,
  canivetes.map((h) => h.nome).join(', '),
);

// Sem preço, total de pontos seria poder de graça. Todos somam o mesmo, e a
// escolha passa a ser sobre o formato do pentágono.
const somas = herois.map((h) => EIXOS.reduce((s, e) => s + h[e], 0));
conferir(
  'todos os heróis somam o mesmo total',
  Math.max(...somas) === Math.min(...somas),
  `de ${Math.min(...somas)} a ${Math.max(...somas)}`,
);

const morais = new Set(herois.map((h) => h.moral));
conferir(
  'a escala moral vai de -3 a +3',
  morais.has(-3) && morais.has(3),
  [...morais].sort((a, b) => a - b).join(' '),
);

for (const eixo of EIXOS) {
  const fortes = herois.filter((h) => h[eixo] >= 8).length;
  conferir(`o eixo ${eixo} tem especialistas`, fortes >= 8, `${fortes} com 8+`);
}

for (const tipo of new Set(COMPOSICAO_DA_JORNADA)) {
  const quantos = catalogo.desafios.filter((d) => d.tipo === tipo).length;
  conferir(`há desafios do tipo ${tipo}`, quantos >= 2, `${quantos} no catálogo`);
}

/**
 * Nenhum eixo pode ser de descarte. Conta pelo **dia**, não pelo catálogo: a
 * jornada sorteia três combates e só um de cada outra prova, então um lance
 * escrito num desafio de combate vale o triplo. Foi contando pelo catálogo que
 * o desequilíbrio passou despercebido — vigor aparecia como o eixo mais raro,
 * e era na verdade quatro vezes menos cobrado que combate.
 *
 * A folga é larga de propósito: o alvo é 4,2 lances por eixo, e o que esta
 * conferência proíbe é o buraco, não a assimetria.
 */
const porEixoNoDia = lancesPorEixoNoDia(catalogo);
const MINIMO_POR_EIXO = 3.5;
const MAXIMO_POR_EIXO = 5;
const desprezados = EIXOS.filter(
  (e) => porEixoNoDia[e] < MINIMO_POR_EIXO || porEixoNoDia[e] > MAXIMO_POR_EIXO,
);
conferir(
  `todo eixo é cobrado entre ${MINIMO_POR_EIXO} e ${MAXIMO_POR_EIXO} vezes por dia`,
  desprezados.length === 0,
  EIXOS.map((e) => `${e.slice(0, 4)} ${porEixoNoDia[e].toFixed(2)}`).join(' · '),
);

const foraDoTamanho = catalogo.desafios.filter((d) => d.lances.length !== 3);
conferir(
  'todo desafio tem exatamente 3 lances',
  foraDoTamanho.length === 0,
  foraDoTamanho.map((d) => `${d.nome} (${d.lances.length})`).join(', '),
);

// O draft não pode travar, nem depender de muitos resorteios para andar.
let travas = 0;
let resorteiosTotais = 0;
const AMOSTRAS_DRAFT = 1500;
for (let d = 0; d < AMOSTRAS_DRAFT; d++) {
  const dia = `conferencia-${d}`;
  const m = montarParty(dia, 'guloso', mulberry32(hash(dia)));
  if (m.travou || m.party.length !== TAMANHO_PARTY) travas++;
  resorteiosTotais += m.resorteios;
}
conferir(`nenhum draft trava em ${AMOSTRAS_DRAFT} tentativas`, travas === 0, `${travas} travas`);
console.log(`        resorteios: ${(resorteiosTotais / AMOSTRAS_DRAFT).toFixed(2)} por jornada`);

/* ------------------------------------------------- o modelo que está no ar */

/**
 * Daqui para baixo, tudo confere o **motor de despacho** — o que o jogador
 * joga. Antes estas checagens rodavam sobre `simularCampanha`, o motor lance a
 * lance do modelo anterior, e passavam verdes enquanto o jogo publicado podia
 * estar quebrado. Confiança falsa é pior que checagem nenhuma.
 */

const AMOSTRAS_DESPACHO = 300;

function medir(politica: string, nivelDoDraft: Parameters<typeof montarParty>[1] = 'sinergico') {
  let salvou = 0;
  let missoes = 0;
  let usadas = 0;
  for (let d = 0; d < AMOSTRAS_DESPACHO; d++) {
    const dia = `desp-${d}`;
    const { party } = montarParty(dia, nivelDoDraft, mulberry32(hash(`${nivelDoDraft}:${dia}`)));
    if (party.length !== TAMANHO_PARTY) continue;
    usadas++;
    const j = simularJornada(party, dia, jornadaPara(dia), POLITICAS[politica]);
    missoes += j.vitorias;
    if (j.salvou) salvou++;
  }
  return { salvou: (salvou / usadas) * 100, missoes: missoes / usadas };
}

/**
 * O despacho precisa pagar. É a conferência que corresponde, no jogo novo, à do
 * draft no antigo: se mandar o esquadrão certo e mandar qualquer um dão no
 * mesmo, as seis decisões de despacho são cerimônia, e nada mais aqui detecta.
 *
 * A comparação é contra o `bruto`, não contra o `pessimo`: o pessimo escolhe
 * deliberadamente o pior esquadrão possível e fica perto de zero, o que faria a
 * razão explodir e a checagem não medir mais nada. O `bruto` é o jogador
 * realista — leu o pentágono por alto e mandou os três mais fortes.
 */
const despachoBom = medir('zeloso');
const despachoBruto = medir('bruto');
conferir(
  'despachar bem paga o dobro de despachar no impulso',
  despachoBom.salvou >= despachoBruto.salvou * 2,
  `zeloso ${despachoBom.salvou.toFixed(1)}% × bruto ${despachoBruto.salvou.toFixed(1)}%`,
);

/**
 * O cansaço precisa estar cobrando alguma coisa — e o jeito de provar isso não
 * é olhar o número dele, é **desligá-lo**.
 *
 * Com o cansaço valendo, o `zeloso`, que guarda gente descansada, tem de bater
 * o `miope`, que manda sempre o melhor time da vez. Com o cansaço em zero, a
 * ordem tem de **inverter**: sem custo por reusar, queimar o time A passa a ser
 * a jogada certa e segurar gente vira erro.
 *
 * Se as duas medidas apontarem para o mesmo lado, o cansaço virou enfeite — o
 * jogo continuaria funcionando, e a mecânica que o distingue teria morrido sem
 * ninguém perceber.
 */
const comCansaco = { zeloso: despachoBom.salvou, miope: medir('miope').salvou };
const pesoReal = PESO_DO_CANSACO;
definirPesoDoCansaco(0);
const semCansaco = { zeloso: medir('zeloso').salvou, miope: medir('miope').salvou };
definirPesoDoCansaco(pesoReal);

conferir(
  'com cansaço, guardar gente vence queimar o time A',
  comCansaco.zeloso > comCansaco.miope,
  `zeloso ${comCansaco.zeloso.toFixed(1)}% × miope ${comCansaco.miope.toFixed(1)}%`,
);
conferir(
  'sem cansaço a ordem inverte — o cansaço é que faz guardar valer',
  semCansaco.miope > semCansaco.zeloso,
  `miope ${semCansaco.miope.toFixed(1)}% × zeloso ${semCansaco.zeloso.toFixed(1)}%`,
);

/**
 * O draft ainda importa, agora que os cinco não jogam juntos. Mesma pergunta de
 * sempre, com o despacho fixo no melhor para não embolar as duas decisões.
 */
const draftBom = medir('zeloso', 'sinergico').salvou;
const draftRuim = medir('zeloso', 'pessimo').salvou;
conferir(
  'recrutar bem paga o dobro de recrutar mal',
  draftBom >= draftRuim * 2,
  `sinérgico ${draftBom.toFixed(1)}% × péssimo ${draftRuim.toFixed(1)}%`,
);

/**
 * A jornada tem de ser vencível e não trivial. Um jogador bom que vencesse
 * todas as missões não teria o que decidir; um que não vencesse nenhuma
 * também não.
 */
conferir(
  'o bom jogador vence entre 3 e 6 das 7 missões, em média',
  despachoBom.missoes >= 3 && despachoBom.missoes <= 6,
  `${despachoBom.missoes.toFixed(2)} missões`,
);

/**
 * E a calibragem em si, num intervalo largo.
 *
 * As razões acima medem *distância* entre jogar bem e mal, e distância
 * sobrevive a mudanças de dificuldade: dá para o jogo inteiro ficar fácil
 * demais com as proporções intactas. Foi o que aconteceu ao tirar o teto da
 * sobra numa sabotagem de teste — o bom jogador foi de 30% para 42% e só uma
 * checagem reclamou.
 *
 * O intervalo é largo de propósito. Ele não existe para fixar o número, existe
 * para uma mudança que move a dificuldade **em silêncio** ter de ser
 * reconhecida por quem a fez.
 */
conferir(
  'o bom jogador salva o mundo entre 15% e 45% das jornadas',
  despachoBom.salvou >= 15 && despachoBom.salvou <= 45,
  `${despachoBom.salvou.toFixed(1)}%`,
);

/**
 * Missão que cobrasse os cinco eixos seria impossível por construção: o
 * esquadrão mais parelho que cabe numa party de cinco não chega a cobrir tudo.
 * Como a exigência sai dos três lances escritos no desafio, uma edição do
 * catálogo pode criar isso sem querer.
 */
const missoesLargas = catalogo.desafios
  .map((d, i) => ({ d, cobrados: eixosCobrados(exigenciaDaMissao(d, i % ETAPAS)).length }))
  .filter((m) => m.cobrados > 3 || m.cobrados < 1);
conferir(
  'nenhuma missão cobra mais de 3 eixos',
  missoesLargas.length === 0,
  missoesLargas.map((m) => `${m.d.nome} (${m.cobrados})`).join(', '),
);

/**
 * Nenhum eixo pode pedir mais do que o esquadrão daquela missão consegue pôr,
 * nem no pior lugar possível da jornada — última etapa, e o trono já engrossado
 * por ter falhado tudo o que veio antes.
 *
 * O teto **não é o mesmo para toda missão**: as comuns levam no máximo três
 * heróis, o trono leva todos os que sobraram. Foi o erro da primeira versão
 * desta checagem, que acusou o trono de impossível medindo-o pela régua das
 * outras.
 */
const pedidosImpossiveis = catalogo.desafios.flatMap((d) => {
  const ehTrono = d.tipo === 'trono';
  const teto = (ehTrono ? TAMANHO_PARTY : ESQUADRAO_MAXIMO) * MAXIMO_POR_HEROI;
  // O pior caso do trono é chegar lá tendo perdido as seis anteriores.
  const pior = exigenciaDaMissao(d, ETAPAS - 1, ehTrono ? ETAPAS - 1 : 0);
  return EIXOS.filter((e) => pior[e] > teto).map((e) => `${d.nome}/${e} ${pior[e]} > ${teto}`);
});
conferir(
  'nenhum eixo pede mais do que o esquadrão daquela missão consegue pôr',
  pedidosImpossiveis.length === 0,
  pedidosImpossiveis.join(', '),
);

/* --------------------------------------- uma jornada de despacho, por dentro */

const diaDespacho = '2026-08-29';
const { party: partyD } = montarParty(diaDespacho, 'sinergico', mulberry32(hash(diaDespacho)));
const jornadaD = jornadaPara(diaDespacho);
const j1 = simularJornada(partyD, diaDespacho, jornadaD, POLITICAS.zeloso);
const j2 = simularJornada(partyD, diaDespacho, jornadaD, POLITICAS.zeloso);
conferir('a jornada de despacho é determinística', JSON.stringify(j1) === JSON.stringify(j2));
conferir('a jornada tem 7 missões', j1.relatos.length === ETAPAS);

conferir(
  'toda missão tem protagonista e narração',
  j1.relatos.every((r) => r.protagonista && r.narracao.length > 0 && !r.narracao.includes('{h}')),
  `${j1.relatos.length} missões`,
);

/**
 * A margem é a soma dos saldos, e a interface mostra as duas coisas: a coluna
 * de saldo e o total embaixo. Se pararem de fechar, o jogador vê uma conta que
 * não bate e a regra do teto da sobra vira mágica.
 */
conferir(
  'a margem da missão é a soma exata dos saldos',
  j1.relatos.every((r) => {
    const soma = eixosCobrados(r.exigencia).reduce((s, e) => s + r.saldos[e], 0);
    return soma === r.margem;
  }),
);

conferir(
  'todo saldo respeita o teto da sobra',
  j1.relatos.every((r) => eixosCobrados(r.exigencia).every((e) => r.saldos[e] <= TETO_DA_SOBRA)),
);

conferir(
  'há um dado por eixo cobrado, entre -4 e +4',
  j1.relatos.every((r) => {
    const cobrados = eixosCobrados(r.exigencia);
    return cobrados.every((e) => r.dados[e] >= -4 && r.dados[e] <= 4);
  }),
);

conferir(
  'só quem foi despachado pode cair',
  j1.relatos.every((r) => !r.caido || r.esquadrao.some((h) => h.id === r.caido!.id)),
);

/**
 * Quem tomba é o protagonista — exceto quando o Mártir toma o lugar dele, que é
 * a razão de o traço existir.
 */
conferir(
  'quem cai é o protagonista, ou o Mártir no lugar dele',
  j1.relatos.every((r) => !r.caido || r.caido.id === r.protagonista.id || r.caido.traco === 'martir'),
);

/** Esquadrão de 2 ou 3 nas seis primeiras; a última leva todos os que sobraram. */
conferir(
  'esquadrão tem 2 ou 3 nas missões comuns',
  j1.relatos
    .slice(0, -1)
    .every((r) => r.esquadrao.length >= ESQUADRAO_MINIMO && r.esquadrao.length <= ESQUADRAO_MAXIMO),
);

/** O cansaço não pode passar do teto nem ficar negativo. */
const cansacos = j1.relatos.flatMap((r) => r.esquadrao.map((h) => h.id));
conferir(
  'a jornada usa mais de um esquadrão',
  new Set(j1.relatos.map((r) => r.esquadrao.map((h) => h.id).sort().join(','))).size > 1,
  `${new Set(cansacos).size} heróis despachados ao longo do dia`,
);

const perfil = perfilDaParty(partyD);
console.log('');
console.log(`--- companhia de exemplo (${partyD.map((h) => h.nome).join(', ')}) ---`);
console.log('party: ' + EIXOS.map((e) => `${e} ${perfil[e]}`).join(' · '));

console.log('');
console.log('--- a jornada de despacho, missão a missão ---');
for (const r of j1.relatos) {
  const pent = eixosCobrados(r.exigencia)
    .map(
      (e) =>
        `${e.slice(0, 4)} ${r.somas[e]}${r.dados[e] >= 0 ? '+' : ''}${r.dados[e]}/${r.exigencia[e]}`,
    )
    .join('  ');
  console.log('');
  console.log(`${r.numero}. ${r.desafio.nome}  [${r.esquadrao.map((h) => h.nome).join(', ')}]`);
  console.log(`   ${pent}   margem ${r.margem >= 0 ? '+' : ''}${r.margem} → ${r.resultado}`);
  console.log(`   ${r.narracao}${r.caido ? `  (cai ${r.caido.nome})` : ''}`);
}

const texto = textoDeCompartilhamento(comoCampanha(j1.relatos, partyD, jornadaD), 1);
conferir('o compartilhamento não revela a companhia', !partyD.some((h) => texto.includes(h.nome)));
console.log('');
console.log('--- compartilhamento ---');
console.log(texto);
console.log('');

process.exit(falhas === 0 ? 0 : 1);
