-- ============================================================
-- Pizza & Totó — Gestión y Capacitación de Sucursales
-- Esquema Supabase (PostgreSQL)
-- Ejecutar en el SQL Editor de un proyecto Supabase nuevo.
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type rol_usuario      as enum ('gerente', 'encargado', 'colaborador');
create type frecuencia       as enum ('diario', 'semanal', 'mensual');
create type tipo_item        as enum ('booleano', 'valor', 'texto');   -- cumple/no, valor numérico (temp), o nota
create type estado_respuesta as enum ('cumple', 'no_cumple', 'na', 'pendiente');
create type tipo_pregunta    as enum ('opcion_multiple', 'verdadero_falso');
create type estado_intento   as enum ('en_progreso', 'aprobado', 'reprobado');

-- ============================================================
-- 1. SUCURSALES Y USUARIOS
-- ============================================================
create table sucursales (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  direccion   text,
  telefono    text,
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- profiles se vincula 1:1 con auth.users de Supabase
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         rol_usuario not null default 'colaborador',
  sucursal_id uuid references sucursales(id) on delete set null,  -- null para gerente (global)
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Helpers de rol/sucursal para políticas RLS
create or replace function auth_rol() returns rol_usuario
  language sql stable security definer set search_path = public as $$
  select rol from profiles where id = auth.uid()
$$;

create or replace function auth_sucursal() returns uuid
  language sql stable security definer set search_path = public as $$
  select sucursal_id from profiles where id = auth.uid()
$$;

create or replace function es_gerente() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_rol() = 'gerente', false)
$$;

-- ============================================================
-- 2. CHECKLISTS
-- ============================================================
create table categorias (
  id       uuid primary key default gen_random_uuid(),
  nombre   text not null unique,   -- Apertura, Cierre, Limpieza e Higiene, ...
  orden    int not null default 0
);

-- Plantilla de checklist (ej. "Apertura diaria")
create table checklist_plantillas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  frecuencia   frecuencia not null,
  categoria_id uuid references categorias(id) on delete set null,
  rol_objetivo rol_usuario,             -- null = cualquiera
  activa       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- Ítems de una plantilla
create table checklist_items (
  id            uuid primary key default gen_random_uuid(),
  plantilla_id  uuid not null references checklist_plantillas(id) on delete cascade,
  descripcion   text not null,
  tipo          tipo_item not null default 'booleano',
  requiere_foto boolean not null default false,
  unidad        text,                   -- ej. '°C' para ítems de valor
  critico       boolean not null default false,  -- resalta en el panel si no cumple
  orden         int not null default 0
);

-- Instancia: una plantilla generada para una sucursal en un periodo
create table checklist_instancias (
  id            uuid primary key default gen_random_uuid(),
  plantilla_id  uuid not null references checklist_plantillas(id) on delete cascade,
  sucursal_id   uuid not null references sucursales(id) on delete cascade,
  fecha         date not null,          -- día (diario) o inicio de periodo (semanal/mensual)
  completada    boolean not null default false,
  completada_por uuid references profiles(id) on delete set null,
  completada_en timestamptz,
  creado_en     timestamptz not null default now(),
  unique (plantilla_id, sucursal_id, fecha)
);

-- Respuesta a cada ítem dentro de una instancia
create table checklist_respuestas (
  id            uuid primary key default gen_random_uuid(),
  instancia_id  uuid not null references checklist_instancias(id) on delete cascade,
  item_id       uuid not null references checklist_items(id) on delete cascade,
  estado        estado_respuesta not null default 'pendiente',
  valor_num     numeric,                -- para ítems tipo 'valor' (ej. temperatura)
  nota          text,
  foto_url      text,                   -- ruta en Supabase Storage
  respondido_por uuid references profiles(id) on delete set null,
  respondido_en timestamptz,
  unique (instancia_id, item_id)
);

-- ============================================================
-- 3. CAPACITACIONES Y EXÁMENES
-- ============================================================
create table capacitaciones (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  rol_objetivo rol_usuario,             -- null = todos
  activa       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table capacitacion_materiales (
  id               uuid primary key default gen_random_uuid(),
  capacitacion_id  uuid not null references capacitaciones(id) on delete cascade,
  titulo           text not null,
  contenido        text,               -- texto/markdown
  recurso_url      text,               -- PDF, video, enlace
  orden            int not null default 0
);

create table examenes (
  id               uuid primary key default gen_random_uuid(),
  capacitacion_id  uuid references capacitaciones(id) on delete set null,
  titulo           text not null,
  calif_minima     int not null default 80,   -- % aprobatorio
  max_intentos     int not null default 3,
  minutos_limite   int,                        -- null = sin límite
  mensual          boolean not null default true,  -- se repite cada mes
  competencia      text,                        -- nombre de la competencia que certifica
  vigencia_meses   int not null default 12,     -- vigencia de la constancia
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

create table preguntas (
  id          uuid primary key default gen_random_uuid(),
  examen_id   uuid not null references examenes(id) on delete cascade,
  enunciado   text not null,
  tipo        tipo_pregunta not null default 'opcion_multiple',
  puntos      int not null default 1,
  orden       int not null default 0
);

create table opciones (
  id           uuid primary key default gen_random_uuid(),
  pregunta_id  uuid not null references preguntas(id) on delete cascade,
  texto        text not null,
  es_correcta  boolean not null default false,
  orden        int not null default 0
);

-- Intento de examen de un usuario
create table intentos_examen (
  id          uuid primary key default gen_random_uuid(),
  examen_id   uuid not null references examenes(id) on delete cascade,
  usuario_id  uuid not null references profiles(id) on delete cascade,
  periodo     text not null,           -- 'YYYY-MM' del intento mensual
  estado      estado_intento not null default 'en_progreso',
  calificacion int,                     -- % obtenido
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz
);

create table respuestas_examen (
  id           uuid primary key default gen_random_uuid(),
  intento_id   uuid not null references intentos_examen(id) on delete cascade,
  pregunta_id  uuid not null references preguntas(id) on delete cascade,
  opcion_id    uuid references opciones(id) on delete set null,
  correcta     boolean,
  unique (intento_id, pregunta_id)
);

-- ============================================================
-- 4. CONSTANCIAS DE COMPETENCIAS
-- ============================================================
create table constancias (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references profiles(id) on delete cascade,
  examen_id    uuid references examenes(id) on delete set null,
  competencia  text not null,
  folio        text not null unique,
  calificacion int,
  emitida_en   date not null default current_date,
  vence_en     date,
  intento_id   uuid references intentos_examen(id) on delete set null
);

-- ============================================================
-- 5. ASIGNACIONES (qué debe hacer quién)
-- ============================================================
create table asignaciones (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null,       -- 'capacitacion' | 'examen'
  referencia_id    uuid not null,       -- id de capacitación o examen
  sucursal_id      uuid references sucursales(id) on delete cascade,  -- null = todas
  usuario_id       uuid references profiles(id) on delete cascade,    -- null = por rol/sucursal
  rol_objetivo     rol_usuario,
  creado_en        timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index on profiles (sucursal_id);
create index on checklist_instancias (sucursal_id, fecha);
create index on checklist_respuestas (instancia_id);
create index on intentos_examen (usuario_id, periodo);
create index on constancias (usuario_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table sucursales           enable row level security;
alter table profiles             enable row level security;
alter table categorias           enable row level security;
alter table checklist_plantillas enable row level security;
alter table checklist_items      enable row level security;
alter table checklist_instancias enable row level security;
alter table checklist_respuestas enable row level security;
alter table capacitaciones       enable row level security;
alter table capacitacion_materiales enable row level security;
alter table examenes             enable row level security;
alter table preguntas            enable row level security;
alter table opciones             enable row level security;
alter table intentos_examen      enable row level security;
alter table respuestas_examen    enable row level security;
alter table constancias          enable row level security;
alter table asignaciones         enable row level security;

-- --- Catálogos: lectura para todos los autenticados; escritura solo gerente ---
create policy cat_sel  on categorias           for select using (auth.role() = 'authenticated');
create policy cat_all  on categorias           for all    using (es_gerente()) with check (es_gerente());
create policy pl_sel   on checklist_plantillas for select using (auth.role() = 'authenticated');
create policy pl_all   on checklist_plantillas for all    using (es_gerente()) with check (es_gerente());
create policy it_sel   on checklist_items      for select using (auth.role() = 'authenticated');
create policy it_all   on checklist_items      for all    using (es_gerente()) with check (es_gerente());
create policy cap_sel  on capacitaciones       for select using (auth.role() = 'authenticated');
create policy cap_all  on capacitaciones       for all    using (es_gerente()) with check (es_gerente());
create policy mat_sel  on capacitacion_materiales for select using (auth.role() = 'authenticated');
create policy mat_all  on capacitacion_materiales for all  using (es_gerente()) with check (es_gerente());
create policy exa_sel  on examenes             for select using (auth.role() = 'authenticated');
create policy exa_all  on examenes             for all    using (es_gerente()) with check (es_gerente());
create policy preg_sel on preguntas            for select using (auth.role() = 'authenticated');
create policy preg_all on preguntas            for all    using (es_gerente()) with check (es_gerente());
-- Opciones: los usuarios NO deben ver 'es_correcta'; expón un view sin esa columna en la app.
create policy opc_sel  on opciones             for select using (auth.role() = 'authenticated');
create policy opc_all  on opciones             for all    using (es_gerente()) with check (es_gerente());
create policy asig_sel on asignaciones         for select using (es_gerente() or sucursal_id = auth_sucursal() or usuario_id = auth.uid());
create policy asig_all on asignaciones         for all    using (es_gerente()) with check (es_gerente());

-- --- Sucursales ---
create policy suc_sel on sucursales for select
  using (es_gerente() or id = auth_sucursal());
create policy suc_all on sucursales for all
  using (es_gerente()) with check (es_gerente());

-- --- Profiles: cada quien se ve a sí mismo; gerente ve todo; encargado ve su sucursal ---
create policy prof_sel on profiles for select
  using (id = auth.uid() or es_gerente() or (auth_rol() = 'encargado' and sucursal_id = auth_sucursal()));
create policy prof_upd_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy prof_all on profiles for all
  using (es_gerente()) with check (es_gerente());

-- --- Instancias de checklist: por sucursal ---
create policy ins_sel on checklist_instancias for select
  using (es_gerente() or sucursal_id = auth_sucursal());
create policy ins_upd on checklist_instancias for update
  using (es_gerente() or sucursal_id = auth_sucursal())
  with check (es_gerente() or sucursal_id = auth_sucursal());
create policy ins_ins on checklist_instancias for insert
  with check (es_gerente() or sucursal_id = auth_sucursal());

-- --- Respuestas: pertenecen a una instancia de la sucursal del usuario ---
create policy resp_sel on checklist_respuestas for select
  using (es_gerente() or exists (
    select 1 from checklist_instancias ci
    where ci.id = instancia_id and ci.sucursal_id = auth_sucursal()));
create policy resp_mod on checklist_respuestas for all
  using (es_gerente() or exists (
    select 1 from checklist_instancias ci
    where ci.id = instancia_id and ci.sucursal_id = auth_sucursal()))
  with check (es_gerente() or exists (
    select 1 from checklist_instancias ci
    where ci.id = instancia_id and ci.sucursal_id = auth_sucursal()));

-- --- Intentos de examen: cada usuario los suyos; gerente todos ---
create policy int_sel on intentos_examen for select
  using (usuario_id = auth.uid() or es_gerente()
         or (auth_rol() = 'encargado' and exists (
              select 1 from profiles p where p.id = usuario_id and p.sucursal_id = auth_sucursal())));
create policy int_mod on intentos_examen for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy rexa_sel on respuestas_examen for select
  using (exists (select 1 from intentos_examen i
                 where i.id = intento_id and (i.usuario_id = auth.uid() or es_gerente())));
create policy rexa_mod on respuestas_examen for all
  using (exists (select 1 from intentos_examen i where i.id = intento_id and i.usuario_id = auth.uid()))
  with check (exists (select 1 from intentos_examen i where i.id = intento_id and i.usuario_id = auth.uid()));

-- --- Constancias: propias, gerente todas, encargado las de su sucursal ---
create policy const_sel on constancias for select
  using (usuario_id = auth.uid() or es_gerente()
         or (auth_rol() = 'encargado' and exists (
              select 1 from profiles p where p.id = usuario_id and p.sucursal_id = auth_sucursal())));
create policy const_all on constancias for all
  using (es_gerente()) with check (es_gerente());

-- ============================================================
-- 6. DATOS SEMILLA — Categorías
-- ============================================================
insert into categorias (nombre, orden) values
  ('Apertura', 1),
  ('Cierre', 2),
  ('Limpieza e Higiene', 3),
  ('Seguridad Alimentaria', 4),
  ('Inventario y Almacén', 5),
  ('Producción/Cocina', 6),
  ('Caja y Ventas', 7),
  ('Mantenimiento de Equipo', 8),
  ('Servicio al Cliente', 9),
  ('Personal', 10);

-- ============================================================
-- 6.1 Plantillas + ítems de ejemplo
-- ============================================================
-- Apertura diaria
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id, rol_objetivo)
  select 'Apertura diaria', 'diario', id, 'encargado' from categorias where nombre='Apertura'
  returning id)
insert into checklist_items (plantilla_id, descripcion, tipo, unidad, critico, requiere_foto, orden)
select p.id, x.descripcion, x.tipo::tipo_item, x.unidad, x.critico, x.foto, x.orden from p,
(values
  ('Encender hornos y registrar temperatura', 'valor', '°C', true, false, 1),
  ('Revisar limpieza general del área de clientes', 'booleano', null, false, true, 2),
  ('Encender letreros, luces y música', 'booleano', null, false, false, 3),
  ('Contar y registrar fondo de caja', 'valor', 'MXN', true, false, 4),
  ('Verificar uniforme e higiene del personal', 'booleano', null, true, false, 5),
  ('Confirmar existencias de masa e ingredientes clave', 'booleano', null, true, false, 6)
) as x(descripcion, tipo, unidad, critico, foto, orden);

-- Control de temperaturas (diario)
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id, rol_objetivo)
  select 'Control de temperaturas', 'diario', id, null from categorias where nombre='Seguridad Alimentaria'
  returning id)
insert into checklist_items (plantilla_id, descripcion, tipo, unidad, critico, orden)
select p.id, x.descripcion, x.tipo::tipo_item, x.unidad, x.critico, x.orden from p,
(values
  ('Temperatura refrigerador principal', 'valor', '°C', true, 1),
  ('Temperatura congelador', 'valor', '°C', true, 2),
  ('Revisión de caducidades (PEPS)', 'booleano', null, true, 3),
  ('Ingredientes preparados etiquetados con fecha', 'booleano', null, false, 4)
) as x(descripcion, tipo, unidad, critico, orden);

-- Cierre diario
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id, rol_objetivo)
  select 'Cierre diario', 'diario', id, 'encargado' from categorias where nombre='Cierre'
  returning id)
insert into checklist_items (plantilla_id, descripcion, tipo, critico, orden)
select p.id, x.descripcion, x.tipo::tipo_item, x.critico, x.orden from p,
(values
  ('Apagar y limpiar hornos', 'booleano', false, 1),
  ('Limpieza de superficies y utensilios', 'booleano', false, 2),
  ('Sacar basura', 'booleano', false, 3),
  ('Corte de caja y cuadre vs. sistema', 'valor', true, 4),
  ('Cerrar y activar alarma', 'booleano', true, 5)
) as x(descripcion, tipo, critico, orden);

-- Limpieza profunda (semanal)
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id)
  select 'Limpieza profunda semanal', 'semanal', id from categorias where nombre='Limpieza e Higiene'
  returning id)
insert into checklist_items (plantilla_id, descripcion, requiere_foto, orden)
select p.id, x.descripcion, x.foto, x.orden from p,
(values
  ('Limpiar campanas y filtros de extracción', true, 1),
  ('Limpiar cámaras de refrigeración por dentro', true, 2),
  ('Lavar pisos y coladeras', false, 3),
  ('Ordenar y limpiar almacén', false, 4)
) as x(descripcion, foto, orden);

-- Inventario completo (semanal)
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id, rol_objetivo)
  select 'Inventario completo semanal', 'semanal', id, 'encargado' from categorias where nombre='Inventario y Almacén'
  returning id)
insert into checklist_items (plantilla_id, descripcion, tipo, orden)
select p.id, x.descripcion, x.tipo::tipo_item, x.orden from p,
(values
  ('Conteo físico de insumos', 'texto', 1),
  ('Registrar mermas de la semana', 'valor', 2),
  ('Generar pedido a proveedor', 'booleano', 3)
) as x(descripcion, tipo, orden);

-- Auditoría mensual
with p as (
  insert into checklist_plantillas (nombre, frecuencia, categoria_id, rol_objetivo)
  select 'Auditoría mensual de sucursal', 'mensual', id, 'encargado' from categorias where nombre='Servicio al Cliente'
  returning id)
insert into checklist_items (plantilla_id, descripcion, critico, orden)
select p.id, x.descripcion, x.critico, x.orden from p,
(values
  ('Revisión integral de imagen de sucursal', false, 1),
  ('Confirmar exámenes mensuales presentados por el personal', true, 2),
  ('Revisión de indicadores: mermas, cumplimiento, exámenes', true, 3)
) as x(descripcion, critico, orden);

-- ============================================================
-- 7. FUNCIÓN: generar instancias de checklist para un periodo
--    Llamar desde un cron (pg_cron o Vercel Cron).
-- ============================================================
create or replace function generar_instancias(p_fecha date, p_frecuencia frecuencia)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  insert into checklist_instancias (plantilla_id, sucursal_id, fecha)
  select pl.id, s.id, p_fecha
  from checklist_plantillas pl
  cross join sucursales s
  where pl.frecuencia = p_frecuencia and pl.activa and s.activa
  on conflict (plantilla_id, sucursal_id, fecha) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Ejemplo de programación con pg_cron (activar la extensión primero):
-- select cron.schedule('gen-diario',  '0 5 * * *', $$ select generar_instancias(current_date, 'diario') $$);
-- select cron.schedule('gen-semanal', '0 5 * * 1', $$ select generar_instancias(current_date, 'semanal') $$);
-- select cron.schedule('gen-mensual', '0 5 1 * *', $$ select generar_instancias(current_date, 'mensual') $$);

-- ============================================================
-- FIN
-- ============================================================
