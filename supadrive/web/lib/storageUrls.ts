"use client";

import { supabaseBrowserClient } from "./supabaseClient";

function normalizePath(bucket: string, path: string) {
  let normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }
  return normalized;
}

export function getPublicUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const normalized = normalizePath(bucket, path);
  const { data } = supabaseBrowserClient.storage.from(bucket).getPublicUrl(normalized);
  return data?.publicUrl ?? null;
}

export async function getSignedUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const normalized = normalizePath(bucket, path);
  const { data, error } = await supabaseBrowserClient.storage
    .from(bucket)
    .createSignedUrl(normalized, expiresIn);
  if (error) {
    console.error("Failed to create signed URL", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
