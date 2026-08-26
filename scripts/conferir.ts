/**
 * Conferências do modelo: integridade do roster, determinismo e — o mais
 * importante — que a compatibilidade nunca deixe o draft sem saída.
 *
 *   node scripts/conferir.ts
 */
import {
  exigenciaDaJornada,
  perfilDaParty,
  simularCampanha,
  textoDeCompartilhamento,
  todosOsHerois,
} from '../src/motor.ts';
import {
  COMPOSICAO_DA_JORNADA,
  EIXOS,
  MAXIMO_DA_PARTY,
  MAXIMO_POR_HEROI,
  TAMANHO_PARTY,
  TRACOS,
} from '../src/regras.ts';
import { hash, mulberry32 } from '../src/rng.ts';
import { catalogo, dbHerois, jornadaPara, montarParty } from './comum.ts';
import { lancesPorEixoNoDia } from './avaliar.ts';

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

// Nenhum lance pode pedir mais do que uma party perfeita conseguiria entregar.
let impossiveis = 0;
let maiorExigencia = 0;
for (let d = 0; d < 300; d++) {
  const exigencia = exigenciaDaJornada(jornadaPara(`exigencia-${d}`));
  for (const eixo of EIXOS) {
    maiorExigencia = Math.max(maiorExigencia, exigencia[eixo]);
    if (exigencia[eixo] > MAXIMO_DA_PARTY) impossiveis++;
  }
}
conferir(
  'nenhum lance pede mais do que a party consegue somar',
  impossiveis === 0,
  `maior exigência ${maiorExigencia} de ${MAXIMO_DA_PARTY}`,
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

/**
 * O draft precisa pagar. É a conferência mais importante do arquivo, porque é a
 * única que falha quando o jogo continua funcionando e deixa de ser um jogo: se
 * escolher bem e escolher mal dão no mesmo, as cinco rodadas de recrutamento são
 * cerimônia, e nada mais aqui detecta isso.
 *
 * Já aconteceu uma vez — foi com todos os heróis no mesmo formato equilibrado,
 * e só apareceu porque alguém pensou em medir o jogador que escolhe o pior
 * candidato de cada rodada. Agora essa medida roda sempre.
 */
const AMOSTRAS_ESCOLHA = 400;
function salvouOMundo(nivel: Parameters<typeof montarParty>[1]): number {
  let salvou = 0;
  for (let d = 0; d < AMOSTRAS_ESCOLHA; d++) {
    const dia = `escolha-${d}`;
    const { party } = montarParty(dia, nivel, mulberry32(hash(`${nivel}:${dia}`)));
    if (party.length !== TAMANHO_PARTY) continue;
    const c = simularCampanha(party, 'agressiva', dia, jornadaPara(dia));
    if (c.vitorias === 7) salvou++;
  }
  return (salvou / AMOSTRAS_ESCOLHA) * 100;
}
const bemEscolhida = salvouOMundo('sinergico');
const malEscolhida = salvouOMundo('pessimo');
conferir(
  'escolher bem paga o dobro de escolher mal',
  bemEscolhida >= malEscolhida * 2,
  `sinérgico ${bemEscolhida.toFixed(1)}% × péssimo ${malEscolhida.toFixed(1)}%`,
);

// Determinismo: é o que permite comparar resultados entre jogadores.
const dia = '2026-08-13';
const { party } = montarParty(dia, 'informado', mulberry32(hash(dia)));
const jornada = jornadaPara(dia);
const a = simularCampanha(party, 'equilibrada', dia, jornada);
const b = simularCampanha(party, 'equilibrada', dia, jornada);
conferir('a simulação é determinística', JSON.stringify(a) === JSON.stringify(b));
conferir('a jornada tem 7 etapas', a.etapas.length === 7);
conferir(
  'a jornada tem 4 combates contando o trono',
  jornada.filter((d) => d.tipo === 'combate' || d.tipo === 'trono').length === 4,
);
conferir('nenhum desafio se repete no dia', new Set(jornada.map((d) => d.id)).size === 7);

const lances = a.etapas.flatMap((e) => e.lances);
conferir(
  'todo lance tem protagonista e narração',
  lances.every((l) => l.protagonista && l.narracao.length > 0 && !l.narracao.includes('{h}')),
  `${lances.length} lances`,
);
conferir(
  'a conta do lance fecha',
  lances.every((l) => l.somaDoGrupo + l.modificadores + l.dado === l.valor),
);
conferir(
  'o dado fica entre -4 e +4',
  lances.every((l) => l.dado >= -4 && l.dado <= 4),
);
conferir(
  'quem morre é sempre o protagonista do lance',
  a.etapas.every((e) => e.caidos.every((h) => e.lances.some((l) => l.caido?.id === h.id))),
);

const texto = textoDeCompartilhamento(a, 1);
conferir('o compartilhamento não revela a party', !party.some((h) => texto.includes(h.nome)));

const perfil = perfilDaParty(party);
console.log(`\n--- party de exemplo (${party.map((h) => h.nome).join(', ')}) ---`);
console.log('party:   ' + EIXOS.map((e) => `${e} ${perfil[e]}`).join(' · '));
console.log('exigido: ' + EIXOS.map((e) => `${e} ${exigenciaDaJornada(jornada)[e]}`).join(' · '));

console.log('\n--- exemplo de narração ---');
for (const etapa of a.etapas.slice(0, 2)) {
  console.log(`\n${etapa.numero}. ${etapa.desafio.nome}`);
  for (const l of etapa.lances) {
    const mods = `${l.modificadores >= 0 ? '+' : ''}${l.modificadores}`;
    const dado = `${l.dado >= 0 ? '+' : ''}${l.dado}`;
    console.log(
      `   ${l.numero}º ${l.eixo}: ${l.somaDoGrupo}${mods} ${dado} = ${l.valor} vs ${l.dificuldade}` +
        `\n      ${l.narracao}`,
    );
  }
}
console.log('\n--- compartilhamento ---\n' + texto + '\n');

process.exit(falhas === 0 ? 0 : 1);
