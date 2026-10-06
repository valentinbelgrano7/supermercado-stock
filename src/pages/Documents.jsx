import { Link, useNavigate, useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { useLookups } from '../lib/useLookups.js';
import { DOC_TYPES } from '../lib/docs.js';
import { date, int, money } from '../lib/format.js';
import { useSettings } from '../store/SettingsProvider.jsx';
import { EmptyState, ErrorBox, Loading, PageHeader, Pagination, SearchInput, TableCard } from '../components/ui.jsx';
import { StatusBadge } from '../components/Badges.jsx';

const STATUS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borradores' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'cancelled', label: 'Anulados' },
];

export default function Documents({ type }) {
  const cfg = DOC_TYPES[type];
  const navigate = useNavigate();
  const { reasons } = useSettings();
  const { suppliers } = useLookups();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(['q', 'status', 'reason', 'supplier_id', 'from', 'to', 'page'].map((k) => [k, params.get(k) || '']));
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const { data, loading, error } = useFetch(
    () => api.get('/documents', { ...f, type, pageSize: 50 }),
    [type, params.toString()]
  );
  const reasonMap = reasons[type] || {};

  return (
    <>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<Link to={`${cfg.path}/nuevo`} className="pill-btn primary"><Plus size={16} /> Nuevo {cfg.singular.toLowerCase()}</Link>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={f.q} onChange={(v) => setFilter('q', v)} placeholder="Número, referencia o proveedor" />
        <select className="input sm" style={{ width: 'auto' }} value={f.reason} onChange={(e) => setFilter('reason', e.target.value)}>
          <option value="">Todos los motivos</option>
          {Object.entries(reasonMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {type === 'ingreso' && (
          <select className="input sm" style={{ width: 'auto' }} value={f.supplier_id} onChange={(e) => setFilter('supplier_id', e.target.value)}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 text-[13px] muted">
          <input type="date" className="input sm" style={{ width: 'auto' }} value={f.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="Desde" />
          –
          <input type="date" className="input sm" style={{ width: 'auto' }} value={f.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="Hasta" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS.map((s) => (
          <button key={s.value} className={`chip ${f.status === s.value ? 'active' : ''}`} onClick={() => setFilter('status', s.value)}>{s.label}</button>
        ))}
      </div>

      <ErrorBox error={error} />
      <TableCard footer={data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter('page', String(p))} />}>
        {loading && !data ? <Loading /> : data?.documents.length === 0 ? (
          <EmptyState icon={cfg.icon} title={`No hay ${cfg.title.toLowerCase()}`} text="Cambiá los filtros o cargá uno nuevo."
            action={<Link to={`${cfg.path}/nuevo`} className="pill-btn primary"><Plus size={16} /> Nuevo {cfg.singular.toLowerCase()}</Link>} />
        ) : (
          <table className="data-table" style={{ opacity: loading ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th className="hidden sm:table-cell">Motivo</th>
                {type === 'ingreso' && <th className="hidden md:table-cell">Proveedor</th>}
                <th className="num hidden md:table-cell">Ítems</th>
                <th className="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data?.documents.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => navigate(`${cfg.path}/${d.id}`)}>
                  <td>
                    <div className="font-medium">{d.number}</div>
                    {d.reference && <div className="muted text-[12px]">{d.reference}</div>}
                  </td>
                  <td className="whitespace-nowrap">{date(d.date)}</td>
                  <td className="hidden sm:table-cell">{reasonMap[d.reason] || d.reason}</td>
                  {type === 'ingreso' && <td className="hidden md:table-cell">{d.supplier_name || <span className="muted">—</span>}</td>}
                  <td className="num hidden md:table-cell">{int(d.item_count)}</td>
                  <td className="num">{money(d.total)}</td>
                  <td><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </>
  );
}
