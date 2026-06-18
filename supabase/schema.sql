-- Setec · Pilotage des projets — Supabase schema (task model)
-- Run in the Supabase SQL editor before seeding.
--
-- Access is restricted to authenticated users (the app gates everything behind
-- Supabase Auth magic-link login). Any signed-in user can read and write;
-- tighten (per-team / per-owner) when you add roles.

-- ---------------------------------------------------------------- tables

create table if not exists team_members (
  id       int  primary key,          -- explicit ids (app references them)
  name     text not null,
  initials text not null,
  color    text not null,
  role     text not null
);

create table if not exists projects (
  id             bigint generated always as identity primary key,
  name           text not null,
  client         text not null default 'À définir',
  discipline     text not null default 'À définir',
  responsable_id int  not null references team_members(id),
  phase_index    int  not null default 0 check (phase_index between 0 and 6),
  status         text not null default 'à jour'
                   check (status in ('à jour', 'à risque', 'en retard', 'terminé')),
  budget         int  not null default 0,   -- fees / honoraires, in k€
  start          date not null,
  deadline       date not null,
  created_at     timestamptz not null default now()
);

-- Editable tasks (sous-tâches). Progress + next deliverable are derived from these.
create table if not exists subtasks (
  id           bigint generated always as identity primary key,
  project_id   bigint  not null references projects(id) on delete cascade,
  name         text    not null,
  assignee_id  int     not null references team_members(id),
  start        date    not null,
  planned_days int     not null default 1 check (planned_days >= 1),
  done         boolean not null default false,
  -- Predecessor task ids (Finish-to-Start dependencies), same project.
  depends_on   int[]   not null default '{}'
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

create index if not exists idx_subtasks_project on subtasks (project_id, start);
create index if not exists idx_subtasks_assignee on subtasks (assignee_id);
create index if not exists idx_comments_project on comments (project_id, created_at);

-- ---------------------------------------------------------- RLS (authenticated)

alter table team_members enable row level security;
alter table projects     enable row level security;
alter table subtasks     enable row level security;
alter table comments     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['team_members','projects','subtasks','comments']
  loop
    execute format('drop policy if exists "authenticated read" on %I;', t);
    execute format('drop policy if exists "authenticated write" on %I;', t);
    execute format('create policy "authenticated read" on %I for select using (auth.uid() is not null);', t);
    execute format('create policy "authenticated write" on %I for all using (auth.uid() is not null) with check (auth.uid() is not null);', t);
  end loop;
end $$;
