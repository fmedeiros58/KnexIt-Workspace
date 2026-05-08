/**
 * Responsabilidade do arquivo:
 * - Validar pipeline interno completo do language-layer bridge.
 * - Verificar preenchimento de estado linguistico e handoff podado.
 */
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runLanguageLayer } from "../src/02-language-layer/language-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export async function languageLayerBridgeSpec(): Promise<void> {
  const state = createInitialProcessingState("oi, por favor ajuste este arquivo e me diga se entendeu");
  const output = await runLanguageLayer(state);

  assert(Boolean(output.languageState.speechAct), "expected language state speechAct");
  assert(output.normalizedMessage.length > 0, "expected normalized message");
  assert(Boolean((output.userProfile as Record<string, unknown>).languageHandoff), "expected language handoff payload");
}

await languageLayerBridgeSpec();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
