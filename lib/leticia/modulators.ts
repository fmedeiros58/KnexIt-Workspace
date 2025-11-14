export type ModSignal = {
  id: string;
  strength: number;        // 0..1
  tags: string[];          // ex.: ["math", "safety", "didactic"]
  hint?: string;           // dica curta para injetar no prompt
};

export type ModContext = {
  input: string;
  history: string[];
  recentHints: string[];
};

export interface Modulator {
  id: string;
  /** leitura pré-sináptica: detecta padrão e gera sinal */
  sense(ctx: ModContext): ModSignal | null;
  /** plasticidade: ajuste com base no resultado */
  adapt?(reward: number): void;
}

const registry: Modulator[] = [];
export function register(mod: Modulator) { registry.push(mod); }
export function listMods() { return registry.slice(); }
