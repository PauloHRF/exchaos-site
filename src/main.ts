import {
  jornadaDoDia,
  epilogo,
  moralDaParty,
  perfilDaParty,
  selo,
  simularCampanha,
  sinergia,
  sortearCandidatos,
  textoDeCompartilhamento,
  todosOsHerois,
  type Candidato,
} from './motor.ts';
import { desenharCartao } from './cartao.ts';
import { numerosHtml, radarHtml } from './radar.ts';
import { fundoDaCena, fundoDoRetrato } from './retrato.ts';
import { diaDeHoje, numeroDoDia } from './rng.ts';
import {
  EIXOS,
  ICONE_TIPO,
  MARCADOR_LANCE,
  MAXIMO_DA_PARTY,
  ROTULO_EIXO,
  ROTULO_ETIQUETA,
  ROTULO_TIPO,
  TAMANHO_PARTY,
  TATICAS,
  TOLERANCIA_MORAL,
  TRACOS,
} from './regras.ts';
import type {
  BaseDeHerois,
  Campanha,
  CatalogoDesafios,
  Desafio,
  Eixo,
  Recrutado,
  RelatoEtapa,
  RelatoLance,
  ResultadoEtapa,
  Tatica,
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
  tela: 'inicio' | 'ajuda' | 'draft' | 'tatica' | 'jornada' | 'cartao';
  dia: string;
  treino: boolean;
  jornada: Desafio[];
  party: Recrutado[];
  rodada: number;
  tentativa: number;
  candidatos: Candidato[];
  campanha: Campanha | null;
  /** Até onde a jornada avançou. */
  etapaAtual: number;
  /** Aba aberta: o índice de uma prova, ou -1 para a tela de desfecho. */
  etapaVista: number;
  /** Lances da prova em curso que já mostraram resultado. */
  lancesResolvidos: number;
  /** Há um lance sendo decidido agora. */
  rolando: boolean;
  /** A prova em curso terminou de rolar: só então o botão aparece. */
  provaFechada: boolean;
  concluida: boolean;
  tatica: Tatica;
}

let dbHerois: BaseDeHerois;
let catalogo: CatalogoDesafios;
let estado: Estado;
let treinoPendente = false;

const app = document.querySelector<HTMLDivElement>('#app')!;
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const chaveSalva = (dia: string) => `ateotrono:${dia}`;
const sinalMoral = (m: number) => (m > 0 ? `+${m}` : `${m}`);
const comSinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Índice da aba de desfecho, fora da faixa das provas. */
const DESFECHO = -1;

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
  const tatica = (t: Tatica) =>
    `<li><strong>${TATICAS[t].nome}</strong> — ${escapar(TATICAS[t].descricao)}</li>`;

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
          <strong>Falhar uma prova encerra a jornada na hora.</strong> Não se marcha
          com a companhia em frangalhos: acabou ali, e o que faltava fica por fazer.
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

        <h2>Como um lance é resolvido</h2>
        <p>
          Cada prova tem três lances, e cada lance põe <strong>um eixo</strong> à prova:
          ${EIXOS.map((e) => ROTULO_EIXO[e]).join(', ')}. O que decide é a
          <strong>soma da companhia inteira</strong> naquele eixo — não o herói que a
          narração acompanha.
        </p>
        <p class="conta-exemplo">
          soma do grupo + sinergia + traços + tática + moral + dado (−4 a +4)
          <br />contra a dificuldade do lance
        </p>
        <p>
          Vence a prova quem resolver <strong>dois dos três lances</strong>. Passar o
          mouse sobre um lance mostra a conta que o produziu.
        </p>

        <h2>Os cinco desfechos de um lance</h2>
        <ul class="desfechos">
          <li><span class="marca brilhante">★</span> <strong>Brilhante</strong> — folgado demais para dar errado.</li>
          <li><span class="marca sucesso">●</span> <strong>Sucesso</strong> — resolvido.</li>
          <li><span class="marca custoso">◍</span> <strong>Custoso</strong> — resolvido, e alguém ficou pelo caminho.</li>
          <li><span class="marca falha">○</span> <strong>Falha</strong> — não resolvido, mas ninguém caiu.</li>
          <li><span class="marca grave">✝</span> <strong>Fracasso grave</strong> — não resolvido, e custou uma vida.</li>
        </ul>
        <p>
          O dado é o azar puro: nove resultados igualmente prováveis, de −4 a +4. No pior
          deles alguém pode tombar <strong>mesmo num lance vencido</strong> — é o que
          impede que chegar ao trono e chegar inteiro sejam a mesma coisa.
        </p>

        <h2>A tática</h2>
        <p>Vale para as sete provas, e é escolhida depois de fechar a companhia.</p>
        <ul>${(Object.keys(TATICAS) as Tatica[]).map(tatica).join('')}</ul>

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

function telaTatica(): string {
  return `
    <div class="duas-colunas">
      <aside class="lateral">
        <div class="bloco">
          <h2>Atributos somados</h2>
          ${pentagonoHtml(178)}
          <p class="ajuda" style="margin-top:10px">
            Moral média ${sinalMoral(Math.round(moralDaParty(estado.party) * 10) / 10)} —
            ${selo(moralDaParty(estado.party)).toLowerCase()}.
          </p>
        </div>
      </aside>
      <section class="principal">
        <div class="bloco">
          <h2>Como vocês marcham</h2>
          <p class="ajuda">Vale para as sete provas. Decide entre chegar ao trono e chegar inteiro.</p>
          <div class="escolhas" style="margin-top:14px">
            ${(Object.keys(TATICAS) as Tatica[])
              .map(
                (t) => `<button class="escolha" data-tatica="${t}" aria-label="Tática ${TATICAS[t].nome}">
                  <strong>${TATICAS[t].nome}</strong>
                  <span>${escapar(TATICAS[t].descricao)}</span>
                </button>`,
              )
              .join('')}
          </div>
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
 * Quantos lances da prova já mostraram resultado. Na prova em curso é o
 * contador da sequência; nas já passadas, todos.
 */
function lancesVisiveis(indice: number): number {
  if (indice > estado.etapaAtual && !estado.concluida) return 0;
  if (indice < estado.etapaAtual || estado.concluida) {
    return estado.campanha!.etapas[indice].lances.length;
  }
  return estado.lancesResolvidos;
}

/* --------------------------------------------------- sequência dos lances */

/** Suspense: o tempo em que o lance está sendo decidido, antes do resultado. */
const MS_ROLAGEM = 1400;
/** Tempo de leitura do resultado antes de o próximo lance começar a rolar. */
const MS_LEITURA = 2100;
/** Respiro antes de o botão da próxima prova aparecer. */
const MS_ANTES_DO_BOTAO = 700;

let sequencia: number | undefined;

function pararSequencia() {
  clearTimeout(sequencia);
  sequencia = undefined;
}

/** Começa a rolar o lance seguinte da prova em curso. */
function rolarProximo() {
  const etapa = estado.campanha!.etapas[estado.etapaAtual];
  if (estado.lancesResolvidos >= etapa.lances.length) {
    estado.rolando = false;
    sequencia = window.setTimeout(() => {
      estado.provaFechada = true;
      desenhar();
    }, MS_ANTES_DO_BOTAO);
    desenhar();
    return;
  }

  estado.rolando = true;
  desenhar();
  sequencia = window.setTimeout(() => {
    estado.lancesResolvidos++;
    estado.rolando = false;
    desenhar();
    sequencia = window.setTimeout(rolarProximo, MS_LEITURA);
  }, MS_ROLAGEM);
}

function comecarProva() {
  pararSequencia();
  estado.lancesResolvidos = 0;
  estado.rolando = false;
  estado.provaFechada = false;
  rolarProximo();
}

/** A conta do lance por extenso, para o título do cartão. */
function contaPorExtenso(l: RelatoLance): string {
  const partes = [`${l.somaDoGrupo} do grupo`];
  if (l.modificadores !== 0) partes.push(`${comSinal(l.modificadores)} de bônus`);
  partes.push(`dado ${comSinal(l.dado)}`);
  return `${partes.join(' · ')} = ${l.valor}, e pedia ${l.dificuldade}`;
}

/**
 * A conta saiu do cartão: ocupava uma linha inteira do painel e o jogo se
 * entende sem ela. Fica no título, para quem quiser conferir de onde veio o
 * resultado de um lance.
 */
function lanceHtml(l: RelatoLance): string {
  return `
    <li class="lance ${l.resultado}" title="${escapar(contaPorExtenso(l))}">
      <div class="lance-eixo">${ROTULO_EIXO[l.eixo]}</div>
      <div class="lance-cena">${escapar(l.cena)}</div>
      <div class="lance-desfecho">
        <span class="marca">${MARCADOR_LANCE[l.resultado]}</span> ${escapar(l.narracao)}
      </div>
    </li>`;
}

/**
 * O lance ainda sendo decidido: a cena já está posta, o desfecho não. O dado
 * girando é o mesmo dado do motor — é ele que decide, e mostrar isso vale mais
 * que revelar o número.
 */
function lanceRolandoHtml(l: RelatoLance): string {
  return `
    <li class="lance rolando" aria-live="polite">
      <div class="lance-eixo">${ROTULO_EIXO[l.eixo]}</div>
      <div class="lance-cena">${escapar(l.cena)}</div>
      <div class="lance-decidindo">
        <span class="dado" aria-hidden="true"><i>⚀</i><i>⚁</i><i>⚂</i><i>⚃</i><i>⚄</i><i>⚅</i></span>
        <span class="decidindo-texto">decidindo</span>
      </div>
    </li>`;
}

function textoFecho(e: RelatoEtapa): string {
  if (e.resultado === 'nao-jogada') return 'A companhia não chegou até aqui.';
  if (e.resultado === 'derrota') return `Derrota — ${e.sucessos} de ${e.desafio.lances.length} lances.`;
  if (e.caidos.length === 0) return `Vitória limpa — ${e.sucessos} de ${e.desafio.lances.length} lances.`;
  return `Vitória — ${e.sucessos} de ${e.desafio.lances.length}, e ${e.caidos
    .map((h) => h.nome)
    .join(', ')} ficou pelo caminho.`;
}

/** Quem ainda está de pé quando a etapa aberta começou. */
function estadoDaParty(indice: number): { heroi: Recrutado; caido: boolean }[] {
  const caidos = new Set<string>();
  const campanha = estado.campanha!;
  for (let i = 0; i <= indice; i++) {
    const etapa = campanha.etapas[i];
    const ate = i === indice ? lancesVisiveis(i) : etapa.lances.length;
    etapa.lances.slice(0, ate).forEach((l) => l.caido && caidos.add(l.caido.id));
  }
  return estado.party.map((h) => ({ heroi: h, caido: caidos.has(h.id) }));
}

/** A tela de fim: a companhia que sobrou e o epílogo. Não repete a última prova. */
function desfechoHtml(): string {
  const campanha = estado.campanha!;
  const { titulo, texto, selo: fecho } = epilogo(campanha);
  const venceu = campanha.vitorias === campanha.etapas.length;

  return `
    <aside class="cena ornado">
      <div class="cena-arte" style="background-image:${fundoDaCena(
        'desfecho',
        venceu ? 'trono' : 'travessia',
      )}">
        <span class="cena-tipo">${venceu ? 'O trono caiu' : 'Fim da estrada'}</span>
      </div>
      <h2 class="cena-titulo">A companhia</h2>
      <p class="cena-texto">${escapar(selo(campanha.moralDaParty))} · moral média ${sinalMoral(
        Math.round(campanha.moralDaParty * 10) / 10,
      )}</p>
      <ul class="party-estado">
        ${estadoDaParty(estado.etapaAtual)
          .map(
            ({ heroi, caido }) => `<li class="${caido ? 'caido' : ''}">
              ${retratoHtml(heroi, 'medio')}
              <span class="nome">${escapar(heroi.nome)}</span>
              ${caido ? '<span class="cruz">✝</span>' : ''}
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
      <div class="painel-acao">
        <button class="botao" data-gerar-cartao="1">Gerar o cartão</button>
        <button class="botao secundario" data-compartilhar="1">Copiar só o texto</button>
        <button class="botao secundario" data-treino="1">Marchar num dia qualquer</button>
      </div>
    </section>`;
}

function telaJornada(): string {
  const campanha = estado.campanha!;
  const i = estado.etapaVista;
  const noDesfecho = i === DESFECHO;
  const etapa = campanha.etapas[noDesfecho ? estado.etapaAtual : i];
  const visiveis = noDesfecho ? 0 : lancesVisiveis(i);
  const olhandoPassado = !noDesfecho && i !== estado.etapaAtual;
  const emCurso = !noDesfecho && i === estado.etapaAtual && !estado.concluida;
  const alcancada = noDesfecho || i <= estado.etapaAtual || estado.concluida;
  const provaTerminou = !emCurso || estado.provaFechada;

  const abas = campanha.etapas
    .map((e, k) => {
      // Prova que a jornada não alcançou continua trancada mesmo no fim.
      const liberada = k <= estado.etapaAtual;
      const marca =
        estado.concluida || k < estado.etapaAtual ? MARCADOR_ETAPA[e.resultado] : ICONE_TIPO[e.desafio.tipo];
      return `<button class="aba ${k === i ? 'aberta' : ''} ${liberada ? '' : 'trancada'}"
        data-aba="${k}" ${liberada ? '' : 'disabled'}
        aria-label="Prova ${k + 1}${liberada ? `: ${e.desafio.nome}` : ', ainda não alcançada'}">
        <span class="aba-num">${k + 1}</span>
        <span class="aba-marca">${liberada ? marca : '·'}</span>
      </button>`;
    })
    .join('') +
    (estado.concluida
      ? `<button class="aba desfecho ${noDesfecho ? 'aberta' : ''}" data-aba="${DESFECHO}"
           aria-label="Desfecho da jornada">
           <span class="aba-num">fim</span>
           <span class="aba-marca">⚜️</span>
         </button>`
      : '');

  const emAndamento = campanha.etapas[estado.etapaAtual];
  const caiuAqui = emAndamento.resultado === 'derrota';
  // O botão só existe depois de a prova terminar de rolar. Antes disso, nada
  // no painel convida a pular o que ainda está sendo decidido.
  const acao = estado.concluida
    ? `<button class="botao" data-aba="${DESFECHO}">Ver o desfecho</button>`
    : olhandoPassado
      ? `<button class="botao" data-voltar="1">Voltar para a prova ${estado.etapaAtual + 1}</button>`
      : !estado.provaFechada
        ? ''
        : caiuAqui || estado.etapaAtual >= campanha.etapas.length - 1
          ? `<button class="botao" data-avancar="1">Ver o desfecho</button>`
          : `<button class="botao" data-avancar="1">Seguir para a prova ${estado.etapaAtual + 2}</button>`;

  return `
    <div class="jornada">
      <div class="jornada-topo">
        <span class="painel-titulo">A jornada</span>
        <span class="painel-placar">${
          estado.concluida
            ? 'fim da estrada'
            : `prova <b>${estado.etapaAtual + 1}</b> de ${campanha.etapas.length}`
        }</span>
      </div>
      <nav class="abas" aria-label="Provas da jornada">${abas}</nav>

      <div class="jornada-corpo">
        ${
          noDesfecho
            ? desfechoHtml()
            : `<aside class="cena ornado">
          <div class="cena-arte" style="background-image:${fundoDaCena(etapa.desafio.id, etapa.desafio.tipo)}">
            <span class="cena-tipo">${ROTULO_TIPO[etapa.desafio.tipo]}</span>
          </div>
          <h2 class="cena-titulo">${etapa.numero}. ${escapar(etapa.desafio.nome)}</h2>
          <p class="cena-texto">${escapar(etapa.desafio.abertura)}</p>
          <ul class="party-estado">
            ${estadoDaParty(i)
              .map(
                ({ heroi, caido }) => `<li class="${caido ? 'caido' : ''}">
                  ${retratoHtml(heroi, 'medio')}
                  <span class="nome">${escapar(heroi.nome)}</span>
                  ${caido ? '<span class="cruz">✝</span>' : ''}
                </li>`,
              )
              .join('')}
          </ul>
        </aside>

        <section class="painel ornado">
          <ol class="lances">
            ${etapa.lances
              .slice(0, visiveis)
              .map((l) => lanceHtml(l))
              .join('')}
            ${emCurso && estado.rolando ? lanceRolandoHtml(etapa.lances[visiveis]) : ''}
            ${
              !alcancada
                ? `<li class="lance-vazio">A companhia ainda não chegou aqui.</li>`
                : provaTerminou
                  ? `<li class="etapa-fecho ${etapa.resultado}">
                       ${MARCADOR_ETAPA[etapa.resultado]} ${escapar(textoFecho(etapa))}
                     </li>`
                  : ''
            }
          </ol>
          ${acao ? `<div class="painel-acao">${acao}</div>` : ''}
        </section>`
        }
      </div>
    </div>`;
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
    tatica: telaTatica,
    jornada: telaJornada,
  };

  app.innerHTML = cabecalho + telas[estado.tela]();
  // O cartão só é desenhado quando o jogador pede: é canvas de 1080×1580, e
  // gerar isso a cada redesenho da jornada não teria por quê.
  if (estado.tela === 'cartao') montarCartao();
}

/* ------------------------------------------------------------------- ações */

function estadoNovo(dia: string, treino: boolean): Estado {
  return {
    tela: 'draft',
    dia,
    treino,
    jornada: jornadaDoDia(catalogo, dia),
    party: [],
    rodada: 0,
    tentativa: 0,
    candidatos: [],
    campanha: null,
    etapaAtual: 0,
    etapaVista: 0,
    lancesResolvidos: 0,
    rolando: false,
    provaFechada: false,
    concluida: false,
    tatica: 'equilibrada',
  };
}

/**
 * Desenha o cartão da jornada e injeta na tela. É gerado depois do desenho
 * porque o canvas precisa da imagem pronta antes de virar `src`.
 */
let cartaoPronto: HTMLCanvasElement | null = null;

function montarCartao() {
  const alvo = app.querySelector<HTMLImageElement>('img.cartao');
  if (!alvo || !estado.campanha) return;
  const { titulo, texto } = epilogo(estado.campanha);
  cartaoPronto = desenharCartao({
    campanha: estado.campanha,
    party: estado.party,
    tatica: estado.tatica,
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
    estado.tela = 'tatica';
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

function resolver(tatica: Tatica) {
  estado.campanha = simularCampanha(estado.party, tatica, estado.dia, estado.jornada);
  estado.tatica = tatica;
  estado.tela = 'jornada';
  estado.etapaAtual = 0;
  estado.etapaVista = 0;
  estado.concluida = false;

  if (!estado.treino) {
    localStorage.setItem(
      chaveSalva(estado.dia),
      JSON.stringify({ heroisIds: estado.party.map((h) => h.id), tatica }),
    );
  }
  comecarProva();
}

/** O botão vira a página, e só. A prova aberta já está toda à vista. */
function avancar() {
  const campanha = estado.campanha!;
  const etapa = campanha.etapas[estado.etapaAtual];
  const fim = etapa.resultado === 'derrota' || estado.etapaAtual >= campanha.etapas.length - 1;

  if (fim) {
    pararSequencia();
    estado.concluida = true;
    estado.etapaVista = DESFECHO;
    desenhar();
  } else {
    estado.etapaAtual++;
    estado.etapaVista = estado.etapaAtual;
    comecarProva();
  }
}

function abrirAba(indice: number) {
  if (indice === DESFECHO && !estado.concluida) return;
  if (indice !== DESFECHO && indice > estado.etapaAtual) return;
  estado.etapaVista = indice;
  desenhar();
}

function restaurarSalva(): boolean {
  const bruto = localStorage.getItem(chaveSalva(diaDeHoje()));
  if (!bruto) return false;
  try {
    const salva = JSON.parse(bruto) as { heroisIds: string[]; tatica: Tatica };
    const dia = diaDeHoje();
    const porId = new Map(todosOsHerois(dbHerois).map((h) => [h.id, h]));
    const party = salva.heroisIds
      .map((id) => porId.get(id))
      .filter((h): h is Recrutado => h !== undefined);
    if (party.length !== TAMANHO_PARTY) return false;

    estado = estadoNovo(dia, false);
    estado.party = party;
    estado.campanha = simularCampanha(party, salva.tatica, dia, estado.jornada);
    estado.tatica = salva.tatica;
    estado.tela = 'jornada';
    estado.concluida = true;
    estado.provaFechada = true;
    const parou = estado.campanha.etapas.findIndex((e) => e.resultado === 'derrota');
    estado.etapaAtual = parou >= 0 ? parou : estado.campanha.etapas.length - 1;
    estado.etapaVista = DESFECHO;
    desenhar();
    return true;
  } catch {
    return false;
  }
}

async function compartilhar() {
  const texto = textoDeCompartilhamento(estado.campanha!, numeroDoDia(estado.dia));
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
  const alvo = (evento.target as HTMLElement).closest<HTMLElement>('[data-acao], button[data-recrutar], button[data-aba], button[data-comecar], button[data-resortear], button[data-tatica], button[data-avancar], button[data-voltar], button[data-compartilhar], button[data-treino], button[data-ver-salva], button[data-ajuda], button[data-voltar-inicio], button[data-copiar-imagem], button[data-baixar-imagem], button[data-gerar-cartao], button[data-voltar-desfecho]');
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
  } else if (alvo.dataset.tatica) {
    resolver(alvo.dataset.tatica as Tatica);
  } else if (alvo.dataset.avancar) {
    avancar();
  } else if (alvo.dataset.voltar) {
    abrirAba(estado.etapaAtual);
  } else if (alvo.dataset.aba) {
    abrirAba(Number(alvo.dataset.aba));
  } else if (alvo.dataset.gerarCartao) {
    estado.tela = 'cartao';
    desenhar();
  } else if (alvo.dataset.voltarDesfecho) {
    estado.tela = 'jornada';
    estado.etapaVista = DESFECHO;
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
