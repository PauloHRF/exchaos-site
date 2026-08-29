# Até o Trono

Um jogo diário de navegador. Você recruta cinco heróis de todas as eras e
despacha esquadrões contra sete missões até o trono do Rei Demônio. O difícil
não é vencer uma missão — é ainda ter gente de pé quando chegar a última.

## Como se joga

1. Cinco rodadas de recrutamento. Em cada uma, o dia sorteia **quatro
   candidatos** de jogos diferentes, e você fica com um. Os mesmos quatro para
   todo mundo no mundo. **Você não sabe nada sobre as missões do dia.**
2. Não há preço no recrutamento. O que limita é **quem aceita marchar com quem**.
3. As sete missões vêm uma a uma, e cada uma **mostra o que exige**: um
   pentágono com o quanto pede de cada eixo. Você despacha **2 ou 3** da
   companhia. A última leva **todos os que sobraram**.
4. Quem é despachado volta cansado. Quem fica de fora recupera.
5. **Falhar uma missão não encerra a jornada** — deixa o Rei Demônio mais forte.

Uma jornada por dia, guardada em `localStorage`. O modo treino sorteia um dia
avulso e não gasta a do dia.

## Os números

Cada herói tem cinco atributos de **0 a 11**: Vigor, Mobilidade, Carisma,
Intelecto e Combate. O que resolve uma missão é a comparação entre dois
pentágonos — o que ela exige e o que o esquadrão põe:

```
em cada eixo cobrado:
  soma do esquadrão + sinergia + traços + moral + dado(−4 a +4)  vs  o que a missão pede

a margem da missão é a soma dos saldos, com a sobra de cada eixo limitada a 4
```

Tudo somado, nada multiplicado — nesta escala um multiplicador vira número
quebrado e o jogador perde a conta de cabeça.

**Todos os 80 heróis somam os mesmos 32 pontos, em formatos extremos.** Um
herói pode ter 11 num eixo e 2 noutro. Sem preço no draft, total de pontos
seria poder de graça; com todos iguais e formatos desiguais, cada escolha é uma
troca de verdade. E como agora você **aponta** o esquadrão contra o que a missão
pede, o formato extremo passou a valer mais do que valia: especialista serve
para alguma coisa quando dá para escolher quando ele joga.

## As decisões de desenho

### O draft é cego; o despacho é informado

São duas decisões diferentes, e é de propósito que só uma delas conta com
informação. Você monta os cinco sem saber nada do dia, e só então cada missão
abre o pentágono do que cobra.

Isso preservou a medição que motivou o desenho anterior. Um jogador sintético
que **lê a exigência do dia e monta a companhia contra ela** salva o mundo em
20,1% das jornadas; um que ignora o dia e monta pelo que a companhia tem por
dentro — sinergia, traços que pagam, nenhum lado murcho — salva em **27,1%**. O
oráculo persegue o pentágono de um dia só e aceita um lado murcho que outro dia
cobraria. Esconder a exigência no *recrutamento* não esconde a estratégia boa;
esconde uma armadilha. Revelá-la no *despacho* é outra coisa: ali a companhia
já está fechada, e a informação vira decisão em vez de armadilha.

### Sobrar num eixo não compensa faltar noutro

Cada eixo aproveita no máximo **4 pontos de sobra**; o resto se perde. Sem esse
teto, um pico enorme num eixo cobriria um buraco noutro e a missão viraria soma
bruta — e aí o esquadrão certo seria sempre "os três mais fortes", não os três
que cobrem o que o dia pede.

É a regra mais importante do jogo, e é por isso que a interface mostra o saldo
**já com o teto aplicado**: a margem lá embaixo é a soma exata da coluna. Numa
versão anterior a tabela somava +5, +13 e +3 e anunciava margem +11, e a regra
virava mágica em vez de lição.

### O cansaço pesa, mas não tranca

Quem é despachado ganha 1 de cansaço; quem fica de fora perde 1. Cada ponto
desconta **2 de cada atributo** do herói. Ninguém fica indisponível: dá para
insistir no time A e pagar por isso.

Cooldown como *indisponibilidade* foi tentado primeiro e não funciona, e a
aritmética é curta: com cinco heróis e esquadrões de 2 ou 3, mandar 3 na
primeira missão deixa exatamente 2 disponíveis para a segunda, e a partir daí a
escala inteira é forçada. O jogo se jogaria sozinho a partir da missão 2.

Que o cansaço esteja fazendo trabalho é medida, não afirmação. Um jogador
sintético `miope`, que manda sempre o melhor esquadrão possível para a missão da
vez, contra um `zeloso`, que manda o mais barato que ainda deve passar e guarda
gente descansada:

| desconto por ponto | zeloso | miope | vantagem do zeloso |
| --- | --- | --- | --- |
| 0 (sem cansaço) | 83,8% | **94,5%** | **0,89×** |
| 1 | 57,1% | 47,9% | 1,19× |
| **2** (o do jogo) | **27,7%** | 7,3% | **3,76×** |
| 3 | 13,4% | 0,3% | 53× |

Na primeira linha o `miope` **ganha**: sem cansaço, queimar o time A é a jogada
certa e segurar gente é erro. Segurar só vira sabedoria porque o cansaço
existe. Em 1 o cansaço existe mas quase não decide; em 3 ele decide tudo e o
jogo fica intransponível. Dois é onde a mecânica é a habilidade central sem ser
a única.

### Falhar não encerra: encarece

Cada missão perdida soma **2 ao pentágono do Rei Demônio**, em cada eixo que ele
cobra. O erro vira dívida a administrar em vez de tela de fim — e é isso que dá
espaço ao despacho existir. Num jogo de fim súbito a primeira missão decidiria
quase tudo, e as seis decisões seguintes nunca aconteceriam.

Esse número é o que controla a **inclinação da curva de habilidade**, não a
dificuldade do topo. Em 0, a distância entre jogar bem e jogar no impulso é
3,8×; em 3, vira 15×.

### Onde mora o RNG

Um dado de −4 a +4 **por eixo cobrado**, todos os nove resultados igualmente
prováveis, e o dado entra **antes** do teto da sobra — sorte num eixo que já
estava folgado é desperdiçada, o que faz o esquadrão bem montado ser mais
previsível, e não só mais forte.

Um dado por missão foi tentado antes e é pior por um motivo estrutural: a margem
é a soma de três saldos, então cada ponto de dificuldade movia três de margem
contra um acaso de ±4, e a calibragem caía de um penhasco — 64% de vitória
viravam 11% entre dois valores vizinhos. Três dados somados dão uma curva de
sino: o resultado de costume é o esperado, e o desastre existe sem ser rotina.

### Não há tática, e a ausência é a decisão

O jogo anterior pedia uma tática para a jornada inteira — agressiva, equilibrada
ou defensiva. Medidas até o fim, a agressiva salvava o mundo em 30,7% das
jornadas contra 5,9% da defensiva. **Escolha em que uma opção é cinco vezes
melhor não é decisão, é pegadinha**, e o despacho já pôs seis decisões de
verdade no lugar de uma falsa.

Ao sumirem, elas devolveram o dial que gastavam: `IMUNE` e `DADO_FATAL`
existiam em três versões só para dar identidade a cada tática, e hoje respondem
sozinhos por quanto "chegar inteiro" é alcançável.

### A escassez é social, e agora também temporal

Cada herói tem uma **moral de -3 a +3** e não marcha com quem estiver a mais de
3 pontos dela; muitos **recusam etiquetas** — morto-vivo, magia negra, realeza,
fora da lei. Recrutar Alucard fecha a porta para os dois Belmont. A isso o
despacho acrescentou uma segunda escassez: **quem trabalhou hoje vale menos
amanhã**, e a última missão leva todo mundo.

**Sinergia e traços contam só entre os despachados.** É o que faz o
recrutamento conversar com o despacho: recrutar dois da mesma franquia só paga
se você os mandar juntos.

### A narração acompanha o eixo que decidiu

Cada missão é uma cena só. Quem a narração acompanha é sorteado com peso pelo
eixo em que o esquadrão **mais ficou devendo** — o atributo dele não entra na
conta, quem resolve é o grupo, mas é ele quem aparece e quem morre quando a
missão cobra.

É também o que salvou o conteúdo na troca de motor: os 125 textos de narração
são indexados por eixo e resultado, e continuaram valendo sem uma linha
reescrita.

## Balanceamento

`npm run despachar` roda milhares de jornadas com o **draft fixo**, variando só
quem é despachado. Sem fixar o draft, o efeito das duas decisões ficaria
embolado.

| política de despacho | como escolhe | salvou | sem baixa | perfeita | baixas |
| --- | --- | --- | --- | --- | --- |
| `pessimo` | o pior esquadrão possível | 0,0% | 0,0% | 0,0% | 4,77 |
| `aleatorio` | qualquer esquadrão legal | 0,8% | 0,4% | 0,0% | 3,43 |
| `bruto` | os três melhores no eixo mais cobrado | 3,9% | 2,1% | 0,4% | 2,36 |
| `miope` | o melhor para a missão da vez | 7,3% | 6,4% | 1,6% | 1,62 |
| `zeloso` | o mais barato que ainda deve passar | **27,7%** | **20,8%** | **6,6%** | 1,46 |

`npm run despachar -- --draft` faz a pergunta simétrica: com o despacho fixo no
`zeloso`, quanto o recrutamento sozinho move?

| draft | salvou | baixas |
| --- | --- | --- |
| `pessimo` | 8,5% | 2,14 |
| `aleatorio` | 17,3% | 1,79 |
| `guloso` | 17,3% | 1,76 |
| `informado` | 20,1% | 1,69 |
| `sinergico` | **27,1%** | 1,48 |

O `guloso` empata com o `aleatorio` de propósito: desde que todo herói soma os
mesmos 32 pontos, ordenar por força bruta é ruído, e ele fica no conjunto para
provar isso a cada rodagem.

**As duas decisões pagam, e o despacho paga mais.** Recrutar bem em vez de mal
vale 3,2×; despachar bem em vez de no impulso vale 7,1× sobre o `bruto` — que é
o jogador realista, o que leu o pentágono por alto e mandou os três mais fortes.

Outros modos: `--peso` varre o desconto do cansaço, `--trono` o quanto cada
falha engrossa o Rei Demônio, `--varrer` a dificuldade das missões, `--inteiro`
a margem imune ao azar, e `--exemplo` imprime uma jornada inteira com a conta de
cada missão.

**A janela é estreita.** As somas ficam agrupadas, então a transição entre "toda
missão passa" e "nenhuma passa" acontece em poucos pontos de
`FATOR_DA_EXIGENCIA`.

Três armadilhas encontradas no caminho, todas por medição:

- **Cooldown que tranca faz o jogo se jogar sozinho.** 5 = 3 + 2.
- **Um modificador aplicado por eixo é multiplicado pelo número de eixos.** A
  tática entrando em cada eixo virava ±12 de margem — mais que todo o resto
  somado —, e as três colapsavam: a defensiva chegava a perder *mais* gente que
  a agressiva, por perder missão demais.
- **Duas cópias do laço da jornada divergem.** A regra de quem tomba morava
  dentro do simulador, e a interface, que tem o seu próprio laço, rodava sem
  ela: sete fracassos graves e a companhia voltava inteira.

`npm run conferir` faz 33 checagens do roster e do catálogo: integridade,
determinismo, traços válidos e usados, que nenhum draft fique sem candidato
compatível, e que **todo eixo seja cobrado entre 3,5 e 5 vezes por dia** —
contando pelo dia e não pelo catálogo, porque a jornada sorteia três combates e
só um de cada uma das outras provas, e um eixo cobrado quatro vezes menos que
outro não é atributo, é lugar de jogar fora os pontos que sobram.

## Trocar o conteúdo

Heróis em `public/data/guildas.json`, missões em `public/data/desafios.json`,
ambos carregados por `fetch`. O motor não conhece nenhum nome nem nenhuma cena.

O pentágono de cada missão sai dos três lances que o desafio já trazia escritos:
cada lance era um eixo e uma dificuldade, e é isso que vira espeto no pentágono,
multiplicado por `FATOR_DA_EXIGENCIA`. Os eixos que o desafio não citava ficam
em zero — e têm de ficar, porque o esquadrão mais parelho que cabe numa party de
cinco só chega a 17 no seu eixo mais fraco, e missão que cobrasse os cinco eixos
seria impossível por construção.

Retratos e cenários são desenhados por código, mas o CSS tenta carregar
`public/retratos/<id>.jpg` e `public/cenas/<id>.jpg` por cima — jogar imagens
nessas pastas troca a arte sem tocar em código.

## Rodando

```bash
npm install
npm run dev
```

## Estrutura

```
src/tipos.ts     tipos do domínio
src/rng.ts       PRNG com seed, dia UTC, embaralhamento
src/regras.ts    eixos, traços, moral, composição da jornada, narração, epílogos
src/motor.ts     compatibilidade, sorteio dos candidatos, sinergia, epílogo
src/despacho.ts  exigência, cansaço, resolução da missão, baixas, jornada
src/radar.ts     o pentágono em SVG, com a bolinha de cada eixo
src/retrato.ts   brasões dos heróis e cenários das missões
src/main.ts      telas, ritmo da revelação, salvamento, compartilhamento
src/cartao.ts    o cartão de imagem da jornada
scripts/despachar.ts  calibragem do modelo de despacho
scripts/conferir.ts   as checagens do roster e do catálogo
scripts/avaliar.ts    quanto vale uma companhia para quem não sabe o que o dia cobra
```

`src/motor.ts` ainda carrega a simulação lance a lance do modelo anterior, que
`scripts/conferir.ts` usa nas checagens de roster e determinismo.
