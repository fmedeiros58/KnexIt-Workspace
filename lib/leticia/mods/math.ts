import { Modulator, ModContext, ModSignal } from "../modulators";

export class MathMod implements Modulator {
  id = "math";
  private gain = 0.7;
  sense(ctx: ModContext): ModSignal | null {
    const hasEq = /[=×÷+\-*/^]|(somar|calcular|equação|derivar|integrar)/i.test(ctx.input);
    if (!hasEq) return null;
    return {
      id: this.id,
      strength: this.gain,
      tags: ["math"],
      hint: "Seja rigorosa, mostre passos numerados e verifique unidades.",
    };
  }
  adapt(reward: number) {
    this.gain = clamp(this.gain * (0.98 + 0.04 * reward), 0.3, 0.95);
  }
}
function clamp(x:number,a:number,b:number){return Math.max(a,Math.min(b,x));}
