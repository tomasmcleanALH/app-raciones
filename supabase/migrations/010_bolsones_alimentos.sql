-- ============================================================
-- Alimentos: Bolsones (sub-ubicación opcional dentro de una
-- ubicación; ej. "Bolsón 5" guardado en la ubicación "12").
-- Antes vivían mezclados en ubicaciones_alimentos como filas
-- "BOLSON N": este script los saca de ahí a su propio catálogo.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 009)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Catálogo de Bolsones (mismo esquema que ubicaciones_alimentos).
-- ------------------------------------------------------------
create table if not exists public.bolsones_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 2) Columna nueva, opcional (a diferencia de ubicacion_id, acá
--    no todo movimiento tiene un bolsón asociado).
-- ------------------------------------------------------------
alter table public.entradas_alimentos add column if not exists bolson_id uuid references public.bolsones_alimentos (id);
alter table public.entregas add column if not exists bolson_id uuid references public.bolsones_alimentos (id);

-- ------------------------------------------------------------
-- 3) Migrar las filas "BOLSON ..." que ya estaban cargadas como
--    ubicación: pasan a bolsones_alimentos y se borran de
--    ubicaciones_alimentos. Si algún movimiento ya las usaba como
--    ubicacion_id, se les completa el bolson_id correspondiente y
--    se limpia el ubicacion_id (no sabemos a qué ubicación real
--    pertenecía, así que queda para completar a mano si hace falta).
-- ------------------------------------------------------------
insert into public.bolsones_alimentos (campo_id, nombre)
select campo_id, nombre
from public.ubicaciones_alimentos
where nombre ilike 'bolson %' or nombre ilike 'bolsón %'
on conflict (campo_id, nombre) do nothing;

update public.entradas_alimentos e
set bolson_id = b.id, ubicacion_id = null
from public.ubicaciones_alimentos u
join public.bolsones_alimentos b
  on b.campo_id = u.campo_id and b.nombre = u.nombre
where e.ubicacion_id = u.id
  and (u.nombre ilike 'bolson %' or u.nombre ilike 'bolsón %');

update public.entregas e
set bolson_id = b.id, ubicacion_id = null
from public.ubicaciones_alimentos u
join public.bolsones_alimentos b
  on b.campo_id = u.campo_id and b.nombre = u.nombre
where e.ubicacion_id = u.id
  and (u.nombre ilike 'bolson %' or u.nombre ilike 'bolsón %');

delete from public.ubicaciones_alimentos
where nombre ilike 'bolson %' or nombre ilike 'bolsón %';

-- ------------------------------------------------------------
-- 4) RLS: mismo esquema que ubicaciones_alimentos.
-- ------------------------------------------------------------
alter table public.bolsones_alimentos enable row level security;

drop policy if exists bolsones_alimentos_select on public.bolsones_alimentos;
create policy bolsones_alimentos_select on public.bolsones_alimentos
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists bolsones_alimentos_modificar on public.bolsones_alimentos;
create policy bolsones_alimentos_modificar on public.bolsones_alimentos
  for all to authenticated
  using (
    public.es_admin_de_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  )
  with check (
    public.es_admin_de_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );
