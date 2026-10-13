-- Run once in Supabase SQL editor. Anon can only INSERT; reads are aggregate counts via play_stats.
create table visits (
  id bigint generated always as identity primary key,
  choice text not null check (choice in ('allow','reject')),
  at timestamptz not null default now()
);
create table plays (
  id bigint generated always as identity primary key,
  pid text not null check (length(pid) between 8 and 40),
  mode text not null check (mode in ('solo','multi')),
  at timestamptz not null default now()
);
alter table visits enable row level security;
alter table plays enable row level security;
create policy visits_insert on visits for insert to anon with check (true);
create policy plays_insert on plays for insert to anon with check (true);
grant insert on visits, plays to anon;

-- Counts only (view runs as owner, so anon needs no SELECT on the tables).
create view play_stats as select
  (select count(*) from visits) as visitors,
  (select count(*) from visits where choice = 'allow') as allowed,
  (select count(*) from visits where choice = 'reject') as rejected,
  (select count(*) from visits where at > now() - interval '24 hours') as visitors_24h,
  (select count(*) from plays) as plays,
  (select count(distinct pid) from plays) as players,
  (select count(*) from plays where mode = 'multi') as multi_plays;
grant select on play_stats to anon;
