/**
 * Cifra — a lógica.
 *
 * Cinco letras, oito tentativas. O que muda tudo em relação a um Wordle é a
 * forma do retorno: em vez de uma cor por letra, três números pelo chute
 * inteiro. Você sabe *quanto* acertou, nunca *o quê*. Deixa de ser jogo de
 * vocabulário e vira dedução — cada chute é uma equação, e a partida é o
 * sistema.
 *
 * Três consequências que não são detalhe:
 *
 *   1. O teclado não guarda estado nenhum. Num Wordle ele guarda de graça,
 *      porque lá o jogo conhece cada letra; aqui não conhece. E a marca também
 *      não mora nele: mora **na casa do chute**, porque a hipótese que o
 *      jogador tem não é sobre a letra, é sobre *aquela ocorrência* dela — "o A
 *      do terceiro chute é o que está no lugar" é uma frase que a marca por
 *      tecla não sabe dizer. Um clique na casa cicla a marca.
 *
 *      A exceção é o que os chutes já *provam* (ver `deduzir`): isso é fato
 *      sobre a letra, não sobre a casa, então aparece em toda casa onde ela
 *      estiver — e não aceita ser desmarcado.
 *
 *   2. O branco (`_`) inverte de função por causa do limite de um por chute.
 *      Com vários brancos ele isolaria uma incógnita (`_E___` responde "o E
 *      está na palavra?" sem ambiguidade). Com um só, você sempre digita quatro
 *      letras reais mais um branco: ele deixa de isolar e passa a *remover
 *      ruído* — tira da conta a posição onde qualquer palpite seu só sujaria os
 *      números.
 *
 *   3. O chute não é preenchido da esquerda pra direita. Existe um cursor, e
 *      ele é clicável: num jogo em que você monta molde (`GR_TO`), digitar em
 *      fila é a interação errada — você quer pousar numa casa específica.
 */

import { RESPOSTAS, EXTRAS, ACEITAS, semAcento } from './palavras.js';

const TAM = 5;
const TENTATIVAS = 8;
const BRANCO = '_';
const FUSO = 'America/Sao_Paulo';

/** O dia 1 da Cifra. Muda isto e o número de todas as rodadas anda junto. */
const EPOCA = Date.UTC(2026, 8, 1);

/*
 * Uma cifra por dia, da lista inteira. Houve um seletor comum/difícil, em que
 * o comum tirava as palavras com letra repetida — e ele saiu porque não era
 * dificuldade nenhuma: só 37% das respostas repetem letra, então em quase dois
 * terços dos dias as duas opções davam partidas indistinguíveis. Pior, a
 * repetição é propriedade da palavra, que o jogador só descobre no fim: não dá
 * pra sentir um botão de dificuldade que só se manifesta depois de acabar.
 *
 * Sem seletor, todo mundo joga a mesma cifra — que é o que faz o resultado
 * compartilhado querer dizer alguma coisa.
 */
const SEMENTE = 0x5ea1d0;

// ---------------------------------------------------------------- sorteio

/** mulberry32 — pequeno, determinístico e igual em qualquer navegador. */
function prng(semente) {
  return () => {
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * O baralho: a lista inteira, embaralhada uma vez com semente fixa. O dia N
 * tira a carta N — então nenhuma palavra se repete antes de o baralho inteiro
 * passar, que é o que uma escolha por hash não garantiria.
 */
function baralho() {
  const cartas = [...RESPOSTAS];
  const sortear = prng(SEMENTE);
  for (let i = cartas.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [cartas[i], cartas[j]] = [cartas[j], cartas[i]];
  }
  return cartas;
}

const BARALHO = baralho();

/** A data de hoje em São Paulo, YYYY-MM-DD. O dia vira à meia-noite de Brasília. */
function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function numeroDaRodada(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - EPOCA) / 86400000) + 1;
}

function palavraDoDia(iso) {
  const n = BARALHO.length;
  return BARALHO[((numeroDaRodada(iso) - 1) % n + n) % n];
}

// ---------------------------------------------------------------- as regras

/**
 * O coração do jogo. Devolve só a contagem — quais letras casaram é
 * precisamente o que não se conta.
 *
 * A contagem de "na palavra" é por multiconjunto, igual à do Wordle: uma letra
 * do alvo já gasta por um acerto de posição não pode ser gasta de novo. Sem
 * isso, chutar AAAAA contra CASAL devolveria amarelo demais.
 *
 * O branco não entra em nenhum dos três, mas a letra do alvo que ele encobre
 * continua disponível para casar como amarelo noutra posição — ele apaga o
 * palpite, não a palavra.
 */
export function pontuar(chute, alvo) {
  const sobraAlvo = [];
  const sobraChute = [];
  let verde = 0;
  let digitadas = 0;

  for (let i = 0; i < TAM; i++) {
    if (chute[i] === BRANCO) {
      sobraAlvo.push(alvo[i]);
      continue;
    }
    digitadas++;
    if (chute[i] === alvo[i]) verde++;
    else {
      sobraAlvo.push(alvo[i]);
      sobraChute.push(chute[i]);
    }
  }

  const disponivel = new Map();
  for (const c of sobraAlvo) disponivel.set(c, (disponivel.get(c) || 0) + 1);

  let amarelo = 0;
  for (const c of sobraChute) {
    const n = disponivel.get(c) || 0;
    if (n > 0) {
      disponivel.set(c, n - 1);
      amarelo++;
    }
  }

  return { lugar: verde, palavra: amarelo, fora: digitadas - verde - amarelo };
}

/** `null` quando o chute vale; a frase da recusa quando não. */
export function motivoRecusa(chute) {
  if (chute.length < TAM || chute.includes(' ')) return 'Faltam letras.';

  const brancos = [...chute].filter((c) => c === BRANCO).length;
  if (brancos > 1) return 'No máximo um branco por chute.';
  if (brancos === 0) {
    return ACEITAS.has(chute) ? null : 'Essa palavra não está no dicionário do jogo.';
  }

  // Com um branco, vale se alguma letra o completa formando palavra do
  // dicionário — o molde precisa existir, mesmo que você não saiba qual é.
  const i = chute.indexOf(BRANCO);
  for (let c = 65; c <= 90; c++) {
    if (ACEITAS.has(chute.slice(0, i) + String.fromCharCode(c) + chute.slice(i + 1))) return null;
  }
  return 'Nenhuma palavra encaixa nesse molde.';
}

/**
 * O que os chutes já jogados **provam** sobre cada letra — sem palpite, sem
 * olhar a resposta, e sem nunca afirmar algo que possa estar errado.
 *
 * Duas delas saem da mesma conta: `lugar + palavra` é quantas das letras que
 * você digitou estão na palavra.
 *
 *   · deu zero  → nenhuma delas está. Todas ausentes.
 *   · deu o máximo possível → todas estão. Todas presentes.
 *
 * O "máximo possível" desconta as letras que já sabemos ausentes, porque essas
 * não podiam pontuar de qualquer jeito. É isso que faz a dedução encadear: uma
 * letra provada morta num chute abre a conta de outro, e por isso o laço roda
 * até parar de mudar.
 *
 * Há uma terceira, sobre *posição*, e ela é por casa e não por letra: se o
 * "no lugar" iguala quantas letras você digitou, então **todas** estão no
 * lugar — não sobra nenhuma pra estar fora dele. É o que acontece na jogada
 * que vence (`5/0/0`), e sem esta regra a palavra certa apareceria como "meio
 * certa": provada presente, com a posição ainda em aberto.
 *
 * Fora esses casos, posição continua sendo palpite do jogador — e tem de
 * continuar, senão o jogo estaria resolvendo a si mesmo.
 */
export function deduzir(chutes, alvo) {
  const ausentes = new Set();
  const presentes = new Set();
  const posicoes = new Set();     // chaves `linha:casa` provadas no lugar

  let mudou = true;
  while (mudou) {
    mudou = false;

    for (const [l, chute] of chutes.entries()) {
      const p = pontuar(chute, alvo);
      const acertos = p.lugar + p.palavra;

      // Tudo que foi digitado está no lugar: nada sobrou pra estar fora dele.
      const digitadas = [...chute].filter((c) => c !== BRANCO).length;
      if (digitadas > 0 && p.lugar === digitadas) {
        for (let i = 0; i < TAM; i++) {
          if (chute[i] !== BRANCO) posicoes.add(`${l}:${i}`);
        }
      }

      // As casas digitadas cuja letra ainda não é sabidamente morta: são as
      // únicas que podiam ter pontuado.
      const abertas = [...chute].filter((c) => c !== BRANCO && !ausentes.has(c));
      if (abertas.length === 0) continue;

      if (acertos === 0) {
        for (const c of abertas) if (!ausentes.has(c)) { ausentes.add(c); mudou = true; }
      } else if (acertos === abertas.length) {
        for (const c of abertas) if (!presentes.has(c)) { presentes.add(c); mudou = true; }
      }
    }
  }

  return { ausentes, presentes, posicoes };
}

// ---------------------------------------------------------------- estado

/** A marca de uma letra: 0 sem marca, 1 certa, 2 meio certa, 3 errada. */
const SEM_MARCA = 0;
const CERTA = 1;
const MEIO = 2;
const ERRADA = 3;

const estado = {
  dia: hojeSP(),
  bonita: '',
  alvo: '',
  chutes: [],
  atual: Array(TAM).fill(null),
  cursor: 0,
  fim: null,
  contabilizada: false,
  marcas: {},          // as marcas postas à mão
  provado: { ausentes: new Set(), presentes: new Set(), posicoes: new Set() },
};

const chaveRodada = () => `cifra:r:${estado.dia}`;

/**
 * Uma impressão curta do alvo, gravada junto da rodada.
 *
 * O vocabulário é gerado (ver `scripts/cifra-palavras.mjs`), e mexer nele
 * reordena o baralho: a palavra de um mesmo dia muda. Sem esta marca, uma
 * rodada salva antes da troca voltaria pontuada contra a palavra nova — o
 * tabuleiro mostrando derrota na linha final enquanto o estado diz "ganhou".
 * Não é hipótese: aconteceu ao trocar a fonte de palavras.
 *
 * Guarda o hash e não a palavra por educação, não por segurança: quem abrir o
 * console calcula a resposta do dia de qualquer jeito, porque a lista inteira
 * viaja na página.
 */
function impressao(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function guardar() {
  try {
    localStorage.setItem(chaveRodada(), JSON.stringify({
      chutes: estado.chutes, fim: estado.fim, marcas: estado.marcas,
      contabilizada: estado.contabilizada, alvo: impressao(estado.alvo),
    }));
  } catch { /* modo privativo, cota cheia — o jogo continua, só não lembra */ }
}

function recuperar() {
  try {
    return JSON.parse(localStorage.getItem(chaveRodada()) || 'null');
  } catch { return null; }
}

// ---------------------------------------------------------------- histórico

const CHAVE_STATS = 'cifra:stats';
const statsZerado = () => ({
  jogos: 0, vitorias: 0, sequencia: 0, melhor: 0, ultima: null,
  dist: Array(TENTATIVAS).fill(0),
});

function lerStats() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_STATS) || 'null');
    if (!s || !Array.isArray(s.dist) || s.dist.length !== TENTATIVAS) return statsZerado();
    return { ...statsZerado(), ...s };
  } catch { return statsZerado(); }
}

/**
 * Conta a rodada uma vez só, e a trava mora no registro **do dia**, não nas
 * estatísticas. É o que faz recarregar a página com a partida terminada não
 * inflar nada — e o que faz apagar um dia não corromper o histórico inteiro.
 *
 * A sequência só continua se a rodada contabilizada antes foi a de ontem
 * (`ultima === n - 1`); pular um dia zera, que é o contrato de jogo diário.
 */
function contabilizar() {
  if (!estado.fim || estado.contabilizada) return;

  const s = lerStats();
  const n = numeroDaRodada(estado.dia);
  s.jogos += 1;

  if (estado.fim === 'ganhou') {
    s.vitorias += 1;
    s.dist[estado.chutes.length - 1] += 1;
    s.sequencia = s.ultima === n - 1 ? s.sequencia + 1 : 1;
    s.melhor = Math.max(s.melhor, s.sequencia);
  } else {
    s.sequencia = 0;
  }
  s.ultima = n;

  estado.contabilizada = true;
  try { localStorage.setItem(CHAVE_STATS, JSON.stringify(s)); } catch { /* sem histórico */ }
  guardar();
}

// ---------------------------------------------------------------- marcas

/** A marca é de uma casa de um chute, não de uma letra: chave `linha:casa`. */
const chaveCasa = (l, i) => `${l}:${i}`;

/**
 * A marca que vale para uma casa. O que os chutes provam vence o que a mão
 * marcou: deixar você anotar "certa" numa letra que os seus próprios chutes já
 * mataram não é liberdade, é ajudar a mentir pra si mesmo.
 *
 * A prova é sobre a letra, então pinta toda casa onde ela aparece. A mão é
 * sobre a casa, e fica só nela — marcar o A de um chute não mexe no A do
 * chute de cima, que é justamente o ponto de marcar por casa.
 */
function marcaDaCasa(l, i) {
  const letra = estado.chutes[l]?.[i];
  if (!letra || letra === BRANCO) return SEM_MARCA;

  // Provada no lugar vence tudo: é a única prova que fala de posição.
  if (estado.provado.posicoes.has(chaveCasa(l, i))) return CERTA;
  if (estado.provado.ausentes.has(letra)) return ERRADA;
  const mao = estado.marcas[chaveCasa(l, i)] || SEM_MARCA;
  // Provada presente: só resta o palpite de posição, e esse é seu.
  if (estado.provado.presentes.has(letra)) return mao === CERTA ? CERTA : MEIO;
  return mao;
}

/** A casa carrega prova (e não só palpite)? É o que o ponto no canto mostra. */
function casaProvada(l, i) {
  const letra = estado.chutes[l]?.[i];
  if (!letra || letra === BRANCO) return false;
  return estado.provado.posicoes.has(chaveCasa(l, i))
    || estado.provado.ausentes.has(letra)
    || estado.provado.presentes.has(letra);
}

function ciclarCasa(l, i) {
  const letra = estado.chutes[l]?.[i];
  if (!letra) return;
  if (letra === BRANCO) {
    avisar('O branco não é letra — não há o que marcar nele.');
    return;
  }
  if (estado.provado.posicoes.has(chaveCasa(l, i))) {
    avisar(`Seus chutes já provaram que o ${letra} está exatamente aí.`);
    return;
  }
  if (estado.provado.ausentes.has(letra)) {
    avisar(`Seus chutes já provaram que ${letra} não está na palavra.`);
    return;
  }

  const atual = marcaDaCasa(l, i);
  estado.marcas[chaveCasa(l, i)] = estado.provado.presentes.has(letra)
    ? (atual === CERTA ? MEIO : CERTA)   // provada viva: resta certa ou meio certa
    : (atual + 1) % 4;

  guardar();
  desenharTabuleiro();
}

function recalcularProvas() {
  estado.provado = deduzir(estado.chutes, estado.alvo);
}

// ---------------------------------------------------------------- desenho

const $ = (s) => document.querySelector(s);
const tabuleiro = $('#tabuleiro');
const elAviso = $('#aviso');

function desenharTabuleiro() {
  tabuleiro.replaceChildren();

  for (let l = 0; l < TENTATIVAS; l++) {
    const julgada = l < estado.chutes.length;
    const ativa = !julgada && l === estado.chutes.length && !estado.fim;

    const linha = document.createElement('div');
    linha.className = 'linha';
    if (julgada) linha.classList.add('linha--julgada');
    if (ativa) linha.classList.add('linha--ativa');
    if (l === TENTATIVAS - 1) linha.classList.add('linha--ultima');

    for (let i = 0; i < TAM; i++) {
      const c = document.createElement('div');
      c.className = 'celula';
      const ch = julgada ? estado.chutes[l][i] : ativa ? estado.atual[i] : null;

      if (ch) {
        c.textContent = ch;
        c.classList.add(ch === BRANCO ? 'celula--branco' : 'celula--cheia');
      }

      if (julgada && ch && ch !== BRANCO) {
        const m = marcaDaCasa(l, i);
        c.dataset.linha = l;
        c.dataset.casa = i;
        c.dataset.marca = m;
        c.dataset.provada = casaProvada(l, i) ? '1' : '0';
        c.setAttribute('role', 'button');
        c.setAttribute('tabindex', '0');
        c.setAttribute('aria-label',
          `${ch}${['', ' — marcada certa', ' — marcada meio certa', ' — marcada errada'][m]}`);
      }

      if (ativa) {
        c.dataset.casa = i;
        c.setAttribute('role', 'button');
        c.setAttribute('tabindex', '-1');
        c.setAttribute('aria-label', `casa ${i + 1}${ch ? `, ${ch}` : ', vazia'}`);
        if (i === estado.cursor) {
          c.classList.add('celula--cursor');
          c.setAttribute('aria-current', 'true');
        }
      }
      linha.appendChild(c);
    }

    /*
     * Os três contadores são filhos diretos da linha, não um bloco à parte:
     * a linha é uma grade de oito, e é isso que deixa tudo alinhado em coluna
     * sem gasto de espaço entre grupos.
     *
     * Nas linhas ainda não jogadas eles aparecem **vazios**, com a cor de cada
     * um. Custa nada e diz de cara a forma do retorno — que aqui não é óbvia:
     * quem chega esperando um Wordle precisa ver logo que o que volta são três
     * números, e não cinco cores.
     */
    const p = julgada ? pontuar(estado.chutes[l], estado.alvo) : null;
    for (const tipo of ['lugar', 'palavra', 'fora']) {
      const b = document.createElement('b');
      b.className = `num num--${tipo}`;
      if (p) b.textContent = p[tipo];
      else b.classList.add('num--vazio');
      linha.appendChild(b);
    }
    if (p) {
      linha.setAttribute('aria-label',
        `${estado.chutes[l]}: ${p.lugar} no lugar, ${p.palavra} na palavra, ${p.fora} fora`);
    }

    tabuleiro.appendChild(linha);
  }
}

/*
 * O branco fecha a segunda fila, que assim tem as mesmas dez teclas da
 * primeira. Ele já teve fila própria e custava uma linha inteira de altura —
 * cara demais para uma tecla, num jogo em que o teclado e as oito tentativas
 * precisam caber juntos na tela.
 */
const FILAS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'BRANCO'],
  ['ENVIAR', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'APAGAR'],
];

const ehLetra = (t) => /^[A-Z]$/.test(t);

function desenharTeclado() {
  const el = $('#teclado');
  el.replaceChildren();

  for (const fila of FILAS) {
    const div = document.createElement('div');
    div.className = 'fila';
    for (const t of fila) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tecla';
      b.dataset.tecla = t;

      if (t === 'ENVIAR' || t === 'APAGAR') b.classList.add('tecla--larga');
      if (t === 'BRANCO') {
        b.classList.add('tecla--branco');
        b.textContent = '␣';
        b.title = 'branco — deixa a casa em aberto (barra de espaço)';
        b.setAttribute('aria-label', 'branco');
      } else {
        b.textContent = t === 'APAGAR' ? '⌫' : t;
        if (t === 'APAGAR') b.setAttribute('aria-label', 'apagar');
      }
      div.appendChild(b);
    }
    el.appendChild(div);
  }

  // O teclado só digita. Marca é na casa do chute, com um clique.
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.tecla');
    if (b) apertar(b.dataset.tecla);
  });
}

function atualizarSelo() {
  $('#selo-rodada').textContent = `rodada nº ${numeroDaRodada(estado.dia)}`;
}

let avisoTimer;
function avisar(texto) {
  elAviso.textContent = texto;
  clearTimeout(avisoTimer);
  if (texto) avisoTimer = setTimeout(() => { elAviso.textContent = ''; }, 3200);
}

function tremer() {
  const linha = tabuleiro.children[estado.chutes.length];
  if (!linha) return;
  linha.classList.remove('linha--erro');
  void linha.offsetWidth;
  linha.classList.add('linha--erro');
}

// ---------------------------------------------------------------- o cursor

/** A próxima casa vazia a partir de `i`, dando a volta. `null` se estiver cheio. */
function proximaVaga(i) {
  for (let k = 0; k < TAM; k++) {
    const j = (i + k) % TAM;
    if (estado.atual[j] === null) return j;
  }
  return null;
}

function escrever(valor) {
  estado.atual[estado.cursor] = valor;
  const vaga = proximaVaga(estado.cursor + 1);
  estado.cursor = vaga === null ? Math.min(estado.cursor + 1, TAM - 1) : vaga;
  desenharTabuleiro();
}

function apagar() {
  if (estado.atual[estado.cursor] !== null) {
    estado.atual[estado.cursor] = null;
  } else {
    estado.cursor = Math.max(0, estado.cursor - 1);
    estado.atual[estado.cursor] = null;
  }
  desenharTabuleiro();
}

function mover(passo) {
  estado.cursor = Math.min(TAM - 1, Math.max(0, estado.cursor + passo));
  desenharTabuleiro();
}

// ---------------------------------------------------------------- a partida

function novaPartida() {
  estado.dia = hojeSP();
  estado.bonita = palavraDoDia(estado.dia);
  estado.alvo = semAcento(estado.bonita);

  // Rodada salva só serve se falar da mesma palavra: vocabulário novo reordena
  // o baralho, e aproveitá-la mostraria placar de outro jogo.
  const salvo = recuperar();
  const serve = salvo?.alvo === impressao(estado.alvo);
  const descartada = Boolean(salvo) && !serve;

  estado.chutes = serve ? salvo.chutes : [];
  estado.fim = serve ? salvo.fim : null;
  estado.contabilizada = serve ? Boolean(salvo.contabilizada) : false;
  estado.marcas = serve ? (salvo.marcas ?? {}) : {};
  if (descartada) guardar();
  estado.atual = Array(TAM).fill(null);
  estado.cursor = 0;

  recalcularProvas();
  atualizarSelo();
  desenharTabuleiro();
  avisar(descartada ? 'O vocabulário mudou — a cifra de hoje é outra, e a rodada recomeçou.' : '');

  if (estado.fim) setTimeout(() => abrirFim(), 250);
}

function apertar(tecla) {
  if (estado.fim) return;

  if (tecla === 'ENVIAR') return enviar();
  if (tecla === 'APAGAR') return apagar();

  if (tecla === 'BRANCO') {
    const jaTem = estado.atual.some((c, i) => c === BRANCO && i !== estado.cursor);
    if (jaTem) return avisar('Só um branco por chute.');
    return escrever(BRANCO);
  }
  if (ehLetra(tecla)) escrever(tecla);
}

function enviar() {
  if (estado.atual.includes(null)) {
    avisar('Faltam letras.');
    tremer();
    return;
  }

  const chute = estado.atual.join('');
  const recusa = motivoRecusa(chute);
  if (recusa) {
    avisar(recusa);
    tremer();
    return;
  }

  estado.chutes.push(chute);
  const p = pontuar(chute, estado.alvo);
  estado.atual = Array(TAM).fill(null);
  estado.cursor = 0;

  if (p.lugar === TAM) estado.fim = 'ganhou';
  else if (estado.chutes.length >= TENTATIVAS) estado.fim = 'perdeu';

  const contarProvas = () => estado.provado.ausentes.size
    + estado.provado.presentes.size + estado.provado.posicoes.size;

  const antes = contarProvas();
  recalcularProvas();
  const depois = contarProvas();

  guardar();
  desenharTabuleiro();

  const novas = depois - antes;
  if (!estado.fim && novas > 0) {
    avisar(novas > 1
      ? `${novas} letras marcadas sozinhas: os chutes já provaram.`
      : 'Uma letra marcada sozinha: os chutes já provaram.');
  } else {
    avisar('');
  }

  if (estado.fim) setTimeout(() => abrirFim(), 500);
}

// ---------------------------------------------------------------- o fim

const EMOJI = { lugar: '🟪', palavra: '🟨', fora: '⬛' };

function textoDePartilha() {
  const cabeca = `CIFRA nº ${numeroDaRodada(estado.dia)}`;
  const placar = estado.fim === 'ganhou' ? `${estado.chutes.length}/${TENTATIVAS}` : `X/${TENTATIVAS}`;

  const linhas = estado.chutes.map((c) => {
    const p = pontuar(c, estado.alvo);
    return `${EMOJI.lugar}${p.lugar} ${EMOJI.palavra}${p.palavra} ${EMOJI.fora}${p.fora}`;
  });

  return [`${cabeca} — ${placar}`, '', ...linhas, '', 'exchaos.com.br/jogos/cifra'].join('\n');
}

function faltaParaAmanha() {
  const emSP = new Date(new Date().toLocaleString('en-US', { timeZone: FUSO }));
  const meia = new Date(emSP);
  meia.setHours(24, 0, 0, 0);
  const min = Math.max(0, Math.round((meia - emSP) / 60000));
  return `${String(Math.floor(min / 60)).padStart(2, '0')}h${String(min % 60).padStart(2, '0')}`;
}

function abrirFim() {
  contabilizar();

  const ganhou = estado.fim === 'ganhou';
  $('#fim-veredito').textContent = ganhou ? 'Decifrada.' : 'O oráculo calou.';
  $('#fim-veredito').style.color = ganhou ? 'var(--lugar)' : 'var(--perigo)';
  $('#fim-palavra').textContent = estado.bonita.toUpperCase();
  $('#fim-partilha').hidden = true;   // só reaparece se a cópia falhar
  $('#btn-copiar').textContent = 'Copiar resultado';
  $('#fim-proxima').textContent = `próxima cifra em ${faltaParaAmanha()}`;
  desenharEstatisticas($('#fim-stats'));
  $('#modal-fim').showModal();
}

/**
 * O histórico, desenhado. Vai em dois lugares — no fim da partida e no botão
 * do cabeçalho — e por isso recebe o container em vez de procurá-lo.
 */
function desenharEstatisticas(alvo) {
  const s = lerStats();
  alvo.replaceChildren();

  if (!s.jogos) {
    const p = document.createElement('p');
    p.className = 'stats-vazio';
    p.textContent = 'Nenhuma cifra decifrada ainda. A primeira conta amanhã de manhã.';
    alvo.appendChild(p);
    return;
  }

  // A distribuição vem antes do resumo: logo depois de jogar, a pergunta é
  // "onde a de hoje caiu", e ela é a única que responde isso.
  const titulo = document.createElement('h3');
  titulo.textContent = 'Em quantas tentativas';
  alvo.appendChild(titulo);

  const maior = Math.max(1, ...s.dist);
  const graf = document.createElement('div');
  graf.className = 'stats-dist';
  for (let i = 0; i < TENTATIVAS; i++) {
    const linha = document.createElement('div');
    linha.className = 'stats-barra';

    const n = document.createElement('span');
    n.textContent = i + 1;

    const barra = document.createElement('i');
    barra.style.width = s.dist[i] ? `${Math.max(9, (s.dist[i] / maior) * 100)}%` : '0';
    if (estado.fim === 'ganhou' && estado.chutes.length === i + 1) barra.classList.add('atual');

    const v = document.createElement('b');
    v.textContent = s.dist[i];

    linha.append(n, barra, v);
    graf.appendChild(linha);
  }
  alvo.appendChild(graf);

  const pct = Math.round((s.vitorias / s.jogos) * 100);
  const numeros = document.createElement('div');
  numeros.className = 'stats-numeros';
  for (const [rotulo, valor] of [
    ['cifras', s.jogos], ['decifradas', `${pct}%`],
    ['sequência', s.sequencia], ['melhor', s.melhor],
  ]) {
    const cx = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = valor;
    const sp = document.createElement('span');
    sp.textContent = rotulo;
    cx.append(b, sp);
    numeros.appendChild(cx);
  }
  alvo.appendChild(numeros);
}

// ---------------------------------------------------------------- ligações

function ligar() {
  $('#btn-ajuda').addEventListener('click', () => $('#modal-ajuda').showModal());

  $('#btn-stats').addEventListener('click', () => {
    desenharEstatisticas($('#stats-corpo'));
    $('#modal-stats').showModal();
  });

  /*
   * O tabuleiro tem dois cliques diferentes, e a linha diz qual é: na linha
   * ativa você escolhe onde a próxima letra cai; numa linha já julgada você
   * cicla a marca daquela casa.
   */
  tabuleiro.addEventListener('click', (e) => {
    const c = e.target.closest('.celula[data-casa]');
    if (!c) return;

    if (c.closest('.linha--julgada')) {
      return ciclarCasa(Number(c.dataset.linha), Number(c.dataset.casa));
    }
    if (c.closest('.linha--ativa') && !estado.fim) {
      estado.cursor = Number(c.dataset.casa);
      desenharTabuleiro();
    }
  });

  // Enter/Espaço numa casa julgada: o mesmo que clicar, pra quem usa teclado.
  tabuleiro.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'Space') return;
    const c = e.target.closest('.linha--julgada .celula[data-casa]');
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    ciclarCasa(Number(c.dataset.linha), Number(c.dataset.casa));
  });

  $('#btn-limpar-marcas').addEventListener('click', () => {
    estado.marcas = {};
    guardar();
    desenharTabuleiro();
    avisar('Marcas à mão apagadas. O que os chutes provam continua.');
  });

  $('#btn-copiar').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(textoDePartilha());
      e.target.textContent = 'Copiado!';
      setTimeout(() => { e.target.textContent = 'Copiar resultado'; }, 1800);
    } catch {
      // Sem área de transferência (contexto inseguro, permissão negada): o
      // resultado aparece para ser copiado à mão, em vez de sumir em silêncio.
      const bloco = $('#fim-partilha');
      bloco.textContent = textoDePartilha();
      bloco.hidden = false;
      e.target.textContent = 'Copie daqui';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') { e.preventDefault(); return apertar('ENVIAR'); }
    if (e.key === 'Backspace') { e.preventDefault(); return apertar('APAGAR'); }
    // `code` além de `key` porque nem toda origem preenche os dois: layout com
    // IME, teclado virtual de sistema e automação chegam com um deles vazio.
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); return apertar('BRANCO'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); return mover(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); return mover(1); }

    const letra = semAcento(e.key);
    if (ehLetra(letra)) apertar(letra);
  });
}

// ---------------------------------------------------------------- conferir

/**
 * As checagens, em `?conferir`. Pequenas de propósito: o que pode regredir aqui
 * é a contagem, a validação e a dedução — e é o que elas medem.
 */
function conferir() {
  const casos = [];
  const eq = (nome, a, b) => casos.push({ nome, ok: JSON.stringify(a) === JSON.stringify(b), a, b });
  const lista = (s) => [...s].sort();

  eq('acerto cheio', pontuar('CASAL', 'CASAL'), { lugar: 5, palavra: 0, fora: 0 });
  eq('erro cheio', pontuar('MUITO', 'CASAL'), { lugar: 0, palavra: 0, fora: 5 });
  eq('anagrama puro', pontuar('ABCDE', 'BCDEA'), { lugar: 0, palavra: 5, fora: 0 });
  eq('repetida do chute nao infla', pontuar('AAAAA', 'CASAL'), { lugar: 2, palavra: 0, fora: 3 });
  eq('repetida do alvo conta uma vez', pontuar('SALAS', 'CASAL'), { lugar: 2, palavra: 2, fora: 1 });
  eq('branco nao entra na soma', somaDe(pontuar('CAS_L', 'CASAL')), 4);
  eq('branco nao vira acerto', pontuar('CAS_L', 'CASAL'), { lugar: 4, palavra: 0, fora: 0 });
  eq('letra sob o branco ainda casa amarelo', pontuar('_AAAA', 'ABCDE').palavra, 1);

  eq('recusa palavra fora do dicionario', motivoRecusa('XXXXX') !== null, true);
  eq('aceita palavra do dicionario', motivoRecusa('CASAL'), null);
  eq('recusa dois brancos', motivoRecusa('CA__L') !== null, true);
  eq('aceita um branco com molde existente', motivoRecusa('CAS_L'), null);
  eq('recusa molde sem nenhuma palavra', motivoRecusa('XYZW_') !== null, true);
  eq('recusa chute curto', motivoRecusa('CASA') !== null, true);

  // dedução
  eq('chute zerado mata todas as letras',
    lista(deduzir(['MUITO'], 'CASAL').ausentes), ['I', 'M', 'O', 'T', 'U']);
  eq('chute zerado nao afirma presenca',
    deduzir(['MUITO'], 'CASAL').presentes.size, 0);
  eq('chute sem fora prova todas presentes',
    lista(deduzir(['SALAS'], 'SALSA').presentes), ['A', 'L', 'S']);
  eq('nada a provar em chute misto',
    deduzir(['CASAL'], 'GRATO').ausentes.size + deduzir(['CASAL'], 'GRATO').presentes.size, 0);
  // O encadeamento é o que justifica o laço rodar até parar de mudar.
  // Contra GRATO, PEIXE zera e mata P,E,I,X. Aí PEGAR — que vale 3 acertos —
  // passa a ter só três casas vivas (G, A, R), e três acertos em três casas
  // vivas prova as três presentes. Sozinho, PEGAR não prova nada: 3 acertos em
  // 5 casas abertas não diz quais.
  eq('a deducao encadeia',
    lista(deduzir(['PEIXE', 'PEGAR'], 'GRATO').presentes), ['A', 'G', 'R']);
  eq('sem o chute anterior nao daria pra provar',
    deduzir(['PEGAR'], 'GRATO').presentes.size, 0);
  // A regra de posição. Sem ela, a jogada que vence pintava a palavra certa de
  // "meio certa": provada presente, com a posição em aberto — que era mentira.
  eq('a jogada que vence prova as cinco casas',
    [...deduzir(['GRATO'], 'GRATO').posicoes].sort(), ['0:0', '0:1', '0:2', '0:3', '0:4']);
  eq('acerto parcial nao prova posicao nenhuma',
    deduzir(['CASAL'], 'GRATO').posicoes.size, 0);
  eq('nao basta pontuar alto: tem que ser tudo no lugar',
    deduzir(['ABCDE'], 'BCDEA').posicoes.size, 0);
  eq('com branco, prova so as casas digitadas',
    [...deduzir(['GRA_O'], 'GRATO').posicoes].sort(), ['0:0', '0:1', '0:2', '0:4']);

  eq('nunca prova algo falso', (() => {
    const alvo = 'GRATO';
    const { ausentes, presentes } = deduzir(['PEIXE', 'PEGAR', 'CASAL'], alvo);
    return ausentes.size > 0 && presentes.size > 0
      && [...ausentes].every((c) => !alvo.includes(c))
      && [...presentes].every((c) => alvo.includes(c));
  })(), true);

  eq('o baralho e a lista inteira', BARALHO.length, RESPOSTAS.length);
  eq('o baralho nao perde nem duplica carta',
    new Set(BARALHO).size, RESPOSTAS.length);
  eq('todo alvo tem 5 letras',
    BARALHO.every((p) => semAcento(p).length === 5), true);
  eq('todo alvo esta no dicionario',
    BARALHO.every((p) => ACEITAS.has(semAcento(p))), true);
  eq('a rodada do dia e estavel',
    palavraDoDia('2026-09-01'), palavraDoDia('2026-09-01'));
  eq('dias seguidos dao palavras diferentes',
    palavraDoDia('2026-09-01') !== palavraDoDia('2026-09-02'), true);
  // Nenhuma repetição antes de o baralho inteiro passar: é o que o embaralhar
  // uma vez garante e a escolha por hash não garantiria.
  eq('o ciclo inteiro nao repete palavra', (() => {
    const vistas = new Set();
    for (let n = 1; n <= BARALHO.length; n++) {
      const d = new Date(Date.UTC(2026, 8, n));
      const iso = d.toISOString().slice(0, 10);
      vistas.add(palavraDoDia(iso));
    }
    return vistas.size;
  })(), BARALHO.length);

  // Duas grafias que só diferem no acento são o *mesmo* chute, porque a
  // comparação é sem acento. Se as duas existirem na lista, uma delas é
  // resposta impossível de revelar direito — `mares`/`marés`, `forca`/`força`.
  const porForma = new Map();
  const colisoes = [];
  for (const p of [...RESPOSTAS, ...EXTRAS]) {
    const f = semAcento(p);
    if (porForma.has(f)) colisoes.push(`${porForma.get(f)} / ${p}`);
    else porForma.set(f, p);
  }
  eq('nenhuma palavra colide sem acento', colisoes, []);

  const falhas = casos.filter((c) => !c.ok);
  console.log(`Cifra — ${casos.length - falhas.length}/${casos.length} checagens passaram`);
  for (const f of falhas) console.error('FALHOU:', f.nome, f.a, '≠', f.b);
  return falhas.length === 0;
}

const somaDe = (p) => p.lugar + p.palavra + p.fora;

// ---------------------------------------------------------------- partida

desenharTeclado();
ligar();
novaPartida();

if (new URLSearchParams(location.search).has('conferir')) conferir();

// A ajuda abre sozinha só na primeira visita, e só com a rodada intacta: se já
// há partida em andamento ou terminada, `novaPartida` tem o seu próprio modal
// para abrir, e dois empilhados não ajudam ninguém.
try {
  if (!localStorage.getItem('cifra:visto') && estado.chutes.length === 0 && !estado.fim) {
    $('#modal-ajuda').showModal();
    localStorage.setItem('cifra:visto', '1');
  }
} catch { /* sem localStorage: a ajuda fica no botão "?", que é onde ela mora mesmo */ }
