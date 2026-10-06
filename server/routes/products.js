import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';
import { query, tx } from '../db/pool.js';
import { ah, badRequest, intOrNull, notFound, num, paging, requireFields, str } from '../lib/http.js';
import { applyMovement, round3 } from '../lib/stock.js';
import { getSettings } from '../lib/settings.js';
import { UPLOADS_DIR } from '../lib/paths.js';

const router = Router();

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8) || '.jpg';
      cb(null, `prod-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)),
});
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const SELECT = `
  SELECT p.*, c.name AS category_name, s.name AS supplier_name,
         CASE WHEN p.stock <= 0 THEN 'out' WHEN p.stock <= p.min_stock THEN 'low' ELSE 'ok' END AS stock_status
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers s ON s.id = p.supplier_id`;

const SORTS = {
  name: 'p.name ASC',
  stock: 'p.stock ASC, p.name ASC',
  recent: 'p.updated_at DESC',
  value: '(p.stock * p.cost) DESC',
};

function buildFilters(q) {
  const where = [];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('$?', `$${params.length}`));
  };
  const search = str(q.q);
  if (search) add(`(p.name ILIKE '%' || $? || '%' OR p.sku ILIKE $? || '%' OR p.barcode = $?)`, search);
  if (intOrNull(q.category_id)) add('p.category_id = $?', intOrNull(q.category_id));
  if (intOrNull(q.supplier_id)) add('p.supplier_id = $?', intOrNull(q.supplier_id));
  if (q.status === 'inactive') where.push('NOT p.active');
  else if (q.status !== 'all') where.push('p.active');
  if (q.stock === 'low') where.push('p.stock <= p.min_stock');
  if (q.stock === 'out') where.push('p.stock <= 0');
  if (q.stock === 'ok') where.push('p.stock > p.min_stock');
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, offset } = paging(req);
  const { where, params } = buildFilters(req.query);
  const order = SORTS[req.query.sort] || SORTS.name;
  const [list, count] = await Promise.all([
    query(`${SELECT} ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${offset}`, params),
    query(`SELECT count(*)::int AS n FROM products p ${where}`, params),
  ]);
  res.json({ products: list.rows, total: count.rows[0].n, page, pageSize });
}));

// Búsqueda exacta por código de barras o SKU (lector de códigos).
router.get('/lookup', ah(async (req, res) => {
  const code = str(req.query.code);
  if (!code) throw badRequest('Código vacío.');
  const { rows } = await query(
    `${SELECT} WHERE p.barcode = $1 OR lower(p.sku) = lower($1) ORDER BY p.active DESC LIMIT 1`,
    [code]
  );
  if (!rows[0]) throw notFound(`No se encontró ningún producto con el código "${code}".`);
  res.json({ product: rows[0] });
}));

router.get('/export', ah(async (req, res) => {
  const { where, params } = buildFilters({ ...req.query, status: req.query.status || 'all' });
  const { rows } = await query(`${SELECT} ${where} ORDER BY p.name`, params);
  const data = rows.map((p) => ({
    SKU: p.sku,
    'Código de barras': p.barcode || '',
    Nombre: p.name,
    Categoría: p.category_name || '',
    Proveedor: p.supplier_name || '',
    Unidad: p.unit,
    Costo: p.cost,
    Precio: p.price,
    Stock: p.stock,
    'Stock mínimo': p.min_stock,
    Ubicación: p.location || '',
    Activo: p.active ? 'Sí' : 'No',
    'Valor stock (costo)': Math.round(p.stock * p.cost * 100) / 100,
  }));
  sendWorkbook(res, data, 'Productos', `productos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}));

router.get('/import-template', (req, res) => {
  sendWorkbook(res, [{
    SKU: 'GAL-001', 'Código de barras': '7790000000001', Nombre: 'Galletitas de agua 200 g',
    Categoría: 'Almacén', Proveedor: 'Distribuidora Ejemplo', Unidad: 'un', Costo: 450, Precio: 690,
    Stock: 24, 'Stock mínimo': 10, Ubicación: 'Góndola 3',
  }], 'Productos', 'plantilla-productos.xlsx');
});

router.post('/import', sheetUpload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Adjuntá un archivo .xlsx o .csv.');
  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  } catch {
    throw badRequest('No se pudo leer el archivo.');
  }
  if (!rows.length) throw badRequest('El archivo no tiene filas.');
  if (rows.length > 5000) throw badRequest('Máximo 5000 filas por importación.');

  const settings = await getSettings();
  const result = await tx(async (client) => {
    const stats = { created: 0, updated: 0, stockAdjusted: 0, errors: [] };
    const catCache = new Map();
    const supCache = new Map();

    const resolveId = async (table, cache, name) => {
      if (!name) return null;
      const key = name.toLowerCase();
      if (cache.has(key)) return cache.get(key);
      const found = await client.query(`SELECT id FROM ${table} WHERE lower(name) = $1`, [key]);
      const id = found.rows[0]?.id
        ?? (await client.query(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id`, [name])).rows[0].id;
      cache.set(key, id);
      return id;
    };

    for (const [i, raw] of rows.entries()) {
      const r = normalizeRow(raw);
      const line = i + 2;
      if (!r.name) {
        stats.errors.push(`Fila ${line}: falta el nombre.`);
        continue;
      }
      await client.query('SAVEPOINT row_sp');
      try {
        const categoryId = await resolveId('categories', catCache, r.category);
        const supplierId = await resolveId('suppliers', supCache, r.supplier);
        const unit = ['un', 'kg', 'lt'].includes(r.unit) ? r.unit : null;

        let existing = null;
        if (r.sku) existing = (await client.query('SELECT id, stock FROM products WHERE lower(sku) = lower($1)', [r.sku])).rows[0];
        if (!existing && r.barcode) existing = (await client.query('SELECT id, stock FROM products WHERE barcode = $1', [r.barcode])).rows[0];

        let productId;
        if (existing) {
          productId = existing.id;
          await client.query(
            `UPDATE products SET name = $2, barcode = COALESCE($3, barcode), category_id = COALESCE($4, category_id),
                    supplier_id = COALESCE($5, supplier_id), unit = COALESCE($6, unit), cost = COALESCE($7, cost),
                    price = COALESCE($8, price), min_stock = COALESCE($9, min_stock),
                    location = COALESCE($10, location), updated_at = now()
              WHERE id = $1`,
            [productId, r.name, r.barcode, categoryId, supplierId, unit, r.cost, r.price, r.minStock, r.location]
          );
          stats.updated++;
        } else {
          productId = (await client.query(
            `INSERT INTO products (sku, barcode, name, category_id, supplier_id, unit, cost, price, min_stock, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [r.sku || tempSku(), r.barcode, r.name, categoryId, supplierId, unit || 'un', r.cost ?? 0, r.price ?? 0, r.minStock ?? 0, r.location]
          )).rows[0].id;
          if (!r.sku) await assignSku(client, productId);
          stats.created++;
        }

        if (r.stock !== null) {
          const current = existing ? Number(existing.stock) : 0;
          const delta = round3(r.stock - current);
          if (delta !== 0) {
            await applyMovement(client, {
              productId, delta, type: 'ajuste', reason: 'Importación Excel',
              userId: req.user.id, allowNegative: settings.allow_negative_stock || r.stock >= 0,
            });
            stats.stockAdjusted++;
          }
        }
        await client.query('RELEASE SAVEPOINT row_sp');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp');
        stats.errors.push(`Fila ${line} (${r.name}): ${err.code === '23505' ? 'código de barras o SKU duplicado' : err.message}`);
      }
    }
    return stats;
  });
  res.json(result);
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id]);
  if (!rows[0]) throw notFound('Producto no encontrado.');
  res.json({ product: rows[0] });
}));

router.get('/:id/movements', ah(async (req, res) => {
  const { pageSize, offset, page } = paging(req, 30);
  const [list, count] = await Promise.all([
    query(
      `SELECT m.*, d.number AS document_number, d.type AS document_type, u.name AS user_name
         FROM stock_movements m
         LEFT JOIN documents d ON d.id = m.document_id
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.product_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
      [req.params.id]
    ),
    query('SELECT count(*)::int AS n FROM stock_movements WHERE product_id = $1', [req.params.id]),
  ]);
  res.json({ movements: list.rows, total: count.rows[0].n, page, pageSize });
}));

function productParams(b) {
  const unit = ['un', 'kg', 'lt'].includes(b.unit) ? b.unit : 'un';
  return [
    str(b.barcode), str(b.name), intOrNull(b.category_id), intOrNull(b.supplier_id), unit,
    Math.max(0, num(b.cost)), Math.max(0, num(b.price)), Math.max(0, num(b.min_stock)),
    str(b.location), b.active !== false,
  ];
}

router.post('/', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre' });
  const settings = await getSettings();
  const product = await tx(async (client) => {
    const sku = str(req.body.sku);
    const { rows } = await client.query(
      `INSERT INTO products (sku, barcode, name, category_id, supplier_id, unit, cost, price, min_stock, location, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [sku || tempSku(), ...productParams(req.body)]
    );
    const id = rows[0].id;
    if (!sku) await assignSku(client, id);
    const initial = num(req.body.initial_stock);
    if (initial !== 0) {
      await applyMovement(client, {
        productId: id, delta: initial, type: 'ajuste', reason: 'Stock inicial',
        userId: req.user.id, allowNegative: settings.allow_negative_stock,
      });
    }
    return id;
  });
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [product]);
  res.status(201).json({ product: rows[0] });
}));

router.put('/:id', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre', sku: 'El SKU' });
  const { rowCount } = await query(
    `UPDATE products SET sku = $1, barcode = $2, name = $3, category_id = $4, supplier_id = $5, unit = $6,
            cost = $7, price = $8, min_stock = $9, location = $10, active = $11, updated_at = now()
      WHERE id = $12`,
    [str(req.body.sku), ...productParams(req.body), req.params.id]
  );
  if (!rowCount) throw notFound('Producto no encontrado.');
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json({ product: rows[0] });
}));

router.delete('/:id', ah(async (req, res) => {
  const used = await query(
    `SELECT (SELECT count(*) FROM document_items WHERE product_id = $1)
          + (SELECT count(*) FROM stock_movements WHERE product_id = $1) AS n`,
    [req.params.id]
  );
  if (Number(used.rows[0].n) > 0) {
    throw badRequest('El producto tiene movimientos o documentos asociados. Desactivalo en lugar de eliminarlo.');
  }
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Producto no encontrado.');
  res.json({ ok: true });
}));

// Ajuste manual de stock (conteo físico o corrección).
router.post('/:id/adjust', ah(async (req, res) => {
  const mode = req.body.mode === 'set' ? 'set' : 'delta';
  const value = num(req.body.quantity, NaN);
  if (!Number.isFinite(value)) throw badRequest('Ingresá una cantidad válida.');
  const reason = str(req.body.reason) || (mode === 'set' ? 'Conteo físico' : 'Ajuste manual');
  const settings = await getSettings();

  await tx(async (client) => {
    const { rows } = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('Producto no encontrado.');
    const delta = mode === 'set' ? round3(value - Number(rows[0].stock)) : round3(value);
    if (delta === 0) throw badRequest('El ajuste no modifica el stock.');
    await applyMovement(client, {
      productId: Number(req.params.id), delta, type: 'ajuste', reason, notes: str(req.body.notes),
      userId: req.user.id, allowNegative: settings.allow_negative_stock,
    });
  });
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json({ product: rows[0] });
}));

router.post('/:id/image', imageUpload.single('image'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Subí una imagen PNG, JPG, WEBP o GIF (máx. 3 MB).');
  const url = `/uploads/${req.file.filename}`;
  const { rowCount } = await query('UPDATE products SET image_url = $2, updated_at = now() WHERE id = $1', [req.params.id, url]);
  if (!rowCount) throw notFound('Producto no encontrado.');
  res.json({ image_url: url });
}));

router.delete('/:id/image', ah(async (req, res) => {
  await query('UPDATE products SET image_url = NULL, updated_at = now() WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- helpers ----------

const tempSku = () => `tmp-${crypto.randomBytes(6).toString('hex')}`;

async function assignSku(client, id) {
  await client.query(`UPDATE products SET sku = 'P' || lpad(id::text, 5, '0') WHERE id = $1`, [id]);
}

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}

// Columna vacía → null (en un update no se toca el valor existente)
const optNum = (v) => (v === '' ? null : Math.max(0, num(v)));

function normalizeRow(raw) {
  // Normaliza encabezados: minúsculas y sin acentos.
  const row = {};
  for (const [k, v] of Object.entries(raw)) {
    row[k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()] = v;
  }
  const stockRaw = pick(row, 'stock', 'stock actual', 'cantidad');
  return {
    sku: str(pick(row, 'sku', 'codigo', 'codigo interno')),
    barcode: str(pick(row, 'codigo de barras', 'barcode', 'ean')),
    name: str(pick(row, 'nombre', 'producto', 'descripcion')),
    category: str(pick(row, 'categoria', 'rubro')),
    supplier: str(pick(row, 'proveedor')),
    unit: str(pick(row, 'unidad'))?.toLowerCase() ?? null,
    cost: optNum(pick(row, 'costo')),
    price: optNum(pick(row, 'precio', 'precio venta')),
    minStock: optNum(pick(row, 'stock minimo', 'minimo')),
    location: str(pick(row, 'ubicacion')),
    stock: stockRaw === '' ? null : num(stockRaw),
  };
}

function sendWorkbook(res, data, sheetName, filename) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

export { sendWorkbook };
export default router;
