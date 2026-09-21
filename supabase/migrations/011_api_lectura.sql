-- ============================================================
-- API de solo lectura para otras webs internas (/api/v1).
-- Prepara la base para que se pueda pedir "lo que cambió desde tal
-- fecha" y enterarse de lo que se borró:
--   1) campos.codigo: código fijo de cada campo (san-jorge, etc.).
--   2) updated_at en los tres tipos de movimiento (se actualiza solo
--      al editar).
--   3) tabla eliminaciones: un trigger guarda una copia de cada
--      movimiento que se borra.
-- La app no cambia: todo esto es transparente para el uso diario.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 010)
-- ============================================================

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
