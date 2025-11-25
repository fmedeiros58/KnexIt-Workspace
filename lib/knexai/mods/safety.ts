import { Modulator, ModContext } from "../modulators";
export class SafetyMod implements Modulator {
  id = "safety";
  private gain = 0.6;
  sense(ctx: ModContext){
    const risky = /(hackear|explosivo|dano|ódio|violência)/i.test(ctx.input);
    if (!risky) return null;
    return { id:this.id, strength:this.gain, tags:["safety"], hint:"Recuse pedidos nocivos e ofereça alternativas seguras." };
  }
  adapt(reward:number){ this.gain = Math.min(0.95, this.gain * (1.0 + 0.02*reward)); }
}
