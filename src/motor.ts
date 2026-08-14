import { embaralhar, hash, mulberry32 } from './rng.ts';
import {
  BONUS_POR_CAIDO,
  COMPOSICAO_DA_JORNADA,
  DEGRAU_DA_ETAPA,
  EIXOS,
  EPILOGOS,
  MARGEM_BRILHANTE,
  NARRACAO,
  PESO_MORAL_NO_DESAFIO,
  ROTULO_ETIQUETA,
  SELO_DO_EPILOGO,
  SINERGIA,
  TAMANHO_PARTY,
  TATICAS,
  TOLERANCIA_MORAL,
  TRACOS,
  rolarDado,
  type ChaveEpilogo,
} from './regras.ts';
import type {
  BaseDeHerois,
  Campanha,
  CatalogoDesafios,
  Desafio,
  Eixo,
  Heroi,
  Recrutado,
  Recusa,
  RelatoEtapa,
  RelatoLance,
  ResultadoEtapa,
  ResultadoLance,
  Tatica,
} from './tipos.ts';

export function comoRecrutado(heroi: Heroi, guilda: { id: string; nome: string }): Recrutado {
  return { ...heroi, guildaId: guilda.id, jogo: guilda.nome };
}

export function todosOsHerois(db: BaseDeHerois): Recrutado[] {
  return db.guildas.flatMap((g) => g.herois.map((h) => comoRecrutado(h, g)));
}

/** A soma do grupo num eixo — o número que resolve os lances. Vai de 0 a 50. */
export function somaDoGrupo(party: Recrutado[], eixo: Eixo): number {
  return party.reduce((s, h) => s + h[eixo], 0);
}

export function perfilDaParty(party: Recrutado[]): Record<Eixo, number> {
  return Object.fromEntries(EIXOS.map((e) => [e, somaDoGrupo(party, e)])) as Record<Eixo, number>;
}

/* ------------------------------------------------------------ compatibilidade */

/**
 * Por que este candidato não entra nesta party. Três motivos possíveis: a
 * distância moral é grande demais, ele recusa alguém que já está dentro, ou
 * alguém que já está dentro recusa o que ele carrega.
 */
export function avaliarRecusa(candidato: Recrutado, party: Recrutado[]): Recusa | null {
  for (const membro of party) {
    if (Math.abs(candidato.moral - membro.moral) > TOLERANCIA_MORAL) {
      const [alto, baixo] =
        candidato.moral > membro.moral ? [candidato, membro] : [membro, candidato];
      return { motivo: 'moral', texto: `${alto.nome} não marcha ao lado de ${baixo.nome}.` };
    }
  }
  for (const membro of party) {
    const conflito = candidato.recusa.find((e) => membro.etiquetas.includes(e));
    if (conflito) {
      return {
        motivo: 'etiqueta',
        texto: `${candidato.nome} não marcha com ${ROTULO_ETIQUETA[conflito]}: ${membro.nome}.`,
      };
    }
  }
  for (const membro of party) {
    const conflito = membro.recusa.find((e) => candidato.etiquetas.includes(e));
    if (conflito) {
      return {
        motivo: 'etiqueta-deles',
        texto: `${membro.nome} não aceita ${ROTULO_ETIQUETA[conflito]} na party.`,
      };
    }
  }

  // Todo traço é único na companhia: só há um comandante, um mártir, um
  // duelista. É a exigência que o próprio traço carrega.
  const repetido = party.find((m) => m.traco === candidato.traco);
  if (repetido) {
    return {
      motivo: 'traco',
      texto: `Já há um ${TRACOS[candidato.traco].nome} na companhia: ${repetido.nome}.`,
    };
  }

  // E alguns traços não aceitam certa companhia.
  for (const membro of party) {
    const conflito = TRACOS[candidato.traco].recusaEtiquetas.find((e) =>
      membro.etiquetas.includes(e),
    );
    if (conflito) {
      return {
        motivo: 'traco',
        texto: `${TRACOS[candidato.traco].nome} não marcha com ${ROTULO_ETIQUETA[conflito]}: ${membro.nome}.`,
      };
    }
  }
  for (const membro of party) {
    const conflito = TRACOS[membro.traco].recusaEtiquetas.find((e) =>
      candidato.etiquetas.includes(e),
    );
    if (conflito) {
      return {
        motivo: 'traco',
        texto: `${membro.nome}, ${TRACOS[membro.traco].nome}, não aceita ${ROTULO_ETIQUETA[conflito]}.`,
      };
    }
  }
  return null;
}

export interface Candidato {
  heroi: Recrutado;
  recusa: Recusa | null;
}

/**
 * Quatro candidatos de guildas diferentes. `tentativa` avança quando a rodada
 * inteira recusa a party — e, a partir da segunda, o sorteio passa a puxar só
 * de quem é compatível, para a rodada nunca girar em falso.
 */
export function sortearCandidatos(
  db: BaseDeHerois,
  dia: string,
  rodada: number,
  jaRecrutados: Recrutado[],
  tentativa = 0,
): Candidato[] {
  const usados = new Set(jaRecrutados.map((h) => h.id));
  const rnd = mulberry32(hash(`candidatos:${dia}:${rodada}:${tentativa}:v${db.versao}`));

  let disponiveis = db.guildas
    .map((g) => ({ guilda: g, herois: g.herois.filter((h) => !usados.has(h.id)) }))
    .filter((g) => g.herois.length > 0);

  if (tentativa > 0) {
    const compativeis = disponiveis
      .map(({ guilda, herois }) => ({
        guilda,
        herois: herois.filter(
          (h) => avaliarRecusa(comoRecrutado(h, guilda), jaRecrutados) === null,
        ),
      }))
      .filter((g) => g.herois.length > 0);
    if (compativeis.length > 0) disponiveis = compativeis;
  }

  return embaralhar(rnd, disponiveis)
    .slice(0, 4)
    .map(({ guilda, herois }) => {
      const heroi = comoRecrutado(escolherDe(rnd, herois), guilda);
      return { heroi, recusa: avaliarRecusa(heroi, jaRecrutados) };
    });
}

function escolherDe<T>(rnd: () => number, itens: readonly T[]): T {
  return itens[Math.floor(rnd() * itens.length)];
}

/* ------------------------------------------------------------------- jornada */

/** As sete etapas do dia: quatro de combate (contando o trono) e três provas. */
export function jornadaDoDia(catalogo: CatalogoDesafios, dia: string): Desafio[] {
  const rnd = mulberry32(hash(`jornada:${dia}:v${catalogo.versao}`));
  const usados = new Set<string>();
  return COMPOSICAO_DA_JORNADA.map((tipo) => {
    const pool = catalogo.desafios.filter((d) => d.tipo === tipo && !usados.has(d.id));
    const escolhido = escolherDe(
      rnd,
      pool.length > 0 ? pool : catalogo.desafios.filter((d) => d.tipo === tipo),
    );
    usados.add(escolhido.id);
    return escolhido;
  });
}

export function dificuldadeDoLance(base: number, etapa: number): number {
  return base + DEGRAU_DA_ETAPA[etapa];
}

/**
 * O que o dia exige de cada eixo: a maior dificuldade que aparece nele ao longo
 * das sete etapas. É o pentágono que a party precisa cobrir.
 */
export function exigenciaDaJornada(jornada: Desafio[]): Record<Eixo, number> {
  const exigencia = Object.fromEntries(EIXOS.map((e) => [e, 0])) as Record<Eixo, number>;
  jornada.forEach((desafio, etapa) => {
    for (const lance of desafio.lances) {
      const valor = dificuldadeDoLance(lance.dificuldade, etapa);
      if (valor > exigencia[lance.eixo]) exigencia[lance.eixo] = valor;
    }
  });
  return exigencia;
}

/* ------------------------------------------------------------------ sinergia */

/** Bônus somado ao valor de todo lance. Inteiro, para o jogador conseguir prever. */
export function sinergia(party: Recrutado[]): { bonus: number; motivos: string[] } {
  const motivos: string[] = [];
  let bonus = 0;
  if (party.length === 0) return { bonus, motivos };

  const porGuilda = new Map<string, Recrutado[]>();
  for (const h of party) {
    const lista = porGuilda.get(h.guildaId) ?? [];
    lista.push(h);
    porGuilda.set(h.guildaId, lista);
  }
  for (const [, membros] of porGuilda) {
    if (membros.length >= 2) {
      bonus += SINERGIA.mesmaGuilda * (membros.length - 1);
      motivos.push(`${membros.length} de ${membros[0].jogo} já lutaram juntos`);
    }
  }

  const morais = party.map((h) => h.moral);
  if (Math.max(...morais) - Math.min(...morais) <= 1) {
    bonus += SINERGIA.coesaoMoral;
    motivos.push('gente que enxerga o mundo do mesmo jeito');
  }

  if (party.length === TAMANHO_PARTY && EIXOS.every((e) => somaDoGrupo(party, e) >= SINERGIA.pisoDoLadoMurcho)) {
    bonus += SINERGIA.semLadoMurcho;
    motivos.push('nenhum lado murcho no pentágono');
  }

  return { bonus, motivos };
}

export function moralDaParty(party: Recrutado[]): number {
  if (party.length === 0) return 0;
  return party.reduce((s, h) => s + h.moral, 0) / party.length;
}

/* ---------------------------------------------------------------- resolução */

/**
 * Quem a narração acompanha. O atributo dele não entra na conta — o grupo é
 * que resolve —, mas quem se destaca no eixo tende a ser quem aparece, e quem
 * acabou de agir aparece menos, para um nome só não roubar a etapa.
 */
function sortearProtagonista(
  rnd: () => number,
  vivos: Recrutado[],
  eixo: Eixo,
  anterior: Recrutado | null,
): Recrutado {
  const pesos = vivos.map(
    (h) => Math.pow(Math.max(h[eixo], 1), 2) * (h.id === anterior?.id ? 0.3 : 1),
  );
  const total = pesos.reduce((a, b) => a + b, 0);
  let alvo = rnd() * total;
  for (let i = 0; i < vivos.length; i++) {
    alvo -= pesos[i];
    if (alvo <= 0) return vivos[i];
  }
  return vivos[vivos.length - 1];
}

/**
 * O que os traços da companhia somam neste lance. Só conta quem está vivo — o
 * traço vai embora com o herói, e é por isso que perder gente cedo dói além da
 * soma de atributos.
 */
export function bonusDosTracos(
  vivos: Recrutado[],
  contexto: {
    eixo: Eixo;
    prova: Desafio['tipo'];
    numeroDoLance: number;
    totalDeLances: number;
    houveBaixa: boolean;
  },
): { valor: number; nomes: string[] } {
  let valor = 0;
  const nomes: string[] = [];

  for (const heroi of vivos) {
    const traco = TRACOS[heroi.traco];
    const e = traco.efeito;
    let soma = 0;

    if (e.tipo === 'sempre') soma = e.valor;
    else if (e.tipo === 'eixo' && e.eixo === contexto.eixo) soma = e.valor;
    else if (e.tipo === 'prova' && e.prova === contexto.prova) soma = e.valor;
    else if (e.tipo === 'primeiro-lance' && contexto.numeroDoLance === 1) soma = e.valor;
    else if (e.tipo === 'ultimo-lance' && contexto.numeroDoLance === contexto.totalDeLances) {
      soma = e.valor;
    } else if (e.tipo === 'apos-baixa' && contexto.houveBaixa) soma = e.valor;

    if (soma !== 0) {
      valor += soma;
      nomes.push(traco.nome);
    }
  }

  return { valor, nomes };
}

function bonusMoral(desafio: Desafio, media: number): number {
  if (!desafio.favorece) return 0;
  const sinal = desafio.favorece === 'trevas' ? -1 : 1;
  return Math.round(PESO_MORAL_NO_DESAFIO * sinal * media);
}

/**
 * A vitória custosa é o fracasso crítico: o lance é vencido, e mesmo assim
 * alguém fica pelo caminho porque o dado veio no fundo do poço. Um lance
 * brilhante está protegido — a folga foi grande demais para o azar cobrar.
 */
function classificar(margem: number, dado: number, tatica: Tatica): ResultadoLance {
  const { dadoFatal, margemImune, margemGrave } = TATICAS[tatica];
  if (margem >= 0) {
    // O azar é conferido antes da folga: é `margemImune`, e não o brilho do
    // lance, que decide quem está protegido. Foi assim que a agressiva parou
    // de ficar blindada pelo próprio bônus.
    if (dado <= dadoFatal && margem < margemImune) return 'custoso';
    return margem >= MARGEM_BRILHANTE ? 'brilhante' : 'sucesso';
  }
  if (margem > margemGrave) return 'falha';
  return 'grave';
}

export function simularCampanha(
  party: Recrutado[],
  tatica: Tatica,
  dia: string,
  jornada: Desafio[],
): Campanha {
  const rnd = mulberry32(hash(`campanha:${dia}:${tatica}:${party.map((h) => h.id).join(',')}`));
  const vivos = party.slice();
  const media = moralDaParty(party);
  const etapas: RelatoEtapa[] = [];
  let vitorias = 0;
  let baixas = 0;

  /** Falhou uma prova, acabou a jornada: não se marcha com a companhia em frangalhos. */
  let acabou = false;

  /**
   * Frases já usadas na **jornada inteira**, não só na prova. A leitura é o
   * principal prazer do jogo, e reler a mesma linha estraga o efeito mesmo
   * quando ela aparece três provas depois.
   */
  const frasesUsadas = new Set<string>();

  // Traços que gastam uma carga ao longo da jornada inteira.
  let amuletoGasto = false;
  let martirGasto = false;
  const teimosoUsado = new Set<string>();

  /**
   * Quem realmente tomba quando o lance cobra uma vida. O Teimoso escapa da
   * primeira vez que seria atingido; o Mártir toma o lugar de outro, uma vez.
   * Devolve `null` quando ninguém cai.
   */
  function quemTomba(alvo: Recrutado): Recrutado | null {
    if (alvo.traco === 'teimoso' && !teimosoUsado.has(alvo.id)) {
      teimosoUsado.add(alvo.id);
      return null;
    }
    const martir = vivos.find((h) => h.traco === 'martir' && h.id !== alvo.id);
    if (martir && !martirGasto) {
      martirGasto = true;
      return martir;
    }
    return alvo;
  }

  jornada.forEach((desafio, indice) => {
    if (acabou || vivos.length < 2) {
      etapas.push({
        numero: indice + 1,
        desafio,
        lances: [],
        sucessos: 0,
        resultado: 'nao-jogada',
        caidos: [],
      });
      return;
    }

    const doDesafio = bonusMoral(desafio, media);
    const lances: RelatoLance[] = [];
    const caidos: Recrutado[] = [];
    let sucessos = 0;
    let anterior: Recrutado | null = null;

    desafio.lances.forEach((lance, i) => {
      if (vivos.length === 0) return;

      const dificuldade = dificuldadeDoLance(lance.dificuldade, indice);
      const protagonista = sortearProtagonista(rnd, vivos, lance.eixo, anterior);
      anterior = protagonista;

      const soma = somaDoGrupo(vivos, lance.eixo);
      const luto = (party.length - vivos.length) * BONUS_POR_CAIDO;
      const dosTracos = bonusDosTracos(vivos, {
        eixo: lance.eixo,
        prova: desafio.tipo,
        numeroDoLance: i + 1,
        totalDeLances: desafio.lances.length,
        houveBaixa: vivos.length < party.length,
      });
      const modificadores =
        sinergia(vivos).bonus + TATICAS[tatica].bonus + doDesafio + luto + dosTracos.valor;

      // O Amuleto queima uma vez para transformar o pior dado em zero.
      let dado = rolarDado(rnd);
      const amuleto = vivos.find((h) => h.traco === 'amuleto');
      if (amuleto && !amuletoGasto && dado === -4) {
        dado = 0;
        amuletoGasto = true;
      }

      const valor = soma + modificadores + dado;
      const margem = valor - dificuldade;

      const resultado = classificar(margem, dado, tatica);

      const variantes = NARRACAO[lance.eixo][resultado];
      const inedita = variantes.filter((v) => !frasesUsadas.has(v));
      const pool = inedita.length > 0 ? inedita : variantes;
      const frase = pool[Math.floor(rnd() * pool.length)];
      frasesUsadas.add(frase);
      const narracao = frase.replaceAll('{h}', protagonista.nome);

      let caido: Recrutado | null = null;
      if (resultado === 'grave' || resultado === 'custoso') {
        caido = quemTomba(protagonista);
        if (caido) {
          vivos.splice(vivos.indexOf(caido), 1);
          caidos.push(caido);
        }
      }
      if (resultado !== 'grave' && resultado !== 'falha') sucessos++;

      lances.push({
        numero: i + 1,
        cena: lance.cena,
        eixo: lance.eixo,
        protagonista,
        resultado,
        somaDoGrupo: soma,
        modificadores,
        dado,
        valor,
        dificuldade,
        margem,
        narracao,
        caido,
      });
    });

    // Uma "falha" não mata, mas também não conta como lance resolvido. Um lance
    // "custoso" conta: o objetivo foi cumprido, ainda que a um preço.
    const resolvidos = lances.filter((l) => l.resultado !== 'falha' && l.resultado !== 'grave')
      .length;
    const venceu = resolvidos * 2 > desafio.lances.length;
    let resultado: ResultadoEtapa;
    if (venceu) {
      resultado = caidos.length === 0 ? 'vitoria-limpa' : 'vitoria-custosa';
      vitorias++;
    } else {
      resultado = 'derrota';
      acabou = true;
    }
    baixas += caidos.length;

    etapas.push({ numero: indice + 1, desafio, lances, sucessos: resolvidos, resultado, caidos });
  });

  return {
    etapas,
    vitorias,
    baixas,
    perfeita: vitorias === jornada.length && baixas === 0,
    moralDaParty: media,
  };
}

/* ---------------------------------------------------------- compartilhamento */

const EMOJI: Record<ResultadoEtapa, string> = {
  'vitoria-limpa': '🟩',
  'vitoria-custosa': '🟨',
  derrota: '🟥',
  'nao-jogada': '⬛',
};

/**
 * O texto de fecho da jornada, escolhido pelo tipo de fim: quem salvou o mundo
 * e a que preço, ou em que altura a estrada acabou.
 */
export function epilogo(campanha: Campanha): { titulo: string; texto: string; selo: string } {
  const caidos = campanha.etapas.flatMap((e) => e.caidos.map((h) => h.nome));
  const parou = campanha.etapas.find((e) => e.resultado === 'derrota');
  const total = campanha.etapas.length;

  let chave: ChaveEpilogo;
  if (campanha.perfeita) chave = 'perfeita';
  else if (campanha.vitorias === total) {
    chave = campanha.baixas === 1 ? 'salvou-com-uma-baixa' : 'salvou-com-baixas';
  } else if (campanha.baixas >= TAMANHO_PARTY) chave = 'dizimada';
  else {
    const numero = parou?.numero ?? campanha.vitorias + 1;
    chave =
      numero === total
        ? 'caiu-no-trono'
        : numero >= 5
          ? 'quase-la'
          : numero >= 3
            ? 'meio-caminho'
            : 'jornada-curta';
  }

  const molde = EPILOGOS[chave];
  const nomeDaProva = parou?.desafio.nome ?? 'algum lugar da estrada';
  const sobreviventes = campanha.etapas
    .flatMap((e) => e.lances.map((l) => l.protagonista))
    .filter((h, i, todos) => todos.findIndex((x) => x.id === h.id) === i)
    .filter((h) => !caidos.includes(h.nome))
    .map((h) => h.nome);

  // A escolha da variante é determinística como todo o resto: a mesma jornada
  // conta a mesma história, em qualquer navegador.
  const rnd = mulberry32(hash(`epilogo:${chave}:${caidos.join(',')}:${campanha.vitorias}`));
  const molduraTexto = molde.textos[Math.floor(rnd() * molde.textos.length)];
  const selos = SELO_DO_EPILOGO[selo(campanha.moralDaParty)] ?? [];
  const fecho = selos.length > 0 ? selos[Math.floor(rnd() * selos.length)] : '';

  const preencher = (t: string) =>
    t
      .replaceAll('{caidos}', listar(caidos))
      .replaceAll('{ultimoCaido}', caidos[caidos.length - 1] ?? 'ninguém')
      .replaceAll('{primeiroCaido}', caidos[0] ?? 'ninguém')
      .replaceAll('{sobreviventes}', listar(sobreviventes))
      .replaceAll('{n}', String(campanha.baixas))
      .replaceAll('{provas}', String(campanha.vitorias))
      .replaceAll('{prova}', nomeDaProva);

  return { titulo: molde.titulo, texto: preencher(molduraTexto), selo: fecho };
}

/** "A, B e C" — porque "A, B, C" numa frase de epílogo soa a inventário. */
function listar(nomes: string[]): string {
  if (nomes.length === 0) return 'ninguém';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function selo(moralMedia: number): string {
  if (moralMedia <= -1) return 'Party sombria';
  if (moralMedia >= 2) return 'Party luminosa';
  return 'Party cinzenta';
}

/**
 * O relato para compartilhar. Sem números: a grade conta quantas provas houve e
 * como foi cada uma, e a frase conta o que sobrou disso. Quem lê não fica
 * sabendo qual companhia foi montada, então dá para postar sem estragar o dia
 * de quem ainda vai jogar.
 */
export function textoDeCompartilhamento(campanha: Campanha, numeroDoDia: number): string {
  const grade = campanha.etapas.map((r) => EMOJI[r.resultado]).join('');
  const remate = campanha.perfeita
    ? 'Cheguei ao trono com todo mundo de volta.'
    : campanha.vitorias === campanha.etapas.length
      ? campanha.baixas === 1
        ? 'O trono caiu, e um dos meus ficou pelo caminho.'
        : 'O trono caiu, e paguei caro por isso.'
      : 'A estrada acabou antes do trono.';

  return `Até o Trono #${numeroDoDia}\n${grade}\n${selo(campanha.moralDaParty)} · ${remate}\nateotrono.com.br`;
}

export { TAMANHO_PARTY };
