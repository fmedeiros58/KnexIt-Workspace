import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

async function shouldPassThroughIdentityRegulatorOnNameOrigin(): Promise<void> {
  const result = await runPipelineConductor({ rawMessage: "pq vc tem esse nome?" });
  const aiIdentity = result.state.executionArtifacts.behavior?.aiIdentity;

  assert(Boolean(aiIdentity), "expected behavior.aiIdentity execution artifact");
  assert(aiIdentity?.nameOriginQuestionDetected === true, "expected name-origin detection in 17b identity regulator");
  assert(
    /language-engineered|homenagem|medeiros|leticia/i.test(result.responseText),
    "expected identity-grounded response text",
  );
  assert(
    !/duas bases complementares/i.test(result.responseText),
    "expected no legacy hardcoded identity artifact",
  );
  assert(
    result.state.trace.some(
      (event) => event.layer === "response-behavior" && /identityDetected=true/.test(event.detail || ""),
    ),
    "expected response-behavior trace with identityDetected=true",
  );
}

async function shouldAvoidCreatorHallucinationInIdentityProfilePath(): Promise<void> {
  const result = await runPipelineConductor({ rawMessage: "quem e esse medeiros?" });
  const normalized = normalize(result.responseText);

  assert(
    /\b(idealizador|fundador|origem|epistemologico)\b/.test(normalized) && /\bleticia\b/.test(normalized),
    "expected creator-context grounded response",
  );
  assert(
    !/\b(ufrj|doutorado|2015|dissertacao)\b/.test(normalized),
    "expected no unsupported creator biography details",
  );
}

await shouldPassThroughIdentityRegulatorOnNameOrigin();
await shouldAvoidCreatorHallucinationInIdentityProfilePath();
