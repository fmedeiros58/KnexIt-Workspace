export interface InputPolicyRouterInput {
  injectionFlagged: boolean;
  maliciousFlagged: boolean;
  harmfulFlagged: boolean;
  sensitiveFlagged: boolean;
}

export interface InputPolicyRouterOutput {
  action: "allow" | "caution" | "block";
  policyFlags: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function inputPolicyRouter(input: InputPolicyRouterInput): InputPolicyRouterOutput {
  const policyFlags: string[] = [];
  if (input.injectionFlagged) policyFlags.push("injection_risk");
  if (input.maliciousFlagged) policyFlags.push("malicious_intent");
  if (input.harmfulFlagged) policyFlags.push("harmful_content");
  if (input.sensitiveFlagged) policyFlags.push("sensitive_data");

  let action: "allow" | "caution" | "block" = "allow";
  if (input.maliciousFlagged || input.harmfulFlagged) action = "block";
  else if (input.injectionFlagged || input.sensitiveFlagged) action = "caution";

  const score = action === "allow" ? 0.12 : action === "caution" ? 0.62 : 0.92;

  return {
    action,
    policyFlags,
    ok: action !== "block",
    component: "input-policy-router",
    score,
    detail: action,
    context: {
      policyFlags,
      action,
    },
  };
}
