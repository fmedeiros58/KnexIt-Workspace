import crypto from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isEmail(value) {
  return EMAIL_REGEX.test(normalizeEmail(value));
}

export function generateOtpCode() {
  const code = crypto.randomInt(0, 1_000_000);
  return String(code).padStart(6, "0");
}

export function hashOtp(code, tokenId, salt) {
  const normalizedCode = String(code || "").trim();
  const normalizedSalt = String(salt || "").trim();
  const normalizedTokenId = String(tokenId || "").trim();
  return crypto
    .createHash("sha256")
    .update(`${normalizedCode}:${normalizedSalt}:${normalizedTokenId}`)
    .digest("hex");
}

export function verifyOtp(code, tokenId, salt, expectedHash) {
  if (!expectedHash) return false;
  const computed = hashOtp(code, tokenId, salt);
  const computedBuf = Buffer.from(computed, "hex");
  const expectedBuf = Buffer.from(String(expectedHash), "hex");
  if (computedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}
