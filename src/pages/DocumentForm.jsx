import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Ban, CheckCircle2, Package, Save, Trash2, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useLookups } from '../lib/useLookups.js';
import { DOC_TYPES } from '../lib/docs.js';
import { date, dateTime, money, qty, qtyUnit, today, UNIT_LABEL } from '../lib/format.js';
import { useSettings } from '../store/SettingsProvider.jsx';
import { useCrumb } from '../components/Breadcrumbs.jsx';
import { ErrorBox, Field, Loading } from '../components/ui.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import ProductPicker from '../components/ProductPicker.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function toItem(p, extra = {}) {
  return {
    key: newKey(),
    product_id: p.product_id ?? p.id,
    product_name: p.product_name ?? p.name,
    sku: p.sku,
    unit: p.unit,
    current_stock: p.current_stock ?? p.stock,
    product_cost: p.product_cost ?? p.cost,
    quantity: '1',
    unit_cost: String(p.unit_cost ?? p.product_cost ?? p.cost ?? ''),
    lot: '',
    expiry_date: '',
    ...extra,
  };
}

const toNum = (v) => Number(String(v ?? '').replace(',', '.')) || 0;

export default function DocumentForm({ type }) {
  const cfg = DOC_TYPES[type];
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { reasons, settings, refreshAlerts } = useSettings();
  const { suppliers } = useLookups();

  const [doc, setDoc] = useState(null);
  const [header, setHeader] = useState({ reason: cfg.defaultReason, supplier_id: '', date: today(), reference: '', notes: '' });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null); // 'confirm' | 'cancel' | 'delete'
  const [cancelNotes, setCancelNotes] = useState('');

  useCrumb(isNew ? null : doc?.number);

  // Carga del documento existente o prefill (ej. desde Reposición)
  useEffect(() => {
    if (isNew) {
      const pre = location.state?.prefill;
      setDoc(null);
      setHeader({
        reason: pre?.reason || cfg.defaultReason,
        supplier_id: pre?.supplier_id ? String(pre.supplier_id) : '',
        date: today(),
        reference: '',
        notes: pre?.notes || '',
      });
      setItems((pre?.items || []).map((p) => toItem(p, { quantity: String(p.quantity ?? 1) })));
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/documents/${id}`)
      .then(({ document: d }) => {
        if (d.type !== type) {
          navigate(`${DOC_TYPES[d.type].path}/${d.id}`, { replace: true });
          return;
        }
        setDoc(d);
        setHeader({
          reason: d.reason, supplier_id: d.supplier_id ? String(d.supplier_id) : '', date: d.date,
          reference: d.reference || '', notes: d.notes || '',
        });
        setItems(d.items.map((it) => toItem(it, {
          quantity: String(it.quantity), unit_cost: String(it.unit_cost), lot: it.lot || '', expiry_date: it.expiry_date || '',
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = isNew || doc?.status === 'draft';
  const isIngreso = type === 'ingreso';

  const total = useMemo(
    () => items.reduce((s, it) => s + toNum(it.quantity) * (isIngreso ? toNum(it.unit_cost) : toNum(it.unit_cost) || toNum(it.product_cost)), 0),
    [items, isIngreso]
  );

  const addProduct = (p) => {
    setItems((list) => {
      const idx = list.findIndex((it) => it.product_id === p.id && !it.lot && !it.expiry_date);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], quantity: String(toNum(copy[idx].quantity) + 1) };
        return copy;
      }
      return [...list, toItem(p, { unit_cost: isIngreso ? String(p.cost ?? '') : '0' })];
    });
  };
  const updateItem = (key, field, value) => setItems((list) => list.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  const removeItem = (key) => setItems((list) => list.filter((it) => it.key !== key));
  const setH = (k) => (e) => setHeader((h) => ({ ...h, [k]: e.target.value }));

  const payload = (confirm) => ({
    type,
    ...header,
    confirm,
    items: items.map((it) => ({
      product_id: it.product_id,
      quantity: toNum(it.quantity),
      unit_cost: isIngreso ? toNum(it.unit_cost) : 0,
      lot: it.lot,
      expiry_date: it.expiry_date,
    })),
  });

  const save = async (confirm = false) => {
    setSaving(true);
    setError('');
    try {
      const r = isNew ? await api.post('/documents', payload(confirm)) : await api.put(`/documents/${id}`, payload(confirm));
      toast(confirm ? `${cfg.singular} confirmado: stock actualizado` : 'Borrador guardado');
      refreshAlerts();
      if (isNew) navigate(`${cfg.path}/${r.document.id}`, { replace: true });
      else applyLoaded(r.document);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const applyLoaded = (d) => {
    setDoc(d);
    setItems(d.items.map((it) => toItem(it, {
      quantity: String(it.quantity), unit_cost: String(it.unit_cost), lot: it.lot || '', expiry_date: it.expiry_date || '',
    })));
  };

  if (loading) return <Loading />;
  if (!isNew && !doc) return <ErrorBox error={error || 'Documento no encontrado.'} />;

  const reasonMap = reasons[type] || {};
  const shortages = !isIngreso && editable && !settings.allow_negative_stock
    ? items.filter((it) => toNum(it.quantity) > Number(it.current_stock))
    : [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-normal">{isNew ? `Nuevo ${cfg.singular.toLowerCase()}` : doc.number}</h1>
            {doc && <StatusBadge status={doc.status} />}
          </div>
          <p className="muted mt-1 mb-0 text-[13px]">
            {isNew ? 'Se guarda como borrador; el stock cambia recién al confirmar.' : (
              <>
                Creado {dateTime(doc.created_at)}{doc.created_by_name ? ` por ${doc.created_by_name}` : ''}
                {doc.confirmed_at && ` · Confirmado ${dateTime(doc.confirmed_at)}`}
                {doc.cancelled_at && ` · Anulado ${dateTime(doc.cancelled_at)}`}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && doc.status === 'draft' && (
            <button className="pill-btn" onClick={() => setDialog('delete')}><Trash2 size={16} /> Eliminar</button>
          )}
          {editable && (
            <>
              <button className="pill-btn" disabled={saving} onClick={() => save(false).catch(() => {})}><Save size={16} /> Guardar borrador</button>
              <button className="pill-btn primary" disabled={saving || items.length === 0} onClick={() => setDialog('confirm')}>
                <CheckCircle2 size={16} /> Confirmar
              </button>
            </>
          )}
          {doc?.status === 'confirmed' && (
            <button className="pill-btn" onClick={() => setDialog('cancel')} style={{ color: 'var(--gcal-danger)' }}><Ban size={16} /> Anular</button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="panel mb-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Motivo">
            <select value={header.reason} onChange={setH('reason')} disabled={!editable}>
              {Object.entries(reasonMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" value={header.date} onChange={setH('date')} disabled={!editable} required />
          </Field>
          {(isIngreso || header.reason === 'devolucion_proveedor') && (
            <Field label="Proveedor">
              <select value={header.supplier_id} onChange={setH('supplier_id')} disabled={!editable}>
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={isIngreso ? 'Remito / factura' : 'Referencia'}>
            <input value={header.reference} onChange={setH('reference')} disabled={!editable} placeholder={isIngreso ? 'Ej. 0001-00012345' : 'Ej. Ticket Z, caja 2'} />
          </Field>
        </div>
        <Field label="Notas" className="mt-4">
          <textarea value={header.notes} onChange={setH('notes')} disabled={!editable} style={{ minHeight: 56 }} />
        </Field>
      </div>

      <div className="overflow-hidden rounded-xl border border-gcal-border bg-white">
        {editable && (
          <div className="border-b border-gcal-border p-3">
            <ProductPicker onPick={addProduct} />
          </div>
        )}
        {items.length === 0 ? (
          <div className="muted flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Package size={22} />
            <span>Escaneá códigos de barras o buscá productos para agregarlos.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num hidden sm:table-cell">Stock actual</th>
                  <th className="num" style={{ width: 120 }}>Cantidad</th>
                  <th className="num" style={{ width: 130 }}>{isIngreso ? 'Costo unit.' : 'Costo (valoriz.)'}</th>
                  {isIngreso && <th style={{ width: 110 }}>Lote</th>}
                  {isIngreso && <th style={{ width: 150 }}>Vencimiento</th>}
                  <th className="num">Subtotal</th>
                  {editable && <th style={{ width: 44 }} />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const cost = isIngreso ? toNum(it.unit_cost) : toNum(it.unit_cost) || toNum(it.product_cost);
                  const short = shortages.includes(it);
                  return (
                    <tr key={it.key}>
                      <td>
                        <Link to={`/productos/${it.product_id}`} className="font-medium text-inherit hover:underline">{it.product_name}</Link>
                        <div className="muted text-[12px]">{it.sku}</div>
                      </td>
                      <td className="num hidden sm:table-cell">
                        <span style={{ color: short ? 'var(--gcal-danger)' : undefined }}>{qtyUnit(it.current_stock, it.unit)}</span>
                      </td>
                      <td className="num">
                        {editable ? (
                          <input className="input sm text-right" type="number" min="0" step={it.unit === 'un' ? 1 : 0.001} value={it.quantity}
                            onChange={(e) => updateItem(it.key, 'quantity', e.target.value)}
                            style={short ? { borderColor: 'var(--gcal-danger)' } : undefined} />
                        ) : `${qty(it.quantity)} ${UNIT_LABEL[it.unit]}`}
                      </td>
                      <td className="num">
                        {editable && isIngreso ? (
                          <input className="input sm text-right" type="number" min="0" step="0.01" value={it.unit_cost}
                            onChange={(e) => updateItem(it.key, 'unit_cost', e.target.value)} />
                        ) : money(cost)}
                      </td>
                      {isIngreso && (
                        <td>
                          {editable ? <input className="input sm" value={it.lot} onChange={(e) => updateItem(it.key, 'lot', e.target.value)} placeholder="—" />
                            : it.lot || <span className="muted">—</span>}
                        </td>
                      )}
                      {isIngreso && (
                        <td>
                          {editable ? <input className="input sm" type="date" value={it.expiry_date} onChange={(e) => updateItem(it.key, 'expiry_date', e.target.value)} />
                            : it.expiry_date ? date(it.expiry_date) : <span className="muted">—</span>}
                        </td>
                      )}
                      <td className="num font-medium">{money(toNum(it.quantity) * cost)}</td>
                      {editable && (
                        <td>
                          <button className="icon-btn sm danger" onClick={() => removeItem(it.key)} aria-label="Quitar"><X size={16} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gcal-border bg-gcal-soft px-4 py-3">
          <span className="muted text-[13px]">
            {items.length} {items.length === 1 ? 'renglón' : 'renglones'} · {qty(items.reduce((s, it) => s + toNum(it.quantity), 0))} unidades
          </span>
          <span className="text-[16px]">Total <b className="tabular">{money(total)}</b></span>
        </div>
      </div>

      {shortages.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--gcal-warning-bg)', color: 'var(--gcal-warning)' }}>
          <AlertTriangle size={16} /> {shortages.length === 1 ? 'Un producto supera' : `${shortages.length} productos superan`} el stock disponible. No se podrá confirmar.
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'confirm'}
        title={`Confirmar ${cfg.singular.toLowerCase()}`}
        confirmLabel="Confirmar"
        message={isIngreso
          ? `Se sumarán al stock ${items.length} productos por ${money(total)}.${header.reason === 'compra' && settings.update_cost_on_purchase ? ' El costo de cada producto se actualizará con el de esta compra.' : ''}`
          : `Se descontarán del stock ${items.length} productos (valorizado ${money(total)}).`}
        onClose={() => setDialog(null)}
        onConfirm={() => save(true)}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        danger
        title={`Anular ${doc?.number}`}
        confirmLabel="Anular"
        message={isIngreso
          ? 'Se restará del stock la mercadería que ingresó con este documento. Esta acción no se puede deshacer.'
          : 'Se devolverá al stock la mercadería egresada con este documento. Esta acción no se puede deshacer.'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          const r = await api.post(`/documents/${id}/cancel`, { notes: cancelNotes });
          applyLoaded(r.document);
          setHeader((h) => ({ ...h, notes: r.document.notes || '' }));
          setCancelNotes('');
          refreshAlerts();
          toast('Documento anulado');
        }}
      >
        <Field label="Motivo de la anulación (opcional)">
          <input value={cancelNotes} onChange={(e) => setCancelNotes(e.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'delete'}
        danger
        title="Eliminar borrador"
        confirmLabel="Eliminar"
        message={`¿Eliminar el borrador ${doc?.number}? No afecta el stock.`}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await api.del(`/documents/${id}`);
          toast('Borrador eliminado');
          navigate(cfg.path);
        }}
      />
    </>
  );
}
