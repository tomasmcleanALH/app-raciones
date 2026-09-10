# App Raciones

Registro de entregas de alimento a las recrías — Agropecuaria Las Helenas.

## Qué es

Una app web simple para que el tractorista cargue cada entrega de alimento (fecha, tipo de
alimento, lote destino, cantidad, observaciones) y el encargado vea todo en una grilla con
filtros. Funciona sin señal: si no hay conexión en el campo, la entrega queda guardada en el
celular y se sube sola apenas vuelve la señal.

## Stack

- [Next.js](https://nextjs.org) (App Router) + Tailwind CSS
- [Supabase](https://supabase.com) (base de datos, autenticación, RLS)
- PWA instalable (manifest + service worker) con cola offline en IndexedDB
- Desplegado en [Vercel](https://vercel.com)

## Desarrollo local

```bash
npm install
npm run dev
```

Necesita un archivo `.env.local` (ver `.env.local.example`) con las claves del proyecto
Supabase, y haber corrido `supabase/schema.sql` en el SQL Editor de ese proyecto.

## Roles

- **Tractorista**: carga entregas, ve su propio historial.
- **Encargado**: ve todas las entregas, administra lotes, tipos de alimento y usuarios.
