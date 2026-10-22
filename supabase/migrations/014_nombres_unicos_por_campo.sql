-- ============================================================
-- Lotes y alimentos: el nombre tiene que ser único DENTRO de cada
-- campo, no en toda la base.
--
-- Cuando estas dos tablas nacieron (antes de existir los campos) el
-- nombre era único a secas. Al agregar campos (003) se les sumó
-- campo_id, pero nunca se sacó esa restricción vieja: por eso, si
-- "CREEP FEEDING TEKNAL" ya existía en un campo, no se podía crear
-- uno con el mismo nombre en otro ("Ya existe uno con ese nombre").
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (se puede correr más de una vez sin problema)
-- ============================================================

-- 1) Sacar la restricción vieja (nombre único en toda la base).
alter table public.lotes drop constraint if exists lotes_nombre_key;
alter table public.alimentos drop constraint if exists alimentos_nombre_key;

-- 2) Asegurar la correcta: nombre único por campo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lotes'::regclass and conname = 'lotes_campo_id_nombre_key'
  ) then
    alter table public.lotes add constraint lotes_campo_id_nombre_key unique (campo_id, nombre);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alimentos'::regclass and conname = 'alimentos_campo_id_nombre_key'
  ) then
    alter table public.alimentos add constraint alimentos_campo_id_nombre_key unique (campo_id, nombre);
  end if;
end $$;
