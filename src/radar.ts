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

function poligono(
  valores: Record<Eixo, number>,
  max: number,
  raio: number,
  centro: number,
  /** Proporção mínima do raio nos eixos escolhidos por `comPiso`. Só desenho. */
  piso = 0,
  comPiso: (eixo: Eixo) => boolean = () => false,
): string {
  return EIXOS.map((eixo, i) => {
    const p = valores[eixo] / max;
    return vertice(i, comPiso(eixo) ? Math.max(p, piso) : p, raio, centro)
      .map((n) => n.toFixed(1))
      .join(',');
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

/**
 * O pentágono da missão: o que ela exige contra o que o esquadrão põe.
 *
 * A escala é passada de fora e fica **fixa** entre as missões de propósito. Se
 * cada missão normalizasse pelo próprio maior valor, dois pentágonos iguais na
 * tela significariam coisas diferentes, e o jogador perderia a única leitura
 * que importa de relance: *falta muito ou falta pouco?*
 *
 * Os eixos que a missão não cobra ficam em zero, então a exigência aparece como
 * espinhos apontando para o que o dia pede. É a forma, e não o número, que
 * responde qual esquadrão serve.
 */
/**
 * O corpinho do pentágono: onde a missão não pede nada, os dois polígonos são
 * desenhados como se o eixo pedisse este tanto, em **pontos do eixo**, em vez
 * de ficarem no centro. Pequeno de propósito: é só para a forma não
 * degenerar numa reta passando pelo meio. Não existe na regra.
 */
export const PISO_VISUAL = 3;

export interface OpcoesDespacho {
  tamanho: number;
  /** O pentágono da missão. Zero nos eixos que ela não cobra. */
  exigencia: Record<Eixo, number>;
  /** O que o esquadrão põe em cada eixo, já com cansaço e modificadores. */
  somas: Record<Eixo, number>;
  /** O dado de cada eixo, quando já rolou. É o que a bolinha mostra. */
  dados?: Partial<Record<Eixo, number>>;
  maximo: number;
  titulo?: string;
  /**
   * Piso **de desenho** para os eixos que a missão não cobra, em pontos do
   * eixo. Não existe na regra: `despacho.ts` continua tratando esses eixos
   * como zero, e a conta na tela não muda.
   *
   * Existe porque um pentágono com dois eixos cobrados separados por um vazio
   * saía do vértice até o centro e voltava, virando um V sem corpo. Com o piso,
   * os dois polígonos passam pelo mesmo ponto onde nada é pedido, então eles só
   * divergem onde há exigência de verdade — e a forma volta a ter corpo sem
   * inventar exigência nenhuma.
   */
  pisoVisual?: number;
}

export function radarDespachoHtml({
  tamanho,
  exigencia,
  somas,
  dados,
  maximo,
  titulo,
  pisoVisual = PISO_VISUAL,
}: OpcoesDespacho): string {
  const margem = 26;
  const centro = tamanho / 2;
  const raio = centro - margem;
  const cobrados = EIXOS.filter((e) => exigencia[e] > 0);
  const semExigencia = (e: Eixo) => exigencia[e] <= 0;

  const piso = pisoVisual / maximo;

  const marcas = EIXOS.map((eixo, i) => {
    const [x, y] = vertice(i, 1.24, raio, centro);
    const cobra = exigencia[eixo] > 0;
    return `<text class="radar-rotulo${cobra ? ' cobrado' : ' folga'}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
      text-anchor="middle" dominant-baseline="middle"
      >${ICONE_EIXO[eixo]}<title>${ROTULO_EIXO[eixo]}${
        cobra ? `: pede ${exigencia[eixo]}` : ': não é cobrado'
      }</title></text>`;
  }).join('');

  /**
   * Uma bolinha por eixo cobrado, parada onde o esquadrão chegou depois do
   * dado. Fora do anel da exigência é sobra, dentro é falta — e é essa a
   * leitura que a animação encena. `--x-sem-dado` guarda de onde ela partiu,
   * para o CSS animar do valor certo até o valor sorteado.
   */
  const bolinhas = cobrados
    .map((eixo) => {
      const i = EIXOS.indexOf(eixo);
      const dado = dados?.[eixo];
      const valor = somas[eixo] + (dado ?? 0);
      const [x, y] = vertice(i, valor / maximo, raio, centro);
      const [xs, ys] = vertice(i, somas[eixo] / maximo, raio, centro);
      const passou = valor >= exigencia[eixo];
      // `--dx/--dy` é de onde a bolinha parte: a posição sem o dado. O CSS
      // anima de lá até aqui, então o jogador vê o dado empurrar ou puxar o
      // eixo, em vez de o número simplesmente aparecer trocado.
      return `<circle class="radar-bolinha ${passou ? 'passou' : 'faltou'}${
        dado === undefined ? ' parada' : ''
      }" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"
        style="--dx:${(xs - x).toFixed(1)}px; --dy:${(ys - y).toFixed(1)}px"
        ><title>${ROTULO_EIXO[eixo]}: ${somas[eixo]}${
          dado === undefined ? '' : ` ${dado >= 0 ? '+' : ''}${dado}`
        } contra ${exigencia[eixo]}</title></circle>`;
    })
    .join('');

  return `<svg class="radar radar-despacho" viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}"
      role="img" aria-label="${titulo ?? 'O que a missão exige e o que o esquadrão põe'}">
    ${malha(raio, centro, [0.25, 0.5, 0.75, 1])}
    <polygon class="radar-valor" points="${poligono(somas, maximo, raio, centro, piso, semExigencia)}" />
    <polygon class="radar-exigencia espinhos" points="${poligono(exigencia, maximo, raio, centro, piso, semExigencia)}" />
    ${bolinhas}
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
