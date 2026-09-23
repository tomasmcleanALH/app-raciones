-- ============================================================
-- Arregla la 011... digo, la 012: el índice que se creó para
-- client_id era "parcial" (sólo cuando no es null) y eso no le
-- alcanza a Postgres para poder resolver el "no duplicar" que usa
-- la sincronización offline (ON CONFLICT). Se reemplaza por un
-- índice único común: en Postgres eso también permite varios null
-- sin problema (cada null se considera distinto), así que los
-- movimientos viejos (sin client_id) no se ven afectados.
--
-- Copiar y pegar este archivo completo en:
-- Supabase Dashboard > SQL Editor > New query > Run
-- (proyecto que ya tiene corridos schema.sql, 002 a 012)
-- ============================================================

drop index if exists public.movimientos_stock_client_id_key;

create unique index if not exists movimientos_stock_client_id_key
  on public.movimientos_stock (client_id);
