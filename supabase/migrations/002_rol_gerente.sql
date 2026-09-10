-- ============================================================
-- Agrega el rol "gerente".
-- Copiar y pegar en: Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corrido supabase/schema.sql)
-- ============================================================

-- Permite el nuevo valor de rol
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('tractorista', 'encargado', 'gerente'));

-- El gerente ve todas las entregas (no sólo las propias), igual que el encargado.
-- No puede editarlas/borrarlas: esa parte de la política no cambia (entregas_update/entregas_delete siguen sólo para encargado).
drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas
  for select to authenticated
  using (
    cargado_por = auth.uid()
    or public.tiene_rol('encargado')
    or public.tiene_rol('gerente')
  );
