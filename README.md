# Até o Trono

Um jogo diário de navegador. Você recruta cinco heróis de todas as eras e
atravessa sete provas até o trono do Rei Demônio. O difícil não é chegar — é
chegar com todo mundo.

## Como se joga

1. Cinco rodadas. Em cada uma, o dia sorteia **quatro candidatos** de jogos
   diferentes, e você recruta um. Os mesmos quatro para todo mundo no mundo.
2. Não há preço. O que limita é **quem aceita marchar com quem**.
3. Escolha a **tática** da jornada.
4. A companhia encara sete provas — quatro de espada na mão, mais uma
   negociação, um enigma e uma travessia. **Falhou uma prova, acabou a jornada.**

Uma jornada por dia, guardada em `localStorage`. O modo treino sorteia um dia
avulso e não gasta a do dia.

## Os números

Cada herói tem cinco atributos de **0 a 11**: Vigor, Mobilidade, Carisma,
Intelecto e Combate. O que resolve um lance é a **soma da companhia** naquele
eixo:

```
soma do grupo + sinergia + traços + tática + moral + dado(−4 a +4)  vs  dificuldade
```

Tudo somado, nada multiplicado — nesta escala um multiplicador vira número
quebrado e o jogador perde a conta de cabeça.

**Todos os 80 heróis somam os mesmos 32 pontos, em formatos extremos.** Um
herói pode ter 11 num eixo e 2 noutro. Sem preço no draft, total de pontos
seria poder de graça; com todos iguais e formatos desiguais, cada escolha é uma
troca de verdade — ganho muito aqui, perco muito ali.

Isso saiu de uma medição: com todos os heróis no mesmo formato equilibrado,
um jogador que escolhia **o pior candidato de cada rodada** terminava tão bem
quanto um que conhecia o futuro. A composição não distinguia nada porque a
variação entre companhias era menor que o dado.

## As decisões de desenho

### A resolução produz acontecimentos, não um veredito

Cada prova se divide em **três lances**. Cada lance põe um eixo à prova e é
revelado em duas fases: a cena com o dado girando, e só depois o desfecho. O
protagonista é sorteado com peso pelo atributo — quem é bom naquilo tende a
aparecer — mas **o atributo dele não entra na conta**: quem resolve é o grupo.
Ele é quem a narração acompanha, e quem morre quando o lance cobra.

### Cada herói traz um traço, e o traço cobra o seu preço

São 16 traços, cinco heróis cada. Valem todos por volta de 4 pontos de
atributo, mas cobram em momentos diferentes: Comandante soma sempre, Vanguarda
só no primeiro lance, Vingança só depois que alguém cai, Mártir tomba no lugar
de outro.

**Todo traço é único na companhia** — é a exigência que o próprio traço traz, e
resolve de brinde o problema de empilhar o mesmo efeito cinco vezes. Alguns
também recusam companhia: Orador não marcha com besta, Vingança não entra com
sacro, Amuleto recusa magia negra.

É daqui que vem a estratégia sem o jogador saber o que o dia vai pedir: ela
nasce de dentro da companhia, não do encaixe com a jornada.

### A escassez é social, não econômica

Cada herói tem uma **moral de -3 a +3** e não marcha com quem estiver a mais de
3 pontos dela, e muitos **recusam etiquetas** — morto-vivo, magia negra,
realeza, fora da lei. Recrutar Alucard fecha a porta para os dois Belmont.

### Onde mora o RNG

No **dado do lance**, e só nele: −4 a +4, todos os nove resultados igualmente
prováveis. Sem isso, com provas fixas e soma determinística, a jornada estaria
decidida no instante em que a companhia fecha.

### O que separa chegar de chegar inteiro

- **`dadoFatal`** — o fracasso crítico. Com o dado no fundo do poço alguém fica
  pelo caminho *mesmo num lance vencido*. Existe porque tudo o mais depende da
  força da companhia: sem azar puro, quem é forte o bastante para vencer as sete
  provas nunca perde ninguém, e chegar inteiro viria de graça.
- **`margemImune`** — vitórias folgadas não podem ser cobradas. É a largura
  dessa imunidade que dá identidade a cada tática sem tornar nenhuma imortal.
- **`margemGrave`** — o quanto se pode falhar antes de perder alguém.

## Balanceamento

`npm run tune` roda milhares de jornadas com jogadores sintéticos.
`npm run tune -- --perfil` mostra onde caem as somas por eixo.
`npm run tune -- --varrer` varre dificuldade × margem, medindo sempre a **melhor**
tática — calibrar olhando uma só já escondeu uma tática dominante aqui.

**A janela é estreita.** As somas ficam agrupadas e o dado é ±4, então a
transição entre "todo lance passa" e "nenhum lance passa" acontece em poucos
pontos. `npm run reescalar -- -3` desloca o catálogo inteiro para experimentar.

Duas armadilhas encontradas no caminho:

- **Morrer menos vence duas vezes.** Baixa tira soma, que tira vitórias.
- **Calibrar olhando uma tática só esconde a dominante.**

`npm run conferir` faz 31 checagens: integridade do roster, determinismo,
traços válidos e usados, e que nenhum draft fique sem candidato compatível.

## Trocar o conteúdo

Heróis em `public/data/guildas.json`, provas em `public/data/desafios.json`,
ambos carregados por `fetch`. O motor não conhece nenhum nome nem nenhuma cena.

Retratos e cenários são desenhados por código, mas o CSS tenta carregar
`public/retratos/<id>.jpg` e `public/cenas/<id>.jpg` por cima — jogar imagens
nessas pastas troca a arte sem tocar em código.

`npm run remodelar` refaz os formatos e a distribuição de traços; roda **uma vez
só**, sobre um roster ainda não remodelado.

## Rodando

```bash
npm install
npm run dev
```

## Estrutura

```
src/tipos.ts     tipos do domínio
src/rng.ts       PRNG com seed, dia UTC, embaralhamento
src/regras.ts    eixos, traços, táticas, moral, composição da jornada, frases
src/motor.ts     compatibilidade, sorteio, resolução lance a lance
src/radar.ts     o pentágono em SVG
src/retrato.ts   brasões dos heróis e cenários das provas
src/main.ts      telas, ritmo da narração, compartilhamento
scripts/         remodelagem, reescala, balanceamento e conferências
```
