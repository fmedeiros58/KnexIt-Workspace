-- Add avatar URL to directory entries (idempotent).
alter table if exists public.knexchat_directory
  add column if not exists avatar_url text;
