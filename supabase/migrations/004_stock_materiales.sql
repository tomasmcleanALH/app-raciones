-- ============================================================
-- Stock de materiales: nuevo módulo, completamente separado del
-- de Alimentos/Entregas, para llevar el stock de materiales
-- (rollos de alambre, postes, lo que se necesite) por isleta.
--
-- Además agrega "módulos" por usuario: cada usuario (menos el
-- Dueño, que ve todo) queda habilitado a Alimentos y/o Materiales.
-- Así una persona puede administrar sólo el stock de materiales
-- sin ver nada de alimentos, o viceversa.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002_rol_gerente.sql,
-- 003_campos.sql)
-- ============================================================

-- ------------------------------------------------------------
-- 1) A qué módulo(s) tiene acceso cada usuario. El Dueño no
--    necesita filas acá: bypassea todo vía es_dueno(), igual que
--    ya pasa con usuarios_campos.
-- ------------------------------------------------------------
create table if not exists public.usuarios_modulos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  modulo text not null check (modulo in ('alimentos', 'materiales')),
  primary key (usuario_id, modulo)
);

-- Todo el mundo que ya existe hoy sólo usaba Alimentos: se lo dejamos habilitado.
insert into public.usuarios_modulos (usuario_id, modulo)
  select id, 'alimentos' from public.profiles where rol <> 'dueno'
  on conflict do nothing;

-- ------------------------------------------------------------
-- 2) Isletas (pertenece a un campo) — puntos de acopio de materiales.
-- ------------------------------------------------------------
create table if not exists public.isletas (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 3) Materiales (pertenece a un campo) — catálogo editable, igual
--    formato que "alimentos" pero para este módulo aparte.
-- ------------------------------------------------------------
create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- 4) Movimientos de stock: entrada (ingresó material a la isleta)
--    o salida (se retiró/consumió). El stock actual de cada
--    isleta+material se calcula sumando entradas y restando salidas.
-- ------------------------------------------------------------
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  isleta_id uuid not null references public.isletas (id),
  material_id uuid not null references public.materiales (id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'unidades',
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists movimientos_stock_fecha_idx on public.movimientos_stock (fecha desc);
create index if not exists movimientos_stock_cargado_por_idx on public.movimientos_stock (cargado_por);

-- ------------------------------------------------------------
-- 5) Función auxiliar: ¿tiene el usuario logueado acceso a este módulo?
-- ------------------------------------------------------------
create or replace function public.tiene_acceso_a_modulo(p_modulo text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_modulos
    where usuario_id = auth.uid() and modulo = p_modulo
  );
$$;

-- ------------------------------------------------------------
-- 6) RLS
-- ------------------------------------------------------------
alter table public.usuarios_modulos enable row level security;
alter table public.isletas enable row level security;
alter table public.materiales enable row level security;
alter table public.movimientos_stock enable row level security;

drop policy if exists usuarios_modulos_select on public.usuarios_modulos;
create policy usuarios_modulos_select on public.usuarios_modulos
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin_de_campo((
    select uc.campo_id from public.usuarios_campos uc where uc.usuario_id = usuarios_modulos.usuario_id limit 1
  )));
-- Las escrituras de usuarios_modulos se hacen siempre con la
-- service_role key desde /api/admin/usuarios; no se habilitan por RLS.

-- isletas: todos los del campo Y del módulo Materiales leen; sólo
-- el admin de ese campo (con módulo Materiales) modifica.
drop policy if exists isletas_select on public.isletas;
create policy isletas_select on public.isletas
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'));

drop policy if exists isletas_modificar on public.isletas;
create policy isletas_modificar on public.isletas
  for all to authenticated
  using (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'))
  with check (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'));

-- materiales: mismo esquema que isletas
drop policy if exists materiales_select on public.materiales;
create policy materiales_select on public.materiales
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'));

drop policy if exists materiales_modificar on public.materiales;
create policy materiales_modificar on public.materiales
  for all to authenticated
  using (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'))
  with check (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('materiales'));

-- movimientos_stock: cada usuario ve/crea los suyos; encargado/gerente/dueño
-- del campo de la isleta (con módulo Materiales) ven todos; sólo el
-- admin de ese campo edita/borra.
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
    )
  );

drop policy if exists movimientos_stock_insert on public.movimientos_stock;
create policy movimientos_stock_insert on public.movimientos_stock
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
    and public.tiene_acceso_a_modulo('materiales')
    and exists (select 1 from public.isletas i where i.id = isleta_id and public.tiene_acceso_a_campo(i.campo_id))
  );

drop policy if exists movimientos_stock_update on public.movimientos_stock;
create policy movimientos_stock_update on public.movimientos_stock
  for update to authenticated
  using (exists (
    select 1 from public.isletas i where i.id = movimientos_stock.isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
  ))
  with check (exists (
    select 1 from public.isletas i where i.id = isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
  ));

drop policy if exists movimientos_stock_delete on public.movimientos_stock;
create policy movimientos_stock_delete on public.movimientos_stock
  for delete to authenticated
  using (exists (
    select 1 from public.isletas i where i.id = movimientos_stock.isleta_id
      and public.es_admin_de_campo(i.campo_id) and public.tiene_acceso_a_modulo('materiales')
  ));

-- ------------------------------------------------------------
-- 7) Alimentos/Entregas pasan a requerir también el módulo
--    Alimentos (para que a alguien con sólo Materiales no le
--    aparezca ni se lo pueda consultar por API).
-- ------------------------------------------------------------
drop policy if exists lotes_select on public.lotes;
create policy lotes_select on public.lotes
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'));

drop policy if exists lotes_modificar on public.lotes;
create policy lotes_modificar on public.lotes
  for all to authenticated
  using (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'))
  with check (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'));

drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'));

drop policy if exists alimentos_modificar on public.alimentos;
create policy alimentos_modificar on public.alimentos
  for all to authenticated
  using (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'))
  with check (public.es_admin_de_campo(campo_id) and public.tiene_acceso_a_modulo('alimentos'));

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
    )
  );

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and activo = true)
    and public.tiene_acceso_a_modulo('alimentos')
    and exists (select 1 from public.lotes l where l.id = lote_id and public.tiene_acceso_a_campo(l.campo_id))
  );

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas
  for update to authenticated
  using (exists (
    select 1 from public.lotes l where l.id = entregas.lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
  ))
  with check (exists (
    select 1 from public.lotes l where l.id = lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
  ));

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
  for delete to authenticated
  using (exists (
    select 1 from public.lotes l where l.id = entregas.lote_id
      and public.es_admin_de_campo(l.campo_id) and public.tiene_acceso_a_modulo('alimentos')
  ));
