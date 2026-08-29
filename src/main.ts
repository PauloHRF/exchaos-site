import {
  jornadaDoDia,
  epilogo,
  moralDaParty,
  perfilDaParty,
  selo,
  sinergia,
  sortearCandidatos,
  textoDeCompartilhamento,
  todosOsHerois,
  type Candidato,
} from './motor.ts';
import {
  CANSACO_MAXIMO,
  ESQUADRAO_MAXIMO,
  ESQUADRAO_MINIMO,
  MAXIMO_DO_ESQUADRAO,
  PESO_DO_CANSACO,
  TETO_DA_SOBRA,
  atributoEfetivo,
  avancarCansaco,
  cargasNovas,
  chaveDoEpilogo,
  cobrarBaixa,
  comoCampanha,
  contaDaMissao,
  eixosCobrados,
  exigenciaDaMissao,
  resolverMissao,
  sinergiaDoEsquadrao,
  type Cansaco,
  type Cargas,
  type ContextoDaMissao,
  type EntradaDaMissao,
  type RelatoMissao,
} from './despacho.ts';
import { desenharCartao } from './cartao.ts';
import { numerosHtml, radarDespachoHtml, radarHtml } from './radar.ts';
import { fundoDaCena, fundoDoRetrato } from './retrato.ts';
import { diaDeHoje, hash, mulberry32, numeroDoDia } from './rng.ts';
import {
  EIXOS,
  ICONE_TIPO,
  MAXIMO_DA_PARTY,
  ROTULO_EIXO,
  ROTULO_ETIQUETA,
  ROTULO_TIPO,
  TAMANHO_PARTY,
  ROTULO_RESULTADO,
  TOLERANCIA_MORAL,
  TRACOS,
} from './regras.ts';
import type {
  BaseDeHerois,
  CatalogoDesafios,
  Desafio,
  Eixo,
  Recrutado,
  ResultadoEtapa,
} from './tipos.ts';

/**
 * O selo da ExChaos: a Estrela do Caos com o núcleo dourado de ordem.
 *
 * Vai embutido em vez de vir de `public/` porque é o que o resto da arte já
 * faz — brasões e cenários também são SVG gerado aqui — e porque um pedido de
 * rede a mais para 1 KB de marca não se paga. A versão colorida é a correta:
 * o guia manda usá-la sobre superfície escura, que é o fundo obsidiana daqui.
 */
const SELO_EXCHAOS = `
<svg class="selo-svg" viewBox="0 0 200 200" role="img" aria-label="ExChaos">
  <defs>
    <g id="flecha-exchaos">
      <path d="M100,84 L100,42" fill="none" stroke="#E4D5B7" stroke-width="7" stroke-linecap="round"/>
      <path d="M100,33 L109,48 L91,48 Z" fill="#E4D5B7"/>
    </g>
  </defs>
  <circle cx="100" cy="100" r="94" fill="none" stroke="#9A6BE8" stroke-width="1.4"/>
  <circle cx="100" cy="100" r="91" fill="none" stroke="#9A6BE8" stroke-width="2.2" stroke-dasharray="2 10"/>
  <circle cx="100" cy="100" r="87" fill="none" stroke="#9A6BE8" stroke-width="0.7"/>
  <g fill="#C9962E">
    <circle cx="150" cy="70" r="1.3"/><circle cx="52" cy="126" r="1.1"/>
    <circle cx="126" cy="150" r="1.2"/><circle cx="70" cy="52" r="1"/>
  </g>
  <use href="#flecha-exchaos" transform="rotate(0 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(45 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(90 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(135 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(180 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(225 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(270 100 100)"/>
  <use href="#flecha-exchaos" transform="rotate(315 100 100)"/>
  <path d="M100,92 L101.8,98.2 L108,100 L101.8,101.8 L100,108 L98.2,101.8 L92,100 L98.2,98.2 Z" fill="#C9962E"/>
</svg>`;

const ROTULO_MORAL: Record<number, string> = {
  [-3]: 'Vilão',
  [-2]: 'Cruel',
  [-1]: 'Ambíguo',
  0: 'Neutro',
  1: 'Decente',
  2: 'Nobre',
  3: 'Santo',
};

const MARCADOR_ETAPA: Record<ResultadoEtapa, string> = {
  'vitoria-limpa': '🟩',
  'vitoria-custosa': '🟨',
  derrota: '🟥',
  'nao-jogada': '⬛',
};

interface Estado {
  tela: 'inicio' | 'ajuda' | 'draft' | 'jornada' | 'cartao';
  dia: string;
  treino: boolean;
  jornada: Desafio[];
  party: Recrutado[];
  rodada: number;
  tentativa: number;
  candidatos: Candidato[];

  /* --- a jornada de despacho --- */
  /** Quem ainda está de pé. */
  vivos: Recrutado[];
  cansaco: Cansaco;
  /** As cargas que se gastam uma vez por jornada: amuleto, mártir, teimoso. */
  cargas: Cargas;
  /** Em que missão a jornada está, de 0 a 6. */
  missao: number;
  vitorias: number;
  falhas: number;
  /** Quem está marcado para ir na missão atual. */
  selecao: string[];
  /** As missões já fechadas. */
  relatos: RelatoMissao[];
  /** A missão resolvida que está na tela, ainda não fechada. */
  relato: RelatoMissao | null;
  /** As bolinhas estão correndo: o desfecho ainda não apareceu. */
  rolando: boolean;
  concluida: boolean;
  /** Os ids de quem foi em cada missão. É o que o salvamento guarda. */
  despachos: string[][];

  /**
   * O acaso e as frases vivem no estado porque a jornada avança clique a
   * clique: um gerador recriado a cada missão repetiria os mesmos dados, e um
   * conjunto de frases recriado repetiria as mesmas linhas.
   */
  rnd: () => number;
  frasesUsadas: Set<string>;
}

let dbHerois: BaseDeHerois;
let catalogo: CatalogoDesafios;
let estado: Estado;
let treinoPendente = false;

const app = document.querySelector<HTMLDivElement>('#app')!;
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
/**
 * A chave do salvamento continua com o nome antigo de propósito: é
 * identificador interno, não endereço. Trocá-la faria toda jornada já guardada
 * sumir sem ganho nenhum.
 */
const chaveSalva = (dia: string) => `ateotrono:${dia}`;
const sinalMoral = (m: number) => (m > 0 ? `+${m}` : `${m}`);
const comSinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

const eixosDoHeroi = (h: Recrutado): Record<Eixo, number> =>
  Object.fromEntries(EIXOS.map((e) => [e, h[e]])) as Record<Eixo, number>;

/* ------------------------------------------------------------------ pedaços */

function moralHtml(moral: number): string {
  const classe = moral > 0 ? 'luz' : moral < 0 ? 'trevas' : 'cinza';
  return `<span class="moral ${classe}">${sinalMoral(moral)} ${ROTULO_MORAL[moral]}</span>`;
}

function retratoHtml(heroi: Recrutado, classe = ''): string {
  return `<span class="retrato ${classe}" style="background-image:${fundoDoRetrato(heroi)}"
    role="img" aria-label="Retrato de ${escapar(heroi.nome)}"></span>`;
}

function candidatoHtml(candidato: Candidato, indice: number): string {
  const { heroi, recusa } = candidato;
  const eixos = eixosDoHeroi(heroi);
  const rotulo = `Recrutar ${heroi.nome}, ${heroi.classe} de ${heroi.jogo}`;
  return `
    <button class="carta ${recusa ? 'recusado' : ''}" data-recrutar="${indice}"
            aria-label="${escapar(rotulo)}" ${recusa ? 'disabled' : ''}>
      ${retratoHtml(heroi)}
      <span class="carta-corpo">
        <span class="nome">${escapar(heroi.nome)}</span>
        <span class="classe">${escapar(heroi.classe)}</span>
        <span class="guilda">${escapar(heroi.jogo)}</span>
        ${moralHtml(heroi.moral)}
        ${numerosHtml(eixos)}
        <span class="traco-heroi" title="${escapar(TRACOS[heroi.traco].descricao)}">
          <b>${TRACOS[heroi.traco].nome}</b>
          <i>${escapar(TRACOS[heroi.traco].descricao)}</i>
        </span>
        <span class="tracos">
          ${heroi.etiquetas.map((e) => `<span class="traco">${ROTULO_ETIQUETA[e]}</span>`).join('')}
          ${heroi.recusa.map((e) => `<span class="traco veto">recusa ${ROTULO_ETIQUETA[e]}</span>`).join('')}
        </span>
        ${recusa ? `<span class="motivo-recusa">${escapar(recusa.texto)}</span>` : ''}
      </span>
    </button>`;
}

/** O pentágono da party. Sem contorno de exigência: o dia não se anuncia. */
function pentagonoHtml(tamanho = 190): string {
  const perfil = perfilDaParty(estado.party);
  return `
    <div class="pentagono">
      <div class="radar-caixa grande">
        ${radarHtml(perfil, MAXIMO_DA_PARTY, {
          tamanho,
          rotulos: true,
          titulo: 'Atributos somados da party',
        })}
      </div>
      <div class="legenda">
        ${EIXOS.map(
          (e) => `<div class="linha-eixo">
            <span class="rotulo">${ROTULO_EIXO[e]}</span>
            <span class="valor">${perfil[e]}</span>
          </div>`,
        ).join('')}
      </div>
    </div>`;
}

/** A companhia em fileira: cinco lugares, cheios ou vagos, sempre na mesma linha. */
function partyHtml(): string {
  const membros = estado.party
    .map(
      (h) => `<li class="membro">
        ${retratoHtml(h, 'medio')}
        <span class="nome">${escapar(h.nome)}</span>
        <span class="meta">${escapar(TRACOS[h.traco].nome)}</span>
        <span class="meta fraca">${escapar(h.jogo)} · ${sinalMoral(h.moral)}</span>
      </li>`,
    )
    .join('');
  const vagas = Array.from(
    { length: TAMANHO_PARTY - estado.party.length },
    () => `<li class="membro vazio"><span class="marca-vaga">+</span><span class="nome">vaga</span></li>`,
  ).join('');
  const { motivos, bonus } = sinergia(estado.party);
  return `<ul class="party">${membros}${vagas}</ul>
    ${
      motivos.length
        ? `<p class="ajuda sinergia">Sinergia ${comSinal(bonus)}: ${motivos.map(escapar).join('; ')}.</p>`
        : ''
    }`;
}

/* -------------------------------------------------------------------- telas */

function telaInicio(): string {
  const salva = localStorage.getItem(chaveSalva(diaDeHoje()));
  return `
    <div class="coluna-estreita">
      <div class="bloco pergaminho ornado">
        <h2>A jornada de hoje</h2>
        <p>
          Sete provas separam vocês do trono. Quatro se resolvem no aço; as outras
          três, não — e é nelas que morre quem só sabe brigar.
        </p>
        <p>
          Cinco heróis atendem ao chamado, um por vez, entre os quatro que a estrada
          trouxe naquela hora. A estrada traz os mesmos quatro para todo mundo, hoje.
        </p>
        <p>
          Ninguém marcha ao lado de qualquer um. Há quem não durma perto de um
          morto-vivo, quem não aceite dividir a fogueira com magia negra, e quem
          jamais siga uma coroa.
        </p>
        <p class="remate">
          Chegar ao trono já é raro. <strong>Chegar com todo mundo, quase ninguém consegue.</strong>
        </p>
      </div>
      <button class="botao" data-comecar="1">Atender ao chamado</button>
      <button class="botao secundario" data-ajuda="1">Como se joga</button>
      ${salva ? `<button class="botao secundario" data-ver-salva="1">Rever a jornada de hoje</button>` : ''}
      <button class="botao secundario" data-treino="1">Marchar num dia qualquer (não conta)</button>
    </div>`;
}

/** Todas as regras num lugar só. O jogo não se explica sozinho, e não deveria. */
function telaAjuda(): string {
  return `
    <div class="coluna-estreita">
      <div class="bloco ajuda-pagina">
        <h2>O objetivo</h2>
        <p>
          Sete provas separam a companhia do trono do Rei Demônio. Vencer as sete já é
          raro. Vencer as sete <strong>sem perder ninguém</strong> é o feito que quase
          não acontece — e é o que o jogo pede.
        </p>
        <p class="aviso">
          <strong>Falhar uma missão não encerra a jornada</strong> — mas cada uma
          perdida deixa o Rei Demônio mais forte para o encontro final.
        </p>

        <h2>O recrutamento</h2>
        <p>
          Cinco rodadas. Em cada uma, a estrada traz <strong>quatro candidatos</strong>
          de jogos diferentes, e você fica com um. São os mesmos quatro para todo mundo
          no mundo, no mesmo dia.
        </p>
        <p>
          Não existe dinheiro. Todos os heróis somam os mesmos 32 pontos — o que muda é
          <strong>a forma</strong>: um pode ter 11 de Combate e 2 de Carisma. Escolher é
          sempre trocar um lado forte por um lado fraco.
        </p>

        <h2>Quem aceita marchar com quem</h2>
        <ul>
          <li>
            <strong>Moral</strong> — cada herói vai de -3 (vilão) a +3 (santo), e não
            marcha com quem estiver a mais de ${TOLERANCIA_MORAL} pontos de distância.
            Um santo e um vilão nunca dividem a mesma fogueira.
          </li>
          <li>
            <strong>Etiquetas</strong> — morto-vivo, magia negra, realeza, fora da lei,
            besta, sacro, máquina, mercenário. Muitos heróis recusam companhia de certas
            etiquetas, e a carta diz qual.
          </li>
          <li>
            <strong>Traços</strong> — cada herói traz um, e <strong>o traço é único na
            companhia</strong>: só há um Comandante, um Mártir, um Duelista. Alguns
            traços também recusam etiquetas.
          </li>
        </ul>
        <p>
          Candidato recusado aparece apagado, com o motivo escrito. Se os quatro
          recusarem, a estrada traz outros quatro.
        </p>

        <h2>O despacho</h2>
        <p>
          As sete missões vêm uma a uma, e cada uma <strong>mostra o que exige</strong>:
          um pentágono com o quanto ela pede de cada eixo
          (${EIXOS.map((e) => ROTULO_EIXO[e]).join(', ')}). Você despacha
          <strong>${ESQUADRAO_MINIMO} ou ${ESQUADRAO_MAXIMO} da companhia</strong> — a
          última leva todos os que sobraram.
        </p>
        <p>
          O que decide é a soma do <strong>esquadrão despachado</strong>, eixo por eixo,
          contra o que a missão pede. Sinergia e traços contam só entre quem foi: os dois
          da mesma franquia só se ajudam se marcharem juntos.
        </p>
        <p class="conta-exemplo">
          em cada eixo cobrado: soma do esquadrão + sinergia + traços + moral + dado (−4 a +4)
          <br />contra o que a missão pede naquele eixo
        </p>
        <p>
          Os saldos dos eixos somados dão a <strong>margem</strong> da missão. Sobrar
          muito num eixo <strong>não compensa</strong> faltar noutro: cada eixo aproveita
          no máximo ${TETO_DA_SOBRA} de sobra, e o resto se perde. Esquadrão torto perde
          para esquadrão parelho.
        </p>

        <h2>O cansaço</h2>
        <p>
          Quem é despachado volta cansado, e cada ponto de cansaço tira
          ${PESO_DO_CANSACO} de <strong>cada atributo</strong> dele. Quem fica de fora
          recupera um ponto. Ninguém fica indisponível — dá para insistir no time A e
          pagar por isso.
        </p>
        <p>
          É a decisão central do jogo: a missão final leva <strong>todos os que
          sobraram</strong>, então chegar ao trono com a companhia inteira exausta é o
          preço de nunca ter rodado o elenco.
        </p>

        <h2>Os cinco desfechos de uma missão</h2>
        <ul class="desfechos">
          <li><span class="marca brilhante">★</span> <strong>Brilhante</strong> — folgado demais para dar errado.</li>
          <li><span class="marca sucesso">●</span> <strong>Sucesso</strong> — resolvido.</li>
          <li><span class="marca custoso">◍</span> <strong>Custoso</strong> — resolvido, e alguém ficou pelo caminho.</li>
          <li><span class="marca falha">○</span> <strong>Falha</strong> — não resolvido, mas ninguém caiu.</li>
          <li><span class="marca grave">✝</span> <strong>Fracasso grave</strong> — não resolvido, e custou uma vida.</li>
        </ul>
        <p>
          O dado é o azar puro, e há <strong>um por eixo cobrado</strong>: nove resultados
          igualmente prováveis, de −4 a +4. No pior deles alguém pode tombar
          <strong>mesmo numa missão vencida</strong> — é o que impede que chegar ao trono
          e chegar inteiro sejam a mesma coisa.
        </p>

        <h2>O dia</h2>
        <p>
          Uma jornada por dia, igual para todo mundo. O resultado fica guardado no seu
          navegador. O modo treino sorteia um dia avulso e pode ser repetido à vontade.
        </p>
      </div>
      <button class="botao" data-voltar-inicio="1">Voltar</button>
    </div>`;
}

/** Tela só do cartão: a imagem grande e o que fazer com ela. */
function telaCartao(): string {
  return `
    <div class="coluna-cartao">
      <div class="cartao-caixa">
        <img class="cartao" alt="Cartão da jornada, para compartilhar" />
      </div>
      <div class="cartao-acoes">
        <button class="botao" data-copiar-imagem="1">Copiar a imagem</button>
        <button class="botao secundario" data-baixar-imagem="1">Baixar a imagem</button>
        <button class="botao secundario" data-voltar-desfecho="1">Voltar ao desfecho</button>
      </div>
    </div>`;
}

function telaDraft(): string {
  const todosRecusam = estado.candidatos.every((c) => c.recusa !== null);
  return `
    <div class="duas-colunas">
      <aside class="lateral">
        <div class="bloco">
          <h2>Atributos somados</h2>
          ${pentagonoHtml(178)}
        </div>
      </aside>
      <section class="principal">
        <div class="bloco">
          <div class="guilda-cabecalho">
            <h2>Rodada ${estado.rodada + 1} de ${TAMANHO_PARTY}</h2>
            <span class="ajuda">${todosRecusam ? 'ninguém aceita' : 'recrute um'}</span>
          </div>
          ${
            todosRecusam
              ? `<p class="ajuda">Nenhum dos quatro marcha com essa companhia.</p>
                 <button class="botao" data-resortear="1" style="margin-top:12px">Esperar outros quatro</button>`
              : `<div class="ofertas">${estado.candidatos.map(candidatoHtml).join('')}</div>`
          }
        </div>
      </section>
    </div>
    <div class="bloco">
      <h2>A companhia</h2>
      ${partyHtml()}
    </div>`;
}

/* ------------------------------------------------------------------ jornada */

/**
 * A jornada de despacho.
 *
 * Diferença de fundo em relação ao modelo antigo: lá a campanha inteira era
 * simulada de uma vez e a tela só a reproduzia; aqui **cada missão espera uma
 * decisão do jogador**, então o estado avança de verdade a cada clique. É por
 * isso que o salvamento guarda os despachos, e não só a party: sem eles não há
 * como reconstituir a jornada.
 */

const contextoDaMissao = (): ContextoDaMissao => ({
  prova: estado.jornada[estado.missao].tipo,
  numero: estado.missao + 1,
  totalDeMissoes: estado.jornada.length,
  houveBaixa: estado.vivos.length < estado.party.length,
});

const exigenciaAtual = () =>
  exigenciaDaMissao(estado.jornada[estado.missao], estado.missao, estado.falhas);

const naUltimaMissao = () => estado.missao === estado.jornada.length - 1;

/** Quem vai: na última, todo mundo que sobrou; nas outras, quem foi marcado. */
function esquadraoAtual(): Recrutado[] {
  if (naUltimaMissao()) return estado.vivos.slice();
  return estado.vivos.filter((h) => estado.selecao.includes(h.id));
}

function entradaDaMissao(esquadrao: Recrutado[]): EntradaDaMissao {
  return {
    esquadrao,
    desafio: estado.jornada[estado.missao],
    exigencia: exigenciaAtual(),
    cansaco: estado.cansaco,
    moralDaParty: moralDaParty(estado.party),
    ctx: contextoDaMissao(),
  };
}

/**
 * O medidor de cansaço. Pontinhos, não barra: o número é pequeno e inteiro, e
 * contar três bolinhas é mais rápido que ler uma barra pela metade.
 */
function cansacoHtml(heroi: Recrutado): string {
  const n = estado.cansaco[heroi.id] ?? 0;
  const pontos = Array.from({ length: CANSACO_MAXIMO - 1 }, (_, i) =>
    i < n ? '<b class="gasto"></b>' : '<b></b>',
  ).join('');
  const titulo = n === 0 ? 'descansado' : `cansaço ${n}: menos ${n * PESO_DO_CANSACO} em cada atributo`;
  return `<span class="cansaco ${n === 0 ? 'inteiro' : n >= 3 ? 'exausto' : ''}"
    title="${titulo}">${pontos}</span>`;
}

/** Os atributos do herói nos eixos que ESTA missão cobra, já com o cansaço. */
function atributosNaMissaoHtml(heroi: Recrutado, cobrados: Eixo[]): string {
  return `<span class="eixos-do-heroi">${cobrados
    .map((e) => {
      const agora = atributoEfetivo(heroi, e, estado.cansaco);
      return `<span title="${ROTULO_EIXO[e]}">
        <i>${ROTULO_EIXO[e].slice(0, 3).toUpperCase()}</i>
        <b class="${agora < heroi[e] ? 'gasto' : ''}">${agora}</b>
      </span>`;
    })
    .join('')}</span>`;
}

function fichaHtml(heroi: Recrutado, cobrados: Eixo[]): string {
  const vai = estado.selecao.includes(heroi.id) || naUltimaMissao();
  const cheio = estado.selecao.length >= ESQUADRAO_MAXIMO && !vai;
  const travado = naUltimaMissao() || estado.relato !== null;
  return `
    <button class="ficha ${vai ? 'vai' : ''} ${cheio ? 'cheio' : ''}"
      data-alternar="${heroi.id}" ${travado ? 'disabled' : ''}
      aria-pressed="${vai}" aria-label="${escapar(heroi.nome)}${vai ? ', despachado' : ''}">
      ${retratoHtml(heroi, 'pequeno')}
      <span class="ficha-corpo">
        <span class="nome">${escapar(heroi.nome)}</span>
        <span class="meta" title="${escapar(TRACOS[heroi.traco].descricao)}">${TRACOS[heroi.traco].nome}</span>
        ${atributosNaMissaoHtml(heroi, cobrados)}
      </span>
      ${cansacoHtml(heroi)}
    </button>`;
}

/** A fita das sete missões: onde a jornada está e o que já custou. */
function fitaHtml(): string {
  return `<div class="fita">${estado.jornada
    .map((_, i) => {
      const r = estado.relatos[i];
      const marca = r
        ? MARCADOR_ETAPA[r.venceu ? (r.caido ? 'vitoria-custosa' : 'vitoria-limpa') : 'derrota']
        : i === estado.missao
          ? '◆'
          : '·';
      return `<span class="${i === estado.missao && !estado.concluida ? 'agora' : ''}">${marca}</span>`;
    })
    .join('')}</div>`;
}

function telaDespacho(): string {
  const desafio = estado.jornada[estado.missao];
  const exigencia = exigenciaAtual();
  const cobrados = eixosCobrados(exigencia);
  const esquadrao = esquadraoAtual();
  const dados = estado.relato && !estado.rolando ? estado.relato.dados : undefined;
  const conta = esquadrao.length ? contaDaMissao(entradaDaMissao(esquadrao), dados) : null;
  const somas =
    conta?.somas ?? (Object.fromEntries(EIXOS.map((e) => [e, 0])) as Record<Eixo, number>);

  /**
   * O saldo mostrado já leva o teto da sobra, e a margem é a soma exata desta
   * coluna. Com o saldo cru a tabela não fechava com o total, e a regra de que
   * sobra demais num eixo é desperdiçada virava mágica em vez de lição.
   */
  const linhas = cobrados
    .map((e) => {
      const posto = somas[e];
      const dado = dados?.[e];
      const cru = posto + (dado ?? 0) - exigencia[e];
      const aproveitado = Math.min(cru, TETO_DA_SOBRA);
      return `<tr class="${aproveitado >= 0 ? 'cobre' : 'falta'}">
        <th>${ROTULO_EIXO[e]}</th>
        <td class="num">${posto}</td>
        <td class="col-dado">${dado === undefined ? '' : comSinal(dado)}</td>
        <td class="num alvo">${exigencia[e]}</td>
        <td class="num saldo">${comSinal(aproveitado)}${
          cru > aproveitado
            ? `<i class="teto" title="sobrou ${comSinal(cru)}, mas cada eixo aproveita no máximo ${TETO_DA_SOBRA}">&#9656;</i>`
            : ''
        }</td>
      </tr>`;
    })
    .join('');

  const { motivos, bonus } = sinergiaDoEsquadrao(esquadrao);
  const margem = dados ? conta?.margem : conta?.margemSemDado;

  return `
    <div class="duas-colunas despacho">
      <aside class="lateral">
        <div class="bloco missao" style="background-image:${fundoDaCena(desafio.id, desafio.tipo)}">
          <div class="missao-cabecalho">
            <span class="tipo">${ICONE_TIPO[desafio.tipo]} ${ROTULO_TIPO[desafio.tipo]}</span>
            <span class="contador">Missão ${estado.missao + 1} de ${estado.jornada.length}</span>
          </div>
          <h2>${escapar(desafio.nome)}</h2>
          <p class="abertura">${escapar(desafio.abertura)}</p>
        </div>

        <div class="bloco">
          <div class="radar-caixa grande">
            ${radarDespachoHtml({
              tamanho: 240,
              exigencia,
              somas,
              dados,
              maximo: MAXIMO_DO_ESQUADRAO,
              titulo: `O que ${desafio.nome} exige`,
            })}
          </div>
          <table class="placar-eixos">
            <thead><tr><th>eixo</th><th>põe</th><th>dado</th><th>pede</th><th>saldo</th></tr></thead>
            <tbody>${linhas}</tbody>
          </table>
          ${
            conta
              ? `<p class="margem ${(margem ?? 0) >= 0 ? 'boa' : 'ma'}">
                   Margem ${comSinal(margem ?? 0)}
                   ${dados ? '' : '<i>antes do dado</i>'}
                 </p>`
              : `<p class="ajuda">Marque ${ESQUADRAO_MINIMO} ou ${ESQUADRAO_MAXIMO} para ver a conta.</p>`
          }
        </div>
      </aside>

      <section class="principal">
        <div class="bloco">
          <div class="guilda-cabecalho">
            <h2>${naUltimaMissao() ? 'Todos os que sobraram' : 'Quem vai'}</h2>
            <span class="ajuda">${
              naUltimaMissao()
                ? 'o trono não aceita esquadrão'
                : `${esquadrao.length} de ${ESQUADRAO_MINIMO}&ndash;${ESQUADRAO_MAXIMO} · quem fica, descansa`
            }</span>
          </div>
          ${fitaHtml()}
          <div class="fichas">${estado.vivos.map((h) => fichaHtml(h, cobrados)).join('')}</div>
          ${
            motivos.length
              ? `<p class="ajuda sinergia">Sinergia ${comSinal(bonus)}: ${motivos.map(escapar).join('; ')}.</p>`
              : ''
          }
        </div>

        ${
          estado.relato && !estado.rolando
            ? `<div class="bloco desfecho ${estado.relato.resultado}">
                 <span class="selo-resultado">${ROTULO_RESULTADO[estado.relato.resultado]}</span>
                 <p class="narracao">${escapar(estado.relato.narracao)}</p>
                 ${
                   estado.relato.caido
                     ? `<p class="caido">${escapar(estado.relato.caido.nome)} não volta.</p>`
                     : ''
                 }
                 <button class="botao" data-avancar="1">${
                   naUltimaMissao() ? 'Ver o desfecho' : 'Próxima missão'
                 }</button>
               </div>`
            : `<div class="bloco acao">
                 <button class="botao grande" data-despachar="1"
                   ${esquadrao.length >= ESQUADRAO_MINIMO && !estado.rolando ? '' : 'disabled'}>
                   ${estado.rolando ? 'A missão corre…' : naUltimaMissao() ? 'Enfrentar o Rei Demônio' : 'Despachar'}
                 </button>
                 ${
                   estado.falhas > 0
                     ? `<p class="ajuda aviso">${estado.falhas} ${
                         estado.falhas === 1 ? 'missão perdida' : 'missões perdidas'
                       } &mdash; o Rei Demônio está mais forte.</p>`
                     : ''
                 }
               </div>`
        }
      </section>
    </div>`;
}

function desfechoHtml(): string {
  const campanha = comoCampanha(estado.relatos, estado.party, estado.jornada);
  const { titulo, texto, selo: fecho } = epilogo(
    campanha,
    chaveDoEpilogo(campanha, estado.jornada.length),
  );
  const venceu = campanha.etapas[estado.jornada.length - 1]?.resultado !== 'derrota';
  const caidos = new Set(campanha.etapas.flatMap((e) => e.caidos.map((h) => h.id)));

  return `
    <div class="duas-colunas">
      <aside class="cena ornado">
        <div class="cena-arte" style="background-image:${fundoDaCena(
          'desfecho',
          venceu ? 'trono' : 'travessia',
        )}">
          <span class="cena-tipo">${venceu ? 'O trono caiu' : 'O trono resistiu'}</span>
        </div>
        <h2 class="cena-titulo">A companhia</h2>
        <p class="cena-texto">${escapar(selo(campanha.moralDaParty))} · moral média ${sinalMoral(
          Math.round(campanha.moralDaParty * 10) / 10,
        )}</p>
        <ul class="party-estado">
          ${estado.party
            .map(
              (heroi) => `<li class="${caidos.has(heroi.id) ? 'caido' : ''}">
                ${retratoHtml(heroi, 'medio')}
                <span class="nome">${escapar(heroi.nome)}</span>
                ${caidos.has(heroi.id) ? '<span class="cruz">&#10013;</span>' : ''}
              </li>`,
            )
            .join('')}
        </ul>
      </aside>

      <section class="painel ornado">
        <div class="placar ${campanha.perfeita ? 'perfeito' : ''}">
          <div class="grade">${campanha.etapas.map((e) => MARCADOR_ETAPA[e.resultado]).join('')}</div>
        </div>
        <div class="epilogo">
          <h3>${escapar(titulo)}</h3>
          <p>${escapar(texto)}</p>
          ${fecho ? `<p class="epilogo-selo">${escapar(fecho)}</p>` : ''}
        </div>
        <ol class="relato-missoes">
          ${estado.relatos
            .map(
              (r) => `<li class="${r.resultado}">
                <b>${escapar(r.desafio.nome)}</b>
                <i>${escapar(r.narracao)}</i>
              </li>`,
            )
            .join('')}
        </ol>
        <div class="painel-acao">
          <button class="botao" data-gerar-cartao="1">Gerar o cartão</button>
          <button class="botao secundario" data-compartilhar="1">Copiar só o texto</button>
          <button class="botao secundario" data-treino="1">Marchar num dia qualquer</button>
        </div>
      </section>
    </div>`;
}

function telaJornada(): string {
  return estado.concluida ? desfechoHtml() : telaDespacho();
}


/* ------------------------------------------------------------------ desenho */

function desenhar() {
  const cabecalho = `
    <div class="portal">
      <span class="portal-selo">${SELO_EXCHAOS}</span>
      <span class="portal-texto">
        <b>ExChaos</b>
        <i>From chaos, worlds.</i>
      </span>
    </div>
    <header class="topo">
      <div class="marca">Até o Trono</div>
      <div class="subtitulo">${
        estado.treino
          ? 'Jornada de treino'
          : `Jornada #${numeroDoDia(estado.dia)} · ${estado.dia.split('-').reverse().join('/')}`
      }</div>
    </header>`;

  const telas: Record<Estado['tela'], () => string> = {
    inicio: telaInicio,
    ajuda: telaAjuda,
    cartao: telaCartao,
    draft: telaDraft,
    jornada: telaJornada,
  };

  app.innerHTML = cabecalho + telas[estado.tela]();
  // O cartão só é desenhado quando o jogador pede: é canvas de 1080×1580, e
  // gerar isso a cada redesenho da jornada não teria por quê.
  if (estado.tela === 'cartao') montarCartao();
}

/* ------------------------------------------------------------------- ações */

function estadoNovo(dia: string, treino: boolean): Estado {
  const party: Recrutado[] = [];
  return {
    tela: 'draft',
    dia,
    treino,
    jornada: jornadaDoDia(catalogo, dia),
    party,
    rodada: 0,
    tentativa: 0,
    candidatos: [],
    vivos: party,
    cansaco: {},
    cargas: cargasNovas(),
    missao: 0,
    vitorias: 0,
    falhas: 0,
    selecao: [],
    relatos: [],
    relato: null,
    rolando: false,
    concluida: false,
    despachos: [],
    rnd: mulberry32(hash(`despacho:${dia}`)),
    frasesUsadas: new Set(),
  };
}

/**
 * Desenha o cartão da jornada e injeta na tela. É gerado depois do desenho
 * porque o canvas precisa da imagem pronta antes de virar `src`.
 */
let cartaoPronto: HTMLCanvasElement | null = null;

function montarCartao() {
  const alvo = app.querySelector<HTMLImageElement>('img.cartao');
  if (!alvo || estado.relatos.length === 0) return;
  const campanha = comoCampanha(estado.relatos, estado.party, estado.jornada);
  const { titulo, texto } = epilogo(campanha, chaveDoEpilogo(campanha, estado.jornada.length));
  cartaoPronto = desenharCartao({
    campanha,
    party: estado.party,
    numeroDoDia: numeroDoDia(estado.dia),
    titulo,
    remate: texto,
  });
  alvo.src = cartaoPronto.toDataURL('image/png');
}

async function copiarImagem(botao: HTMLButtonElement | null) {
  if (!cartaoPronto) return;
  const blob = await new Promise<Blob | null>((ok) => cartaoPronto!.toBlob(ok, 'image/png'));
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    if (botao) {
      botao.textContent = 'Copiada!';
      setTimeout(() => (botao.textContent = 'Copiar a imagem'), 1600);
    }
  } catch {
    // Nem todo navegador deixa copiar imagem; baixar sempre funciona.
    baixarImagem();
  }
}

function baixarImagem() {
  if (!cartaoPronto) return;
  const link = document.createElement('a');
  link.download = `ate-o-trono-${numeroDoDia(estado.dia)}.png`;
  link.href = cartaoPronto.toDataURL('image/png');
  link.click();
}

function iniciar(dia: string, treino: boolean) {
  estado = estadoNovo(dia, treino);
  estado.candidatos = sortearCandidatos(dbHerois, dia, 0, []);
  desenhar();
}

function recrutar(indice: number) {
  const escolhido = estado.candidatos[indice];
  if (!escolhido || escolhido.recusa) return;

  estado.party.push(escolhido.heroi);
  estado.rodada++;
  estado.tentativa = 0;

  if (estado.party.length >= TAMANHO_PARTY) {
    estado.tela = 'jornada';
    estado.vivos = estado.party.slice();
    estado.cansaco = Object.fromEntries(estado.party.map((h) => [h.id, 0]));
    guardarJornada();
  } else {
    estado.candidatos = sortearCandidatos(dbHerois, estado.dia, estado.rodada, estado.party);
  }
  desenhar();
}

function resortear() {
  estado.tentativa++;
  estado.candidatos = sortearCandidatos(
    dbHerois,
    estado.dia,
    estado.rodada,
    estado.party,
    estado.tentativa,
  );
  desenhar();
}

function alternarDespacho(id: string) {
  if (naUltimaMissao() || estado.relato) return;
  const i = estado.selecao.indexOf(id);
  if (i >= 0) estado.selecao.splice(i, 1);
  else if (estado.selecao.length < ESQUADRAO_MAXIMO) estado.selecao.push(id);
  desenhar();
}

/** Suspense: o tempo em que as bolinhas correm, antes de o desfecho aparecer. */
const MS_ROLAGEM = 1100;
let sequencia: number | undefined;

function pararSequencia() {
  clearTimeout(sequencia);
  sequencia = undefined;
}

function despachar(esquadrao = esquadraoAtual(), animar = true) {
  if (esquadrao.length < ESQUADRAO_MINIMO) return;

  const { relato, amuletoGasto } = resolverMissao(
    entradaDaMissao(esquadrao),
    estado.rnd,
    estado.frasesUsadas,
    estado.cargas.amuletoDisponivel,
  );
  if (amuletoGasto) estado.cargas.amuletoDisponivel = false;
  cobrarBaixa(relato, estado.vivos, estado.cargas);

  estado.relato = relato;
  estado.despachos.push(esquadrao.map((h) => h.id));

  if (!animar) {
    estado.rolando = false;
    return;
  }
  // As bolinhas correm primeiro, o desfecho vem depois: a mesma divisão em
  // duas fases do jogo antigo — a cena, e então o que ela custou.
  estado.rolando = true;
  desenhar();
  sequencia = window.setTimeout(() => {
    estado.rolando = false;
    desenhar();
  }, MS_ROLAGEM);
}

/** Fecha a missão que está na tela e prepara a seguinte. */
function encerrarMissao() {
  const relato = estado.relato!;
  if (relato.caido) estado.vivos = estado.vivos.filter((h) => h.id !== relato.caido!.id);
  if (relato.venceu) estado.vitorias++;
  else estado.falhas++;

  estado.relatos.push(relato);
  estado.cansaco = avancarCansaco(estado.cansaco, estado.vivos, relato.esquadrao);
  estado.relato = null;
  estado.selecao = [];
  estado.missao++;
}

function avancar() {
  pararSequencia();
  encerrarMissao();
  guardarJornada();

  // Sem gente de pé para formar esquadrão, a jornada acaba onde está.
  if (estado.missao >= estado.jornada.length || estado.vivos.length < ESQUADRAO_MINIMO) {
    estado.concluida = true;
  }
  desenhar();
}

/**
 * O salvamento guarda **quem foi em cada missão**, não só a party.
 *
 * No jogo antigo bastavam os cinco nomes: a campanha era determinística a
 * partir deles. Aqui as decisões são do jogador, então sem os despachos não há
 * como reconstituir a jornada — e é justamente por haver decisões que uma por
 * dia faz sentido.
 */
function guardarJornada() {
  if (estado.treino) return;
  localStorage.setItem(
    chaveSalva(estado.dia),
    JSON.stringify({ heroisIds: estado.party.map((h) => h.id), despachos: estado.despachos }),
  );
}

function restaurarSalva(): boolean {
  const bruto = localStorage.getItem(chaveSalva(diaDeHoje()));
  if (!bruto) return false;
  try {
    const salva = JSON.parse(bruto) as { heroisIds: string[]; despachos?: string[][] };
    if (!salva.despachos) return false; // jornada do modelo antigo: não se reencena

    const dia = diaDeHoje();
    const porId = new Map(todosOsHerois(dbHerois).map((h) => [h.id, h]));
    const party = salva.heroisIds
      .map((id) => porId.get(id))
      .filter((h): h is Recrutado => h !== undefined);
    if (party.length !== TAMANHO_PARTY) return false;

    estado = estadoNovo(dia, false);
    estado.party = party;
    estado.vivos = party.slice();
    estado.cansaco = Object.fromEntries(party.map((h) => [h.id, 0]));
    estado.tela = 'jornada';

    // Reencena os mesmos despachos: mesma seed, mesmos dados, mesmo desfecho.
    for (const ids of salva.despachos) {
      if (estado.missao >= estado.jornada.length) break;
      const esquadrao = estado.vivos.filter((h) => ids.includes(h.id));
      if (esquadrao.length === 0) break;
      despachar(esquadrao, false);
      encerrarMissao();
    }
    estado.concluida =
      estado.missao >= estado.jornada.length || estado.vivos.length < ESQUADRAO_MINIMO;
    desenhar();
    return true;
  } catch {
    return false;
  }
}

async function compartilhar() {
  const texto = textoDeCompartilhamento(
    comoCampanha(estado.relatos, estado.party, estado.jornada),
    numeroDoDia(estado.dia),
  );
  const botao = app.querySelector<HTMLButtonElement>('[data-compartilhar]');
  try {
    await navigator.clipboard.writeText(texto);
    if (botao) {
      botao.textContent = 'Copiado!';
      setTimeout(() => (botao.textContent = 'Copiar o relato'), 1600);
    }
  } catch {
    const area = document.createElement('textarea');
    area.className = 'saida-compartilhar';
    area.readOnly = true;
    area.rows = 4;
    area.value = texto;
    botao?.insertAdjacentElement('afterend', area);
    area.select();
  }
}

app.addEventListener('click', (evento) => {
  const alvo = (evento.target as HTMLElement).closest<HTMLElement>('[data-acao], button[data-recrutar], button[data-aba], button[data-comecar], button[data-resortear], button[data-alternar], button[data-despachar], button[data-avancar], button[data-voltar], button[data-compartilhar], button[data-treino], button[data-ver-salva], button[data-ajuda], button[data-voltar-inicio], button[data-copiar-imagem], button[data-baixar-imagem], button[data-gerar-cartao], button[data-voltar-desfecho]');
  if (!alvo) return;

  if (alvo.dataset.ajuda) {
    estado.tela = 'ajuda';
    desenhar();
  } else if (alvo.dataset.voltarInicio) {
    estado.tela = 'inicio';
    desenhar();
  } else if (alvo.dataset.comecar) {
    iniciar(treinoPendente ? `treino-${Date.now()}` : diaDeHoje(), treinoPendente);
  } else if (alvo.dataset.recrutar) {
    recrutar(Number(alvo.dataset.recrutar));
  } else if (alvo.dataset.resortear) {
    resortear();
  } else if (alvo.dataset.alternar) {
    alternarDespacho(alvo.dataset.alternar);
  } else if (alvo.dataset.despachar) {
    despachar();
  } else if (alvo.dataset.avancar) {
    avancar();
  } else if (alvo.dataset.gerarCartao) {
    estado.tela = 'cartao';
    desenhar();
  } else if (alvo.dataset.voltarDesfecho) {
    estado.tela = 'jornada';
    desenhar();
  } else if (alvo.dataset.copiarImagem) {
    void copiarImagem(alvo as HTMLButtonElement);
  } else if (alvo.dataset.baixarImagem) {
    baixarImagem();
  } else if (alvo.dataset.compartilhar) {
    void compartilhar();
  } else if (alvo.dataset.verSalva) {
    restaurarSalva();
  } else if (alvo.dataset.treino) {
    pararSequencia();
    treinoPendente = true;
    estado.tela = 'inicio';
    estado.treino = true;
    desenhar();
  }
});

/* ---------------------------------------------------------------- arranque */

async function arrancar() {
  // Relativo ao BASE_URL: no GitHub Pages o site vive num subcaminho, e um
  // caminho absoluto buscaria os dados na raiz do domínio.
  const base = import.meta.env.BASE_URL;
  const [herois, desafios] = await Promise.all([
    fetch(`${base}data/guildas.json`).then((r) => r.json() as Promise<BaseDeHerois>),
    fetch(`${base}data/desafios.json`).then((r) => r.json() as Promise<CatalogoDesafios>),
  ]);
  dbHerois = herois;
  catalogo = desafios;

  estado = estadoNovo(diaDeHoje(), false);
  estado.tela = 'inicio';

  if (!restaurarSalva()) desenhar();
}

void arrancar();
