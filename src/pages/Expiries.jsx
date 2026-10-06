import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlarmClock, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { date, money, qtyUnit, relativeDays } from '../lib/format.js';
import { useSettings } from '../store/SettingsProvider.jsx';
import { EmptyState, ErrorBox, Loading, PageHeader, TableCard } from '../components/ui.jsx';
import { ExpiryBadge } from '../components/Badges.jsx';

const RANGES = [7, 15, 30, 60, 90];

export default function Expiries() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [days, setDays] = useState(settings.expiry_alert_days);
  const { data, loading, error } = useFetch(() => api.get('/reports/expiries', { days }), [days]);

  const items = data?.items || [];
  const expired = items.filter((i) => i.days_left < 0);
  const atRisk = items.reduce((s, i) => s + i.remaining * i.cost, 0);

  const registerWaste = () => {
    navigate('/egresos/nuevo', {
      state: {
        prefill: {
          reason: 'vencimiento',
          notes: 'Retiro de productos vencidos',
          items: expired.map((i) => ({ id: i.product_id, name: i.product_name, sku: i.sku, unit: i.unit, stock: i.stock, cost: i.cost, quantity: i.remaining })),
        },
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Vencimientos"
        subtitle="Lotes ingresados que (según FIFO) siguen en góndola y vencen pronto o ya vencieron"
        actions={expired.length > 0 && (
          <button className="pill-btn" onClick={registerWaste} style={{ color: 'var(--gcal-danger)' }}>
            <Trash2 size={16} /> Dar de baja vencidos
          </button>
        )}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="muted text-[13px]">Próximos</span>
        {RANGES.map((d) => (
          <button key={d} className={`chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} días</button>
        ))}
        {data && (
          <span className="muted ml-auto text-[13px]">
            {items.length} lotes · {expired.length} vencidos · valor en riesgo <b className="text-[#3c4043]">{money(atRisk)}</b>
          </span>
        )}
      </div>
      <ErrorBox error={error} />
      <TableCard>
        {loading && !data ? <Loading /> : items.length === 0 ? (
          <EmptyState icon={AlarmClock} title="Sin vencimientos próximos" text="Cargá la fecha de vencimiento en los ingresos para que aparezcan acá." />
        ) : (
          <table className="data-table" style={{ opacity: loading ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Vencimiento</th>
                <th className="hidden sm:table-cell">Lote</th>
                <th className="num">Cant. estimada</th>
                <th className="num hidden md:table-cell">Valor</th>
                <th className="hidden md:table-cell">Ingreso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link to={`/productos/${i.product_id}`} className="font-medium text-inherit hover:underline">{i.product_name}</Link>
                    <div className="muted text-[12px]">{i.sku} · stock total {qtyUnit(i.stock, i.unit)}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    {date(i.expiry_date)}
                    <div className="muted text-[12px]">{relativeDays(i.days_left)}</div>
                  </td>
                  <td className="hidden sm:table-cell">{i.lot || <span className="muted">—</span>}</td>
                  <td className="num">{qtyUnit(i.remaining, i.unit)}</td>
                  <td className="num hidden md:table-cell">{money(i.remaining * i.cost)}</td>
                  <td className="hidden md:table-cell"><Link to={`/ingresos/${i.document_id}`}>{i.document_number}</Link></td>
                  <td><ExpiryBadge days={i.days_left} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </>
  );
}
