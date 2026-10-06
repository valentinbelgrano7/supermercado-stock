# Góndola — Control de stock para supermercados

Sistema de gestión (admin) para controlar el inventario de un supermercado: productos con código de barras, ingresos de mercadería, egresos (ventas, mermas, vencimientos), ajustes por conteo físico, kardex por producto, alertas de reposición y de vencimientos.

> Powered by [ProfesIA](https://www.instagram.com/profesia.ia/)

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inicio** | KPIs: valor del stock (costo y venta), productos bajo mínimo y sin stock, ingresos/egresos/mermas del mes, gráfico de los últimos 6 meses, stock por categoría, próximos vencimientos y últimos movimientos. |
| **Productos** | CRUD con SKU, código de barras (EAN), categoría, proveedor, unidad (un/kg/lt), costo, precio, stock mínimo, ubicación e imagen. Búsqueda, filtros, orden, paginación. **Importar/Exportar Excel** (con plantilla). |
| **Ficha de producto** | Stock actual vs. mínimo, margen, valorización y **kardex** completo. **Ajuste de stock** por conteo físico o suma/resta, con motivo. |
| **Categorías / Proveedores** | CRUD con cantidad de productos, valor del stock y productos a reponer por proveedor. |
| **Ingresos** | Compras, devoluciones de clientes, transferencias. Ciclo **borrador → confirmado → anulado**. Lote y fecha de vencimiento por renglón. Al confirmar una compra se actualiza el costo del producto (configurable). |
| **Egresos** | Ventas, mermas, vencimientos, consumo interno, devolución a proveedor. Valorizados al costo vigente. Valida stock suficiente (configurable). |
| **Lector de códigos** | En ingresos/egresos se puede escanear con un lector USB/Bluetooth: cada lectura agrega el producto o suma 1 si ya está. |
| **Movimientos** | Kardex general filtrable por tipo, categoría, fecha y texto. Exportable a Excel. |
| **Reposición** | Productos en o bajo el mínimo agrupados por proveedor, con cantidad sugerida editable → **genera un ingreso borrador**. |
| **Vencimientos** | Lotes que, estimando **FIFO**, siguen en góndola y vencen pronto o ya vencieron, con valor en riesgo → botón para **dar de baja vencidos** (egreso por vencimiento). |
| **Configuración** | Nombre del negocio, CUIT, dirección, moneda, zona horaria, días de alerta de vencimiento, stock negativo, actualización de costo. Gestión de **usuarios** (admin/operador) y cambio de contraseña. |

### Efectos de lado del ciclo de vida

- **Borrador**: editable y eliminable; no toca el stock.
- **Confirmar** ingreso → suma stock (y actualiza costo si es compra). Confirmar egreso → resta stock.
- **Anular** un confirmado → revierte cada renglón con un movimiento tipo *Anulación*. No se puede deshacer.
- Todo cambio de stock queda en `stock_movements` con el saldo resultante y el usuario.

## Stack

React 19 + React Router 7 + Vite 7 · Tailwind CSS 4 · lucide-react · Express 4 · PostgreSQL 16 (`pg`) · bcryptjs + sesiones propias (Bearer, 14 días) · multer · xlsx. JavaScript (ES modules), sin TypeScript.

```
/
├── src/            # React: pages, components, lib, api, auth, store
├── server/         # Express: routes, middleware, db (schema + migrate + seed), lib, public (build)
├── uploads/        # imágenes de productos
├── docker-compose.yml
├── vite.config.js
└── package.json
```

## Setup local

Requisitos: Node >= 20, npm y Docker.

```bash
# 1. Postgres 16 en Docker
npm run db:up

# 2. Variables de entorno
cp .env.example .env

# 3. Dependencias
npm install

# 4. (Opcional) datos demo: supermercado con 38 productos, proveedores y 6 meses de movimientos
npm run seed

# 5. Desarrollo: Vite en :5173 (proxy /api → Express :3001)
npm run dev
```

Abrí http://localhost:5173 e ingresá con el admin inicial (de `.env`):

- **Email:** `admin@super.local`
- **Contraseña:** `admin123`

> Cambiá la contraseña desde *Configuración → Mi contraseña*.

El schema es idempotente y se aplica en cada arranque (`server/db/schema.sql`). El usuario admin se crea solo si la tabla de usuarios está vacía.

### Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | API + Vite con recarga |
| `npm run build` | Compila la SPA en `server/public` |
| `npm start` | Producción: Express sirve API + SPA |
| `npm run migrate` | Aplica el schema manualmente |
| `npm run seed` | Carga datos demo si no hay productos (`-- --force` para forzar) |
| `npm run db:up` / `db:down` | Levanta / baja Postgres en Docker |

### Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgres://stock:stock@localhost:5432/stock` | Conexión a Postgres |
| `PORT` | `3001` | Puerto de Express |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | `admin@super.local` / `admin123` / `Administrador` | Admin inicial |
| `SEED_DEMO` | `false` | Cargar datos demo al arrancar si la base está vacía |
| `PGSSL` | `false` | Forzar SSL en la conexión (o usar `?sslmode=require` en la URL) |
| `UPLOADS_DIR` | `./uploads` | Carpeta de imágenes (montar un volumen en producción) |

## Deploy en Railway

1. Crear un proyecto con un servicio **PostgreSQL** y un servicio desde este repo.
2. En el servicio de la app, setear `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
3. Nixpacks corre `npm run build` y arranca con `npm start` (ver `nixpacks.toml` / `railway.json`). Health check: `GET /health`.
4. Para conservar las imágenes subidas, montar un **volumen** y apuntar `UPLOADS_DIR` a esa ruta.

## API (resumen)

Todas las rutas bajo `/api` (salvo login) requieren `Authorization: Bearer <token>`.

- `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · `POST /auth/password`
- `GET|PUT /settings` · `GET|POST|PUT|DELETE /users` (admin)
- `GET|POST|PUT|DELETE /categories`, `/suppliers`
- `GET|POST /products` · `GET|PUT|DELETE /products/:id` · `GET /products/lookup?code=` · `POST /products/:id/adjust` · `GET /products/:id/movements` · `POST|DELETE /products/:id/image` · `GET /products/export` · `GET /products/import-template` · `POST /products/import`
- `GET|POST /documents` · `GET|PUT|DELETE /documents/:id` · `POST /documents/:id/confirm` · `POST /documents/:id/cancel`
- `GET /movements` · `GET /movements/export`
- `GET /reports/dashboard` · `GET /reports/restock` · `GET /reports/expiries`
