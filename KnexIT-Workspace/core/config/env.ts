import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string().min(10),
  DATABASE_URL: z.string().url().optional(),
});

export function loadEnv(raw = process.env) {
  return schema.parse(raw);
}
