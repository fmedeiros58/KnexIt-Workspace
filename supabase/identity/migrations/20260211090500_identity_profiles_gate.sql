-- Gate profile creation until email is verified via OTP

create or replace function public.handle_auth_user_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_profile boolean;
  verified_by_code boolean;
begin
  select exists(select 1 from public.profiles where id = new.id) into has_profile;
  verified_by_code := (new.raw_user_meta_data->>'email_verified_by_code_at') is not null;

  if not has_profile and not verified_by_code then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;
