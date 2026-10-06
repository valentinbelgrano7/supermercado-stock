import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';
import { pool, query, tx } from './pool.js';
import { applyMovement } from '../lib/stock.js';
import { REASONS } from '../lib/constants.js';

const CATEGORIES = ['Almacén', 'Bebidas', 'Lácteos', 'Limpieza', 'Perfumería', 'Fiambrería', 'Congelados', 'Verdulería', 'Panificados'];

const SUPPLIERS = [
  { name: 'Distribuidora del Sur', cuit: '30-71234567-8', contact: 'Marcela Gómez', phone: '11 4555-1200', email: 'ventas@delsur.com.ar' },
  { name: 'Bebidas Norte SA', cuit: '30-70987654-3', contact: 'Jorge Paz', phone: '11 4777-8899', email: 'pedidos@bebidasnorte.com.ar' },
  { name: 'Lácteos La Pampa', cuit: '30-69876543-1', contact: 'Ana Ruiz', phone: '2954 42-1133', email: 'comercial@lapampa.com.ar' },
  { name: 'Higiene Total SRL', cuit: '30-71555444-2', contact: 'Diego Sosa', phone: '11 4321-0099', email: 'info@higienetotal.com.ar' },
  { name: 'Frigorífico El Trébol', cuit: '30-70111222-9', contact: 'Luis Benítez', phone: '11 4600-3030', email: 'ventas@eltrebol.com.ar' },
];

// [nombre, categoría, proveedor, unidad, costo, precio, stock mínimo, ubicación, días de vencimiento]
const PRODUCTS = [
  ['Yerba mate 1 kg', 0, 0, 'un', 2850, 3990, 20, 'Góndola 1', 365],
  ['Azúcar 1 kg', 0, 0, 'un', 980, 1390, 30, 'Góndola 1', 720],
  ['Fideos tirabuzón 500 g', 0, 0, 'un', 720, 1090, 40, 'Góndola 2', 540],
  ['Arroz largo fino 1 kg', 0, 0, 'un', 1150, 1690, 30, 'Góndola 2', 540],
  ['Aceite de girasol 1,5 L', 0, 0, 'un', 2400, 3290, 24, 'Góndola 2', 400],
  ['Harina 000 1 kg', 0, 0, 'un', 690, 990, 30, 'Góndola 1', 300],
  ['Galletitas de agua 200 g', 0, 0, 'un', 450, 690, 36, 'Góndola 3', 180],
  ['Puré de tomate 520 g', 0, 0, 'un', 520, 790, 30, 'Góndola 3', 540],
  ['Café molido 250 g', 0, 0, 'un', 3100, 4390, 12, 'Góndola 1', 365],
  ['Mayonesa 500 g', 0, 0, 'un', 1350, 1950, 18, 'Góndola 3', 240],
  ['Gaseosa cola 2,25 L', 1, 1, 'un', 1900, 2790, 48, 'Bebidas A', 180],
  ['Agua mineral 2 L', 1, 1, 'un', 650, 990, 60, 'Bebidas A', 365],
  ['Cerveza lata 473 ml', 1, 1, 'un', 1050, 1590, 72, 'Bebidas B', 270],
  ['Jugo naranja 1 L', 1, 1, 'un', 980, 1450, 24, 'Bebidas A', 120],
  ['Vino tinto malbec 750 ml', 1, 1, 'un', 3200, 4690, 18, 'Bebidas C', 900],
  ['Leche entera 1 L', 2, 2, 'un', 950, 1290, 60, 'Heladera 1', 12],
  ['Yogur bebible frutilla 1 L', 2, 2, 'un', 1300, 1890, 24, 'Heladera 1', 20],
  ['Queso cremoso', 2, 2, 'kg', 6800, 9490, 8, 'Heladera 2', 35],
  ['Manteca 200 g', 2, 2, 'un', 1650, 2290, 20, 'Heladera 1', 60],
  ['Dulce de leche 400 g', 2, 2, 'un', 1550, 2190, 18, 'Heladera 1', 120],
  ['Lavandina 1 L', 3, 3, 'un', 590, 890, 24, 'Góndola 6', 365],
  ['Detergente 750 ml', 3, 3, 'un', 1200, 1790, 24, 'Góndola 6', 720],
  ['Papel higiénico x4', 3, 3, 'un', 1800, 2590, 30, 'Góndola 7', null],
  ['Jabón en polvo 800 g', 3, 3, 'un', 2600, 3690, 12, 'Góndola 6', 720],
  ['Shampoo 400 ml', 4, 3, 'un', 2900, 4190, 10, 'Góndola 8', 720],
  ['Pasta dental 90 g', 4, 3, 'un', 1400, 1990, 18, 'Góndola 8', 720],
  ['Desodorante aerosol', 4, 3, 'un', 2300, 3290, 12, 'Góndola 8', 720],
  ['Jamón cocido', 5, 4, 'kg', 9800, 13900, 6, 'Fiambrería', 25],
  ['Salame milán', 5, 4, 'kg', 11500, 16500, 4, 'Fiambrería', 60],
  ['Queso de máquina', 5, 4, 'kg', 8700, 12300, 6, 'Fiambrería', 30],
  ['Hamburguesas x4', 6, 4, 'un', 2700, 3890, 15, 'Freezer 1', 150],
  ['Papas fritas congeladas 1 kg', 6, 4, 'un', 2900, 4190, 12, 'Freezer 1', 300],
  ['Helado 1 kg', 6, 2, 'un', 4800, 6890, 8, 'Freezer 2', 200],
  ['Banana', 7, null, 'kg', 1100, 1790, 20, 'Verdulería', 7],
  ['Papa', 7, null, 'kg', 600, 990, 40, 'Verdulería', 20],
  ['Tomate redondo', 7, null, 'kg', 1500, 2390, 15, 'Verdulería', 8],
  ['Pan francés', 8, null, 'kg', 1800, 2800, 10, 'Panadería', 2],
  ['Pan lactal grande', 8, 0, 'un', 2100, 2990, 12, 'Panadería', 15],
];

const BARCODE_BASE = 7790000100000;

export async function seedDemo({ onlyIfEmpty = false } = {}) {
  await migrate();
  if (onlyIfEmpty) {
    const { rows } = await query('SELECT count(*)::int AS n FROM products');
    if (rows[0].n > 0) return;
  }
  const { rows: admins } = await query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  const userId = admins[0]?.id ?? null;

  await tx(async (client) => {
    await client.query(`UPDATE settings SET business_name = 'Supermercado Don Pepe' WHERE id = 1`);

    const catIds = [];
    for (const name of CATEGORIES) {
      const { rows } = await client.query(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT ((lower(name))) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name]
      );
      catIds.push(rows[0].id);
    }
    const supIds = [];
    for (const s of SUPPLIERS) {
      const { rows } = await client.query(
        `INSERT INTO suppliers (name, cuit, contact, phone, email) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ((lower(name))) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [s.name, s.cuit, s.contact, s.phone, s.email]
      );
      supIds.push(rows[0].id);
    }

    const products = [];
    for (const [i, p] of PRODUCTS.entries()) {
      const [name, cat, sup, unit, cost, price, min, location, shelfDays] = p;
      const { rows } = await client.query(
        `INSERT INTO products (sku, barcode, name, category_id, supplier_id, unit, cost, price, min_stock, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT ((lower(sku))) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [
          `P${String(i + 1).padStart(5, '0')}`, unit === 'un' ? String(BARCODE_BASE + i) : null, name,
          catIds[cat], sup === null ? null : supIds[sup], unit, cost, price, min, location,
        ]
      );
      products.push({ id: rows[0].id, cost, min, unit, sup, shelfDays });
    }

    const docs = [];
    const addDoc = async ({ type, reason, supplier, daysAgo, items, cancel = false }) => {
      const { rows } = await client.query(
        `INSERT INTO documents (type, reason, supplier_id, date, created_by, reference)
         VALUES ($1, $2, $3, CURRENT_DATE - $4::int, $5, $6) RETURNING id, date`,
        [type, reason, supplier, daysAgo, userId, type === 'ingreso' && reason === 'compra' ? `Remito 0001-${String(10000 + docs.length).padStart(8, '0')}` : null]
      );
      const id = rows[0].id;
      await client.query(`UPDATE documents SET number = $2 || '-' || lpad(id::text, 6, '0') WHERE id = $1`, [id, type === 'ingreso' ? 'ING' : 'EGR']);
      let total = 0;
      for (const it of items) {
        await client.query(
          `INSERT INTO document_items (document_id, product_id, quantity, unit_cost, lot, expiry_date)
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE CURRENT_DATE - $7::int + $6::int END)`,
          [id, it.product.id, it.qty, it.product.cost, it.lot ?? null, type === 'ingreso' ? it.expiry ?? null : null, daysAgo]
        );
        total += it.qty * it.product.cost;
        await applyMovement(client, {
          productId: it.product.id, delta: type === 'ingreso' ? it.qty : -it.qty, type, documentId: id,
          reason: REASONS[type][reason], unitCost: it.product.cost, userId, allowNegative: false,
        });
      }
      await client.query(
        `UPDATE documents SET total = $2, status = 'confirmed', confirmed_at = now() - ($3 || ' days')::interval WHERE id = $1`,
        [id, Math.round(total * 100) / 100, String(daysAgo)]
      );
      await client.query(
        `UPDATE stock_movements SET created_at = now() - ($2 || ' days')::interval WHERE document_id = $1`,
        [id, String(daysAgo)]
      );
      docs.push(id);
      return id;
    };

    // Compras de los últimos meses, agrupadas por proveedor
    const bySupplier = new Map();
    for (const p of products) {
      const key = p.sup ?? 'none';
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key).push(p);
    }
    // Línea de tiempo: compras por proveedor intercaladas con ventas diarias agrupadas
    const rnd = mulberry32(42);
    const events = [
      ...[150, 120, 90, 60, 30, 8].map((daysAgo) => ({ daysAgo, kind: 'compra' })),
      ...[140, 110, 85, 55, 25, 14, 6, 3, 1].map((daysAgo) => ({ daysAgo, kind: 'venta' })),
    ].sort((a, b) => b.daysAgo - a.daysAgo);

    let lot = 100;
    for (const ev of events) {
      if (ev.kind === 'compra') {
        for (const [sup, list] of bySupplier) {
          await addDoc({
            type: 'ingreso', reason: 'compra', supplier: sup === 'none' ? null : supIds[sup], daysAgo: ev.daysAgo,
            items: list.map((p) => ({
              product: p,
              qty: p.unit === 'kg' ? Math.max(5, Math.round(p.min * 2)) : Math.round(p.min * 2.2),
              lot: `L${lot++}`,
              expiry: p.shelfDays,
            })),
          });
        }
        continue;
      }
      const items = [];
      for (const p of products) {
        const { rows } = await client.query('SELECT stock FROM products WHERE id = $1', [p.id]);
        const stock = Number(rows[0].stock);
        const fastMover = products.indexOf(p) % 4 === 1;
        const share = ev.daysAgo > 6 ? 0.45 + rnd() * 0.4 : fastMover ? 0.4 + rnd() * 0.15 : 0.04 + rnd() * 0.25;
        const qty = p.unit === 'kg' ? Math.round(stock * share * 10) / 10 : Math.floor(stock * share);
        if (qty > 0) items.push({ product: p, qty });
      }
      if (items.length) await addDoc({ type: 'egreso', reason: 'venta', supplier: null, daysAgo: ev.daysAgo, items });
    }

    // Mermas y vencimientos sobre el stock que quedó
    const portion = async (p, share) => {
      const { rows } = await client.query('SELECT stock FROM products WHERE id = $1', [p.id]);
      const q = Number(rows[0].stock) * share;
      return p.unit === 'kg' ? Math.round(q * 10) / 10 : Math.floor(q);
    };
    const merma = [];
    for (const p of [products[15], products[33], products[36]]) {
      const qty = await portion(p, 0.2);
      if (qty > 0) merma.push({ product: p, qty });
    }
    if (merma.length) await addDoc({ type: 'egreso', reason: 'merma', supplier: null, daysAgo: 0, items: merma });
    const vencido = await portion(products[16], 0.25);
    if (vencido > 0) {
      await addDoc({ type: 'egreso', reason: 'vencimiento', supplier: null, daysAgo: 0, items: [{ product: products[16], qty: vencido }] });
    }
    // Dos productos agotados
    const agotados = [];
    for (const p of [products[29], products[17]]) {
      const qty = await portion(p, 1);
      if (qty > 0) agotados.push({ product: p, qty });
    }
    if (agotados.length) await addDoc({ type: 'egreso', reason: 'venta', supplier: null, daysAgo: 0, items: agotados });
  });
  console.log('[seed] datos demo cargados');
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDemo({ onlyIfEmpty: !process.argv.includes('--force') })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
