import fs from "node:fs";
import path from "node:path";
import {
  assertSupabaseTypeSanity,
  generateSupabaseTypes,
  normalizeEol,
  resolveProjectRef,
} from "./supabase-types-utils.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || "";
const explicitProjectRef = process.env.SUPABASE_PROJECT_ID || "";

const projectRef = resolveProjectRef(supabaseUrl, explicitProjectRef);
const generated = normalizeEol(generateSupabaseTypes({ projectRef, accessToken }));
assertSupabaseTypeSanity(generated);

const targetPath = path.join(process.cwd(), "types", "supabase.ts");
if (!fs.existsSync(targetPath)) {
  console.error("types/supabase.ts not found. Run npm run db:types:gen first.");
  process.exit(1);
}

const current = normalizeEol(fs.readFileSync(targetPath, "utf8"));
if (generated !== current) {
  console.error("Supabase type drift detected in types/supabase.ts.");
  console.error("Run: npm run db:types:gen");
  process.exit(1);
}

console.log(`Supabase types check passed for project ${projectRef}.`);
