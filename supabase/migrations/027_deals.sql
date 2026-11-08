create table deals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  offer_text text not null,
  discount_label text not null,
  redemption_code_prefix text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  parking_spot_ids uuid[] not null default '{}'
);

create table deal_redemptions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references parking_spots(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  redemption_code text not null
);

alter table deals enable row level security;
alter table deal_redemptions enable row level security;

create policy "Anyone can read active deals"
  on deals for select
  using (true);

create policy "Users can read own redemptions"
  on deal_redemptions for select
  using (auth.uid() = user_id);