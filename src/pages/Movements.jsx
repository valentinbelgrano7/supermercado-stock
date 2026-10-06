import { Link, useSearchParams } from 'react-router';
import { Download, History } from 'lucide-react';
import { api, download } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { useLookups } from '../lib/useLookups.js';
import { dateTime, money, qty, UNIT_LABEL } from '../lib/format.js';
import { EmptyState, ErrorBox, Loading, PageHeader, Pagination, SearchInput, TableCard } from '../components/ui.jsx';
import { MOVEMENT_TYPES, MovementBadge } from '../components/Badges.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Movements() {
  const toast = useToast();
  const { categories } = useLookups();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(['q', 'type', 'category_id', 'from', 'to', 'page'].map((k) => [k, params.get(k) || '']));
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const { data, loading, error } = useFetch(() => api.get('/movements', { ...f, pageSize: 50 }), [params.toString()]);

  return (
    <>
      <PageHeader
        title="Movimientos de stock"
        subtitle="Kardex general: cada entrada, salida, ajuste y anulación"
        actions={
          <button className="pill-btn" onClick={() => download('/movements/export', f).catch((e) => toast(e.message, 'error'))}>
            <Download size={16} /> Exportar Excel
          </button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={f.q} onChange={(v) => setFilter('q', v)} placeholder="Producto, SKU, código o documento" />
        <select className="input sm" style={{ width: 'auto' }} value={f.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-1 text-[13px] muted">
          <input type="date" className="input sm" style={{ width: 'auto' }} value={f.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="Desde" />
          –
          <input type="date" className="input sm" style={{ width: 'auto' }} value={f.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="Hasta" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button className={`chip ${!f.type ? 'active' : ''}`} onClick={() => setFilter('type', '')}>Todos</button>
        {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
          <button key={k} className={`chip ${f.type === k ? 'active' : ''}`} onClick={() => setFilter('type', k)}>{v.label}</button>
        ))}
      </div>

      <ErrorBox error={error} />
      <TableCard footer={data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter('page', String(p))} />}>
        {loading && !data ? <Loading /> : data?.movements.length === 0 ? (
          <EmptyState icon={History} title="Sin movimientos" text="No hay movimientos con estos filtros." />
        ) : (
          <table className="data-table" style={{ opacity: loading ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="hidden lg:table-cell">Detalle</th>
                <th className="num">Cantidad</th>
                <th className="num hidden sm:table-cell">Saldo</th>
                <th className="num hidden md:table-cell">Valor</th>
                <th className="hidden xl:table-cell">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {data?.movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{dateTime(m.created_at)}</td>
                  <td>
                    <Link to={`/productos/${m.product_id}`} className="font-medium text-inherit hover:underline">{m.product_name}</Link>
                    <div className="muted text-[12px]">{m.sku}</div>
                  </td>
                  <td><MovementBadge type={m.type} /></td>
                  <td className="hidden lg:table-cell">
                    {m.document_id && (
                      <Link to={`/${m.document_type === 'egreso' ? 'egresos' : 'ingresos'}/${m.document_id}`}>{m.document_number}</Link>
                    )}
                    <span className="muted">{m.document_id ? ' · ' : ''}{m.reason}</span>
                  </td>
                  <td className="num font-medium" style={{ color: m.quantity < 0 ? 'var(--gcal-danger)' : 'var(--gcal-success)' }}>
                    {m.quantity > 0 ? '+' : ''}{qty(m.quantity)} <span className="muted font-normal">{UNIT_LABEL[m.unit]}</span>
                  </td>
                  <td className="num hidden sm:table-cell">{qty(m.stock_after)}</td>
                  <td className="num hidden md:table-cell">{money(Math.abs(m.quantity) * m.unit_cost)}</td>
                  <td className="muted hidden xl:table-cell">{m.user_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </>
  );
}
