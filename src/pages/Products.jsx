import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Download, FileSpreadsheet, Package, Plus, Upload } from 'lucide-react';
import { api, download } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { useLookups } from '../lib/useLookups.js';
import { money, qtyUnit } from '../lib/format.js';
import { EmptyState, ErrorBox, Loading, PageHeader, Pagination, SearchInput, TableCard } from '../components/ui.jsx';
import { StockBadge } from '../components/Badges.jsx';
import ProductFormModal from '../components/ProductFormModal.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';

const STOCK_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'low', label: 'Bajo mínimo' },
  { value: 'out', label: 'Sin stock' },
  { value: 'ok', label: 'En stock' },
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, suppliers } = useLookups();
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

  const filters = {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    supplier_id: params.get('supplier_id') || '',
    stock: params.get('stock') || '',
    status: params.get('status') || '',
    sort: params.get('sort') || 'name',
    page: Number(params.get('page')) || 1,
  };
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const key = params.toString();
  const { data, loading, error, reload } = useFetch(() => api.get('/products', { ...filters, pageSize: 50 }), [key]);

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={data ? `${data.total.toLocaleString('es-AR')} productos` : ' '}
        actions={
          <>
            <button className="pill-btn" onClick={() => setImporting(true)}><Upload size={16} /> Importar</button>
            <button className="pill-btn" onClick={() => download('/products/export', filters).catch((e) => toast(e.message, 'error'))}>
              <Download size={16} /> Exportar
            </button>
            <button className="pill-btn primary" onClick={() => setEditing({})}><Plus size={16} /> Nuevo producto</button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Nombre, SKU o código de barras" />
        <select className="input sm" style={{ width: 'auto' }} value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input sm" style={{ width: 'auto' }} value={filters.supplier_id} onChange={(e) => setFilter('supplier_id', e.target.value)}>
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input sm" style={{ width: 'auto' }} value={filters.sort} onChange={(e) => setFilter('sort', e.target.value === 'name' ? '' : e.target.value)}>
          <option value="name">Orden: nombre</option>
          <option value="stock">Orden: menor stock</option>
          <option value="value">Orden: mayor valor</option>
          <option value="recent">Orden: modificados</option>
        </select>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {STOCK_FILTERS.map((f) => (
          <button key={f.value} className={`chip ${filters.stock === f.value ? 'active' : ''}`} onClick={() => setFilter('stock', f.value)}>
            {f.label}
          </button>
        ))}
        <span className="mx-1 w-px bg-gcal-border" />
        <button className={`chip ${filters.status === 'inactive' ? 'active' : ''}`} onClick={() => setFilter('status', filters.status === 'inactive' ? '' : 'inactive')}>
          Inactivos
        </button>
      </div>

      <ErrorBox error={error} />
      <TableCard footer={data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter('page', String(p))} />}>
        {loading && !data ? <Loading /> : data?.products.length === 0 ? (
          <EmptyState icon={Package} title="No hay productos" text="Probá con otros filtros o cargá tu primer producto."
            action={<button className="pill-btn primary" onClick={() => setEditing({})}><Plus size={16} /> Nuevo producto</button>} />
        ) : (
          <table className="data-table" style={{ opacity: loading ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="hidden md:table-cell">Categoría</th>
                <th className="num">Stock</th>
                <th className="num hidden sm:table-cell">Mínimo</th>
                <th className="num hidden lg:table-cell">Costo</th>
                <th className="num hidden lg:table-cell">Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data?.products.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => navigate(`/productos/${p.id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Thumb product={p} />
                      <div className="min-w-0">
                        <div className={`font-medium ${p.active ? '' : 'muted line-through'}`}>{p.name}</div>
                        <div className="muted text-[12px]">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell">{p.category_name || <span className="muted">—</span>}</td>
                  <td className="num font-medium">{qtyUnit(p.stock, p.unit)}</td>
                  <td className="num muted hidden sm:table-cell">{qtyUnit(p.min_stock, p.unit)}</td>
                  <td className="num hidden lg:table-cell">{money(p.cost)}</td>
                  <td className="num hidden lg:table-cell">{money(p.price)}</td>
                  <td><StockBadge product={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <ProductFormModal
        open={Boolean(editing)}
        product={editing?.id ? editing : null}
        categories={categories}
        suppliers={suppliers}
        onClose={() => setEditing(null)}
        onSaved={(p) => {
          setEditing(null);
          toast('Producto creado');
          navigate(`/productos/${p.id}`);
        }}
      />
      <ImportModal open={importing} onClose={() => setImporting(false)} onDone={reload} />
    </>
  );
}

export function Thumb({ product, size = 36 }) {
  return product.image_url ? (
    <img src={product.image_url} alt="" className="shrink-0 rounded-lg border border-gcal-border object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="muted flex shrink-0 items-center justify-center rounded-lg bg-gcal-soft" style={{ width: size, height: size }}>
      <Package size={size / 2.2} />
    </span>
  );
}

function ImportModal({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const close = () => {
    setFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  const run = async () => {
    if (!file) return setError('Seleccioná un archivo.');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.upload('/products/import', fd);
      setResult(r);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Importar productos desde Excel"
      onClose={close}
      width={560}
      footer={result ? (
        <button className="pill-btn primary" onClick={close}>Listo</button>
      ) : (
        <>
          <button className="pill-btn" onClick={close}>Cancelar</button>
          <button className="pill-btn primary" onClick={run} disabled={busy || !file}>{busy ? 'Importando…' : 'Importar'}</button>
        </>
      )}
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="kpi"><div className="kpi-label">Creados</div><div className="kpi-value">{result.created}</div></div>
            <div className="kpi"><div className="kpi-label">Actualizados</div><div className="kpi-value">{result.updated}</div></div>
            <div className="kpi"><div className="kpi-label">Stock ajustado</div><div className="kpi-value">{result.stockAdjusted}</div></div>
          </div>
          {result.errors.length > 0 && (
            <div className="form-error max-h-48 overflow-y-auto">
              {result.errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0">
            Subí un archivo <b>.xlsx</b> o <b>.csv</b>. Los productos se identifican por SKU o código de barras:
            si existen se actualizan, si no se crean. Las categorías y proveedores nuevos se crean solos.
          </p>
          <p className="muted m-0 text-[13px]">
            Si incluís la columna <b>Stock</b>, la diferencia con el stock actual se registra como ajuste «Importación Excel».
          </p>
          <button type="button" className="pill-btn self-start" onClick={() => download('/products/import-template')}>
            <FileSpreadsheet size={16} /> Descargar plantilla
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-gcal-border bg-gcal-soft px-4 py-6 text-center hover:bg-gcal-hover">
            <Upload size={22} className="muted" />
            <span className="font-medium">{file ? file.name : 'Elegí un archivo'}</span>
            <span className="muted text-[12px]">Máximo 5000 filas</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          {error && <div className="form-error">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
