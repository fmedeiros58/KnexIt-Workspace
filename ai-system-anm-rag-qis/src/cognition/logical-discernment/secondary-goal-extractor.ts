import type { LogicalDiscernmentInput, SecondaryGoalExtraction } from "./logical-discernment-types";
import { normalizeLogicalText, toUnique } from "./logical-discernment-utils";

export function extractSecondaryGoals(input: LogicalDiscernmentInput): SecondaryGoalExtraction {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) return { goals: [], evidence: ["empty_prompt"] };

  const matches: string[] = [];

  const chainedPatterns = [
    /\be ainda\s+([^.;!?]{4,80})/g,
    /\bmas (?:sem|tambem|tambem quero|quero)\s+([^.;!?]{4,80})/g,
    /\b(?:tambem|tbm)\s+([^.;!?]{4,80})/g,
    /\bsem\s+([^.;!?]{4,80})/g,
  ];

  for (const pattern of chainedPatterns) {
    const patternMatches = Array.from(normalized.matchAll(pattern));
    for (const row of patternMatches) {
      if (!row[1]) continue;
      matches.push(row[1].replace(/\s+/g, " ").trim());
    }
  }

  const goals = toUnique(matches, 8);
  return {
    goals,
    evidence: goals.length ? ["secondary_goal_clauses_detected"] : ["no_secondary_goal_clause"],
  };
}

