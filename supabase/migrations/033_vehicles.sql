-- Multiple vehicles per user, at most one primary.
-- All writes go through backend-only functions that serialize per user.

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_number text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint vehicles_number_format check (vehicle_number ~ '^[A-Z0-9]{4,12}$'),
  -- Retry-safe inserts; also serves lookups by user_id (leading column).
  constraint vehicles_user_number_key unique (user_id, vehicle_number)
);

-- At most one primary vehicle per user, enforced by the database.
create unique index vehicles_one_primary_per_user
  on public.vehicles (user_id)
  where is_primary;

alter table public.vehicles enable row level security;

create policy "Users can read own vehicles"
  on public.vehicles for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies or privileges for clients.
revoke insert, update, delete on public.vehicles from anon, authenticated;

create or replace function public.add_vehicle(
  p_user_id uuid,
  p_vehicle_number text,
  p_make_primary boolean default false
)
returns setof public.vehicles
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('vehicles:' || p_user_id::text, 0));

  if exists (
    select 1 from public.vehicles
    where user_id = p_user_id and vehicle_number = p_vehicle_number
  ) then
    raise exception 'VEHICLE_EXISTS';
  end if;

  if (select count(*) from public.vehicles where user_id = p_user_id) >= 5 then
    raise exception 'VEHICLE_LIMIT';
  end if;

  insert into public.vehicles (user_id, vehicle_number)
  values (p_user_id, p_vehicle_number)
  returning id into v_id;

  if p_make_primary or not exists (
    select 1 from public.vehicles where user_id = p_user_id and is_primary
  ) then
    update public.vehicles set is_primary = false
      where user_id = p_user_id and is_primary;
    update public.vehicles set is_primary = true
      where id = v_id;
  end if;

  return query
    select * from public.vehicles
    where user_id = p_user_id
    order by is_primary desc, created_at, id;
end
$$;

create or replace function public.set_primary_vehicle(
  p_user_id uuid,
  p_vehicle_id uuid
)
returns setof public.vehicles
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('vehicles:' || p_user_id::text, 0));

  if not exists (
    select 1 from public.vehicles where id = p_vehicle_id and user_id = p_user_id
  ) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  -- Clear first, then set, so the partial unique index never sees two primaries.
  update public.vehicles set is_primary = false
    where user_id = p_user_id and is_primary and id <> p_vehicle_id;
  update public.vehicles set is_primary = true
    where id = p_vehicle_id and user_id = p_user_id;

  return query
    select * from public.vehicles
    where user_id = p_user_id
    order by is_primary desc, created_at, id;
end
$$;

create or replace function public.delete_vehicle(
  p_user_id uuid,
  p_vehicle_id uuid
)
returns setof public.vehicles
language plpgsql
set search_path = ''
as $$
declare
  v_was_primary boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('vehicles:' || p_user_id::text, 0));

  delete from public.vehicles
    where id = p_vehicle_id and user_id = p_user_id
    returning is_primary into v_was_primary;

  if not found then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  -- Promote the oldest remaining vehicle. No-op when none remain
  -- (deleting the last vehicle is allowed).
  if v_was_primary then
    update public.vehicles set is_primary = true
    where id = (
      select id from public.vehicles
      where user_id = p_user_id
      order by created_at, id
      limit 1
    );
  end if;

  return query
    select * from public.vehicles
    where user_id = p_user_id
    order by is_primary desc, created_at, id;
end
$$;

-- Whole onboarding in one transaction: any exception rolls back the profile
-- update, the vehicle inserts and the completed flag together.
create or replace function public.complete_onboarding(
  p_user_id uuid,
  p_name text,
  p_address text,
  p_vehicle_numbers text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_number text;
begin
  perform pg_advisory_xact_lock(hashtextextended('vehicles:' || p_user_id::text, 0));

  if coalesce(array_length(p_vehicle_numbers, 1), 0) not between 1 and 3 then
    raise exception 'VALIDATION_ERROR';
  end if;

  insert into public.profiles (id) values (p_user_id)
  on conflict (id) do nothing;

  update public.profiles
    set name = p_name, address = p_address
    where id = p_user_id;

  foreach v_number in array p_vehicle_numbers loop
    insert into public.vehicles (user_id, vehicle_number)
    values (p_user_id, v_number)
    on conflict (user_id, vehicle_number) do nothing;
  end loop;

  if (select count(*) from public.vehicles where user_id = p_user_id) > 5 then
    raise exception 'VEHICLE_LIMIT';
  end if;

  if not exists (
    select 1 from public.vehicles where user_id = p_user_id and is_primary
  ) then
    update public.vehicles set is_primary = true
    where user_id = p_user_id and vehicle_number = p_vehicle_numbers[1];
  end if;

  -- Last step: only reached when everything above succeeded.
  update public.profiles
    set onboarding_completed = true
    where id = p_user_id;
end
$$;

comment on function public.add_vehicle(uuid, text, boolean) is
  'Backend only. Adds a vehicle (max 5 per user); first vehicle becomes primary.';
comment on function public.set_primary_vehicle(uuid, uuid) is
  'Backend only. Atomically switches the primary vehicle.';
comment on function public.delete_vehicle(uuid, uuid) is
  'Backend only. Deletes a vehicle; promotes the oldest remaining one if the primary was removed.';
comment on function public.complete_onboarding(uuid, text, text, text[]) is
  'Backend only. Atomic, idempotent onboarding (profile + 1 to 3 vehicles + completed flag).';

-- These take p_user_id, so only the backend (service role) may execute them.
revoke execute on function
  public.add_vehicle(uuid, text, boolean),
  public.set_primary_vehicle(uuid, uuid),
  public.delete_vehicle(uuid, uuid),
  public.complete_onboarding(uuid, text, text, text[])
from public, anon, authenticated;

grant execute on function
  public.add_vehicle(uuid, text, boolean),
  public.set_primary_vehicle(uuid, uuid),
  public.delete_vehicle(uuid, uuid),
  public.complete_onboarding(uuid, text, text, text[])
to service_role;
