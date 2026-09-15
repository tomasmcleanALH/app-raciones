-- ============================================================
-- Los módulos (Alimentos / Materiales) ahora también se habilitan
-- por CAMPO, no sólo por usuario. Así el Dueño puede prender el
-- Stock de materiales sólo para el campo que corresponda (ej.
-- "Las Isletas") sin que aparezca en los demás (ej. "San Jorge").
--
-- El acceso final de una persona a un módulo, en un campo dado, es
-- la intersección de las dos cosas: que ESA PERSONA tenga el
-- módulo habilitado (usuarios_modulos) Y que ESE CAMPO lo tenga
-- habilitado (campo_modulos).
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002, 003, 004)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Qué módulo(s) tiene habilitados cada campo.
-- ------------------------------------------------------------
create table if not exists public.campo_modulos (
  campo_id uuid not null references public.campos (id) on delete cascade,
  modulo text not null check (modulo in ('alimentos', 'materiales')),
  primary key (campo_id, modulo)
);

-- Alimentos queda habilitado en todos los campos que ya existen (ningún
-- cambio de comportamiento ahí). Materiales sólo se habilita para el
-- campo "Las Isletas", que es donde se va a usar el Stock de materiales.
insert into public.campo_modulos (campo_id, modulo)
  select id, 'alimentos' from public.campos
  on conflict do nothing;

insert into public.campo_modulos (campo_id, modulo)
  select id, 'materiales' from public.campos where nombre = 'Las Isletas'
  on conflict do nothing;

-- ------------------------------------------------------------
-- 2) Función auxiliar: ¿tiene este campo habilitado tal módulo?
-- ------------------------------------------------------------
create or replace function public.campo_tiene_modulo(p_campo_id uuid, p_modulo text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.campo_modulos where campo_id = p_campo_id and modulo = p_modulo
  );
$$;

-- ------------------------------------------------------------
-- 3) RLS: campo_modulos
-- ------------------------------------------------------------
alter table public.campo_modulos enable row level security;

drop policy if exists campo_modulos_select on public.campo_modulos;
create policy campo_modulos_select on public.campo_modulos
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id));

drop policy if exists campo_modulos_modificar on public.campo_modulos;
create policy campo_modulos_modificar on public.campo_modulos
  for all to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- ------------------------------------------------------------
-- 4) Lotes/alimentos/entregas: ahora también exigen que el CAMPO
--    (no sólo el usuario) tenga habilitado el módulo Alimentos.
-- ------------------------------------------------------------
drop policy if exists lotes_select on public.lotes;
create policy lotes_select on public.lotes
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists lotes_modificar on public.lotes;
create policy lotes_modificar on public.lotes
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

drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('alimentos')
    and public.campo_tiene_modulo(campo_id, 'alimentos')
  );

drop policy if exists alimentos_modificar on public.alimentos;
create policy alimentos_modificar on public.alimentos
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

drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or exists (
      select 1 from public.lotes l
      where l.id = entregas.lote_id
        and public.puede_ver_todo_el_campo(l.campo_id)
        and public.tiene_acceso_a_modulo('alimentos')
        and public.campo_tiene_modulo(l.campo_id, 'alimentos')
    )
  );

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
    and public.tiene_acceso_a_modulo('alimentos')
    and exists (
      select 1 from public.lotes l
      where l.id = lote_id and public.tiene_acceso_a_campo(l.campo_id) and public.campo_tiene_modulo(l.campo_id, 'alimentos')
    )
  );

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas
  for update to authenticated
  using (exists (
    select 1 from public.lotes l where l.id = entregas.lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(l.campo_id, 'alimentos')
  ))
  with check (exists (
    select 1 from public.lotes l where l.id = lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(l.campo_id, 'alimentos')
  ));

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
  for delete to authenticated
  using (exists (
    select 1 from public.lotes l where l.id = entregas.lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
      and public.campo_tiene_modulo(l.campo_id, 'alimentos')
  ));

-- ------------------------------------------------------------
-- 5) Isletas/materiales/movimientos_stock: ídem, ahora también
--    exigen que el CAMPO tenga habilitado el módulo Materiales.
-- ------------------------------------------------------------
drop policy if exists isletas_select on public.isletas;
create policy isletas_select on public.isletas
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists isletas_modificar on public.isletas;
create policy isletas_modificar on public.isletas
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

drop policy if exists materiales_select on public.materiales;
create policy materiales_select on public.materiales
  for select to authenticated
  using (
    public.tiene_acceso_a_campo(campo_id)
    and public.tiene_acceso_a_modulo('materiales')
    and public.campo_tiene_modulo(campo_id, 'materiales')
  );

drop policy if exists materiales_modificar on public.materiales;
create policy materiales_modificar on public.materiales
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

drop policy if exists movimientos_stock_select on public.movimientos_stock;
create policy movimientos_stock_select on public.movimientos_stock
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or exists (
      select 1 from public.isletas i
      where i.id = movimientos_stock.isleta_id
        and public.puede_ver_todo_el_campo(i.campo_id)
        and public.tiene_acceso_a_modulo('materiales')
        and public.campo_tiene_modulo(i.campo_id, 'materiales')
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
      select 1 from public.isletas i
      where i.id = isleta_id and public.tiene_acceso_a_campo(i.campo_id) and public.campo_tiene_modulo(i.campo_id, 'materiales')
    )
  );

drop policy if exists movimientos_stock_update on public.movimientos_stock;
create policy movimientos_stock_update on public.movimientos_stock
  for update to authenticated
  using (exists (
    select 1 from public.isletas i where i.id = movimientos_stock.isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(i.campo_id, 'materiales')
  ))
  with check (exists (
    select 1 from public.isletas i where i.id = isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(i.campo_id, 'materiales')
  ));

drop policy if exists movimientos_stock_delete on public.movimientos_stock;
create policy movimientos_stock_delete on public.movimientos_stock
  for delete to authenticated
  using (exists (
    select 1 from public.isletas i where i.id = movimientos_stock.isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
      and public.campo_tiene_modulo(i.campo_id, 'materiales')
  ));
