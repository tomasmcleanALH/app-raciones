-- ============================================================
-- Alimentos: Ubicaciones (dónde está guardado el stock) y
-- Categorías (cómo se agrupa la vista de Stock disponible).
-- Materiales: Categorías (mismo concepto, sin ubicación).
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 008)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Ubicaciones de Alimentos (catálogo propio del módulo).
-- ------------------------------------------------------------
create table if not exists public.ubicaciones_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 2) Categorías de Alimentos y de Materiales (catálogos propios
--    de cada módulo, para agrupar la vista de Stock disponible).
-- ------------------------------------------------------------
create table if not exists public.categorias_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table if not exists public.categorias_materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 3) Columnas nuevas. Nullable a propósito: los movimientos ya
--    cargados en producción quedan sin ubicación/categoría hasta
--    que se editen; el formulario de carga sí las va a pedir.
-- ------------------------------------------------------------
alter table public.alimentos add column if not exists categoria_id uuid references public.categorias_alimentos (id);
alter table public.materiales add column if not exists categoria_id uuid references public.categorias_materiales (id);
alter table public.entradas_alimentos add column if not exists ubicacion_id uuid references public.ubicaciones_alimentos (id);
alter table public.entregas add column if not exists ubicacion_id uuid references public.ubicaciones_alimentos (id);

-- ------------------------------------------------------------
-- 4) Categorías por defecto, para no arrancar de cero en ningún
--    campo ya creado (se pueden renombrar/agregar más después).
-- ------------------------------------------------------------
insert into public.categorias_alimentos (campo_id, nombre)
select c.id, n.nombre
from public.campos c
cross join (values ('Granos en bolsones'), ('Rollos'), ('Insumos'), ('Otros')) as n (nombre)
on conflict (campo_id, nombre) do nothing;

insert into public.categorias_materiales (campo_id, nombre)
select c.id, n.nombre
from public.campos c
cross join (values ('Alambres'), ('Postes'), ('Otros')) as n (nombre)
on conflict (campo_id, nombre) do nothing;

-- ------------------------------------------------------------
-- 5) RLS: ubicaciones_alimentos y categorias_alimentos, mismo
--    esquema que proveedores_alimentos (requieren módulo
--    Alimentos del usuario Y del campo).
-- ------------------------------------------------------------
alter table public.ubicaciones_alimentos enable row level security;
alter table public.categorias_alimentos enable row level security;
alter table public.categorias_materiales enable row level security;

drop policy if exists ubicaciones_alimentos_select on public.ubicaciones_alimentos;
create policy ubicaciones_alimentos_select on public.ubicaciones_alimentos
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists ubicaciones_alimentos_modificar on public.ubicaciones_alimentos;
create policy ubicaciones_alimentos_modificar on public.ubicaciones_alimentos
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

drop policy if exists categorias_alimentos_select on public.categorias_alimentos;
create policy categorias_alimentos_select on public.categorias_alimentos
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists categorias_alimentos_modificar on public.categorias_alimentos;
create policy categorias_alimentos_modificar on public.categorias_alimentos
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

-- ------------------------------------------------------------
-- 6) RLS: categorias_materiales, mismo esquema que proveedores
--    (módulo Materiales).
-- ------------------------------------------------------------
drop policy if exists categorias_materiales_select on public.categorias_materiales;
create policy categorias_materiales_select on public.categorias_materiales
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists categorias_materiales_modificar on public.categorias_materiales;
create policy categorias_materiales_modificar on public.categorias_materiales
  for all to authenticated
  using (
    public.es_admin_de_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  )
  with check (
    public.es_admin_de_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );
