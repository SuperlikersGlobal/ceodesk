-- CeoDesk — esquema inicial
-- Bandeja única de decisiones/aprobaciones/firmas del CEO, con auditoría.
-- Ejecutar en Supabase (SQL Editor o `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfiles (extiende auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id    uuid primary key references auth.users (id) on delete cascade,
  name  text not null,
  email text not null,
  role  text not null default 'member' check (role in ('ceo', 'leader', 'member')),
  title text,
  created_at timestamptz not null default now()
);

-- ¿El usuario actual es CEO? (usado por las políticas RLS)
create or replace function public.is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ceo'
  );
$$;

-- Al registrarse un usuario, crear su perfil automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Solicitudes de decisión
-- ---------------------------------------------------------------------------
create sequence if not exists public.request_code_seq start 100;

create table if not exists public.requests (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null default ('CD-' || nextval('public.request_code_seq')),
  title            text not null,
  type             text not null check (type in ('read', 'approve', 'sign', 'decide')),
  status           text not null default 'pending'
                     check (status in ('pending','in_review','info_requested','approved','rejected','signed','cancelled')),
  priority         text not null default 'medium' check (priority in ('low','medium','high','urgent')),

  requester_id     uuid not null references public.profiles (id),
  requester_name   text,
  requester_title  text,

  context          text not null,
  recommendation   text not null,
  impact           text not null,

  document_name    text,
  document_url     text,
  document_version text,

  due_date         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Registro interno de la decisión (auditoría / "firma").
  decided_at       timestamptz,
  decided_by_id    uuid references public.profiles (id),
  decided_by_name  text,
  decision_note    text
);

create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_requester_idx on public.requests (requester_id);
create index if not exists requests_due_idx on public.requests (due_date);

-- ---------------------------------------------------------------------------
-- Eventos (historial auditable)
-- ---------------------------------------------------------------------------
create table if not exists public.request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  actor_id    uuid not null references public.profiles (id),
  actor_name  text,
  type        text not null check (type in
                ('created','commented','info_requested','info_provided',
                 'approved','rejected','signed','cancelled','reminder_sent')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists request_events_request_idx on public.request_events (request_id);

-- ---------------------------------------------------------------------------
-- Denormalización de nombres (para lectura simple desde el cliente)
-- ---------------------------------------------------------------------------
create or replace function public.fill_request_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.name, p.title into new.requester_name, new.requester_title
  from public.profiles p where p.id = new.requester_id;

  if new.decided_by_id is not null then
    select p.name into new.decided_by_name
    from public.profiles p where p.id = new.decided_by_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_request_names on public.requests;
create trigger trg_fill_request_names
  before insert or update on public.requests
  for each row execute function public.fill_request_names();

create or replace function public.fill_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.name into new.actor_name
  from public.profiles p where p.id = new.actor_id;
  return new;
end;
$$;

drop trigger if exists trg_fill_event_actor on public.request_events;
create trigger trg_fill_event_actor
  before insert on public.request_events
  for each row execute function public.fill_event_actor();

-- Al crear una solicitud, registrar el evento inicial "created".
create or replace function public.log_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.request_events (request_id, actor_id, type)
  values (new.id, new.requester_id, 'created');
  return new;
end;
$$;

drop trigger if exists trg_log_request_created on public.requests;
create trigger trg_log_request_created
  after insert on public.requests
  for each row execute function public.log_request_created();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Modelo simple para una empresa pequeña: todos los usuarios autenticados ven
-- las solicitudes; cada quien crea las suyas; solo el CEO decide.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.request_events enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

-- requests
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests
  for select to authenticated using (true);

drop policy if exists requests_insert_own on public.requests;
create policy requests_insert_own on public.requests
  for insert to authenticated with check (requester_id = auth.uid());

-- El CEO puede decidir sobre cualquier solicitud; el solicitante puede
-- actualizar la suya (p. ej. responder info / cancelar).
drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests
  for update to authenticated
  using (public.is_ceo() or requester_id = auth.uid());

-- request_events
drop policy if exists events_select on public.request_events;
create policy events_select on public.request_events
  for select to authenticated using (true);

drop policy if exists events_insert on public.request_events;
create policy events_insert on public.request_events
  for insert to authenticated with check (actor_id = auth.uid());
