export type ReferenceTypographyConfig = {
  abntTitleEmphasis?: "none" | "italic" | "bold";
};

export function emphasizeTitle(
  text: string,
  mode: "none" | "italic" | "bold" = "none",
): { plainText: string; markdown: string; html: string } {
  const clean = text.trim();
  if (!clean) {
    return { plainText: "", markdown: "", html: "" };
  }
  if (mode === "italic") {
    return {
      plainText: clean,
      markdown: `*${clean}*`,
      html: `<em>${escapeHtml(clean)}</em>`,
    };
  }
  if (mode === "bold") {
    return {
      plainText: clean,
      markdown: `**${clean}**`,
      html: `<strong>${escapeHtml(clean)}</strong>`,
    };
  }
  return {
    plainText: clean,
    markdown: clean,
    html: escapeHtml(clean),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

