/**
 * PRNG determinístico. O ponto inteiro do jogo depende disso: mesma seed +
 * mesma party = mesmo resultado, em qualquer navegador, sem servidor nenhum.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de string estável (FNV-1a de 32 bits). */
export function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Dia do jogo em UTC — todo mundo no mundo vira de dia junto. */
export function diaDeHoje(agora = new Date()): string {
  return agora.toISOString().slice(0, 10);
}

/** Número sequencial do dia desde o lançamento, para o "#123" do compartilhamento. */
export function numeroDoDia(dia: string, lancamento = '2026-08-13'): number {
  const ms = Date.parse(dia + 'T00:00:00Z') - Date.parse(lancamento + 'T00:00:00Z');
  return Math.floor(ms / 86400000) + 1;
}

export function escolher<T>(rnd: () => number, itens: readonly T[]): T {
  return itens[Math.floor(rnd() * itens.length)];
}

/** Embaralhamento de Fisher-Yates usando o PRNG com seed. */
export function embaralhar<T>(rnd: () => number, itens: readonly T[]): T[] {
  const copia = itens.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
