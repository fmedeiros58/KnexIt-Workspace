// lib/leticia/nodes/myelinLocal.ts

export type Sample = { input: string; output: string };
type Entry = Sample & { score: number; ts: number };

/**
 * Cache leve com decaimento exponencial de score.
 * Usado por fusion.ts para armazenar saídas por (system, extras, input).
 */
export class MyelinLocal {
  private store = new Map<string, Entry>();
  private capacity: number;
  private decayRate: number; // ex.: 0.997

  constructor(capacity = 150, decayRate = 0.997) {
    this.capacity = Math.max(1, capacity);
    this.decayRate = Math.min(Math.max(decayRate, 0), 1);
  }

  /** Gera uma chave estável para o par (input, system, extras) */
  key(input: string, system: string, extras: string): string {
    return [
      system?.trim().toLowerCase(),
      extras?.trim().toLowerCase(),
      input?.trim(),
    ].join("｜"); // separador “seguro”
  }

  /** Lê do cache; retorna undefined se não existir */
  get(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (e) {
      // toque para manter “recência”
      e.ts = Date.now();
      this.store.set(key, e);
    }
    return e;
  }

  /** Aprende/atualiza uma entrada com score calculado pelo chamador */
  learn(key: string, sample: Sample, score: number) {
    const now = Date.now();
    const prev = this.store.get(key);
    const blended = prev ? prev.score * this.decayRate + score : score;

    this.store.set(key, { ...sample, score: blended, ts: now });
    this.enforceCapacity();
  }

  /** Aplica decaimento global (chamado periodicamente) */
  decay() {
    for (const [k, v] of this.store) {
      v.score *= this.decayRate;
      this.store.set(k, v);
    }
  }

  private enforceCapacity() {
    if (this.store.size <= this.capacity) return;
    // remove os piores (menor score; desempate por mais antigo)
    const items = [...this.store.entries()];
    items.sort((a, b) => {
      const sa = a[1].score, sb = b[1].score;
      if (sa !== sb) return sa - sb;      // menor score sai primeiro
      return a[1].ts - b[1].ts;           // mais antigo sai primeiro
    });
    const toRemove = items.slice(0, this.store.size - this.capacity);
    for (const [k] of toRemove) this.store.delete(k);
  }
}
