-- Run this in Supabase → SQL Editor → New query → Run
-- Stores one shared row for gallery tap progress (phone + laptop sync)

create table if not exists public.gallery_progress (
  id text primary key default 'shared',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gallery_progress enable row level security;

-- Anonymous access (anon key): fine for a small private gift site.
-- For stricter security later, switch to authenticated users only.
create policy "gallery_read" on public.gallery_progress
  for select using (true);

create policy "gallery_write" on public.gallery_progress
  for insert with check (true);

create policy "gallery_update" on public.gallery_progress
  for update using (true) with check (true);
