-- ============================================================
-- Operaciones - esquema de base de datos
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
--
-- Para un proyecto que YA tiene datos cargados con una versión
-- anterior de este esquema, no correr este archivo: usar en cambio
-- los scripts de supabase/migrations/ en orden.
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabla: profiles (datos de cada usuario, ligada a auth.users)
-- rol "dueno": ve y administra todo, sin importar el campo.
-- Los demás roles están acotados al campo (o campos) al que
-- pertenecen, ver tabla usuarios_campos más abajo.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol text not null default 'tractorista' check (rol in ('tractorista', 'encargado', 'gerente', 'dueno')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: campos (establecimientos: "San Jorge", etc.)
-- ------------------------------------------------------------
create table if not exists public.campos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: usuarios_campos (a qué campo pertenece cada usuario).
-- Hoy se usa de a uno (una fila por usuario), pero queda armada
-- para soportar varios campos por usuario en el futuro.
-- ------------------------------------------------------------
create table if not exists public.usuarios_campos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  campo_id uuid not null references public.campos (id) on delete cascade,
  primary key (usuario_id, campo_id)
);

-- ------------------------------------------------------------
-- Tabla: usuarios_modulos (a qué módulo(s) tiene acceso cada
-- usuario: "alimentos", "materiales", o ambos). El Dueño no
-- necesita filas acá: bypassea todo vía es_dueno().
-- Así una persona puede administrar sólo el stock de materiales
-- sin ver nada de alimentos, o viceversa.
-- ------------------------------------------------------------
create table if not exists public.usuarios_modulos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  modulo text not null check (modulo in ('alimentos', 'materiales')),
  primary key (usuario_id, modulo)
);

-- ------------------------------------------------------------
-- Tabla: campo_modulos (qué módulo(s) tiene habilitados cada
-- campo). El acceso final de una persona a un módulo, en un campo
-- dado, es la intersección de usuarios_modulos Y campo_modulos:
-- así el Dueño puede prender el Stock de materiales sólo para el
-- campo que corresponda, sin que aparezca en los demás.
-- ------------------------------------------------------------
create table if not exists public.campo_modulos (
  campo_id uuid not null references public.campos (id) on delete cascade,
  modulo text not null check (modulo in ('alimentos', 'materiales')),
  primary key (campo_id, modulo)
);

-- ------------------------------------------------------------
-- Tabla: lotes (pertenece a un campo)
-- ------------------------------------------------------------
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- Categorías de Alimentos (para agrupar la vista de Stock
-- disponible) y Ubicaciones de Alimentos (dónde está guardado
-- el stock: el mismo alimento puede estar repartido en varios
-- lugares del campo).
-- ------------------------------------------------------------
create table if not exists public.categorias_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table if not exists public.ubicaciones_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- Bolsones: sub-ubicación opcional dentro de una ubicación
-- (ej. "Bolsón 5" guardado en la ubicación "12").
create table if not exists public.bolsones_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- Tabla: alimentos (pertenece a un campo)
-- ------------------------------------------------------------
create table if not exists public.alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  categoria_id uuid references public.categorias_alimentos (id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- ------------------------------------------------------------
-- Tabla: entregas
-- client_id: generado en el celular al crear la entrega (incluso offline).
--   Sirve para no duplicar si se reintenta el envío al recuperar señal.
-- El campo de la entrega es el campo de su lote (no se repite acá).
-- ------------------------------------------------------------
create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  fecha_entrega date not null,
  lote_id uuid not null references public.lotes (id),
  alimento_id uuid not null references public.alimentos (id),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'kg',
  ubicacion_id uuid references public.ubicaciones_alimentos (id),
  bolson_id uuid references public.bolsones_alimentos (id),
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists entregas_fecha_idx on public.entregas (fecha_entrega desc);
create index if not exists entregas_cargado_por_idx on public.entregas (cargado_por);

-- ------------------------------------------------------------
-- Proveedores de Alimentos (catálogo propio, separado del de
-- Materiales) y Entradas de alimento (compra/llegada, Proveedor
-- opcional, sin lote -- no tiene destino todavía). El stock
-- disponible de un alimento se calcula: entradas - entregas.
-- ------------------------------------------------------------
create table if not exists public.proveedores_alimentos (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table if not exists public.entradas_alimentos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  alimento_id uuid not null references public.alimentos (id),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'kg',
  proveedor_id uuid references public.proveedores_alimentos (id),
  ubicacion_id uuid references public.ubicaciones_alimentos (id),
  bolson_id uuid references public.bolsones_alimentos (id),
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists entradas_alimentos_fecha_idx on public.entradas_alimentos (fecha desc);
create index if not exists entradas_alimentos_cargado_por_idx on public.entradas_alimentos (cargado_por);

-- ------------------------------------------------------------
-- Módulo aparte: Stock de materiales (rollos de alambre, postes,
-- lo que se necesite). No se mezcla con Alimentos: cada usuario
-- necesita el módulo "materiales" (ver usuarios_modulos más
-- arriba) para ver o tocar esto.
-- ------------------------------------------------------------
create table if not exists public.categorias_materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

create table if not exists public.materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  categoria_id uuid references public.categorias_materiales (id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- Proveedores (de quién entra el material) y Contratistas (a quién
-- se le entrega en una salida), y una lista de Lotes PROPIA del
-- módulo Materiales -- separada a propósito de la de Alimentos.
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

create table if not exists public.lotes_materiales (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null references public.campos (id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campo_id, nombre)
);

-- Entrada (ingresó material, de un Proveedor) o salida (se retiró/
-- consumió, para un Contratista en un Lote destino). El stock
-- disponible de cada material se calcula sumando entradas y
-- restando salidas.
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  -- Generado en el celular al crear el movimiento (incluso offline).
  -- Sirve para no duplicar si se reintenta el envío al recuperar señal.
  client_id uuid,
  fecha date not null,
  material_id uuid not null references public.materiales (id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad numeric(10, 2) not null check (cantidad > 0),
  unidad text not null default 'unidades',
  proveedor_id uuid references public.proveedores (id),
  contratista_id uuid references public.contratistas (id),
  lote_material_id uuid references public.lotes_materiales (id),
  observaciones text,
  cargado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint movimientos_stock_campos_por_tipo check (
    (tipo = 'entrada' and proveedor_id is not null and contratista_id is null and lote_material_id is null)
    or
    (tipo = 'salida' and contratista_id is not null and lote_material_id is not null and proveedor_id is null)
  )
);

create index if not exists movimientos_stock_fecha_idx on public.movimientos_stock (fecha desc);
-- Único común (no parcial): hace falta así para que sirva de arbiter
-- del "ON CONFLICT" que usa la sincronización offline. Los movimientos
-- ya cargados antes de tener client_id quedan en null, y Postgres
-- permite varios null en un índice único sin problema.
create unique index if not exists movimientos_stock_client_id_key
  on public.movimientos_stock (client_id);
create index if not exists movimientos_stock_cargado_por_idx on public.movimientos_stock (cargado_por);

-- ------------------------------------------------------------
-- Funciones auxiliares (security definer: saltan RLS al consultar
-- profiles/usuarios_campos, para evitar recursión infinita)
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

-- ¿Tiene el usuario logueado acceso a este módulo ("alimentos" o
-- "materiales")? El Dueño siempre tiene acceso a todos.
create or replace function public.tiene_acceso_a_modulo(p_modulo text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.es_dueno() or exists (
    select 1 from public.usuarios_modulos
    where usuario_id = auth.uid() and modulo = p_modulo
  );
$$;

-- ¿Tiene ESTE CAMPO habilitado tal módulo? (independiente de quién
-- esté mirando: es una propiedad del campo, no del usuario)
create or replace function public.campo_tiene_modulo(p_campo_id uuid, p_modulo text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.campo_modulos where campo_id = p_campo_id and modulo = p_modulo
  );
$$;

-- ------------------------------------------------------------
-- Trigger: al crear un usuario en auth.users, crear su perfil
-- (rol/nombre reales, y el campo al que pertenece, los completa el
-- panel de administración con la service_role key; esto es sólo
-- una red de seguridad)
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
alter table public.campos enable row level security;
alter table public.usuarios_campos enable row level security;
alter table public.usuarios_modulos enable row level security;
alter table public.campo_modulos enable row level security;
alter table public.lotes enable row level security;
alter table public.categorias_alimentos enable row level security;
alter table public.ubicaciones_alimentos enable row level security;
alter table public.bolsones_alimentos enable row level security;
alter table public.alimentos enable row level security;
alter table public.entregas enable row level security;
alter table public.proveedores_alimentos enable row level security;
alter table public.entradas_alimentos enable row level security;
alter table public.categorias_materiales enable row level security;
alter table public.materiales enable row level security;
alter table public.proveedores enable row level security;
alter table public.contratistas enable row level security;
alter table public.lotes_materiales enable row level security;
alter table public.movimientos_stock enable row level security;

-- profiles: se ve a sí mismo y a quien comparta campo con él/ella;
-- sólo puede editar su propio nombre, nunca su propio rol.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.comparte_campo_con(id));

drop policy if exists profiles_update_propio on public.profiles;
create policy profiles_update_propio on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.profiles where id = auth.uid()));

-- campos: cada uno ve los campos a los que pertenece (el dueño los ve
-- todos); sólo el dueño puede crear/editar/borrar campos.
drop policy if exists campos_select on public.campos;
create policy campos_select on public.campos
  for select to authenticated using (public.tiene_acceso_a_campo(id));

drop policy if exists campos_modificar on public.campos;
create policy campos_modificar on public.campos
  for all to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- usuarios_campos: se lee la propia fila, o las de quienes administra
-- (mismo campo, rol encargado) o el dueño. Las escrituras se hacen
-- siempre con la service_role key desde /api/admin/usuarios.
drop policy if exists usuarios_campos_select on public.usuarios_campos;
create policy usuarios_campos_select on public.usuarios_campos
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin_de_campo(campo_id));

-- usuarios_modulos: se lee la propia fila, o las de quienes administra.
-- Las escrituras se hacen siempre con la service_role key desde
-- /api/admin/usuarios.
drop policy if exists usuarios_modulos_select on public.usuarios_modulos;
create policy usuarios_modulos_select on public.usuarios_modulos
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin_de_campo((
    select uc.campo_id from public.usuarios_campos uc where uc.usuario_id = usuarios_modulos.usuario_id limit 1
  )));

-- campo_modulos: se lee si se tiene acceso al campo; sólo el
-- Dueño habilita/deshabilita un módulo para un campo.
drop policy if exists campo_modulos_select on public.campo_modulos;
create policy campo_modulos_select on public.campo_modulos
  for select to authenticated
  using (public.tiene_acceso_a_campo(campo_id));

drop policy if exists campo_modulos_modificar on public.campo_modulos;
create policy campo_modulos_modificar on public.campo_modulos
  for all to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- lotes: todos los del campo Y del módulo Alimentos leen (el
-- usuario Y el campo tienen que tener Alimentos habilitado); sólo
-- el admin de ese campo (con módulo Alimentos) modifica.
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

-- categorias_alimentos / ubicaciones_alimentos: mismo esquema que lotes
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

-- bolsones_alimentos: mismo esquema que ubicaciones_alimentos
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

-- alimentos: mismo esquema que lotes
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

-- entregas: cada usuario ve/crea las suyas; encargado/gerente/dueño
-- del campo del lote (con módulo Alimentos, y ese campo con
-- Alimentos habilitado) ven todas; sólo el admin de ese campo edita/borra
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

-- proveedores_alimentos: mismo esquema que los demás catálogos.
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

-- entradas_alimentos: a diferencia de las entregas (que puede cargar
-- cualquiera con el módulo), sólo el administrador/dueño del campo.
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

-- categorias_materiales: mismo esquema que proveedores/contratistas
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

-- materiales: todos los del campo Y del módulo Materiales leen (el
-- usuario Y el campo tienen que tener Materiales habilitado); sólo
-- el admin de ese campo (con módulo Materiales) modifica.
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

-- proveedores/contratistas/lotes_materiales: mismo esquema que materiales
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

-- movimientos_stock: cada usuario ve/crea los suyos; encargado/gerente/
-- dueño del campo del material (con módulo Materiales, y ese campo
-- con Materiales habilitado) ven todos; sólo el admin de ese campo edita/borra
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
-- API de solo lectura (/api/v1): ver migrations/011_api_lectura.sql
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 1) Código fijo por campo. Se completa solo a partir del nombre
--    (sin tildes, en minúscula y con guiones) cuando coincide con
--    uno de los cinco campos conocidos; si no, queda vacío.
-- ------------------------------------------------------------
alter table public.campos add column if not exists codigo text;

create or replace function public.campos_asignar_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := regexp_replace(
      translate(lower(trim(new.nombre)), 'áéíóúü', 'aeiouu'),
      '\s+', '-', 'g'
    );
    if new.codigo not in ('san-jorge', 'san-jose', 'el-nene', 'las-isletas', 'santa-teresita') then
      new.codigo := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campos_asignar_codigo on public.campos;
create trigger campos_asignar_codigo
  before insert on public.campos
  for each row execute function public.campos_asignar_codigo();

-- Campos que ya existen: se completa el código con el mismo criterio.
update public.campos
set codigo = regexp_replace(translate(lower(trim(nombre)), 'áéíóúü', 'aeiouu'), '\s+', '-', 'g')
where codigo is null
  and regexp_replace(translate(lower(trim(nombre)), 'áéíóúü', 'aeiouu'), '\s+', '-', 'g')
      in ('san-jorge', 'san-jose', 'el-nene', 'las-isletas', 'santa-teresita');

alter table public.campos drop constraint if exists campos_codigo_check;
alter table public.campos add constraint campos_codigo_check
  check (codigo is null or codigo in ('san-jorge', 'san-jose', 'el-nene', 'las-isletas', 'santa-teresita'));

create unique index if not exists campos_codigo_unico on public.campos (codigo) where codigo is not null;

-- ------------------------------------------------------------
-- 2) updated_at en entregas, entradas_alimentos y movimientos_stock.
--    Los registros existentes arrancan con su created_at.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter table public.entregas add column if not exists updated_at timestamptz;
alter table public.entradas_alimentos add column if not exists updated_at timestamptz;
alter table public.movimientos_stock add column if not exists updated_at timestamptz;

update public.entregas set updated_at = created_at where updated_at is null;
update public.entradas_alimentos set updated_at = created_at where updated_at is null;
update public.movimientos_stock set updated_at = created_at where updated_at is null;

alter table public.entregas alter column updated_at set default now();
alter table public.entregas alter column updated_at set not null;
alter table public.entradas_alimentos alter column updated_at set default now();
alter table public.entradas_alimentos alter column updated_at set not null;
alter table public.movimientos_stock alter column updated_at set default now();
alter table public.movimientos_stock alter column updated_at set not null;

drop trigger if exists entregas_updated_at on public.entregas;
create trigger entregas_updated_at before update on public.entregas
  for each row execute function public.set_updated_at();

drop trigger if exists entradas_alimentos_updated_at on public.entradas_alimentos;
create trigger entradas_alimentos_updated_at before update on public.entradas_alimentos
  for each row execute function public.set_updated_at();

drop trigger if exists movimientos_stock_updated_at on public.movimientos_stock;
create trigger movimientos_stock_updated_at before update on public.movimientos_stock
  for each row execute function public.set_updated_at();

create index if not exists entregas_updated_at_idx on public.entregas (updated_at, id);
create index if not exists entradas_alimentos_updated_at_idx on public.entradas_alimentos (updated_at, id);
create index if not exists movimientos_stock_updated_at_idx on public.movimientos_stock (updated_at, id);

-- ------------------------------------------------------------
-- 3) Registro de borrados. Guarda una copia de la fila borrada para
--    que la API pueda informarla como anulada. Sólo la lee el
--    servidor (RLS activado y sin políticas: la app no la ve).
--    Los borrados anteriores a esta migración no quedan registrados.
-- ------------------------------------------------------------
create table if not exists public.eliminaciones (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid not null,
  datos jsonb not null,
  eliminado_en timestamptz not null default now()
);

create index if not exists eliminaciones_eliminado_en_idx on public.eliminaciones (eliminado_en, id);

alter table public.eliminaciones enable row level security;
revoke all on public.eliminaciones from anon, authenticated;

create or replace function public.registrar_eliminacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.eliminaciones (tabla, registro_id, datos)
  values (tg_table_name, old.id, to_jsonb(old));
  return old;
end;
$$;

drop trigger if exists entregas_eliminacion on public.entregas;
create trigger entregas_eliminacion after delete on public.entregas
  for each row execute function public.registrar_eliminacion();

drop trigger if exists entradas_alimentos_eliminacion on public.entradas_alimentos;
create trigger entradas_alimentos_eliminacion after delete on public.entradas_alimentos
  for each row execute function public.registrar_eliminacion();

drop trigger if exists movimientos_stock_eliminacion on public.movimientos_stock;
create trigger movimientos_stock_eliminacion after delete on public.movimientos_stock
  for each row execute function public.registrar_eliminacion();

-- ------------------------------------------------------------
-- Datos de ejemplo (opcional). Comentar/borrar si no se quiere.
-- ------------------------------------------------------------
-- insert into public.campos (nombre) values ('San Jorge');
-- insert into public.campo_modulos (campo_id, modulo)
--   select id, 'alimentos' from public.campos where nombre = 'San Jorge';
-- insert into public.lotes (campo_id, nombre)
--   select id, 'Lote 1' from public.campos where nombre = 'San Jorge';
-- insert into public.alimentos (campo_id, nombre)
--   select id, 'Silo de maíz' from public.campos where nombre = 'San Jorge';
