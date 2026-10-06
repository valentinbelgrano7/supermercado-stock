-- Schema idempotente: se ejecuta en cada arranque (migrate on start).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name           TEXT NOT NULL DEFAULT 'Mi Supermercado',
  cuit                    TEXT,
  address                 TEXT,
  currency                TEXT NOT NULL DEFAULT 'ARS',
  timezone                TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  expiry_alert_days       INTEGER NOT NULL DEFAULT 30,
  allow_negative_stock    BOOLEAN NOT NULL DEFAULT FALSE,
  update_cost_on_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq ON categories (lower(name));

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  cuit       TEXT,
  contact    TEXT,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_uq ON suppliers (lower(name));

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  sku         TEXT NOT NULL,
  barcode     TEXT,
  name        TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  unit        TEXT NOT NULL DEFAULT 'un' CHECK (unit IN ('un', 'kg', 'lt')),
  cost        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  price       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  stock       NUMERIC(14, 3) NOT NULL DEFAULT 0,
  min_stock   NUMERIC(14, 3) NOT NULL DEFAULT 0,
  location    TEXT,
  image_url   TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uq ON products (lower(sku));
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_uq ON products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_supplier_idx ON products (supplier_id);

-- Documentos de stock con ciclo de vida draft -> confirmed -> cancelled.
-- type 'ingreso' suma stock (compras, devoluciones de clientes);
-- type 'egreso' resta stock (ventas, mermas, vencimientos, consumo interno...).
CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  reason       TEXT NOT NULL,
  number       TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  supplier_id  INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reference    TEXT,
  notes        TEXT,
  total        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_type_status_idx ON documents (type, status, date);

CREATE TABLE IF NOT EXISTS document_items (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit_cost   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lot         TEXT,
  expiry_date DATE
);
CREATE INDEX IF NOT EXISTS document_items_doc_idx ON document_items (document_id);
CREATE INDEX IF NOT EXISTS document_items_expiry_idx ON document_items (expiry_date) WHERE expiry_date IS NOT NULL;

-- Kardex: cada cambio de stock queda registrado acá (cantidad con signo).
CREATE TABLE IF NOT EXISTS stock_movements (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso', 'ajuste', 'anulacion')),
  quantity    NUMERIC(14, 3) NOT NULL,
  stock_after NUMERIC(14, 3) NOT NULL,
  unit_cost   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  reason      TEXT,
  notes       TEXT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements (created_at DESC);
