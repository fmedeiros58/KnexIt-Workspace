-- Add missing request metadata columns for KnexChat verification tokens.
alter table public.knexchat_verification_tokens
  add column if not exists ip_address text,
  add column if not exists user_agent text;
