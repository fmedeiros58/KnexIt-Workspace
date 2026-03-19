import {
  assertSupabaseTypeSanity,
  generateSupabaseTypes,
  normalizeEol,
  resolveProjectRef,
} from "./supabase-types-utils.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || "";
const explicitProjectRef = process.env.SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_REF || "";

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
if (!accessToken) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const projectRef = resolveProjectRef(supabaseUrl, explicitProjectRef);
const generated = normalizeEol(generateSupabaseTypes({ projectRef, accessToken }));
assertSupabaseTypeSanity(generated);

console.log("Supabase types doctor OK.");
console.log(`Project ref: ${projectRef}`);
console.log(`Generated type size: ${generated.length} bytes`);
