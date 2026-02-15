export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

const RESERVED_NICKNAMES = new Set([
  "admin",
  "root",
  "support",
  "help",
  "api",
  "system",
  "knex",
  "knexchat",
  "knexspace",
  "login",
  "signup",
  "register",
  "activate",
  "settings",
  "terms",
  "privacy",
  "assets",
]);

export type NicknameValidationError =
  | "required"
  | "too_short"
  | "too_long"
  | "invalid_format"
  | "invalid_separators"
  | "numeric_only";

export type NicknameValidationResult = {
  ok: boolean;
  normalized: string;
  error?: NicknameValidationError;
};

export const normalizeNickname = (value: string) => {
  if (!value) return "";
  return value
    .trim()
    .replace(/^@+/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const hasInvalidSeparators = (value: string) =>
  value.includes("..") || value.includes("__") || value.includes("._") || value.includes("_.");

export const validateNickname = (value: string): NicknameValidationResult => {
  const normalized = normalizeNickname(value);
  if (!normalized) {
    return { ok: false, normalized, error: "required" };
  }
  if (normalized.length < NICKNAME_MIN) {
    return { ok: false, normalized, error: "too_short" };
  }
  if (normalized.length > NICKNAME_MAX) {
    return { ok: false, normalized, error: "too_long" };
  }
  if (!/^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(normalized)) {
    return { ok: false, normalized, error: "invalid_format" };
  }
  if (hasInvalidSeparators(normalized)) {
    return { ok: false, normalized, error: "invalid_separators" };
  }
  if (/^[0-9]+$/.test(normalized)) {
    return { ok: false, normalized, error: "numeric_only" };
  }
  return { ok: true, normalized };
};

export const isReservedNickname = (value: string) => RESERVED_NICKNAMES.has(value);

export const getNicknameRulesLabel = () =>
  "3-20 caracteres, letras/numeros, ponto e _. Sem espacos. Nao pode iniciar/terminar com . ou _.";

export const getNicknameErrorMessage = (error?: NicknameValidationError) => {
  switch (error) {
    case "required":
      return "Informe um nickname.";
    case "too_short":
      return `Use pelo menos ${NICKNAME_MIN} caracteres.`;
    case "too_long":
      return `Use no maximo ${NICKNAME_MAX} caracteres.`;
    case "invalid_format":
      return "Use apenas letras, numeros, ponto e _.";
    case "invalid_separators":
      return "Nao use separadores repetidos (.., __, ._, _.)";
    case "numeric_only":
      return "Nao use apenas numeros.";
    default:
      return "Nickname invalido.";
  }
};
