create table sponsored_spots (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  merchant_id uuid not null references auth.users(id) on delete cascade,
  active_from timestamptz not null default now(),
  active_until timestamptz not null,
  monthly_fee_paid boolean not null default false
);

alter table sponsored_spots enable row level security;

create policy "Anyone can read active sponsored spots"
  on sponsored_spots for select
  using (true);