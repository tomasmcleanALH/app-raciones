-- ============================================================
-- Multi-campo: agrega la entidad "Campo" (San Jorge, y los que se
-- sumen despues), un cuarto rol "dueno" que ve y administra TODO sin
-- restriccion, y acota "encargado" (Administrador), "gerente" y
-- "tractorista" (Usuario) al campo al que pertenecen.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002_rol_gerente.sql)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla de campos
-- ------------------------------------------------------------
create table if not exists public.campos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) A que campo(s) pertenece cada usuario. Hoy se usa de a uno
--    (una fila por usuario), pero queda armado para soportar varios
--    campos por usuario en el futuro sin tener que migrar de nuevo.
-- ------------------------------------------------------------
create table if not exists public.usuarios_campos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  campo_id uuid not null references public.campos (id) on delete cascade,
  primary key (usuario_id, campo_id)
);

-- ------------------------------------------------------------
-- 3) Nuevo rol "dueno"
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('tractorista', 'encargado', 'gerente', 'dueno'));

-- ------------------------------------------------------------
-- 4) Lotes y alimentos pasan a pertenecer a un campo
-- ------------------------------------------------------------
alter table public.lotes add column if not exists campo_id uuid references public.campos (id);
alter table public.alimentos add column if not exists campo_id uuid references public.campos (id);

-- ------------------------------------------------------------
-- 5) Migración de los datos que ya existen: todo pasa a "San Jorge"
-- ------------------------------------------------------------
insert into public.campos (nombre) values ('San Jorge')
  on conflict (nombre) do nothing;

update public.lotes
  set campo_id = (select id from public.campos where nombre = 'San Jorge')
  where campo_id is null;

update public.alimentos
  set campo_id = (select id from public.campos where nombre = 'San Jorge')
  where campo_id is null;

insert into public.usuarios_campos (usuario_id, campo_id)
  select p.id, (select id from public.campos where nombre = 'San Jorge')
  from public.profiles p
  where p.rol <> 'dueno'
  on conflict do nothing;

-- Tomas Mclean pasa a ser Dueño (ajustar el mail si hace falta)
update public.profiles set rol = 'dueno'
  where id = (select id from auth.users where email = 'tomas.mclean@lashelenas.com.ar');

-- ------------------------------------------------------------
-- 6) Ya migrados los datos, campo_id pasa a ser obligatorio
-- ------------------------------------------------------------
alter table public.lotes alter column campo_id set not null;
alter table public.alimentos alter column campo_id set not null;

-- ------------------------------------------------------------
-- 7) Funciones auxiliares (security definer: saltan RLS al
--    consultar profiles/usuarios_campos, para evitar recursión)
-- ------------------------------------------------------------
create or replace function public.es_dueno()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'dueno' and activo = true
  );
$$;

-- ¿Pertenece el usuario logueado a este campo (cualquier rol)?
create or replace function public.tiene_acceso_a_campo(p_campo_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_campos
    where usuario_id = auth.uid() and campo_id = p_campo_id
  );
$$;

-- ¿Es administrador (o dueño) de este campo puntual?
create or replace function public.es_admin_de_campo(p_campo_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_campos uc
    join public.profiles p on p.id = uc.usuario_id
    where uc.usuario_id = auth.uid() and uc.campo_id = p_campo_id
      and p.rol = 'encargado' and p.activo = true
  );
$$;

-- ¿Puede ver todas las entregas de este campo (no sólo las propias)?
create or replace function public.puede_ver_todo_el_campo(p_campo_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_campos uc
    join public.profiles p on p.id = uc.usuario_id
    where uc.usuario_id = auth.uid() and uc.campo_id = p_campo_id
      and p.rol in ('encargado', 'gerente') and p.activo = true
  );
$$;

-- ¿Comparte al menos un campo con este otro usuario? (para poder ver
-- su nombre, ej. "Cargado por", y para que un admin gestione su gente)
create or replace function public.comparte_campo_con(p_usuario_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_campos a
    join public.usuarios_campos b on a.campo_id = b.campo_id
    where a.usuario_id = auth.uid() and b.usuario_id = p_usuario_id
  );
$$;

-- ------------------------------------------------------------
-- 8) RLS: campos / usuarios_campos
-- ------------------------------------------------------------
alter table public.campos enable row level security;
alter table public.usuarios_campos enable row level security;

drop policy if exists campos_select on public.campos;
create policy campos_select on public.campos
  for select to authenticated using (public.tiene_acceso_a_campo(id));

drop policy if exists campos_modificar on public.campos;
create policy campos_modificar on public.campos
  for all to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

drop policy if exists usuarios_campos_select on public.usuarios_campos;
create policy usuarios_campos_select on public.usuarios_campos
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin_de_campo(campo_id));
-- Las escrituras de usuarios_campos se hacen siempre con la
-- service_role key desde /api/admin/usuarios; no se habilitan por RLS.

-- ------------------------------------------------------------
-- 9) RLS: profiles (reemplaza "todos ven todo")
-- ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.comparte_campo_con(id));

-- ------------------------------------------------------------
-- 10) RLS: lotes / alimentos, ahora por campo
-- ------------------------------------------------------------
drop policy if exists lotes_select on public.lotes;
create policy lotes_select on public.lotes
  for select to authenticated using (public.tiene_acceso_a_campo(campo_id));

drop policy if exists lotes_modificar on public.lotes;
create policy lotes_modificar on public.lotes
  for all to authenticated
  using (public.es_admin_de_campo(campo_id))
  with check (public.es_admin_de_campo(campo_id));

drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos
  for select to authenticated using (public.tiene_acceso_a_campo(campo_id));

drop policy if exists alimentos_modificar on public.alimentos;
create policy alimentos_modificar on public.alimentos
  for all to authenticated
  using (public.es_admin_de_campo(campo_id))
  with check (public.es_admin_de_campo(campo_id));

-- ------------------------------------------------------------
-- 11) RLS: entregas, ahora a través del campo de su lote
-- ------------------------------------------------------------
drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or exists (
      select 1 from public.lotes l
      where l.id = entregas.lote_id and public.puede_ver_todo_el_campo(l.campo_id)
    )
  );

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
    and exists (select 1 from public.lotes l where l.id = lote_id and public.tiene_acceso_a_campo(l.campo_id))
  );

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas
  for update to authenticated
  using (exists (select 1 from public.lotes l where l.id = entregas.lote_id and public.es_admin_de_campo(l.campo_id)))
  with check (exists (select 1 from public.lotes l where l.id = lote_id and public.es_admin_de_campo(l.campo_id)));

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
  for delete to authenticated
  using (exists (select 1 from public.lotes l where l.id = entregas.lote_id and public.es_admin_de_campo(l.campo_id)));
