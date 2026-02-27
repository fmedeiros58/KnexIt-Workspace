const assert = require("assert");
const {
  normalizeEmail,
  isEmail,
  generateOtpCode,
  hashOtp,
  verifyOtp,
} = require("../lib/knexchat/activationOtp.js");

assert.strictEqual(normalizeEmail("  Test@Email.com "), "test@email.com");
assert.strictEqual(isEmail("user@example.com"), true);
assert.strictEqual(isEmail("invalid-email"), false);

const code = generateOtpCode();
assert.strictEqual(code.length, 6);
assert.ok(/^\d{6}$/.test(code));

const tokenId = "00000000-0000-0000-0000-000000000001";
const salt = "unit-test-salt";
const hash = hashOtp("123456", tokenId, salt);
assert.strictEqual(verifyOtp("123456", tokenId, salt, hash), true);
assert.strictEqual(verifyOtp("000000", tokenId, salt, hash), false);

console.log("knexchat activation otp tests passed");
