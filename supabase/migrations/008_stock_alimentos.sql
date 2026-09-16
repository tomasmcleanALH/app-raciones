-- ============================================================
-- Módulo Alimentos: stock real. Se agrega Proveedores (propio de
-- Alimentos, separado del de Materiales) y Entradas de alimento
-- (compras/llegadas). Las entregas que ya existen NO se tocan: son
-- las salidas de siempre, con toda su lógica intacta (offline
-- incluido). El stock disponible se calcula: entradas - entregas.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 007)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Proveedores de Alimentos (catálogo propio, separado del de
--    Materiales -- a propósito, no se mezclan).
-- ------------------------------------------------------------
create table if not exists public.proveedores_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 2) Entradas de alimento (compra/llegada). El Proveedor es
--    opcional. No pide lote: un alimento que entra todavía no
--    tiene destino.
-- ------------------------------------------------------------
create table if not exists public.entradas_alimentos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  alimento_id uuid not null references public.alimentos (id),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'kg',
  proveedor_id uuid references public.proveedores_alimentos (id),
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists entradas_alimentos_fecha_idx on public.entradas_alimentos (fecha desc);
create index if not exists entradas_alimentos_cargado_por_idx on public.entradas_alimentos (cargado_por);

-- ------------------------------------------------------------
-- 3) RLS: proveedores_alimentos, mismo esquema que el resto de
--    los catálogos (requiere módulo Alimentos del usuario Y del campo).
-- ------------------------------------------------------------
alter table public.proveedores_alimentos enable row level security;

drop policy if exists proveedores_alimentos_select on public.proveedores_alimentos;
create policy proveedores_alimentos_select on public.proveedores_alimentos
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists proveedores_alimentos_modificar on public.proveedores_alimentos;
create policy proveedores_alimentos_modificar on public.proveedores_alimentos
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
-- 4) RLS: entradas_alimentos. A diferencia de las entregas (que
--    puede cargar cualquiera con el módulo), acá sólo el
--    administrador/dueño del campo -- "lo maneja el administrador".
-- ------------------------------------------------------------
alter table public.entradas_alimentos enable row level security;

drop policy if exists entradas_alimentos_select on public.entradas_alimentos;
create policy entradas_alimentos_select on public.entradas_alimentos
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or exists (
      select 1 from public.alimentos a
      where a.id = entradas_alimentos.alimento_id
        and public.puede_ver_todo_el_campo(a.campo_id)
        and public.tiene_acceso_a_modulo('alimentos')
        and public.campo_tiene_modulo(a.campo_id, 'alimentos')
    )
  );

drop policy if exists entradas_alimentos_insert on public.entradas_alimentos;
create policy entradas_alimentos_insert on public.entradas_alimentos
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (
      select 1 from public.alimentos a
      where a.id = alimento_id
        and public.es_admin_de_campo(a.campo_id)
        and public.tiene_acceso_a_modulo('alimentos')
        and public.campo_tiene_modulo(a.campo_id, 'alimentos')
    )
  );

drop policy if exists entradas_alimentos_update on public.entradas_alimentos;
create policy entradas_alimentos_update on public.entradas_alimentos
  for update to authenticated
  using (exists (
    select 1 from public.alimentos a where a.id = entradas_alimentos.alimento_id
      and public.es_admin_de_campo(a.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(a.campo_id, 'alimentos')
  ))
  with check (exists (
    select 1 from public.alimentos a where a.id = alimento_id
      and public.es_admin_de_campo(a.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(a.campo_id, 'alimentos')
  ));

drop policy if exists entradas_alimentos_delete on public.entradas_alimentos;
create policy entradas_alimentos_delete on public.entradas_alimentos
  for delete to authenticated
  using (exists (
    select 1 from public.alimentos a where a.id = entradas_alimentos.alimento_id
      and public.es_admin_de_campo(a.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(a.campo_id, 'alimentos')
  ));
