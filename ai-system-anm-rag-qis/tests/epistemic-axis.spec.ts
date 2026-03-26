import { classifyEpistemicClaims } from "../src/13-epistemic-integration-layer/epistemic-claim-classifier";
import { detectEpistemicBoundaries } from "../src/13-epistemic-integration-layer/epistemic-boundary-detector";
import { analyzeEvidenceStance } from "../src/13-epistemic-integration-layer/evidence-stance-analyzer";
import { buildUncertaintySignals } from "../src/13-epistemic-integration-layer/uncertainty-signaler";
import { scoreEpistemicConfidence } from "../src/13-epistemic-integration-layer/epistemic-confidence-scorer";
import { validateClaimsAgainstEvidence } from "../src/17-validation-layer/claim-to-evidence-validator";
import { detectEpistemicContradictions } from "../src/17-validation-layer/contradiction-detector";
import { estimateSupportCoverage } from "../src/17-validation-layer/support-coverage-estimator";
import { buildEpistemicValidationVerdict } from "../src/17-validation-layer/validation-verdict-builder";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const text = [
  "Confirmado em fonte oficial: o dado foi registrado no relatorio.",
  "Portanto, o resultado sugere melhora parcial.",
  "Talvez a causa principal seja o aumento da carga de trabalho.",
  "Com certeza absoluta, isso resolve todos os casos.",
  "Qual evidência adicional falta para concluir?",
].join(" ");

const claims = classifyEpistemicClaims(text, 12);
assert(claims.length >= 5, "should classify all major clauses");
assert(claims.some((row) => row.kind === "fact"), "should classify at least one fact");
assert(claims.some((row) => row.kind === "hypothesis"), "should classify at least one hypothesis");
assert(claims.some((row) => row.kind === "speculation"), "should classify at least one speculation");
assert(claims.some((row) => row.kind === "open_question"), "should classify at least one open question");

const evidence = [
  "Fonte oficial registrada com dado confirmado no relatorio tecnico.",
  "No entanto, ha trecho que contradiz parte da conclusao.",
];

const boundaries = detectEpistemicBoundaries(claims, evidence.length);
assert(boundaries.overclaimRisk > 0, "overclaim risk should be non-zero");

const stances = analyzeEvidenceStance(claims, evidence);
assert(stances.length === claims.length, "stance rows must match claim count");

const uncertainty = buildUncertaintySignals({
  overclaimRisk: boundaries.overclaimRisk,
  stanceRows: stances,
  extrapolationFlags: boundaries.extrapolationFlags,
});
assert(uncertainty.signals.length > 0, "uncertainty signals should be emitted");

const confidence = scoreEpistemicConfidence({
  claims,
  stanceRows: stances,
  overclaimRisk: boundaries.overclaimRisk,
});
assert(confidence >= 0 && confidence <= 1, "confidence should stay in [0, 1]");

const claimValidation = validateClaimsAgainstEvidence(claims, evidence);
const coverage = estimateSupportCoverage(claimValidation);
const contradiction = detectEpistemicContradictions(claims, evidence);
const verdict = buildEpistemicValidationVerdict({
  coverage: coverage.coverage,
  contradictionCount: contradiction.issues.length,
  hypothesisCompetitionOk: true,
  unsupportedClaims: claimValidation.filter((row) => !row.supported).length,
});

assert(typeof verdict.ok === "boolean", "verdict must define ok flag");
assert(verdict.score >= 0 && verdict.score <= 1, "verdict score should stay in [0, 1]");
assert(coverage.totalClaims === claims.length, "coverage should track all claims");


test('bootstrap assertions executed', () => {
  expect(true).toBe(true);
});
