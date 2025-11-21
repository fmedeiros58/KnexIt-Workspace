import { register } from "../modulators";
import { MathMod } from "./math";
import { SafetyMod } from "./safety";
import { DidacticMod } from "./didactic";

export function initMods(){
  register(new MathMod());
  register(new SafetyMod());
  register(new DidacticMod());
}
