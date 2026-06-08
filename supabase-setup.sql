-- WakaWithUs — Supabase setup
-- Run this once in Supabase → SQL Editor → New query → Run.

-- 1) Content table (a single row holds the whole site content as JSON)
create table if not exists site_content (
  id          int primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- 2) Let the public website READ the content (anon key).
--    Writes happen only from the dashboard using the secret service key,
--    which bypasses these policies.
alter table site_content enable row level security;

drop policy if exists "public read content" on site_content;
create policy "public read content" on site_content
  for select using (true);

-- 3) Images bucket:
--    Do this in the UI: Storage → New bucket → name it "images" → tick "Public bucket".
--    (Uploads come from the dashboard's service key; public read serves them to the site.)
