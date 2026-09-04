# -*- coding: utf-8 -*-
"""
Os cartões que aparecem quando alguém compartilha um link do site.

**Não faz parte do build.** É ferramenta de arte, rodada à mão quando entra um
jogo novo ou quando a identidade muda; a saída (`assets/brand/og/*.png`) é que
é versionada, como os favicons. Foi por isso que não virou dependência do
`construir.mjs`: transformar desenho em etapa obrigatória de deploy cobraria
pedágio de todo mundo por algo que muda uma vez por trimestre.

    pip install pillow
    python scripts/cartoes-og.py

As fontes da marca vêm do Google Fonts e ficam num cache local ignorado pelo
git — mesma ideia do `.cache-frequencia.txt` do Cifra: arquivo grande, baixável
de novo, sem por que morar no repositório.

O desenho segue o `tokens.css` e o `exchaos-mark.svg`. Se um deles mudar, muda
aqui também: o Pillow não lê CSS nem SVG, então o selo está redesenhado em
código — a mesma duplicação que o `cartao.ts` do Até o Trono já paga.
"""
import math, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(RAIZ, 'scripts', '.cache-fontes')
SAIDA = os.path.join(RAIZ, 'assets', 'brand', 'og')
os.makedirs(SAIDA, exist_ok=True)

FONTES = {
    'GrenzeGotisch.ttf': 'https://github.com/google/fonts/raw/main/ofl/grenzegotisch/GrenzeGotisch%5Bwght%5D.ttf',
    'Spectral-Italic.ttf': 'https://github.com/google/fonts/raw/main/ofl/spectral/Spectral-Italic.ttf',
    'IBMPlexMono-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf',
}


def baixar_fontes():
    os.makedirs(F, exist_ok=True)
    for nome, url in FONTES.items():
        destino = os.path.join(F, nome)
        if os.path.exists(destino):
            continue
        print('  baixando', nome)
        urllib.request.urlretrieve(url, destino)


baixar_fontes()

W, H, S = 1200, 630, 2
OBSIDIAN = (0x14, 0x11, 0x1C)
PARCHMENT = (0xE4, 0xD5, 0xB7)
PARCH_DIM = (0xB9, 0xA9, 0x87)
ARCANE = (0x9A, 0x6B, 0xE8)
CANDLE = (0xC9, 0x96, 0x2E)
MUTED = (0x8B, 0x7F, 0x97)
LINE = (0x33, 0x2B, 0x42)

def fonte(arq, tam, peso=None):
    f = ImageFont.truetype(os.path.join(F, arq), tam)
    if peso:
        try: f.set_variation_by_axes([peso])
        except Exception: pass
    return f

def brilho(img, centro, raio, cor, alpha):
    """Halo radial, como os radial-gradient do exchaos.css."""
    d = raio * 2
    m = ImageOps.invert(Image.radial_gradient('L')).resize((d, d), Image.LANCZOS)
    m = m.point(lambda v: int((v / 255.0) ** 1.8 * 255 * alpha))
    camada = Image.new('RGB', (d, d), cor)
    img.paste(camada, (centro[0] - raio, centro[1] - raio), m)

def selo(dr, cx, cy, raio):
    """O exchaos-mark.svg redesenhado: viewBox de 200 unidades, centro em 100,100."""
    k = raio / 94.0
    P = lambda x, y: (cx + (x - 100) * k, cy + (y - 100) * k)
    def girar(x, y, g):
        r = math.radians(g)
        dx, dy = x - 100, y - 100
        return (100 + dx * math.cos(r) - dy * math.sin(r), 100 + dx * math.sin(r) + dy * math.cos(r))
    def anel(r, larg):
        dr.ellipse([P(100 - r, 100 - r), P(100 + r, 100 + r)], outline=ARCANE, width=max(1, int(larg * k)))
    anel(94, 1.4); anel(87, 0.7)
    for i in range(60):  # o anel tracejado (stroke-dasharray 2 10)
        g = i * 6
        x, y = girar(100, 9, g)
        dr.ellipse([P(x - 1.1, y - 1.1), P(x + 1.1, y + 1.1)], fill=ARCANE)
    for i in range(8):
        g = i * 45
        a, b = girar(100, 84, g), girar(100, 42, g)
        dr.line([P(*a), P(*b)], fill=PARCHMENT, width=max(1, int(7 * k)))
        for p in (a, b):
            r = 3.5
            dr.ellipse([P(p[0] - r, p[1] - r), P(p[0] + r, p[1] + r)], fill=PARCHMENT)
        dr.polygon([P(*girar(100, 33, g)), P(*girar(109, 48, g)), P(*girar(91, 48, g))], fill=PARCHMENT)
    for (x, y, r) in ((150, 70, 1.3), (52, 126, 1.1), (126, 150, 1.2), (70, 52, 1.0)):
        dr.ellipse([P(x - r, y - r), P(x + r, y + r)], fill=CANDLE)
    dr.polygon([P(100, 92), P(101.8, 98.2), P(108, 100), P(101.8, 101.8),
                P(100, 108), P(98.2, 101.8), P(92, 100), P(98.2, 98.2)], fill=CANDLE)

def espacado(dr, xy, texto, fnt, cor, espaco):
    """Titulos em versalete do site usam letter-spacing; o Pillow nao tem."""
    x, y = xy
    for c in texto:
        dr.text((x, y), c, font=fnt, fill=cor)
        x += dr.textlength(c, font=fnt) + espaco
    return x

def quebrar(dr, texto, fnt, largura):
    linhas, atual = [], ''
    for p in texto.split():
        teste = (atual + ' ' + p).strip()
        if dr.textlength(teste, font=fnt) <= largura: atual = teste
        else: linhas.append(atual); atual = p
    if atual: linhas.append(atual)
    return linhas

def cartao(arquivo, eyebrow, titulo, linha):
    img = Image.new('RGB', (W * S, H * S), OBSIDIAN)
    brilho(img, (int(W * .30 * S), int(H * .12 * S)), int(560 * S), ARCANE, .30)
    brilho(img, (int(W * .82 * S), int(H * 1.02 * S)), int(460 * S), CANDLE, .10)
    dr = ImageDraw.Draw(img)

    m = int(46 * S)
    dr.rectangle([m, m, W * S - m, H * S - m], outline=LINE, width=max(1, int(1.5 * S)))

    cx, cy = int(300 * S), int(H / 2 * S)
    brilho(img, (cx, cy), int(200 * S), ARCANE, .22)
    dr = ImageDraw.Draw(img)
    selo(dr, cx, cy, int(148 * S))

    x = int(520 * S)
    larg = int((W - 520 - 84) * S)

    f_eye = fonte('IBMPlexMono-Regular.ttf', int(19 * S))
    f_tit = fonte('GrenzeGotisch.ttf', int(96 * S), 600)
    f_sub = fonte('Spectral-Italic.ttf', int(29 * S))

    linhas_t = quebrar(dr, titulo, f_tit, larg)
    linhas_s = quebrar(dr, linha, f_sub, larg)
    alt = int(56 * S) + len(linhas_t) * int(100 * S) + int(30 * S) + len(linhas_s) * int(46 * S)
    y = int(H / 2 * S) - alt // 2

    espacado(dr, (x, y), eyebrow.upper(), f_eye, MUTED, int(5.2 * S))
    y += int(56 * S)
    for l in linhas_t:
        dr.text((x, y), l, font=f_tit, fill=PARCHMENT)
        y += int(100 * S)
    y += int(30 * S)
    for l in linhas_s:
        dr.text((x, y), l, font=f_sub, fill=PARCH_DIM)
        y += int(46 * S)

    img.resize((W, H), Image.LANCZOS).save(os.path.join(SAIDA, arquivo), optimize=True)
    print('  ->', arquivo)

cartao('og-exchaos.png', 'exchaos · jogos diários',
       'ExChaos', 'From chaos, worlds. Jogos de navegador nascidos do caos.')
cartao('og-jogos.png', 'exchaos · catálogo',
       'Jogos', 'Do caos, mundos. Jogos diários de navegador, de graça e sem instalar nada.')
cartao('og-ate-o-trono.png', 'exchaos · jogo diário',
       'Até o Trono', 'Recrute cinco heróis e despache esquadrões contra sete missões.')
cartao('og-cifra.png', 'exchaos · jogo diário',
       'Cifra', 'Cinco letras, oito tentativas. O oráculo nunca diz quais você acertou.')
