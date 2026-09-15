-- ============================================================
-- Se saca el concepto de "isleta" del módulo de Stock de
-- materiales: no hacía falta un destino separado (como sí lo es
-- el lote en Alimentos), así que los movimientos de stock quedan
-- ligados directo al material (y, a través de él, al campo).
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002, 003, 004, 005)
-- ============================================================

-- ------------------------------------------------------------
-- 1) movimientos_stock: las políticas de RLS pasan a mirar el
--    campo del MATERIAL en vez del de la isleta.
-- ------------------------------------------------------------
drop policy if exists movimientos_stock_select on public.movimientos_stock;
create policy movimientos_stock_select on public.movimientos_stock
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or exists (
      select 1 from public.materiales m
      where m.id = movimientos_stock.material_id
        and public.puede_ver_todo_el_campo(m.campo_id)
        and public.tiene_acceso_a_modulo('materiales')
        and public.campo_tiene_modulo(m.campo_id, 'materiales')
    )
  );

drop policy if exists movimientos_stock_insert on public.movimientos_stock;
create policy movimientos_stock_insert on public.movimientos_stock
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
    and public.tiene_acceso_a_modulo('materiales')
    and exists (
      select 1 from public.materiales m
      where m.id = material_id and public.tiene_acceso_a_campo(m.campo_id) and public.campo_tiene_modulo(m.campo_id, 'materiales')
    )
  );

drop policy if exists movimientos_stock_update on public.movimientos_stock;
create policy movimientos_stock_update on public.movimientos_stock
  for update to authenticated
  using (exists (
    select 1 from public.materiales m where m.id = movimientos_stock.material_id
      and public.es_admin_de_campo(m.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(m.campo_id, 'materiales')
  ))
  with check (exists (
    select 1 from public.materiales m where m.id = material_id
      and public.es_admin_de_campo(m.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(m.campo_id, 'materiales')
  ));

drop policy if exists movimientos_stock_delete on public.movimientos_stock;
create policy movimientos_stock_delete on public.movimientos_stock
  for delete to authenticated
  using (exists (
    select 1 from public.materiales m where m.id = movimientos_stock.material_id
      and public.es_admin_de_campo(m.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(m.campo_id, 'materiales')
  ));

-- ------------------------------------------------------------
-- 2) Saca la columna isleta_id (con su llave foránea) de
--    movimientos_stock, y borra la tabla isletas (que ya nadie
--    referencia).
-- ------------------------------------------------------------
alter table public.movimientos_stock drop column if exists isleta_id;
drop table if exists public.isletas;
