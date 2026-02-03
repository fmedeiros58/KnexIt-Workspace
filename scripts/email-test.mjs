const to = process.env.TEST_EMAIL_TO || process.argv[2];
const url = process.env.TEST_EMAIL_URL || "http://localhost:3000/api/email/test";

if (!to) {
  console.error("Usage: TEST_EMAIL_TO=you@example.com npm run email:test");
  console.error("   or: node scripts/email-test.mjs you@example.com");
  process.exit(1);
}

const payload = {
  to,
  subject: "Teste Resend",
  text: "Teste ok",
  html: "<p>Teste <b>ok</b></p>",
};

try {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Email test failed:", data);
    process.exit(1);
  }
  console.log("Email sent:", data);
} catch (error) {
  console.error("Email test error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
