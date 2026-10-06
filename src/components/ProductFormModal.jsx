import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { FormModal } from './Modal.jsx';
import { Field } from './ui.jsx';
import { money } from '../lib/format.js';

const EMPTY = {
  sku: '', barcode: '', name: '', category_id: '', supplier_id: '', unit: 'un',
  cost: '', price: '', min_stock: '', location: '', active: true, initial_stock: '',
};

export default function ProductFormModal({ open, product, categories, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(product?.id);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(product ? {
      ...EMPTY,
      ...Object.fromEntries(Object.entries(product).map(([k, v]) => [k, v ?? ''])),
    } : EMPTY);
  }, [open, product]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const r = isEdit ? await api.put(`/products/${product.id}`, form) : await api.post('/products', form);
      onSaved(r.product);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cost = Number(String(form.cost).replace(',', '.')) || 0;
  const price = Number(String(form.price).replace(',', '.')) || 0;
  const markup = cost > 0 && price > 0 ? ((price / cost - 1) * 100).toFixed(1).replace('.', ',') : null;

  return (
    <FormModal open={open} title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}
      onSubmit={submit} saving={saving} error={error} width={640}>
      <Field label="Nombre *">
        <input value={form.name} onChange={set('name')} required autoFocus placeholder="Ej. Leche entera 1 L" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código de barras (EAN)" hint="Podés escanearlo con el lector.">
          <input value={form.barcode} onChange={set('barcode')} inputMode="numeric" />
        </Field>
        <Field label={isEdit ? 'SKU *' : 'SKU'} hint={isEdit ? null : 'Si lo dejás vacío se genera automáticamente.'}>
          <input value={form.sku} onChange={set('sku')} required={isEdit} />
        </Field>
        <Field label="Categoría">
          <select value={form.category_id} onChange={set('category_id')}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Proveedor habitual">
          <select value={form.supplier_id} onChange={set('supplier_id')}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Unidad">
          <select value={form.unit} onChange={set('unit')}>
            <option value="un">Unidad</option>
            <option value="kg">Kilo</option>
            <option value="lt">Litro</option>
          </select>
        </Field>
        <Field label="Costo">
          <input type="number" step="0.01" min="0" value={form.cost} onChange={set('cost')} />
        </Field>
        <Field label="Precio de venta" hint={markup ? `Margen ${markup} %` : null}>
          <input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} />
        </Field>
        <Field label="Stock mínimo" hint="Alerta de reposición">
          <input type="number" step="0.001" min="0" value={form.min_stock} onChange={set('min_stock')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ubicación" hint="Góndola, heladera, depósito…">
          <input value={form.location} onChange={set('location')} />
        </Field>
        {isEdit ? (
          <Field label="Stock actual" hint="Para cambiarlo usá «Ajustar stock» o un ingreso/egreso.">
            <input value={form.stock} disabled />
          </Field>
        ) : (
          <Field label="Stock inicial" hint="Se registra como ajuste «Stock inicial».">
            <input type="number" step="0.001" value={form.initial_stock} onChange={set('initial_stock')} />
          </Field>
        )}
      </div>
      {isEdit && (
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={set('active')} /> Producto activo
        </label>
      )}
      {cost > 0 && price > 0 && price < cost && (
        <div className="form-error" style={{ background: 'var(--gcal-warning-bg)', color: 'var(--gcal-warning)' }}>
          El precio de venta ({money(price)}) es menor al costo ({money(cost)}).
        </div>
      )}
    </FormModal>
  );
}
