# Cifra

Jogo diário de dedução. Cinco letras, oito tentativas, uma palavra por dia igual
para todo mundo. Publicado em `exchaos.com.br/jogos/cifra`.

É o primeiro jogo **estático** do portal: HTML, CSS e JS soltos, sem
`package.json` e sem cadeia de build. O `construir.mjs` copia a pasta como está.

```
index.html    marcação e os três modais
estilo.css    o visual, todo em cima dos tokens da marca
jogo.js       as regras, o estado e o desenho
palavras.js   o vocabulário — GERADO, não escrito à mão
```

O vocabulário sai de `scripts/cifra-palavras.mjs`, na raiz do repositório.
**Não edite `palavras.js` à mão**: a próxima geração apaga.

---

## A mecânica, e por que ela não é um Wordle

Depois de cada chute o jogo devolve **três números**, não cinco cores:

| | significado | cor |
|---|---|---|
| no lugar | quantas letras estão na posição certa | Arcano |
| na palavra | quantas existem, mas noutro lugar | Vela |
| fora | quantas não estão na palavra | Névoa |

Ele nunca diz **quais**. Essa única diferença muda o gênero: sai de jogo de
vocabulário e vira dedução lógica — cada chute é uma equação, a partida é o
sistema. A linhagem é antiga e livre (Jotto, Senha, Mastermind); a versão em
palavras que serviu de referência é o Word500.

No Wordle a segunda tentativa já é quase informada. Aqui as três ou quatro
primeiras são **sondagens**: você está montando um sistema de equações, não
caçando a palavra.

### As cores não foram portadas, foram remapeadas

O original usa verde/amarelo/vermelho. A marca ExChaos **não tem verde** — onde
a intuição pede verde, ela usa Arcano. Então:

- **no lugar → Arcano**, que é o acerto da marca;
- **na palavra → Vela**, o quase, quente;
- **fora → Névoa**, o descartado, que some.

Névoa em vez de Sangue no "fora" tem motivo duplo: é o número que mais aparece,
e encher a tela de Sangue gastaria justamente a cor que a marca reserva para
dose pequena. O Sangue ficou para a última tentativa e para a derrota.

### A letra da casa é monoespaçada

A Grenze Gotisch é a display da marca e continua no título. Nas casas, não: ela
é gótica, e numa casa sozinha — sem palavra em volta para desambiguar — I vira
J, C vira E. Num jogo em que ler cada letra *é* a jogada, isso é defeito, não
estilo. A mono ainda cai bem no tema: cifra se lê em máquina.

---

## O branco

A barra de espaço deixa uma casa em branco (`_`), **no máximo uma por chute**.
O branco não entra em nenhum dos três números.

O limite de um inverte a função dele, e vale entender por quê. Com vários
brancos, o `_` **isolaria** uma incógnita: `_E___` responde "o E está na
palavra?" sem ambiguidade nenhuma. Com um só, você sempre digita quatro letras
reais mais um branco — então ele deixa de isolar e passa a **remover ruído**:
tira da conta a casa onde qualquer palpite seu só sujaria os números.

O trade-off inteiro do jogo está aí: preencher tudo dá mais alcance com sinal
sujo; deixar em branco dá menos alcance com sinal limpo.

### A validação com branco, e o bit que ela vaza

Um chute com `_` é aceito se **existir alguma letra que, posta no lugar do
traço, forme palavra do dicionário**. `motivoRecusa` varre as 26 e para na
primeira que fecha.

Isso vaza um bit, e é bom saber que vaza: chutar `GRAT_` e ser aceito ensina que
existe palavra `GRAT?`, sem gastar tentativa. É pequeno e é o preço de ter
validação junto com traço.

---

## As marcas

Um clique numa letra já chutada cicla `certa → meio certa → errada → sem marca`.

**A marca é da casa, não da letra.** Marcar o A de um chute não mexe no A do
chute de cima. É de propósito: a hipótese que o jogador carrega quase nunca é
"o A está na palavra", é "*este* A está no lugar" — frase que marca por tecla
não sabe dizer.

O teclado não guarda estado nenhum. Num Wordle isso sai de graça, porque lá o
jogo conhece cada letra; aqui ele não conhece, e pintar tecla entregaria
exatamente o que a Cifra existe para esconder.

### O que o jogo prova sozinho

`deduzir()` marca automaticamente o que os chutes já **provam**, sem palpite e
sem consultar a resposta. Três regras; duas saem da mesma conta, onde
`lugar + palavra` é quantas das letras digitadas estão na palavra:

1. **deu zero** → nenhuma delas está. Todas ausentes.
2. **deu o máximo possível** → todas estão. Todas presentes.
3. **o "no lugar" iguala o que você digitou** → todas estão *no lugar*. Esta é
   por casa, não por letra.

O "máximo possível" da regra 2 desconta as letras já sabidamente mortas, porque
essas não podiam pontuar. É isso que faz a dedução **encadear** — e por isso o
laço roda até parar de mudar:

> Contra `GRATO`, o chute `PEIXE` zera e mata P, E, I, X. Aí `PEGAR`, que vale 3
> acertos, passa a ter só três casas vivas (G, A, R) — e três acertos em três
> casas vivas provam as três presentes. Sozinho, `PEGAR` não prova nada: 3
> acertos em 5 casas abertas não dizem quais.

A regra 3 nasceu de um defeito real: sem ela, a jogada que vence (`5/0/0`)
provava as cinco letras *presentes*, e a palavra certa aparecia pintada de "meio
certa".

**Prova vence a mão.** Casa provada tem um ponto no canto e não aceita ser
desmarcada — deixar você anotar "certa" numa letra que os seus próprios chutes
mataram não é liberdade, é ajudar a mentir pra si mesmo.

E o que **não** se prova é posição fora da regra 3. Se provasse, o jogo estaria
resolvendo a si mesmo.

---

## Acentos

Digite sem acento. A comparação é sem acento e a grafia certa só aparece na
revelação — quem sabe escrever não deve perder por não achar a tecla.

Isso tem uma consequência que morde: **duas grafias que só diferem no acento são
o mesmo chute**. `mares`/`marés` e `forca`/`força` não podem coexistir, senão
uma delas vira resposta impossível de revelar direito. O gerador mantém a mais
frequente, e há checagem que falha se alguma colisão escapar.

---

## O vocabulário

Gerado por `scripts/cifra-palavras.mjs` a partir de
[hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(licença MIT, derivada de legendas do OpenSubtitles). Roda à mão, o resultado é
commitado, e o build do site **não** o chama.

| | quantas | corte | tolera ruído? |
|---|---|---|---|
| `RESPOSTAS` | 1.742 | freq ≥ 1200 | **não** — resposta obscura é sorteio, não desafio |
| `EXTRAS` | 6.562 | freq ≥ 30 | **sim** — aceitar vocábulo estranho não custa nada |
| aceitas | 8.304 | | |

A assimetria é o truque: recusar palavra real quebra a confiança na regra, então
o lado que valida chute é generoso; a lista que sorteia o dia é apertada. Um
corte de frequência separa as duas de uma fonte só, e o ruído de corpus cai todo
no lado que aguenta.

São 1.742 respostas ≈ **4,8 anos** de rodadas sem repetir palavra.

### As três peneiras

1. **Ortografia do português.** O ruído de legenda é quase todo nome de
   personagem e inglês, e os dois violam regras que o português não viola: `k`,
   `w`, `y`; consoante dobrada fora de `rr`/`ss`; final em consoante que o
   português não usa. Sozinha barra **28.600 formas** — `kenny`, `molly`,
   `grant`, `black`, `shawn` caem sem lista. Custa um falso positivo conhecido:
   `pizza`, pelo `zz`.
2. **Colisão de acento.** ~5.000 casos, desempatados pela frequência.
3. **Exclusão à mão.** O que passa nas duas primeiras e ainda não serve como
   resposta: nome próprio compatível com a ortografia (`bruce`, `jorge`),
   topônimo, palavrão. Só sai das RESPOSTAS — em EXTRAS eles ficam.

Mais um **piso curado**: 37 palavras que legenda de filme não cobre (`jazer`,
`urgir`, `caiar`, `zelos`) e que já eram aceitas antes. Sem esse piso, trocar de
fonte vira regressão silenciosa.

Antes desta geração o dicionário tinha 1.343 palavras e recusava **16%** de uma
amostra de vocabulário corrente — `ainda`, `então`, `tanto`, `nossa`, `quero`.
Hoje recusa 0% da mesma amostra.

### Mexer no vocabulário é mudança destrutiva

Regenerar reordena o baralho: **a palavra de todo dia muda**. Depois de haver
gente jogando, isso invalida qualquer rodada em andamento.

Por isso a rodada salva grava uma **impressão do alvo**, e se ela não bate a
rodada é descartada com aviso. Sem essa guarda, uma partida salva antes da troca
voltava pontuada contra a palavra nova — o tabuleiro mostrando derrota na linha
final enquanto o estado dizia "ganhou". Não é hipótese: aconteceu.

Se precisar ampliar depois do lançamento, acrescente só em `EXTRAS` — isso não
toca no baralho das respostas.

---

## Estado guardado

Tudo em `localStorage`, e toda escrita está em `try/catch`: modo privativo e
cota cheia não podem derrubar o jogo, só a memória dele.

| chave | o quê |
|---|---|
| `cifra:r:<AAAA-MM-DD>` | a rodada do dia: chutes, fim, marcas, impressão do alvo, se já contou |
| `cifra:stats` | jogos, vitórias, sequência, melhor, distribuição |
| `cifra:visto` | se a ajuda já abriu sozinha uma vez |

A trava do "conta uma vez só" mora no **registro do dia**, não nas estatísticas.
Assim recarregar com a partida terminada não infla nada, e apagar um dia não
corrompe o histórico. A sequência só emenda se a rodada contabilizada antes foi
a de ontem.

---

## As checagens

`?conferir` na URL roda 33 checagens no console. Elas guardam a contagem, a
validação, a dedução e a integridade do baralho:

```
exchaos.com.br/jogos/cifra/?conferir
```

Entre as que valem citar: repetida do chute não infla o amarelo; o branco não
entra na soma mas a letra sob ele ainda casa; a dedução encadeia; a dedução
**nunca prova algo falso**; nenhuma palavra colide sem acento; as 812 rodadas do
ciclo não repetem.

**O que elas não cobrem: a interface.** Que a marca aparece na casa certa, que o
cursor anda, que os contadores vazios renderizam, que o cabeçalho cabe — nada
disso é medido, e vai regredir calado se alguém mexer.

---

## Armadilhas que já pegamos

- **A palavra certa saindo amarela no fim.** Era a linha vencedora no tabuleiro,
  não o modal. Faltava a regra de posição na dedução (ver acima). Trocar a cor
  teria escondido o buraco.
- **`semAcento` com os acentos combinantes literais no fonte.** Funciona, mas
  se o arquivo for regravado noutra codificação o normalizador quebra em
  silêncio e *toda* palavra acentuada para de casar. Hoje é `\u0300-\u036F`
  escapado, e a linha é ASCII puro de propósito.
- **Célula a `1fr`.** Dá um tabuleiro de 570px de altura que empurra o teclado
  para fora da tela — e aqui você precisa ver as tentativas anteriores *e*
  digitar. Hoje `--cel` olha `vw` e `vh`, com piso de 36px.
- **Dificuldade que não era dificuldade.** Houve um seletor comum/difícil em que
  o comum tirava palavras com letra repetida. Saiu: só 37% das respostas
  repetem, então em quase dois terços dos dias as duas opções davam partidas
  indistinguíveis — e repetição é propriedade da palavra, que o jogador só
  descobre no fim.
- **Abrir o HTML direto (`file://`) não funciona.** A marca vem de
  `/assets/brand/` por caminho absoluto. Use `npm run preview`.
