import { ICONE_TIPO, ROTULO_TIPO } from './regras.ts';
import type { Campanha, Recrutado, ResultadoEtapa } from './tipos.ts';

/**
 * O cartão de resultado, desenhado em canvas para virar imagem.
 *
 * Texto no aplicativo de mensagem passa batido; imagem, não. É o que faz o
 * resultado circular — e por isso o cartão mostra a companhia inteira, que é a
 * parte de que o jogador se orgulha, sem revelar nada que estrague o dia de
 * quem ainda vai jogar (os atributos e a ordem das provas ficam de fora).
 */

const L = 1080;

const COR = {
  fundo: '#100d09',
  papel: '#191410',
  couro: '#2e2419',
  bronze: '#6d5636',
  ouro: '#c9a227',
  ouroClaro: '#e8ca77',
  pergaminho: '#ece3d0',
  fraco: '#a2937a',
  musgo: '#7fa06a',
  ambar: '#d9a441',
  sangue: '#c4665c',
};

const COR_ETAPA: Record<ResultadoEtapa, string> = {
  'vitoria-limpa': COR.musgo,
  'vitoria-custosa': COR.ambar,
  derrota: COR.sangue,
  'nao-jogada': COR.couro,
};

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";

function texto(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opcoes: { fonte: string; cor: string; alinhar?: CanvasTextAlign; espaco?: number },
) {
  ctx.font = opcoes.fonte;
  ctx.fillStyle = opcoes.cor;
  ctx.textAlign = opcoes.alinhar ?? 'left';
  ctx.letterSpacing = `${opcoes.espaco ?? 0}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}

function filete(ctx: CanvasRenderingContext2D, y: number, x1 = 80, x2 = L - 80) {
  const g = ctx.createLinearGradient(x1, 0, x2, 0);
  g.addColorStop(0, 'rgba(109,86,54,0)');
  g.addColorStop(0.5, COR.bronze);
  g.addColorStop(1, 'rgba(109,86,54,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x1, y, x2 - x1, 2);
}

function caixa(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, a: number, r = 10) {
  ctx.beginPath();
  ctx.roundRect(x, y, l, a, r);
}

export interface DadosDoCartao {
  campanha: Campanha;
  party: Recrutado[];
  numeroDoDia: number;
  titulo: string;
  remate: string;
}

export function desenharCartao(dados: DadosDoCartao): HTMLCanvasElement {
  const { campanha, party, numeroDoDia, titulo, remate } = dados;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  const ctx = canvas.getContext('2d')!;

  const caidos = new Set(campanha.etapas.flatMap((e) => e.caidos.map((h) => h.id)));

  /*
   * Primeiro medir, depois desenhar. A altura sai do conteúdo: com valor fixo,
   * um epílogo curto deixava um palmo de vazio no pé do cartão.
   */
  const tituloEmCaixaAlta = titulo.toUpperCase();
  let tamanhoTitulo = 76;
  ctx.font = `700 ${tamanhoTitulo}px ${SERIF}`;
  while (ctx.measureText(tituloEmCaixaAlta).width > L - 160 && tamanhoTitulo > 40) {
    tamanhoTitulo -= 2;
    ctx.font = `700 ${tamanhoTitulo}px ${SERIF}`;
  }

  ctx.font = `italic 30px ${SERIF}`;
  const linhas: string[] = [];
  let linha = '';
  for (const p of remate.split(' ')) {
    const tentativa = linha ? `${linha} ${p}` : p;
    if (ctx.measureText(tentativa).width > L - 200 && linha) {
      linhas.push(linha);
      linha = p;
    } else linha = tentativa;
  }
  if (linha) linhas.push(linha);
  const remateLinhas = linhas.slice(0, 3);

  const yTitulo = 210 + tamanhoTitulo / 2;
  const yRemate = yTitulo + 54;
  const topoProvas = yRemate + remateLinhas.length * 40 + 20;
  const topoFaixa = topoProvas + 148;
  const topoLista = topoFaixa + 132 + 96;
  const alturaLinha = 96;
  const rodape = topoLista + party.length * alturaLinha + 28;
  const A = rodape + 108;

  canvas.height = A;

  // Fundo e moldura
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, L, A);
  const halo = ctx.createRadialGradient(L / 2, 120, 0, L / 2, 120, 900);
  halo.addColorStop(0, 'rgba(201,162,39,0.14)');
  halo.addColorStop(1, 'rgba(201,162,39,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = COR.couro;
  ctx.lineWidth = 3;
  caixa(ctx, 40, 40, L - 80, A - 80, 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(201,162,39,0.28)';
  ctx.lineWidth = 1;
  caixa(ctx, 52, 52, L - 104, A - 104, 4);
  ctx.stroke();

  // Cabeçalho
  texto(ctx, 'ATÉ O TRONO', 80, 132, { fonte: `700 40px ${SERIF}`, cor: COR.ouroClaro, espaco: 3 });
  texto(ctx, `jornada #${numeroDoDia}`, L - 80, 132, {
    fonte: `500 30px ${MONO}`,
    cor: COR.fraco,
    alinhar: 'right',
  });
  filete(ctx, 162);

  // O desfecho, em corpo grande
  texto(ctx, tituloEmCaixaAlta, L / 2, yTitulo, {
    fonte: `700 ${tamanhoTitulo}px ${SERIF}`,
    cor: campanha.perfeita ? COR.musgo : COR.ouroClaro,
    alinhar: 'center',
    espaco: 2,
  });

  ctx.font = `italic 30px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COR.fraco;
  remateLinhas.forEach((l, i) => ctx.fillText(l, L / 2, yRemate + i * 40));

  // As sete provas
  const larguraProva = 118;
  const vaoProva = 14;
  const totalProvas = campanha.etapas.length * larguraProva + (campanha.etapas.length - 1) * vaoProva;
  let px = (L - totalProvas) / 2;
  campanha.etapas.forEach((etapa, i) => {
    const cor = COR_ETAPA[etapa.resultado];
    ctx.fillStyle = 'rgba(25,20,16,0.9)';
    caixa(ctx, px, topoProvas, larguraProva, 104, 8);
    ctx.fill();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2;
    caixa(ctx, px, topoProvas, larguraProva, 104, 8);
    ctx.stroke();
    ctx.fillStyle = cor;
    ctx.fillRect(px + 18, topoProvas + 18, larguraProva - 36, 8);
    texto(ctx, ICONE_TIPO[etapa.desafio.tipo], px + larguraProva / 2, topoProvas + 70, {
      fonte: '34px sans-serif',
      cor: COR.pergaminho,
      alinhar: 'center',
    });
    texto(ctx, String(i + 1), px + larguraProva / 2, topoProvas + 94, {
      fonte: `600 20px ${MONO}`,
      cor: COR.fraco,
      alinhar: 'center',
    });
    px += larguraProva + vaoProva;
  });

  // Faixa de números
  ctx.strokeStyle = COR.couro;
  ctx.lineWidth = 2;
  caixa(ctx, 80, topoFaixa, L - 160, 132, 8);
  ctx.stroke();
  const colunas: [string, string, string][] = [
    [String(campanha.vitorias), 'PROVAS', COR.pergaminho],
    [String(campanha.baixas), 'BAIXAS', campanha.baixas === 0 ? COR.musgo : COR.sangue],
    [
      (campanha.moralDaParty > 0 ? '+' : '') + (Math.round(campanha.moralDaParty * 10) / 10),
      'MORAL',
      COR.pergaminho,
    ],
  ];
  const larguraCol = (L - 160) / colunas.length;
  colunas.forEach(([valor, rotulo, cor], i) => {
    const cx = 80 + larguraCol * i + larguraCol / 2;
    if (i > 0) {
      ctx.strokeStyle = COR.couro;
      ctx.beginPath();
      ctx.moveTo(80 + larguraCol * i, topoFaixa + 16);
      ctx.lineTo(80 + larguraCol * i, topoFaixa + 116);
      ctx.stroke();
    }
    const tamanho = valor.length > 4 ? 38 : 54;
    texto(ctx, valor, cx, topoFaixa + 68, {
      fonte: `700 ${tamanho}px ${SERIF}`,
      cor,
      alinhar: 'center',
    });
    texto(ctx, rotulo, cx, topoFaixa + 104, {
      fonte: `500 20px ${MONO}`,
      cor: COR.fraco,
      alinhar: 'center',
      espaco: 3,
    });
  });

  // A companhia. O rótulo ganha respiro: colado na caixa acima, parecia parte dela.
  texto(ctx, 'A COMPANHIA', L / 2, topoLista - 34, {
    fonte: `600 24px ${MONO}`,
    cor: COR.bronze,
    alinhar: 'center',
    espaco: 6,
  });

  party.forEach((heroi, i) => {
    const y = topoLista + i * alturaLinha;
    const caiu = caidos.has(heroi.id);
    ctx.fillStyle = COR.papel;
    caixa(ctx, 80, y, L - 160, 80, 8);
    ctx.fill();
    ctx.strokeStyle = caiu ? 'rgba(196,102,92,0.5)' : COR.couro;
    ctx.lineWidth = 2;
    caixa(ctx, 80, y, L - 160, 80, 8);
    ctx.stroke();

    // Barra da esquerda: viva em ouro, caída em sangue
    ctx.fillStyle = caiu ? COR.sangue : COR.ouro;
    caixa(ctx, 80, y, 8, 80, 4);
    ctx.fill();

    texto(ctx, heroi.nome, 122, y + 40, {
      fonte: `700 34px ${SERIF}`,
      cor: caiu ? COR.fraco : COR.pergaminho,
    });
    texto(ctx, heroi.jogo, 122, y + 68, { fonte: `20px ${MONO}`, cor: COR.bronze, espaco: 1 });
    if (caiu) {
      texto(ctx, '✝', L - 112, y + 52, {
        fonte: `40px ${SERIF}`,
        cor: COR.sangue,
        alinhar: 'right',
      });
    }
  });

  // Rodapé
  filete(ctx, rodape);
  texto(ctx, 'ateotrono.com.br · monte a sua', L / 2, rodape + 48, {
    fonte: `24px ${MONO}`,
    cor: COR.fraco,
    alinhar: 'center',
    espaco: 2,
  });

  return canvas;
}

/** Rótulo do tipo de prova, exportado para quem quiser legendar o cartão. */
export { ROTULO_TIPO };
