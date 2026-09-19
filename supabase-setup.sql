-- Run once in Supabase: SQL Editor > New query > paste > Run.
create table scores (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[A-Za-z0-9 ._-]{1,16}$'),
  score int not null check (score between 0 and 2000),  -- 2000 is a guess; set to the real max
  created_at timestamptz not null default now()
);
alter table scores enable row level security;
create policy "anyone can add a score" on scores for insert to anon with check (true); -- table checks above do the validation
-- Public read goes through a view (best score per name); anon cannot read the raw table.
create view leaderboard as
  select name, score from (select distinct on (lower(name)) name, score from scores order by lower(name), score desc) t;
grant select on leaderboard to anon;
grant insert on scores to anon;
