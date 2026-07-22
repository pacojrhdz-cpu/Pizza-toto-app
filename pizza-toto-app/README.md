# Pizza & Totó — Gestión de Sucursales (Fase 1)

App web para operar las sucursales con checklists diarios, semanales y mensuales, con acceso por rol (gerente, encargado, colaborador). Construida con **Next.js 14 (App Router)**, **Supabase** (Postgres + Auth) y desplegable en **Vercel**.

En esta Fase 1 funciona: login por rol, generación automática de los checklists del periodo por sucursal, marcado de ítems con notas y valores (ej. temperaturas), y un panel de cumplimiento por sucursal para el gerente.

---

## 1. Requisitos

- Node.js 18+ y npm
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito sirve)
- Una cuenta de [Vercel](https://vercel.com) y una de [GitHub](https://github.com)

## 2. Configurar Supabase

1. Crea un proyecto nuevo en Supabase.
2. Abre **SQL Editor** y ejecuta el archivo `schema.sql` (está junto a este proyecto). Crea tablas, seguridad por sucursal (RLS), y checklists de ejemplo.
3. En **Settings → API** copia `Project URL` y la `anon public key`.

### Crear sucursales y usuarios

En **Table Editor → sucursales** agrega tus sucursales (nombre, dirección).

Para cada persona:

1. Ve a **Authentication → Users → Add user** y crea el usuario con correo y contraseña.
2. Copia su `User UID`.
3. En **SQL Editor** crea su perfil vinculando el UID, su rol y su sucursal:

```sql
-- Gerente (ve todo; sin sucursal)
insert into profiles (id, nombre, rol, sucursal_id)
values ('UID-DEL-USUARIO', 'Javier', 'gerente', null);

-- Encargado o colaborador (con su sucursal)
insert into profiles (id, nombre, rol, sucursal_id)
values ('UID-DEL-USUARIO', 'Nombre', 'encargado',
        (select id from sucursales where nombre = 'Sucursal Centro'));
```

> Opcional: puedes crear un trigger que genere el perfil automáticamente al registrar un usuario. Por ahora se hace manual para controlar rol y sucursal.

## 3. Correr en local

```bash
cd pizza-toto-app
cp .env.example .env.local     # y llena NEXT_PUBLIC_SUPABASE_URL y ANON_KEY
npm install
npm run dev
```

Abre http://localhost:3000 e inicia sesión.

## 4. Subir a GitHub

```bash
cd pizza-toto-app
git init
git add .
git commit -m "Fase 1: checklists por sucursal"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pizza-toto-app.git
git push -u origin main
```

## 5. Desplegar en Vercel

1. En Vercel: **Add New → Project** e importa el repo de GitHub.
2. En **Environment Variables** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Cada `git push` a `main` vuelve a desplegar automáticamente.

## 6. Generación automática de checklists (recomendado)

La app crea los checklists del periodo cuando el usuario entra. Para que existan aunque nadie entre, programa la función `generar_instancias` con **pg_cron** en Supabase (ver comentarios al final de `schema.sql`):

```sql
select cron.schedule('gen-diario',  '0 5 * * *', $$ select generar_instancias(current_date, 'diario') $$);
select cron.schedule('gen-semanal', '0 5 * * 1', $$ select generar_instancias(current_date, 'semanal') $$);
select cron.schedule('gen-mensual', '0 5 1 * *', $$ select generar_instancias(current_date, 'mensual') $$);
```

---

## Estructura

```
app/
  login/            Inicio de sesión
  dashboard/        Checklists del día por sucursal (encargado/colaborador)
  checklist/[id]/   Detalle: marcar ítems, valores y notas
  panel/            Cumplimiento por sucursal (solo gerente)
components/         Header, formulario de checklist, logout
lib/                Clientes Supabase, auth, periodos, tipos
middleware.ts       Protege rutas y refresca sesión
```

## Qué sigue (próximas fases)

- **Fase 2:** capacitaciones y exámenes mensuales con calificación automática (tablas ya están en `schema.sql`).
- **Fase 3:** constancias de competencias y matriz por sucursal.
- **Fase 4:** evidencia fotográfica en Supabase Storage, notificaciones y reportes.
