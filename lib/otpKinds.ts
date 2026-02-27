export const OtpKind = {
  REQUEST: "request",
  VERIFY: "verify",
} as const;

export type OtpKind = (typeof OtpKind)[keyof typeof OtpKind];

export type OtpFlow = "login" | "signup" | "recovery" | "oauth_verify";
export type OtpMode = "otp_login" | "otp_signup" | "otp_recovery" | "otp_oauth_verify";
export type OtpPhase = "request" | "verify";

export const mapFlowToOtpKind = (_flow: OtpFlow, phase: OtpPhase): OtpKind =>
  phase === "request" ? OtpKind.REQUEST : OtpKind.VERIFY;

export const flowFromMode = (mode?: string | null): OtpFlow | null => {
  switch (mode) {
    case "otp_login":
      return "login";
    case "otp_signup":
      return "signup";
    case "otp_recovery":
      return "recovery";
    case "otp_oauth_verify":
      return "oauth_verify";
    default:
      return null;
  }
};

export const flowFromType = (type?: string | null): OtpFlow | null => {
  switch (type) {
    case "login":
      return "login";
    case "signup":
      return "signup";
    case "recovery":
      return "recovery";
    case "oauth_verify":
      return "oauth_verify";
    case "magiclink":
    case "email":
      return "login";
    default:
      return null;
  }
};

export const resolveOtpFlow = (input: { mode?: string | null; type?: string | null }): OtpFlow | null =>
  flowFromMode(input.mode) ?? flowFromType(input.type);

export const mapFlowToSupabaseOtpType = (flow: OtpFlow): "signup" | "magiclink" | "recovery" => {
  if (flow === "signup") return "signup";
  if (flow === "recovery") return "recovery";
  return "magiclink";
};
