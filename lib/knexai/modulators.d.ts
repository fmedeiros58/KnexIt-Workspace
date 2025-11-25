export type ModSignal = {
  id: string;
  strength: number;
  tags: string[];
  hint?: string;
};

export type ModContext = {
  input: string;
  metadata?: any;
};

export interface Modulator {
  id: string;
  sense(ctx: ModContext): ModSignal | null;
  adapt(reward: number): void;
}

export function register(m: Modulator): void;
export function getRegistered(): Modulator[];
export {};
