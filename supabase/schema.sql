-- ============================================================
-- App Raciones - esquema de base de datos
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabla: profiles (datos de cada usuario, ligada a auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol text not null default 'tractorista' check (rol in ('tractorista', 'encargado')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: lotes
-- ------------------------------------------------------------
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: alimentos
-- ------------------------------------------------------------
create table if not exists public.alimentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: entregas
-- client_id: generado en el celular al crear la entrega (incluso offline).
--   Sirve para no duplicar si se reintenta el envío al recuperar señal.
-- ------------------------------------------------------------
create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  fecha_entrega date not null,
  lote_id uuid not null references public.lotes (id),
  alimento_id uuid not null references public.alimentos (id),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'kg',
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists entregas_fecha_idx on public.entregas (fecha_entrega desc);
create index if not exists entregas_cargado_por_idx on public.entregas (cargado_por);

-- ------------------------------------------------------------
-- Función auxiliar: ¿el usuario logueado tiene tal rol?
-- security definer = se ejecuta saltando RLS de profiles,
-- para evitar recursión infinita en las políticas.
-- ------------------------------------------------------------
create or replace function public.tiene_rol(rol_buscado text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = rol_buscado and activo = true
  );
$$;

-- ------------------------------------------------------------
-- Trigger: al crear un usuario en auth.users, crear su perfil
-- (rol/nombre reales los completa el panel de administración
-- con la service_role key; esto es sólo una red de seguridad)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'tractorista')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS (seguridad a nivel de fila)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.lotes enable row level security;
alter table public.alimentos enable row level security;
alter table public.entregas enable row level security;

-- profiles: cualquier usuario logueado puede leer todos los perfiles
-- (se necesita para mostrar "cargado por" en la grilla), pero sólo
-- puede editar su propio nombre, nunca su propio rol.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_propio on public.profiles;
create policy profiles_update_propio on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.profiles where id = auth.uid()));

-- lotes: todos los logueados leen; sólo encargado modifica
drop policy if exists lotes_select on public.lotes;
create policy lotes_select on public.lotes
  for select to authenticated using (true);

drop policy if exists lotes_modificar on public.lotes;
create policy lotes_modificar on public.lotes
  for all to authenticated
  using (public.tiene_rol('encargado'))
  with check (public.tiene_rol('encargado'));

-- alimentos: todos los logueados leen; sólo encargado modifica
drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos
  for select to authenticated using (true);

drop policy if exists alimentos_modificar on public.alimentos;
create policy alimentos_modificar on public.alimentos
  for all to authenticated
  using (public.tiene_rol('encargado'))
  with check (public.tiene_rol('encargado'));

-- entregas: cada tractorista ve/crea las suyas; encargado ve/edita todas
drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas
  for select to authenticated
  using (cargado_por = auth.uid() or public.tiene_rol('encargado'));

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
  );

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas
  for update to authenticated
  using (public.tiene_rol('encargado'))
  with check (public.tiene_rol('encargado'));

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
  for delete to authenticated
  using (public.tiene_rol('encargado'));

-- ------------------------------------------------------------
-- Datos de ejemplo (opcional). Comentar/borrar si no se quiere.
-- ------------------------------------------------------------
-- insert into public.lotes (nombre) values ('Lote 1'), ('Lote 2'), ('Recría A');
-- insert into public.alimentos (nombre) values ('Silo de maíz'), ('Ración balanceada'), ('Heno de alfalfa');
