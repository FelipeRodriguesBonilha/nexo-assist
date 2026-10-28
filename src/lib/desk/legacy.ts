/** Simula a instabilidade do sistema de chamados legado e aplica retry com backoff. */
export class LegacyUnavailableError extends Error {
  constructor() {
    super("O sistema de chamados está indisponível no momento.");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callLegacy<T>(op: () => T, attempts = 3): Promise<T> {
  const rate = Number(process.env.LEGACY_FAILURE_RATE ?? 0.15);
  for (let i = 0; i < attempts; i++) {
    if (Math.random() >= rate) return op();
    if (i < attempts - 1) await sleep(250 * 2 ** i);
  }
  throw new LegacyUnavailableError();
}
