// Formato es-AR; la moneda y zona horaria salen de Configuración.
let currency = 'ARS';
let timeZone = 'America/Argentina/Buenos_Aires';
let moneyFmt = makeMoney();

function makeMoney() {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  }
}

export function configureFormat(settings) {
  if (settings?.currency) currency = settings.currency;
  if (settings?.timezone) timeZone = settings.timezone;
  moneyFmt = makeMoney();
}

const qtyFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n) => moneyFmt.format(Number(n) || 0);
export const moneyCompact = (n) => `$ ${compactFmt.format(Number(n) || 0)}`;
export const qty = (n) => qtyFmt.format(Number(n) || 0);
export const int = (n) => intFmt.format(Number(n) || 0);

export const UNIT_LABEL = { un: 'un.', kg: 'kg', lt: 'lt' };
export const qtyUnit = (n, unit) => `${qty(n)} ${UNIT_LABEL[unit] || unit || ''}`.trim();

// Fechas 'YYYY-MM-DD' (sin hora): se formatean sin conversión de zona.
export function date(value) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat('es-AR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace('.', '');
}

// Hoy en la zona horaria del negocio, como 'YYYY-MM-DD'
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function relativeDays(days) {
  const d = Number(days);
  if (d < 0) return `vencido hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`;
  if (d === 0) return 'vence hoy';
  if (d === 1) return 'vence mañana';
  return `vence en ${d} días`;
}
