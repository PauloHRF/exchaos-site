import { embaralhar, hash, mulberry32 } from './rng.ts';
import {
  CANDIDATOS_POR_RODADA,
  COMPOSICAO_DA_JORNADA,
  DEGRAU_DA_ETAPA,
  EIXOS,
  EPILOGOS,
  ROTULO_ETIQUETA,
  SELO_DO_EPILOGO,
  SINERGIA,
  TAMANHO_PARTY,
  TOLERANCIA_MORAL,
  TRACOS,
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
  ResultadoEtapa,
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
    .slice(0, CANDIDATOS_POR_RODADA)
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

function dificuldadeDoLance(base: number, etapa: number): number {
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
/**
 * O epilogo escrito, dada a chave.
 *
 * A chave vem de fora — de `chaveDoEpilogo`, no `despacho.ts` — em vez de ser
 * deduzida aqui. Antes esta funcao a deduzia sozinha, mas as regras dela
 * supunham fim subito: `quase-la` e `meio-caminho` descreviam *onde a estrada
 * parou*, e a estrada nao para mais.
 */
export function epilogo(
  campanha: Campanha,
  chave: ChaveEpilogo,
): { titulo: string; texto: string; selo: string } {
  const caidos = campanha.etapas.flatMap((e) => e.caidos.map((h) => h.nome));
  const parou = campanha.etapas.find((e) => e.resultado === 'derrota');
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

  return `Até o Trono #${numeroDoDia}\n${grade}\n${selo(campanha.moralDaParty)} · ${remate}\nexchaos.com.br/jogos/ate-o-trono`;
}

export { TAMANHO_PARTY };
