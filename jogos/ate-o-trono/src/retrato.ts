import { hash } from './rng.ts';
import type { Recrutado, TipoDesafio } from './tipos.ts';

/**
 * Retratos e cenas.
 *
 * Cada herói tem um brasão gerado por código a partir do id — cor derivada da
 * guilda, iniciais no meio, anel de metal em volta. É o que aparece por padrão.
 *
 * Por cima dele, o CSS tenta carregar `public/retratos/<id>.jpg`. Se o arquivo
 * existir, ele cobre o brasão; se não existir, o navegador simplesmente não
 * pinta essa camada e o brasão continua à mostra. Trocar a arte do jogo é
 * jogar imagens numa pasta, sem mexer em código.
 */

const matiz = (semente: string) => hash(semente) % 360;

/**
 * Aspas simples de propósito: estes valores entram num atributo `style="..."`,
 * e uma aspa dupla aqui fecharia o atributo no meio do caminho.
 */
function svgParaUrl(svg: string): string {
  return `url('data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}')`;
}

function iniciais(nome: string): string {
  const palavras = nome.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '?';
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
}

/** Brasão do herói: fundo da guilda, raios sutis, iniciais e anel. */
export function brasaoDoHeroi(heroi: Recrutado): string {
  const h = matiz(heroi.guildaId);
  const h2 = (h + 28) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="f" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stop-color="hsl(${h} 34% 27%)"/>
          <stop offset="1" stop-color="hsl(${h2} 30% 11%)"/>
        </linearGradient>
        <radialGradient id="v" cx="50%" cy="34%" r="72%">
          <stop offset="0" stop-color="hsl(${h} 45% 46%)" stop-opacity="0.5"/>
          <stop offset="1" stop-color="hsl(${h} 45% 20%)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#f)"/>
      <rect width="120" height="120" fill="url(#v)"/>
      <g stroke="hsl(${h} 40% 58%)" stroke-opacity="0.18" stroke-width="1">
        <path d="M60 6 L60 114 M6 60 L114 60 M18 18 L102 102 M102 18 L18 102"/>
      </g>
      <circle cx="60" cy="58" r="31" fill="hsl(${h} 32% 9%)" fill-opacity="0.55"
              stroke="hsl(45 48% 62%)" stroke-opacity="0.55" stroke-width="1.2"/>
      <text x="60" y="72" text-anchor="middle" font-family="Palatino Linotype, Georgia, serif"
            font-size="36" font-weight="700" fill="hsl(45 52% 74%)" fill-opacity="0.92">
        ${iniciais(heroi.nome)}
      </text>
    </svg>`;
  return svgParaUrl(svg);
}

/**
 * O CSS de fundo do retrato: primeiro o arquivo, depois o brasão. Camada que
 * falha em carregar não pinta, e a de baixo aparece.
 */
export function fundoDoRetrato(heroi: Recrutado): string {
  return `url('${arte('retratos', heroi.id)}'), ${brasaoDoHeroi(heroi)}`;
}

/** Caminho de arte relativo ao BASE_URL, para funcionar em subcaminho. */
function arte(pasta: string, id: string): string {
  return `${import.meta.env.BASE_URL}${pasta}/${id}.jpg`;
}

const CORES_DA_CENA: Record<TipoDesafio, number> = {
  combate: 8,
  negociacao: 42,
  enigma: 268,
  travessia: 196,
  trono: 348,
};

/**
 * Cenários desenhados: céu em degradê, um disco baixo no horizonte e camadas
 * de silhueta que mudam conforme o tipo da prova. É o mesmo enquadramento para
 * todas — o que muda é o que está recortado contra o céu —, então as sete
 * provas parecem um conjunto e não sete adesivos diferentes.
 */
const SILHUETAS: Record<TipoDesafio, (h: number) => string> = {
  // Lanças e estandartes contra a fumaça de uma batalha.
  combate: (h) => `
    <g fill="hsl(${h} 30% 6%)">
      <path d="M0 150 L44 128 L92 146 L140 122 L196 148 L252 126 L320 150 L320 180 L0 180 Z"/>
    </g>
    <g stroke="hsl(${h} 26% 9%)" stroke-width="3" stroke-linecap="round">
      <path d="M62 148 L58 92 M104 152 L100 84 M150 146 L146 96 M206 150 L202 88 M252 150 L248 100"/>
    </g>
    <g fill="hsl(${h} 42% 22%)">
      <path d="M100 84 L128 92 L100 100 Z"/><path d="M202 88 L232 96 L202 104 Z"/>
      <path d="M58 92 L80 98 L58 104 Z"/>
    </g>`,
  // Colunatas de um salão onde se decide alguma coisa.
  negociacao: (h) => `
    <g fill="hsl(${h} 24% 8%)">
      <rect x="20" y="70" width="20" height="94"/><rect x="72" y="62" width="22" height="102"/>
      <rect x="226" y="62" width="22" height="102"/><rect x="280" y="70" width="20" height="94"/>
      <rect x="8" y="60" width="44" height="10"/><rect x="62" y="52" width="42" height="10"/>
      <rect x="216" y="52" width="42" height="10"/><rect x="268" y="60" width="44" height="10"/>
      <rect x="0" y="164" width="320" height="16"/>
    </g>
    <path d="M104 62 Q160 18 216 62 L216 70 Q160 30 104 70 Z" fill="hsl(${h} 24% 8%)"/>`,
  // Um portal fechado e o que orbita em volta dele.
  enigma: (h) => `
    <g fill="hsl(${h} 26% 8%)">
      <path d="M118 168 L118 96 Q160 52 202 96 L202 168 Z"/>
      <rect x="0" y="166" width="320" height="14"/>
    </g>
    <g fill="none" stroke="hsl(${h} 40% 46%)" stroke-opacity="0.5" stroke-width="1.5">
      <circle cx="160" cy="112" r="11"/><path d="M160 123 L160 140"/>
    </g>
    <g fill="hsl(${h} 45% 55%)" fill-opacity="0.35">
      <circle cx="74" cy="70" r="3"/><circle cx="252" cy="86" r="2.5"/>
      <circle cx="96" cy="120" r="2"/><circle cx="238" cy="132" r="3"/>
    </g>`,
  // Serra e trilha: o caminho é o problema.
  travessia: (h) => `
    <path d="M0 128 L58 78 L104 118 L152 62 L214 122 L262 88 L320 130 L320 180 L0 180 Z"
          fill="hsl(${h} 28% 10%)"/>
    <g fill="hsl(${h} 34% 78%)" fill-opacity="0.5">
      <path d="M152 62 L168 78 L158 82 L146 76 Z"/><path d="M58 78 L70 90 L62 92 L52 86 Z"/>
    </g>
    <path d="M0 152 L48 140 L112 158 L188 142 L256 160 L320 148 L320 180 L0 180 Z"
          fill="hsl(${h} 24% 6%)"/>
    <path d="M132 180 Q152 160 146 146 Q140 134 158 126" fill="none"
          stroke="hsl(${h} 20% 30%)" stroke-width="3" stroke-dasharray="7 6"/>`,
  // O trono, vazio até alguém chegar.
  trono: (h) => `
    <g fill="hsl(${h} 26% 7%)">
      <rect x="12" y="44" width="24" height="120"/><rect x="284" y="44" width="24" height="120"/>
      <path d="M118 164 L118 76 Q160 44 202 76 L202 164 Z"/>
      <rect x="106" y="140" width="108" height="24"/>
      <path d="M74 180 L246 180 L226 164 L94 164 Z"/>
      <rect x="0" y="176" width="320" height="4"/>
    </g>
    <g fill="hsl(45 48% 58%)" fill-opacity="0.55">
      <path d="M138 66 L146 50 L154 62 L160 44 L166 62 L174 50 L182 66 Z"/>
    </g>`,
};

export function fundoDaCena(id: string, tipo: TipoDesafio): string {
  const h = CORES_DA_CENA[tipo];
  const discoY = tipo === 'travessia' ? 62 : 96;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${h} 22% 16%)"/>
          <stop offset="0.62" stop-color="hsl(${h} 30% 24%)"/>
          <stop offset="1" stop-color="hsl(${h} 26% 12%)"/>
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="${(discoY / 180) * 100}%" r="42%">
          <stop offset="0" stop-color="hsl(${h} 55% 62%)" stop-opacity="0.42"/>
          <stop offset="1" stop-color="hsl(${h} 55% 62%)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ceu)"/>
      <circle cx="160" cy="${discoY}" r="34" fill="hsl(${h} 45% 52%)" fill-opacity="0.3"/>
      <rect width="320" height="180" fill="url(#halo)"/>
      ${SILHUETAS[tipo](h)}
    </svg>`;
  return `url('${arte('cenas', id)}'), ${svgParaUrl(svg)}`;
}
