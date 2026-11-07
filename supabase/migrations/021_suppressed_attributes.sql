alter table parking_spot_attributes 
  add column if not exists suppressed boolean not null default false,
  add column if not exists suppressed_at timestamptz,
  add column if not exists suppressed_by uuid references auth.users(id);