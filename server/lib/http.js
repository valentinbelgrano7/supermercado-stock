export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

// Envuelve handlers async para que los errores lleguen al error handler.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  // Errores de Postgres conocidos
  if (err.code === '23505') return res.status(409).json({ error: duplicateMessage(err) });
  if (err.code === '23503') return res.status(409).json({ error: 'El registro está en uso y no se puede eliminar.' });
  if (err.code === '22P02' || err.code === '23514') return res.status(400).json({ error: 'Datos inválidos.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

function duplicateMessage(err) {
  const c = err.constraint || '';
  if (c.includes('sku')) return 'Ya existe un producto con ese SKU.';
  if (c.includes('barcode')) return 'Ya existe un producto con ese código de barras.';
  if (c.includes('email')) return 'Ya existe un usuario con ese email.';
  if (c.includes('categories')) return 'Ya existe una categoría con ese nombre.';
  if (c.includes('suppliers')) return 'Ya existe un proveedor con ese nombre.';
  return 'Registro duplicado.';
}

// Helpers de parseo de input
export function str(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function num(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function intOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function requireFields(obj, fields) {
  for (const [key, label] of Object.entries(fields)) {
    if (str(obj[key]) === null) throw badRequest(`${label} es obligatorio.`);
  }
}

export function paging(req, defSize = 50) {
  const pageSize = Math.min(Math.max(intOrNull(req.query.pageSize) || defSize, 1), 500);
  const page = Math.max(intOrNull(req.query.page) || 1, 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}
