alter table profiles
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists satisfaction_prompts_enabled boolean not null default true;