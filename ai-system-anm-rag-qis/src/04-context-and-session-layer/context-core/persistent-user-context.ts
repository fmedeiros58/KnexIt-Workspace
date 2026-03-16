export interface PersistentUserContextInput {
  currentProfile: Record<string, unknown>;
  language: string;
  intent: string;
  urgency: "low" | "medium" | "high";
  instructions: string[];
}

export interface PersistentUserContextOutput {
  profile: Record<string, unknown>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function persistentUserContext(input: PersistentUserContextInput): PersistentUserContextOutput {
  const profile = {
    ...input.currentProfile,
    lastLanguage: input.language,
    lastIntent: input.intent,
    lastUrgency: input.urgency,
    preferenceHints: [...new Set(input.instructions)].slice(0, 12),
    updatedAt: new Date().toISOString(),
  };

  const score = Math.max(0.2, Math.min(1, 0.35 + (profile.preferenceHints.length * 0.05)));

  return {
    profile,
    ok: true,
    component: "persistent-user-context",
    score: Number(score.toFixed(4)),
    detail: "profile_updated",
    context: {
      preferenceHints: profile.preferenceHints.length,
    },
  };
}
