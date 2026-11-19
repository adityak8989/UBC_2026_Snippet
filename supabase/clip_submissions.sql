-- Snippet: clip_submissions
-- "Submit a clip" (/submit) proposals for review by the Snippet Ops Bot and a human, who approves and lists.
-- No email or personal data: the creator name is the public name shown on the site.
-- Paste this whole file into the Supabase SQL Editor and click Run. Safe to run again.

create table if not exists public.clip_submissions (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  creator_name   text not null check (char_length(btrim(creator_name)) between 1 and 60),
  title          text not null check (char_length(btrim(title)) between 1 and 80),
  show           text not null check (char_length(btrim(show)) between 1 and 80),        -- game or show
  publisher      text check (publisher is null or char_length(btrim(publisher)) between 1 and 80),
  content_type   text not null check (content_type in ('gameplay', 'original')),
  video_url      text not null check (video_url ~ '^https?://' and char_length(video_url) <= 500),
  length_seconds integer not null check (length_seconds between 1 and 600),
  rights_confirmed boolean not null check (rights_confirmed),  -- "I own this clip or have the rights to sell it"
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists clip_submissions_created_at_idx on public.clip_submissions (created_at desc);

-- Row Level Security: anyone can submit (insert a pending row) and the public can read.
-- Nobody can change or delete rows through the public key; reviewers use the dashboard or the secret key.
alter table public.clip_submissions enable row level security;
revoke all on table public.clip_submissions from anon, authenticated;
grant select, insert on table public.clip_submissions to anon, authenticated;

drop policy if exists "Anyone can submit a clip" on public.clip_submissions;
create policy "Anyone can submit a clip"
  on public.clip_submissions for insert
  to anon, authenticated
  with check (status = 'pending' and rights_confirmed);

drop policy if exists "Anyone can read clip submissions" on public.clip_submissions;
create policy "Anyone can read clip submissions"
  on public.clip_submissions for select
  to anon, authenticated
  using (true);
