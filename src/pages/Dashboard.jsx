import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlarmClock, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, DollarSign, PackageX, Trash2,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { date, dateTime, int, money, moneyCompact, monthLabel, qtyUnit, relativeDays } from '../lib/format.js';
import { ErrorBox, Loading, PageHeader } from '../components/ui.jsx';
import { ExpiryBadge, MovementBadge } from '../components/Badges.jsx';
import { useSettings } from '../store/SettingsProvider.jsx';

const SERIES = [
  { key: 'ingresos', label: 'Ingresos', color: '#1a73e8' },
  { key: 'egresos', label: 'Egresos', color: '#e37400' },
];

export default function Dashboard() {
  const { settings } = useSettings();
  const { data, loading, error } = useFetch(() => api.get('/reports/dashboard'), []);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const { stock, month, months, lowStock, recentMovements, expiring, byCategory, expiryDays } = data;
  const margin = stock.value_price - stock.value_cost;

  return (
    <>
      <PageHeader
        title={`Hola, ${settings.business_name}`}
        subtitle="Resumen del inventario y la actividad del mes"
        actions={
          <>
            <Link to="/egresos/nuevo" className="pill-btn"><ArrowUpFromLine size={16} /> Nuevo egreso</Link>
            <Link to="/ingresos/nuevo" className="pill-btn primary"><ArrowDownToLine size={16} /> Nuevo ingreso</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Valor del stock (costo)" value={money(stock.value_cost)}
          sub={`${moneyCompact(margin)} de margen potencial`} />
        <Kpi icon={Boxes} label="Productos activos" value={int(stock.active_products)}
          sub={`Valor a precio de venta ${moneyCompact(stock.value_price)}`} />
        <Kpi icon={AlertTriangle} label="Bajo stock mínimo" value={int(stock.low_stock)} tone={stock.low_stock ? 'warning' : null}
          sub={<Link to="/reposicion">Ver reposición</Link>} />
        <Kpi icon={PackageX} label="Sin stock" value={int(stock.out_of_stock)} tone={stock.out_of_stock ? 'danger' : null}
          sub={<Link to="/productos?stock=out">Ver productos</Link>} />
        <Kpi icon={ArrowDownToLine} label="Ingresos del mes" value={money(month.ingresos_total)}
          sub={`${int(month.ingresos_count)} documentos confirmados`} />
        <Kpi icon={ArrowUpFromLine} label="Egresos del mes (a costo)" value={money(month.egresos_total)}
          sub={`${int(month.egresos_count)} documentos confirmados`} />
        <Kpi icon={Trash2} label="Mermas y vencidos del mes" value={money(month.mermas_total)} tone={month.mermas_total ? 'danger' : null}
          sub={month.egresos_total ? `${((month.mermas_total / month.egresos_total) * 100).toFixed(1).replace('.', ',')} % de los egresos` : '—'} />
        <Kpi icon={AlarmClock} label={`Lotes por vencer (${expiryDays} días)`} value={expiring.length >= 8 ? '8+' : int(expiring.length)}
          sub={<Link to="/vencimientos">Ver vencimientos</Link>} tone={expiring.length ? 'warning' : null} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="panel xl:col-span-2">
          <div className="panel-header">
            <span className="panel-title">Ingresos vs. egresos (últimos 6 meses, valorizado a costo)</span>
          </div>
          <MonthChart months={months} />
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Stock valorizado por categoría</span></div>
          <div className="flex flex-col gap-3 p-4">
            {byCategory.length === 0 && <span className="muted">Sin datos.</span>}
            {byCategory.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between gap-2 text-[13px]">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular muted">{money(c.value)}</span>
                </div>
                <div className="stock-bar">
                  <span style={{ width: `${(c.value / byCategory[0].value) * 100}%`, background: 'var(--gcal-blue)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ListPanel title="Para reponer" link="/reposicion" empty="Todo el stock está por encima del mínimo.">
          {lowStock.map((p) => (
            <Link key={p.id} to={`/productos/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-inherit hover:bg-gcal-soft">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="muted block truncate text-[12px]">{p.supplier_name || 'Sin proveedor'}</span>
              </span>
              <span className="text-right">
                <span className={`badge ${p.stock <= 0 ? 'danger' : 'warning'}`}>{qtyUnit(p.stock, p.unit)}</span>
                <span className="muted block text-[11px]">mín. {qtyUnit(p.min_stock, p.unit)}</span>
              </span>
            </Link>
          ))}
        </ListPanel>

        <ListPanel title="Próximos vencimientos" link="/vencimientos" empty="No hay lotes por vencer.">
          {expiring.map((e) => (
            <Link key={e.id} to={`/productos/${e.product_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-inherit hover:bg-gcal-soft">
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.product_name}</span>
                <span className="muted block text-[12px]">
                  {date(e.expiry_date)} · {relativeDays(e.days_left)} · {qtyUnit(e.remaining, e.unit)}
                </span>
              </span>
              <ExpiryBadge days={e.days_left} />
            </Link>
          ))}
        </ListPanel>

        <ListPanel title="Últimos movimientos" link="/movimientos" empty="Todavía no hay movimientos.">
          {recentMovements.map((m) => (
            <Link key={m.id} to={`/productos/${m.product_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-inherit hover:bg-gcal-soft">
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.product_name}</span>
                <span className="muted block truncate text-[12px]">{dateTime(m.created_at)} · {m.document_number || m.reason}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <MovementBadge type={m.type} />
                <span className="tabular text-[12px]">{m.quantity > 0 ? '+' : ''}{qtyUnit(m.quantity, m.unit)}</span>
              </span>
            </Link>
          ))}
        </ListPanel>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  const color = tone === 'danger' ? 'var(--gcal-danger)' : tone === 'warning' ? 'var(--gcal-warning)' : undefined;
  return (
    <div className="kpi">
      <div className="kpi-label"><Icon size={15} style={{ color }} /> {label}</div>
      <div className="kpi-value" style={{ color }} title={String(value)}>{value}</div>
      <div className="kpi-sub truncate">{sub}</div>
    </div>
  );
}

function ListPanel({ title, link, empty, children }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        <Link to={link} className="pill-btn ghost sm">Ver todo</Link>
      </div>
      <div className="divide-y divide-gcal-border">
        {items.length ? items : <div className="muted px-4 py-6 text-center text-[13px]">{empty}</div>}
      </div>
    </div>
  );
}

function MonthChart({ months }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.flatMap((m) => [m.ingresos, m.egresos]));
  const ticks = [0, 0.5, 1].map((t) => t * max);

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-4 text-[12px]">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="relative flex h-[220px] gap-2 pl-14">
        {/* grilla */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute right-0 left-14 border-t border-dashed border-[#e8eaed]" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="muted absolute -top-2 -left-14 w-12 text-right text-[11px] tabular">{moneyCompact(t)}</span>
          </div>
        ))}
        {months.map((m, i) => (
          <div
            key={m.month}
            className="relative flex flex-1 items-end justify-center gap-[2px] rounded-md hover:bg-[#f8f9fa]"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {SERIES.map((s) => (
              <div
                key={s.key}
                className="w-full max-w-[22px] rounded-t"
                style={{ height: `${(m[s.key] / max) * 100}%`, minHeight: m[s.key] > 0 ? 2 : 0, background: s.color }}
              />
            ))}
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 min-w-[170px] rounded-lg border border-gcal-border bg-white px-3 py-2 text-[12px] shadow-md">
                <div className="mb-1 font-semibold capitalize">{monthLabel(m.month)} {m.month.slice(0, 4)}</div>
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}
                    </span>
                    <span className="tabular">{money(m[s.key])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 pl-14">
        {months.map((m) => (
          <div key={m.month} className="muted flex-1 text-center text-[12px] capitalize">{monthLabel(m.month)}</div>
        ))}
      </div>
    </div>
  );
}

