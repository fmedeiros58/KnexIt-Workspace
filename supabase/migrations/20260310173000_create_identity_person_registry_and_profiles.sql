-- Identity person registry for passive identification and active search ("wanted").
-- Adds multi-view profile persistence with centroid refresh and retention policy.

create table if not exists knex_identity_runtime.identity_persons (
  person_id text primary key,
  display_name text not null,
  external_id text,
  profile_kind text not null default 'passive',
  search_active boolean not null default false,
  preliminary_similarity_threshold numeric(8,6) not null default 0.720000,
  strong_similarity_threshold numeric(8,6) not null default 0.820000,
  min_consecutive_hits integer not null default 3,
  min_window_ms integer not null default 2400,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_persons_profile_kind_check check (profile_kind in ('passive', 'wanted')),
  constraint identity_persons_preliminary_threshold_check check (
    preliminary_similarity_threshold >= 0 and preliminary_similarity_threshold <= 1
  ),
  constraint identity_persons_strong_threshold_check check (
    strong_similarity_threshold >= 0 and strong_similarity_threshold <= 1
  ),
  constraint identity_persons_min_consecutive_hits_check check (min_consecutive_hits >= 1 and min_consecutive_hits <= 120),
  constraint identity_persons_min_window_ms_check check (min_window_ms >= 200 and min_window_ms <= 120000)
);

create table if not exists knex_identity_runtime.identity_person_profiles (
  profile_id bigserial primary key,
  person_id text not null unique references knex_identity_runtime.identity_persons(person_id) on delete cascade,
  frontal_centroid vector(768),
  left_centroid vector(768),
  right_centroid vector(768),
  consolidated_centroid vector(768),
  front_samples integer not null default 0,
  left_samples integer not null default 0,
  right_samples integer not null default 0,
  retention_max_per_view integer not null default 12,
  retention_ttl_days integer not null default 180,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_person_profiles_retention_max_per_view_check check (
    retention_max_per_view >= 1 and retention_max_per_view <= 200
  ),
  constraint identity_person_profiles_retention_ttl_days_check check (
    retention_ttl_days >= 1 and retention_ttl_days <= 3650
  )
);

create table if not exists knex_identity_runtime.identity_person_reference_images (
  reference_id bigserial primary key,
  person_id text not null references knex_identity_runtime.identity_persons(person_id) on delete cascade,
  image_key text references knex_identity_runtime.identity_image_assets(image_key) on delete set null,
  capture_view text not null default 'unknown',
  quality_score numeric(6,5) not null default 0.0,
  embedding vector(768),
  model_name text,
  is_active boolean not null default true,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_person_reference_images_capture_view_check check (
    capture_view in ('main', 'left', 'front', 'right', 'gallery', 'unknown')
  ),
  constraint identity_person_reference_images_quality_score_check check (
    quality_score >= 0 and quality_score <= 1
  ),
  constraint identity_person_reference_images_person_image_unique unique (person_id, image_key)
);

create or replace function knex_identity_runtime.refresh_identity_person_profile(p_person_id text)
returns jsonb
language plpgsql
as $$
declare
  v_person_id text := trim(coalesce(p_person_id, ''));
begin
  if v_person_id = '' then
    return jsonb_build_object('ok', false, 'error', 'person_id_required');
  end if;

  insert into knex_identity_runtime.identity_person_profiles (person_id)
  values (v_person_id)
  on conflict (person_id) do nothing;

  with agg as (
    select
      r.person_id,
      avg(r.embedding) filter (where r.capture_view = 'front' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now())) as frontal_centroid,
      avg(r.embedding) filter (where r.capture_view = 'left' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now())) as left_centroid,
      avg(r.embedding) filter (where r.capture_view = 'right' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now())) as right_centroid,
      count(*) filter (where r.capture_view = 'front' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now()))::integer as front_samples,
      count(*) filter (where r.capture_view = 'left' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now()))::integer as left_samples,
      count(*) filter (where r.capture_view = 'right' and r.embedding is not null and r.is_active and (r.expires_at is null or r.expires_at > now()))::integer as right_samples
    from knex_identity_runtime.identity_person_reference_images r
    where r.person_id = v_person_id
    group by r.person_id
  ),
  consolidated as (
    select
      a.person_id,
      (
        select avg(v)
        from (
          select a.left_centroid as v where a.left_centroid is not null
          union all
          select a.frontal_centroid as v where a.frontal_centroid is not null
          union all
          select a.right_centroid as v where a.right_centroid is not null
        ) s
      ) as consolidated_centroid
    from agg a
  )
  update knex_identity_runtime.identity_person_profiles p
  set
    frontal_centroid = a.frontal_centroid,
    left_centroid = a.left_centroid,
    right_centroid = a.right_centroid,
    consolidated_centroid = c.consolidated_centroid,
    front_samples = coalesce(a.front_samples, 0),
    left_samples = coalesce(a.left_samples, 0),
    right_samples = coalesce(a.right_samples, 0),
    updated_at = now()
  from agg a
  left join consolidated c on c.person_id = a.person_id
  where p.person_id = a.person_id
    and p.person_id = v_person_id;

  update knex_identity_runtime.identity_person_profiles p
  set
    frontal_centroid = null,
    left_centroid = null,
    right_centroid = null,
    consolidated_centroid = null,
    front_samples = 0,
    left_samples = 0,
    right_samples = 0,
    updated_at = now()
  where p.person_id = v_person_id
    and not exists (
      select 1
      from knex_identity_runtime.identity_person_reference_images r
      where r.person_id = v_person_id
        and r.embedding is not null
        and r.is_active
        and (r.expires_at is null or r.expires_at > now())
    );

  return jsonb_build_object('ok', true, 'person_id', v_person_id);
end;
$$;

create or replace function knex_identity_runtime.apply_person_reference_retention(p_person_id text)
returns jsonb
language plpgsql
as $$
declare
  v_person_id text := trim(coalesce(p_person_id, ''));
  v_keep integer := 12;
  v_ttl integer := 180;
  v_deleted integer := 0;
begin
  if v_person_id = '' then
    return jsonb_build_object('ok', false, 'error', 'person_id_required');
  end if;

  select
    greatest(1, coalesce(retention_max_per_view, 12)),
    greatest(1, coalesce(retention_ttl_days, 180))
  into v_keep, v_ttl
  from knex_identity_runtime.identity_person_profiles
  where person_id = v_person_id;

  with ranked as (
    select
      r.reference_id,
      row_number() over (
        partition by r.capture_view
        order by coalesce(r.quality_score, 0.0) desc, r.created_at desc
      ) as rn
    from knex_identity_runtime.identity_person_reference_images r
    where r.person_id = v_person_id
      and r.is_active
  ),
  to_delete as (
    select reference_id
    from ranked
    where rn > v_keep
    union
    select r.reference_id
    from knex_identity_runtime.identity_person_reference_images r
    where r.person_id = v_person_id
      and r.created_at < (now() - make_interval(days => v_ttl))
  )
  delete from knex_identity_runtime.identity_person_reference_images d
  using to_delete x
  where d.reference_id = x.reference_id;

  get diagnostics v_deleted = row_count;

  perform knex_identity_runtime.refresh_identity_person_profile(v_person_id);

  return jsonb_build_object(
    'ok', true,
    'person_id', v_person_id,
    'deleted', v_deleted,
    'retention_max_per_view', v_keep,
    'retention_ttl_days', v_ttl
  );
end;
$$;

create or replace function knex_identity_runtime.trg_identity_person_reference_maintain()
returns trigger
language plpgsql
as $$
begin
  perform knex_identity_runtime.apply_person_reference_retention(new.person_id);
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_identity_persons on knex_identity_runtime.identity_persons;
create trigger trg_set_updated_at_identity_persons
before update on knex_identity_runtime.identity_persons
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_person_profiles on knex_identity_runtime.identity_person_profiles;
create trigger trg_set_updated_at_identity_person_profiles
before update on knex_identity_runtime.identity_person_profiles
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_person_reference_images on knex_identity_runtime.identity_person_reference_images;
create trigger trg_set_updated_at_identity_person_reference_images
before update on knex_identity_runtime.identity_person_reference_images
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_identity_person_reference_maintain on knex_identity_runtime.identity_person_reference_images;
create trigger trg_identity_person_reference_maintain
after insert or update of quality_score, embedding, is_active, expires_at, capture_view
on knex_identity_runtime.identity_person_reference_images
for each row execute function knex_identity_runtime.trg_identity_person_reference_maintain();

create index if not exists idx_identity_persons_kind_active_updated
  on knex_identity_runtime.identity_persons(profile_kind, search_active, updated_at desc);

create index if not exists idx_identity_persons_external_id
  on knex_identity_runtime.identity_persons(external_id);

create index if not exists idx_identity_person_profiles_updated
  on knex_identity_runtime.identity_person_profiles(updated_at desc);

create index if not exists idx_identity_person_reference_images_person_view_created
  on knex_identity_runtime.identity_person_reference_images(person_id, capture_view, created_at desc);

create index if not exists idx_identity_person_reference_images_person_quality
  on knex_identity_runtime.identity_person_reference_images(person_id, quality_score desc, created_at desc);

create index if not exists idx_identity_person_reference_images_embedding
  on knex_identity_runtime.identity_person_reference_images
  using hnsw (embedding vector_cosine_ops);

create or replace view public.identity_persons as
select * from knex_identity_runtime.identity_persons;

create or replace view public.identity_person_profiles as
select * from knex_identity_runtime.identity_person_profiles;

create or replace view public.identity_person_reference_images as
select * from knex_identity_runtime.identity_person_reference_images;

grant usage on schema knex_identity_runtime to service_role;
grant select, insert, update, delete on table knex_identity_runtime.identity_persons to service_role;
grant select, insert, update, delete on table knex_identity_runtime.identity_person_profiles to service_role;
grant select, insert, update, delete on table knex_identity_runtime.identity_person_reference_images to service_role;
grant usage, select on sequence knex_identity_runtime.identity_person_profiles_profile_id_seq to service_role;
grant usage, select on sequence knex_identity_runtime.identity_person_reference_images_reference_id_seq to service_role;

alter default privileges in schema knex_identity_runtime
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema knex_identity_runtime
grant usage, select on sequences to service_role;

