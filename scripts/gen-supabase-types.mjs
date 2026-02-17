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
const generated = generateSupabaseTypes({ projectRef, accessToken });
const normalized = normalizeEol(generated);

assertSupabaseTypeSanity(normalized);

const targetPath = path.join(process.cwd(), "types", "supabase.ts");
fs.writeFileSync(targetPath, normalized, "utf8");

console.log(`Generated Supabase types from project ${projectRef} into types/supabase.ts`);
