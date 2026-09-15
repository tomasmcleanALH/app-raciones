-- ============================================================
-- Módulo Materiales: se agregan Proveedores, Contratistas y una
-- lista de Lotes propia (separada de la de Alimentos, a propósito:
-- no se mezclan). Se registran en las Entradas/Salidas de stock:
--   - Entrada: se carga el Proveedor.
--   - Salida: se cargan el Contratista y el Lote destino.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002, 003, 004, 005, 006)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Catálogos nuevos, mismo formato que "materiales".
-- ------------------------------------------------------------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table if not exists public.contratistas (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- Lista de lotes PROPIA del módulo Materiales (no la de Alimentos).
create table if not exists public.lotes_materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 2) movimientos_stock: nuevas columnas + una regla que exige
--    justo lo que corresponde según el tipo de movimiento.
-- ------------------------------------------------------------
alter table public.movimientos_stock add column if not exists proveedor_id uuid references public.proveedores (id);
alter table public.movimientos_stock add column if not exists contratista_id uuid references public.contratistas (id);
alter table public.movimientos_stock add column if not exists lote_material_id uuid references public.lotes_materiales (id);

alter table public.movimientos_stock drop constraint if exists movimientos_stock_campos_por_tipo;
alter table public.movimientos_stock add constraint movimientos_stock_campos_por_tipo check (
  (tipo = 'entrada' and proveedor_id is not null and contratista_id is null and lote_material_id is null)
  or
  (tipo = 'salida' and contratista_id is not null and lote_material_id is not null and proveedor_id is null)
);

-- ------------------------------------------------------------
-- 3) RLS: mismo esquema que "materiales" para los 3 catálogos
--    nuevos (requieren módulo Materiales, del usuario Y del campo).
-- ------------------------------------------------------------
alter table public.proveedores enable row level security;
alter table public.contratistas enable row level security;
alter table public.lotes_materiales enable row level security;

drop policy if exists proveedores_select on public.proveedores;
create policy proveedores_select on public.proveedores
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists proveedores_modificar on public.proveedores;
create policy proveedores_modificar on public.proveedores
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

drop policy if exists contratistas_select on public.contratistas;
create policy contratistas_select on public.contratistas
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists contratistas_modificar on public.contratistas;
create policy contratistas_modificar on public.contratistas
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

drop policy if exists lotes_materiales_select on public.lotes_materiales;
create policy lotes_materiales_select on public.lotes_materiales
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists lotes_materiales_modificar on public.lotes_materiales;
create policy lotes_materiales_modificar on public.lotes_materiales
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
