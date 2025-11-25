import { Modulator, ModContext, ModSignal } from "../modulators";
export class DidacticMod implements Modulator {
  id = "didactic";
  private gain = 0.5;
  sense(ctx: ModContext): ModSignal | null {
    return { id: this.id, strength: this.gain, tags: ["style"], hint: "Explique em tópicos curtos e exemplos simples." };
  }
  adapt(reward: number): void {
    this.gain = Math.max(0.3, Math.min(0.9, this.gain * (0.98 + 0.04 * reward)));
  }
}
