-- KnexChat directory table (unique email)
create table if not exists public.knexchat_directory (
  email text primary key,
  name text,
  created_at timestamptz not null default now()
);

-- Optional index for recent-first ordering
create index if not exists knexchat_directory_created_at_idx
  on public.knexchat_directory (created_at desc);

-- Enable Row Level Security (access should go through server with service role)
alter table public.knexchat_directory enable row level security;

drop policy if exists "knexchat_directory_read" on public.knexchat_directory;
drop policy if exists "knexchat_directory_insert" on public.knexchat_directory;
