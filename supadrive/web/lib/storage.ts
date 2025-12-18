"use client";

import { getPublicUrl, getSignedUrl } from "./storageUrls";

const signedUrlCache = new Map<string, Promise<string | null>>();
const isThumbsPrivate = process.env.NEXT_PUBLIC_SUPABASE_THUMBS_PRIVATE === "true";

function normalizePath(bucket: string, path: string) {
  let normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }
  return normalized;
}

export async function getThumbUrl(bucket: string, path?: string | null) {
  if (!path) return null;
  const normalizedPath = normalizePath(bucket, path);
  const cacheKey = `${bucket}/${normalizedPath}`;

  if (!isThumbsPrivate) {
    return getPublicUrl(bucket, normalizedPath);
  }

  if (signedUrlCache.has(cacheKey)) {
    return signedUrlCache.get(cacheKey)!;
  }

  const promise = getSignedUrl(bucket, normalizedPath, 60 * 60);
  signedUrlCache.set(cacheKey, promise);
  return promise;
}
