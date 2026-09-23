-- ============================================================
-- Permite cargar movimientos de stock (Materiales) sin señal, igual
-- que ya funciona con las entregas de Alimentos: se agrega client_id
-- para poder subir el movimiento más tarde sin duplicarlo si el
-- celular reintenta el envío (p. ej. se cortó la señal justo después
-- de guardar, y no llegó a enterarse de que ya se había subido).
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 011)
-- ============================================================

alter table public.movimientos_stock add column if not exists client_id uuid;

-- Único cuando no es null: los movimientos ya cargados (antes de este
-- cambio) quedan con client_id null, y Postgres permite varios null
-- en un índice único.
create unique index if not exists movimientos_stock_client_id_key
  on public.movimientos_stock (client_id) where client_id is not null;
