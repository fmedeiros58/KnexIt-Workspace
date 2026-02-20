-- Add optional avatar URL to group/forum threads for cross-device sync.

alter table public.knexchat_threads
  add column if not exists avatar_url text;

