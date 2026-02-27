"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const missingConfig = !supabaseUrl || !supabaseAnonKey;

const missingConfigClient = () =>
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(
        "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    },
  });

export const supabase = missingConfig ? missingConfigClient() : createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = !missingConfig;
