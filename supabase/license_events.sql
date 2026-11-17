-- Snippet: license_events
-- One row per LicenseIssued event from SnippetLicenses (0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20,
-- Arc testnet), written by the QuickNode Streams webhook (web/app/api/streams/route.ts).
-- Paste this whole file into the Supabase SQL Editor and click Run. Safe to run again.

create table if not exists public.license_events (
  license_id      bigint primary key,                 -- unique: one row per license, upserts are idempotent
  clip_id         text not null check (clip_id ~ '^0x[0-9a-f]{64}$'),
  buyer           text not null check (buyer ~ '^0x[0-9a-f]{40}$'),
  use_type        smallint not null check (use_type between 0 and 2),  -- 0 Editorial, 1 Social, 2 Commercial
  price           bigint not null check (price >= 0),                  -- USDC units, 6 decimals
  rh_amount       bigint not null check (rh_amount >= 0),
  contrib_amount  bigint not null check (contrib_amount >= 0),
  platform_amount bigint not null check (platform_amount >= 0),
  file_hash       text not null check (file_hash ~ '^0x[0-9a-f]{64}$'),
  tx_hash         text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index       integer not null,
  block_number    bigint not null,
  block_timestamp timestamptz not null,               -- from the event's own timestamp field
  created_at      timestamptz not null default now()
);

create index if not exists license_events_clip_id_idx on public.license_events (clip_id);
create index if not exists license_events_block_timestamp_idx on public.license_events (block_timestamp desc);

-- Row Level Security: anyone can read; nobody can write through the public (publishable) key.
-- Only the server's secret key, which bypasses RLS, writes rows.
alter table public.license_events enable row level security;
revoke all on table public.license_events from anon, authenticated;
grant select on table public.license_events to anon, authenticated;

drop policy if exists "Anyone can read license events" on public.license_events;
create policy "Anyone can read license events"
  on public.license_events for select
  to anon, authenticated
  using (true);

-- Realtime: push new rows to the live "Licenses sold" feed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'license_events'
  ) then
    alter publication supabase_realtime add table public.license_events;
  end if;
end $$;
