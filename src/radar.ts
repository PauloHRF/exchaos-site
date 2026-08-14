import { EIXOS, ICONE_EIXO, ROTULO_EIXO } from './regras.ts';
import type { Eixo } from './tipos.ts';

/**
 * O pentágono. Um vértice por eixo, começando no topo e seguindo no sentido
 * horário — a mesma ordem de EIXOS, para o desenho e a leitura baterem.
 */
function vertice(indice: number, proporcao: number, raio: number, centro: number): [number, number] {
  const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / EIXOS.length;
  const r = Math.max(0, Math.min(proporcao, 1)) * raio;
  return [centro + r * Math.cos(angulo), centro + r * Math.sin(angulo)];
}

function poligono(valores: Record<Eixo, number>, max: number, raio: number, centro: number): string {
  return EIXOS.map((eixo, i) => {
    const [x, y] = vertice(i, valores[eixo] / max, raio, centro);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function malha(raio: number, centro: number, aneis: number[]): string {
  const teias = aneis
    .map((fracao) => {
      const pontos = EIXOS.map((_, i) => {
        const [x, y] = vertice(i, fracao, raio, centro);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polygon class="radar-anel" points="${pontos}" />`;
    })
    .join('');

  const raios = EIXOS.map((_, i) => {
    const [x, y] = vertice(i, 1, raio, centro);
    return `<line class="radar-raio" x1="${centro}" y1="${centro}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
  }).join('');

  return teias + raios;
}

export interface OpcoesRadar {
  /** Lado do quadrado do SVG, em pixels. */
  tamanho: number;
  /** Segundo polígono, em contorno tracejado: o que o dia exige. */
  exigencia?: Record<Eixo, number>;
  /** Ícone e valor em cada vértice. */
  rotulos?: boolean;
  titulo?: string;
}

export function radarHtml(
  valores: Record<Eixo, number>,
  max: number,
  { tamanho, exigencia, rotulos = false, titulo }: OpcoesRadar,
): string {
  const margem = rotulos ? 26 : 4;
  const centro = tamanho / 2;
  const raio = centro - margem;

  const marcas = rotulos
    ? EIXOS.map((eixo, i) => {
        const [x, y] = vertice(i, 1.24, raio, centro);
        return `<text class="radar-rotulo" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
          text-anchor="middle" dominant-baseline="middle"
          >${ICONE_EIXO[eixo]}<title>${ROTULO_EIXO[eixo]}</title></text>`;
      }).join('')
    : '';

  const contorno = exigencia
    ? `<polygon class="radar-exigencia" points="${poligono(exigencia, max, raio, centro)}" />`
    : '';

  return `<svg class="radar" viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}"
      role="img" aria-label="${titulo ?? 'Atributos'}">
    ${malha(raio, centro, rotulos ? [0.25, 0.5, 0.75, 1] : [0.5, 1])}
    ${contorno}
    <polygon class="radar-valor" points="${poligono(valores, max, raio, centro)}" />
    ${marcas}
  </svg>`;
}

/** Os cinco números em linha, para quem prefere ler a olhar. */
export function numerosHtml(valores: Record<Eixo, number>): string {
  return `<div class="numeros-eixos">${EIXOS.map(
    (e) =>
      `<span title="${ROTULO_EIXO[e]}"><i>${ROTULO_EIXO[e].slice(0, 3).toUpperCase()}</i>${valores[e]}</span>`,
  ).join('')}</div>`;
}
