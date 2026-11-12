alter table reports
  alter column user_id drop not null;

alter table deal_redemptions
  alter column user_id drop not null;