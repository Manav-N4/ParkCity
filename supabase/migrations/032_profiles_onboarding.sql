-- Onboarding and profile data on the existing profiles table (011).
-- Adds address, onboarding_completed and updated_at; auto-creates a profile
-- for every auth user; restricts client-side writes to the backend.

alter table public.profiles
  add column if not exists address text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- NOT VALID: enforced on new writes without failing on legacy rows.
alter table public.profiles
  add constraint profiles_name_length
    check (name is null or char_length(name) between 1 and 100) not valid,
  add constraint profiles_address_length
    check (address is null or char_length(address) <= 300) not valid;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

comment on function public.set_updated_at() is
  'Trigger: stamps updated_at on UPDATE.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name',
                              new.raw_user_meta_data->>'name', '')), 100), ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end
$$;

comment on function public.handle_new_user() is
  'Trigger on auth.users: creates a profiles row (name prefilled from OAuth metadata).';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users created before this migration.
-- onboarding_completed stays false so every existing user onboards once.
insert into public.profiles (id, name, email)
select
  u.id,
  nullif(left(trim(coalesce(u.raw_user_meta_data->>'full_name',
                            u.raw_user_meta_data->>'name', '')), 100), ''),
  u.email
from auth.users u
on conflict (id) do nothing;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Clients keep SELECT on their own row (existing RLS policy); all writes go
-- through the backend (service role). The existing "Users can update own
-- profile" policy is left in place and is inert without the privilege.
revoke insert, update, delete on public.profiles from anon, authenticated;
