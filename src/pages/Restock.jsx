import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ClipboardList, PackageCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { useLookups } from '../lib/useLookups.js';
import { money, qtyUnit } from '../lib/format.js';
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/ui.jsx';

export default function Restock() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const supplierId = params.get('supplier_id') || '';
  const { suppliers } = useLookups();
  const { data, loading, error } = useFetch(() => api.get('/reports/restock', { supplier_id: supplierId }), [supplierId]);
  const [qtys, setQtys] = useState({});
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!data) return;
    setQtys(Object.fromEntries(data.products.map((p) => [p.id, String(Math.ceil(p.suggested))])));
    setSelected({});
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of data?.products || []) {
      const key = p.supplier_id ?? 0;
      if (!map.has(key)) map.set(key, { id: p.supplier_id, name: p.supplier_name || 'Sin proveedor', items: [] });
      map.get(key).items.push(p);
    }
    return [...map.values()];
  }, [data]);

  const createOrder = (group) => {
    const chosen = group.items.filter((p) => selected[p.id] !== false && Number(qtys[p.id]) > 0);
    navigate('/ingresos/nuevo', {
      state: {
        prefill: {
          reason: 'compra',
          supplier_id: group.id,
          notes: 'Generado desde Reposición',
          items: chosen.map((p) => ({ ...p, quantity: qtys[p.id] })),
        },
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Reposición"
        subtitle="Productos en o debajo del stock mínimo, agrupados por proveedor. Sugerido: llevar al doble del mínimo."
        actions={
          <select className="input sm" style={{ width: 'auto' }} value={supplierId}
            onChange={(e) => setParams(e.target.value ? { supplier_id: e.target.value } : {}, { replace: true })}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      />
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : groups.length === 0 ? (
        <div className="panel">
          <EmptyState icon={PackageCheck} title="Nada para reponer" text="Todos los productos con stock mínimo definido están por encima del mínimo." />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const total = g.items.reduce((s, p) => s + (selected[p.id] === false ? 0 : (Number(qtys[p.id]) || 0) * p.cost), 0);
            return (
              <div key={g.id ?? 0} className="overflow-hidden rounded-xl border border-gcal-border bg-white">
                <div className="panel-header flex-wrap">
                  <div>
                    <span className="panel-title">{g.name}</span>
                    <span className="muted ml-2 text-[13px]">{g.items.length} productos · estimado {money(total)}</span>
                  </div>
                  <button className="pill-btn primary sm" onClick={() => createOrder(g)}>
                    <ClipboardList size={15} /> Crear ingreso borrador
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} />
                        <th>Producto</th>
                        <th className="num">Stock</th>
                        <th className="num hidden sm:table-cell">Mínimo</th>
                        <th className="num" style={{ width: 120 }}>A pedir</th>
                        <th className="num hidden md:table-cell">Costo est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <input type="checkbox" className="h-4 w-4 accent-[#1a73e8]" checked={selected[p.id] !== false}
                              onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))} aria-label={`Incluir ${p.name}`} />
                          </td>
                          <td>
                            <Link to={`/productos/${p.id}`} className="font-medium text-inherit hover:underline">{p.name}</Link>
                            <div className="muted text-[12px]">{p.sku}{p.category_name ? ` · ${p.category_name}` : ''}</div>
                          </td>
                          <td className="num"><span className={`badge ${p.stock <= 0 ? 'danger' : 'warning'}`}>{qtyUnit(p.stock, p.unit)}</span></td>
                          <td className="num muted hidden sm:table-cell">{qtyUnit(p.min_stock, p.unit)}</td>
                          <td className="num">
                            <input className="input sm text-right" type="number" min="0" step={p.unit === 'un' ? 1 : 0.1}
                              value={qtys[p.id] ?? ''} onChange={(e) => setQtys((q) => ({ ...q, [p.id]: e.target.value }))} />
                          </td>
                          <td className="num hidden md:table-cell">{money((Number(qtys[p.id]) || 0) * p.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
