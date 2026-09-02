/**
 * Gera o `jogos/cifra/palavras.js` a partir de uma lista de frequência.
 *
 * Roda **à mão**, e o resultado é commitado. O build do site não chama isto e
 * não deve: o vocabulário é conteúdo curado do jogo, não artefato — se ele
 * mudasse sozinho a cada deploy, a palavra do dia mudaria debaixo de quem já
 * está jogando.
 *
 *     node scripts/cifra-palavras.mjs
 *
 * ## A fonte
 *
 * `hermitdave/FrequencyWords`, listas de frequência derivadas de legendas do
 * OpenSubtitles, licença **MIT**. A frequência não é enfeite: é ela que separa
 * as duas listas que o jogo precisa e que têm exigências opostas.
 *
 * ## Por que duas listas
 *
 *   RESPOSTAS  — de onde sai a palavra do dia. Não tolera ruído: resposta
 *                obscura não é desafio, é sorteio. Corte de frequência alto,
 *                mais peneira, mais lista de exclusão à mão.
 *   EXTRAS     — só valida chute. Tolera ruído: aceitar um vocábulo estranho
 *                que ninguém digitaria não custa nada ao jogador, enquanto
 *                *recusar* palavra real quebra a confiança na regra. Corte
 *                baixo.
 *
 * ## As três peneiras
 *
 * 1. **Ortografia do português.** O ruído de legenda é quase todo nome próprio
 *    e inglês, e os dois violam regras que palavra portuguesa não viola: `k`,
 *    `w` e `y`; consoante dobrada fora de `rr`/`ss`; final em consoante que o
 *    português não usa. Isso sozinho barra 28 mil formas, e entre as mais
 *    frequentes o que ela pega é `kenny`, `molly`, `grant`, `black`, `shawn`.
 *    Custa um falso positivo conhecido: `pizza`, pelo `zz`.
 *
 * 2. **Colisão de acento.** `mares` e `marés` são o *mesmo* chute aqui, porque
 *    a comparação é sem acento — ter as duas deixaria uma resposta impossível
 *    de revelar direito. São ~5.500 colisões, e a frequência desempata sozinha:
 *    fica a grafia mais usada.
 *
 * 3. **Exclusão à mão.** O que passa nas duas primeiras e ainda não serve como
 *    resposta: nome próprio compatível com a ortografia (`bruce`, `jorge`),
 *    topônimo, e palavrão. Só vale para RESPOSTAS — em EXTRAS eles ficam, que
 *    é onde são inofensivos.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const FONTE = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt';
const CACHE = join(raiz, 'scripts', '.cache-frequencia.txt');
const SAIDA = join(raiz, 'jogos', 'cifra', 'palavras.js');

/** Corte para virar resposta do dia. Acima disto o ruído de legenda é raro. */
const CORTE_RESPOSTA = 1200;
/** Corte para ser aceito como chute. Abaixo disto vira lixo de corpus. */
const CORTE_ACEITO = 30;

const TAM = 5;
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// ---------------------------------------------------------------- peneira 1

const VOGAIS = new Set(['A', 'E', 'I', 'O', 'U']);
const FINAIS = new Set(['R', 'S', 'L', 'M', 'Z', 'X', 'N']);

function ehOrtografiaPortuguesa(f) {
  if (/[KWY]/.test(f)) return false;
  if (!VOGAIS.has(f[4]) && !FINAIS.has(f[4])) return false;
  for (let i = 0; i < TAM - 1; i++) {
    if (f[i] === f[i + 1] && !VOGAIS.has(f[i]) && f[i] !== 'R' && f[i] !== 'S') return false;
  }
  return true;
}

// ---------------------------------------------------------------- peneira 3

/** Nome próprio, topônimo, estrangeirismo e palavrão: fora das RESPOSTAS. */
const FORA_DAS_RESPOSTAS = new Set([
  // nomes que a ortografia não pega
  'helen', 'robin', 'bruce', 'jamie', 'carol', 'lucas', 'chloe', 'marie', 'oscar',
  'davis', 'paula', 'chase', 'jules', 'rosie', 'amber', 'bruno', 'damon', 'angie',
  'devon', 'paulo', 'irene', 'dixon', 'bauer', 'jorge', 'boris', 'anton', 'burns',
  'marta', 'ernie', 'gavin', 'agnes', 'nigel', 'carlo', 'sadie', 'dante', 'romeu',
  'aidan', 'tasha', 'silas', 'ramon', 'jamal', 'celia', 'eliza', 'usher', 'delia',
  'lopez', 'josie', 'gomez', 'salem', 'alvin', 'greta', 'elias', 'vance', 'maria',
  'jesus', 'james', 'peter', 'steve', 'simon', 'jason', 'jerry', 'grace', 'alice',
  'laura', 'roger', 'louis', 'susan', 'jesse', 'julie', 'julia', 'barry', 'jones',
  'diana', 'shane', 'mason', 'janet', 'craig', 'quinn', 'angel', 'carla', 'megan',
  'colin', 'mitch', 'cesar', 'césar', 'diego', 'homer', 'felix', 'crane', 'ralph',
  'caleb', 'allen', 'booth', 'mikey', 'elena', 'pedro', 'aaron', 'sammy', 'riley',
  'diane', 'miles', 'vince', 'logan', 'ethan', 'harry', 'sarah', 'david', 'frank',
  'henry', 'ellie', 'jenna', 'wendy', 'april', 'sandy', 'kitty', 'stone', 'tiger',
  'annie', 'clark', 'blake', 'chuck', 'donna', 'katie', 'brown', 'nancy', 'jacob',
  'derek', 'lewis', 'keith', 'grant', 'marty', 'randy', 'casey', 'kenny', 'emily',
  'smith', 'larry', 'scott', 'kelly', 'bobby', 'kevin', 'eddie', 'tommy', 'billy',
  'jimmy', 'danny', 'betty', 'ricky', 'dylan', 'sally', 'terry', 'molly', 'tyler',
  'karen', 'jenny', 'holly', 'ellen', 'shawn', 'wayne', 'black', 'bones', 'price',
  'gibbs', 'white', 'green', 'house', 'renne', 'chris', 'brian',
  // topônimos
  'texas', 'vegas', 'japão', 'egito', 'china', 'índia', 'marte', 'paris', 'miami',
  'viena', 'maine', 'síria', 'delhi', 'chile', 'aires', 'berna', 'timor', 'norad',
  'luiza', 'natal',
  // estrangeirismos crus de legenda
  'there', 'state', 'haven', 'sites', 'blues', 'front', 'great', 'again', 'death',
  'still', 'shock', 'board', 'flash', 'shows', 'bingo', 'trail', 'brave', 'quiet',
  'lines', 'knees', 'glove', 'grief', 'hopes', 'spies', 'treat', 'crude', 'slack',
  'break', 'stand', 'poker', 'chips', 'drone', 'clone', 'pilot', 'union', 'homes',
  'walls', 'usted', 'email',
  // palavrão e explícito: ficam aceitos como chute, nunca como resposta do dia
  'merda', 'porra', 'bunda', 'foder', 'vadia', 'pênis', 'bosta', 'cuzão', 'tesão',
  'sêmen', 'seios', 'porno', 'pornô', 'putas', 'putos', 'cuzõe', 'punhe',
].map(semAcento));

/**
 * O piso: palavra que já foi curada à mão e que a fonte de frequência não
 * cobre. Legenda de filme é um corpus estreito — nele ninguém diz `jazer`,
 * `urgir` nem `caiar`, e todas são português corrente. Sem esta lista, trocar
 * de fonte vira regressão silenciosa: o jogo passaria a recusar palavra que
 * antes aceitava, que é o defeito exato que esta geração veio consertar.
 *
 * Só entram em EXTRAS. São raras demais para virar resposta do dia.
 */
const SEMPRE_ACEITAS = [
  'ceifa', 'ranço', 'trino', 'zelos', 'apear', 'bulir', 'caiar', 'cavas', 'cerol',
  'colmo', 'crivo', 'cuias', 'dosar', 'fados', 'fomes', 'gagos', 'jacas', 'jazer',
  'limos', 'lumes', 'mocho', 'orlas', 'palas', 'pelar', 'pirão', 'plaga', 'popas',
  'rijos', 'roças', 'roída', 'sanha', 'sisos', 'sovar', 'tacha', 'ufano', 'urgir',
  'urros',
];

// ---------------------------------------------------------------- montagem

async function fonte() {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8');
  console.log('· baixando a lista de frequência');
  const r = await fetch(FONTE);
  if (!r.ok) throw new Error(`a fonte respondeu ${r.status}`);
  const txt = await r.text();
  writeFileSync(CACHE, txt, 'utf8');
  return txt;
}

function paraJs(nome, lista, comentario) {
  // Uma string só, não array de strings citadas: corta aspas e vírgulas, e o
  // arquivo cai a menos da metade. O `split` no carregamento é imperceptível.
  const linhas = [];
  for (let i = 0; i < lista.length; i += 12) {
    linhas.push('  ' + lista.slice(i, i + 12).join(' '));
  }
  return `${comentario}\nexport const ${nome} = \`\n${linhas.join('\n')}\n\`.trim().split(/\\s+/);\n`;
}

async function main() {
  const bruto = await fonte();

  // peneiras 1 e 2, de uma vez: a mais frequente entre as grafias que colidem
  const porForma = new Map();
  let colisoes = 0;
  for (const linha of bruto.split('\n')) {
    const [p, n] = linha.split(' ');
    if (!p || !n || [...p].length !== TAM) continue;
    const f = semAcento(p);
    if (!/^[A-Z]{5}$/.test(f)) continue;
    if (!ehOrtografiaPortuguesa(f)) continue;

    const c = Number(n);
    const antes = porForma.get(f);
    if (antes) colisoes++;
    if (!antes || c > antes.n) porForma.set(f, { p, n: c, f });
  }

  const ordenadas = [...porForma.values()].sort((a, b) => b.n - a.n);

  const respostas = ordenadas
    .filter((x) => x.n >= CORTE_RESPOSTA && !FORA_DAS_RESPOSTAS.has(x.f))
    .map((x) => x.p)
    .sort((a, b) => semAcento(a).localeCompare(semAcento(b)));

  const jaTem = new Set(respostas.map(semAcento));
  const extras = ordenadas
    .filter((x) => x.n >= CORTE_ACEITO && !jaTem.has(x.f))
    .map((x) => x.p);
  for (const p of extras) jaTem.add(semAcento(p));

  // O piso entra por último, e só o que ainda falta: a checagem de colisão do
  // jogo não perdoa duas grafias que só diferem no acento.
  let doPiso = 0;
  for (const p of SEMPRE_ACEITAS) {
    const f = semAcento(p);
    if (jaTem.has(f)) continue;
    extras.push(p);
    jaTem.add(f);
    doPiso++;
  }
  extras.sort((a, b) => semAcento(a).localeCompare(semAcento(b)));

  const cabecalho = `/**
 * Cifra — o vocabulário. **Gerado**, não escrito à mão.
 *
 * Sai de \`scripts/cifra-palavras.mjs\`, que lê uma lista de frequência do
 * português (hermitdave/FrequencyWords, licença MIT, derivada de legendas do
 * OpenSubtitles) e a corta em duas. Para mexer no vocabulário, mexa no script
 * e rode-o de novo — editar este arquivo à mão perde na próxima geração.
 *
 *     node scripts/cifra-palavras.mjs
 *
 * As duas listas existem porque o jogo faz duas perguntas com exigências
 * opostas:
 *
 *   RESPOSTAS  — de onde sai a palavra do dia. Só palavra comum: obscura não é
 *                desafio, é sorteio. Corte de frequência >= ${CORTE_RESPOSTA}.
 *   EXTRAS     — só valida chute. Aceitar um vocábulo estranho que ninguém
 *                digitaria não custa nada; *recusar* palavra real quebra a
 *                confiança na regra. Corte >= ${CORTE_ACEITO}.
 *
 * Acentuação é ignorada na comparação e só reaparece na revelação: quem sabe a
 * grafia não deve perder por não achar a tecla. Como consequência, duas
 * grafias que só diferem no acento são o *mesmo* chute — o gerador mantém a
 * mais frequente e o \`?conferir\` falha se alguma colisão escapar.
 */

/** Tira acento e cedilha e sobe pra maiúscula. É a forma em que o jogo compara. */
export const semAcento = (s) =>
  s.normalize('NFD').replace(/[\\u0300-\\u036F]/g, '').toUpperCase();
`;

  const corpo = [
    cabecalho,
    paraJs('RESPOSTAS', respostas, '/** As palavras do dia. Curadas pelo corte de frequência e pela lista de exclusão. */'),
    paraJs('EXTRAS', extras, '/** Só aceitas como chute — nunca viram resposta. */'),
    '/** O dicionário de aceitação: tudo que pode ser digitado, na forma sem acento. */\nexport const ACEITAS = new Set([...RESPOSTAS, ...EXTRAS].map(semAcento));\n',
  ].join('\n');

  writeFileSync(SAIDA, corpo, 'utf8');

  console.log(`\n  formas após ortografia : ${ordenadas.length}`);
  console.log(`  colisões desempatadas  : ${colisoes}`);
  console.log(`  RESPOSTAS (>= ${CORTE_RESPOSTA})  : ${respostas.length}`);
  console.log(`  EXTRAS    (>= ${CORTE_ACEITO})    : ${extras.length}  (${doPiso} vindas do piso curado)`);
  console.log(`  ACEITAS total          : ${respostas.length + extras.length}`);
  console.log(`\n  escrito em ${SAIDA}`);
}

await main();
