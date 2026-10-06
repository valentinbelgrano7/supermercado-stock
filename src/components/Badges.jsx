export const DOC_STATUS = {
  draft: { label: 'Borrador', cls: 'draft' },
  confirmed: { label: 'Confirmado', cls: 'confirmed' },
  cancelled: { label: 'Anulado', cls: 'cancelled' },
};

export function StatusBadge({ status }) {
  const s = DOC_STATUS[status] || { label: status, cls: '' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

const STOCK = {
  ok: { label: 'En stock', cls: 'success' },
  low: { label: 'Stock bajo', cls: 'warning' },
  out: { label: 'Sin stock', cls: 'danger' },
};

export function stockStatus(p) {
  if (Number(p.stock) <= 0) return 'out';
  if (Number(p.stock) <= Number(p.min_stock)) return 'low';
  return 'ok';
}

export function StockBadge({ product }) {
  const s = STOCK[product.stock_status || stockStatus(product)];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export const MOVEMENT_TYPES = {
  ingreso: { label: 'Ingreso', cls: 'success' },
  egreso: { label: 'Egreso', cls: 'info' },
  ajuste: { label: 'Ajuste', cls: 'warning' },
  anulacion: { label: 'Anulación', cls: 'danger' },
};

export function MovementBadge({ type }) {
  const t = MOVEMENT_TYPES[type] || { label: type, cls: '' };
  return <span className={`badge ${t.cls}`}>{t.label}</span>;
}

export function ExpiryBadge({ days }) {
  const d = Number(days);
  if (d < 0) return <span className="badge danger">Vencido</span>;
  if (d <= 7) return <span className="badge warning">{d === 0 ? 'Hoy' : `${d} d`}</span>;
  return <span className="badge">{d} d</span>;
}
