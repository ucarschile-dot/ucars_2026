-- UCars — Schema completo
-- Ejecutar en Supabase SQL Editor (proyecto ucars separado de PVB)

-- ============================================================
-- TABLA: vehicles
-- ============================================================
create table if not exists vehicles (
  id                uuid        default gen_random_uuid() primary key,

  -- Identificación
  patente           text        default '' unique,          -- para routing desde Meta Ads
  marca             text        not null,
  modelo            text        not null,
  version           text        default '',
  año               integer     not null check (año >= 1990 and año <= 2030),

  -- Tipo de carrocería
  tipo              text        not null default 'Sedán'
                                check (tipo in ('Sedán','SUV','Hatchback','Pickup','Furgón','Coupé','Convertible','Minivan','Station Wagon','Otro')),

  -- Mecánica
  combustible       text        not null default 'Bencina'
                                check (combustible in ('Bencina','Diesel','Eléctrico','Híbrido','Gas')),
  transmision       text        not null default 'Automática'
                                check (transmision in ('Automática','Manual','CVT')),

  -- Detalles físicos
  color             text        default '',
  tapiz             text        default '',                 -- color/material interior
  num_duenos        integer     default null,               -- número de dueños anteriores

  -- Precio y estado
  precio            integer     not null check (precio > 0),
  km                integer     not null default 0 check (km >= 0),
  estado            text        not null default 'Disponible'
                                check (estado in ('Disponible','Reservado','Vendido')),
  badge             text        default '',

  -- Media
  imagen            text        default '',

  -- Routing interno — NUNCA se muestran al prospecto
  vendedor_nombre   text        default '',                 -- nombre del Ucariano asignado
  vendedor_telefono text        default '',                 -- WhatsApp del Ucariano (ej: 56912345678)

  -- Notas internas
  notas             text        default '',

  -- Métricas
  dias_en_stock     integer     generated always as
                                (extract(day from now() - created_at)::integer) stored,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists vehicles_estado_idx   on vehicles(estado);
create index if not exists vehicles_marca_idx    on vehicles(marca);
create index if not exists vehicles_precio_idx   on vehicles(precio);
create index if not exists vehicles_patente_idx  on vehicles(patente);
create index if not exists vehicles_tipo_idx     on vehicles(tipo);

alter table vehicles enable row level security;

create policy "Public read vehicles"
  on vehicles for select using (true);

create policy "Service role all vehicles"
  on vehicles for all using (auth.role() = 'service_role');

-- ============================================================
-- TABLA: conversations
-- Estado del flujo multi-paso del bot de WhatsApp
-- ============================================================
create table if not exists conversations (
  id              uuid        default gen_random_uuid() primary key,
  from_number     text        not null unique,             -- número WhatsApp del prospecto
  state           text        not null default 'idle'
                              check (state in ('idle','ask_name','ask_availability')),
  vehicle_id      uuid        references vehicles(id) on delete set null,
  prospect_name   text        default null,
  updated_at      timestamptz default now()
);

create index if not exists conversations_from_idx on conversations(from_number);

alter table conversations enable row level security;

create policy "Service role all conversations"
  on conversations for all using (auth.role() = 'service_role');

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

-- ============================================================
-- SEED: 12 autos del catálogo inicial
-- ============================================================
insert into vehicles (patente, marca, modelo, version, tipo, año, precio, km, combustible, transmision, color, tapiz, num_duenos, estado, badge, imagen) values
  ('AABB11','Toyota',     'Corolla',  '1.8 XEI CVT',         'Sedán', 2021,12900000, 38000,'Bencina','CVT',       'Blanco', 'Negro',  1,'Disponible','Recién ingresado','https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80'),
  ('CCDD22','Chevrolet',  'Tracker',  '1.2T LTZ AT',          'SUV',   2022,15500000, 22000,'Bencina','Automática','Negro',  'Negro',  1,'Disponible','Destacado',       'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80'),
  ('EEFF33','Hyundai',    'Tucson',   '2.0 GLS AT',           'SUV',   2020,14200000, 55000,'Bencina','Automática','Plata',  'Gris',   2,'Disponible','',                'https://images.unsplash.com/photo-1597762117709-859f744b84c3?w=600&q=80'),
  ('GGHH44','Kia',        'Sportage', '2.0 EX AT 4x2',        'SUV',   2021,16800000, 31000,'Diesel', 'Automática','Gris',   'Negro',  1,'Disponible','Recién ingresado','https://images.unsplash.com/photo-1551830820-330a71b99659?w=600&q=80'),
  ('IIJJ55','Volkswagen', 'Tiguan',   '1.4 TSI Trendline AT', 'SUV',   2022,19900000, 18000,'Bencina','Automática','Blanco', 'Beige',  1,'Disponible','Destacado',       'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&q=80'),
  ('KKLL66','Ford',       'Escape',   '2.0 EcoBoost SE AT',   'SUV',   2020,13700000, 48000,'Bencina','Automática','Azul',   'Negro',  2,'Reservado', 'Reservado',       'https://images.unsplash.com/photo-1612825173281-9a193378527e?w=600&q=80'),
  ('MMNN77','Mitsubishi', 'ASX',      '2.0 GLS AT 4WD',       'SUV',   2021,14500000, 40000,'Bencina','Automática','Rojo',   'Negro',  1,'Disponible','',                'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80'),
  ('OOPP88','Nissan',     'Qashqai',  '2.0 Advance CVT',      'SUV',   2019,11800000, 62000,'Bencina','CVT',       'Blanco', 'Gris',   2,'Disponible','',                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80'),
  ('QQRR99','Suzuki',     'Vitara',   '1.6 GLX AT 4WD',       'SUV',   2022,13200000, 25000,'Bencina','Automática','Naranja','Negro',  1,'Disponible','Recién ingresado','https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&q=80'),
  ('SSTT00','Honda',      'HR-V',     '1.8 EXL CVT',          'SUV',   2021,15100000, 33000,'Bencina','CVT',       'Negro',  'Negro',  1,'Disponible','',                'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600&q=80'),
  ('UUVV11','Mazda',      'CX-3',     '2.0 Grand Touring AT', 'SUV',   2020,13400000, 44000,'Bencina','Automática','Azul',   'Negro',  2,'Disponible','',                'https://images.unsplash.com/photo-1541443131876-9c8af0c5d239?w=600&q=80'),
  ('WWXX22','Renault',    'Duster',   '2.0 Privilege AT 4x4', 'SUV',   2021,11500000, 51000,'Bencina','Automática','Gris',   'Gris',   1,'Disponible','',                'https://images.unsplash.com/photo-1546614042-7df3c24c9e5d?w=600&q=80')
on conflict (patente) do nothing;

-- ============================================================
-- Si la tabla YA EXISTE: correr solo estos ALTER TABLE
-- ============================================================
-- alter table vehicles add column if not exists patente text default '' unique;
-- alter table vehicles add column if not exists tipo text not null default 'Sedán';
-- alter table vehicles add column if not exists tapiz text default '';
-- alter table vehicles add column if not exists num_duenos integer default null;
-- alter table vehicles add column if not exists vendedor_nombre text default '';
-- alter table vehicles add column if not exists vendedor_telefono text default '';
