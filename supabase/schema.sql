-- Setec · Pilotage des projets — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db` migration) before seeding.
--
-- NOTE on security: the RLS policies below are intentionally OPEN (anyone with
-- the anon key can read and write). That's fine for a demo/portfolio build with
-- no auth yet. Before exposing real data, replace them with auth-scoped policies.

-- ---------------------------------------------------------------- tables

create table if not exists team_members (
  id       int  primary key,
  name     text not null,
  initials text not null,
  color    text not null,
  role     text not null
);

create table if not exists projects (
  id             bigint generated always as identity primary key,
  name           text    not null,
  client         text    not null default 'À définir',
  discipline     text    not null default 'À définir',
  responsable_id int     not null references team_members(id),
  phase_index    int     not null default 0   check (phase_index between 0 and 6),
  progress       int     not null default 0   check (progress between 0 and 100),
  status         text    not null default 'à jour'
                   check (status in ('à jour', 'à risque', 'en retard', 'terminé')),
  budget         int     not null default 0,  -- fees / honoraires, in k€
  start          date    not null,
  deadline       date    not null,
  rendu_label    text    not null,
  rendu_date     date    not null,
  rendu_done     boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists project_members (
  project_id bigint references projects(id) on delete cascade,
  member_id  int    references team_members(id),
  primary key (project_id, member_id)
);

create table if not exists deliverables (
  id         bigint generated always as identity primary key,
  project_id bigint  not null references projects(id) on delete cascade,
  position   int     not null,
  label      text    not null,
  done       boolean not null default false
);

create table if not exists comments (
  id         bigint generated always as identity primary key,
  project_id bigint not null references projects(id) on delete cascade,
  author     text   not null,
  initials   text   not null,
  color      text   not null,
  text       text   not null,
  when_label text   not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_deliverables_project on deliverables (project_id, position);
create index if not exists idx_comments_project     on comments (project_id, created_at);
create index if not exists idx_project_members_proj on project_members (project_id);

-- ---------------------------------------------------------------- RLS (open)

alter table team_members    enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;
alter table deliverables    enable row level security;
alter table comments        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['team_members','projects','project_members','deliverables','comments']
  loop
    execute format('drop policy if exists "public read" on %I;', t);
    execute format('drop policy if exists "public write" on %I;', t);
    execute format('create policy "public read" on %I for select using (true);', t);
    execute format('create policy "public write" on %I for all using (true) with check (true);', t);
  end loop;
end $$;
