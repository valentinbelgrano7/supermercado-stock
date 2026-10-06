import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ImagePlus, Pencil, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { useLookups } from '../lib/useLookups.js';
import { dateTime, money, qty, qtyUnit } from '../lib/format.js';
import { useCrumb } from '../components/Breadcrumbs.jsx';
import { ErrorBox, Field, Loading, Pagination, TableCard } from '../components/ui.jsx';
import { MovementBadge, StockBadge } from '../components/Badges.jsx';
import ProductFormModal from '../components/ProductFormModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { FormModal } from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { Thumb } from './Products.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, suppliers } = useLookups();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);

  const prod = useFetch(() => api.get(`/products/${id}`), [id]);
  const moves = useFetch(() => api.get(`/products/${id}/movements`, { page, pageSize: 20 }), [id, page]);
  const p = prod.data?.product;
  useCrumb(p?.name);

  const refresh = () => {
    prod.reload();
    moves.reload();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      await api.upload(`/products/${id}/image`, fd);
      prod.reload();
      toast('Imagen actualizada');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (prod.loading && !p) return <Loading />;
  if (prod.error) return <ErrorBox error={prod.error} />;

  const ratio = p.min_stock > 0 ? Math.min(1, p.stock / (p.min_stock * 2)) : p.stock > 0 ? 1 : 0;
  const barColor = p.stock <= 0 ? 'var(--gcal-danger)' : p.stock <= p.min_stock ? 'var(--gcal-warning)' : 'var(--gcal-success)';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="group relative">
            <Thumb product={p} size={64} />
            <button className="icon-btn sm absolute -right-2 -bottom-2 border border-gcal-border bg-white" title="Cambiar imagen"
              onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} />
            </button>
            {p.image_url && (
              <button className="icon-btn sm danger absolute -top-2 -right-2 hidden border border-gcal-border bg-white group-hover:inline-flex" title="Quitar imagen"
                onClick={() => api.del(`/products/${id}/image`).then(prod.reload)}>
                <X size={14} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files[0])} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-normal leading-tight">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="muted">SKU {p.sku}</span>
              {p.barcode && <span className="muted">· EAN {p.barcode}</span>}
              <StockBadge product={p} />
              {!p.active && <span className="badge cancelled">Inactivo</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="pill-btn" onClick={() => setDeleting(true)}><Trash2 size={16} /> Eliminar</button>
          <button className="pill-btn" onClick={() => setEditing(true)}><Pencil size={16} /> Editar</button>
          <button className="pill-btn primary" onClick={() => setAdjusting(true)}><SlidersHorizontal size={16} /> Ajustar stock</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi">
          <div className="kpi-label">Stock actual</div>
          <div className="kpi-value">{qtyUnit(p.stock, p.unit)}</div>
          <div className="stock-bar mt-2"><span style={{ width: `${ratio * 100}%`, background: barColor }} /></div>
          <div className="kpi-sub">Mínimo {qtyUnit(p.min_stock, p.unit)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Costo / Precio</div>
          <div className="kpi-value">{money(p.price)}</div>
          <div className="kpi-sub">
            Costo {money(p.cost)}
            {p.cost > 0 && ` · margen ${((p.price / p.cost - 1) * 100).toFixed(1).replace('.', ',')} %`}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Valor del stock</div>
          <div className="kpi-value">{money(Math.max(0, p.stock) * p.cost)}</div>
          <div className="kpi-sub">A precio de venta {money(Math.max(0, p.stock) * p.price)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Clasificación</div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-[13px]">
            <span><span className="muted">Categoría:</span> {p.category_name || '—'}</span>
            <span><span className="muted">Proveedor:</span> {p.supplier_name || '—'}</span>
            <span><span className="muted">Ubicación:</span> {p.location || '—'}</span>
          </div>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-[16px] font-medium">Movimientos (kardex)</h2>
      <ErrorBox error={moves.error} />
      <TableCard footer={moves.data && <Pagination page={moves.data.page} pageSize={moves.data.pageSize} total={moves.data.total} onPage={setPage} />}>
        {moves.loading && !moves.data ? <Loading /> : moves.data.movements.length === 0 ? (
          <div className="muted px-4 py-8 text-center">Este producto todavía no tiene movimientos.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="hidden sm:table-cell">Detalle</th>
                <th className="num">Cantidad</th>
                <th className="num">Saldo</th>
                <th className="hidden md:table-cell">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {moves.data.movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{dateTime(m.created_at)}</td>
                  <td><MovementBadge type={m.type} /></td>
                  <td className="hidden sm:table-cell">
                    {m.document_id ? (
                      <Link to={`/${m.document_type === 'egreso' ? 'egresos' : 'ingresos'}/${m.document_id}`}>{m.document_number}</Link>
                    ) : null}
                    <span className="muted">{m.document_id ? ' · ' : ''}{m.reason}</span>
                    {m.notes && <div className="muted text-[12px]">{m.notes}</div>}
                  </td>
                  <td className="num font-medium" style={{ color: m.quantity < 0 ? 'var(--gcal-danger)' : 'var(--gcal-success)' }}>
                    {m.quantity > 0 ? '+' : ''}{qty(m.quantity)}
                  </td>
                  <td className="num">{qty(m.stock_after)}</td>
                  <td className="muted hidden md:table-cell">{m.user_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <ProductFormModal
        open={editing}
        product={p}
        categories={categories}
        suppliers={suppliers}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          prod.reload();
          toast('Producto actualizado');
        }}
      />
      <AdjustModal
        open={adjusting}
        product={p}
        onClose={() => setAdjusting(false)}
        onSaved={() => {
          setAdjusting(false);
          refresh();
          toast('Stock ajustado');
        }}
      />
      <ConfirmDialog
        open={deleting}
        danger
        title="Eliminar producto"
        message={`¿Eliminar «${p.name}»? Solo es posible si no tiene movimientos; si los tiene, desactivalo desde Editar.`}
        confirmLabel="Eliminar"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await api.del(`/products/${id}`);
          toast('Producto eliminado');
          navigate('/productos');
        }}
      />
    </>
  );
}

const ADJUST_REASONS = ['Conteo físico', 'Corrección de carga', 'Faltante / robo', 'Rotura', 'Sobrante', 'Otro'];

function AdjustModal({ open, product, onClose, onSaved }) {
  const [mode, setMode] = useState('set');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState(ADJUST_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const num = Number(String(value).replace(',', '.'));
  const valid = value !== '' && Number.isFinite(num);
  const after = valid ? (mode === 'set' ? num : product.stock + num) : null;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/products/${product.id}/adjust`, { mode, quantity: num, reason, notes });
      setValue('');
      setNotes('');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal open={open} title="Ajustar stock" onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel="Registrar ajuste">
      <div className="flex gap-2">
        <button type="button" className={`chip ${mode === 'set' ? 'active' : ''}`} onClick={() => setMode('set')}>Conteo físico (stock real)</button>
        <button type="button" className={`chip ${mode === 'delta' ? 'active' : ''}`} onClick={() => setMode('delta')}>Sumar / restar</button>
      </div>
      <Field
        label={mode === 'set' ? `Stock contado (${product.unit})` : `Cantidad a sumar o restar (${product.unit})`}
        hint={mode === 'delta' ? 'Usá un número negativo para restar.' : null}
      >
        <input type="number" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
      </Field>
      <div className="flex justify-between rounded-lg bg-gcal-soft px-3 py-2 text-[13px]">
        <span>Actual: <b>{qtyUnit(product.stock, product.unit)}</b></span>
        <span>Resultado: <b style={{ color: after !== null && after < 0 ? 'var(--gcal-danger)' : undefined }}>{after === null ? '—' : qtyUnit(after, product.unit)}</b></span>
      </div>
      <Field label="Motivo">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {ADJUST_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Notas">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </Field>
    </FormModal>
  );
}
