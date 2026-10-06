import { useState } from 'react';
import { Link } from 'react-router';
import { Mail, Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { int } from '../lib/format.js';
import { EmptyState, ErrorBox, Field, Loading, PageHeader, SearchInput, TableCard } from '../components/ui.jsx';
import { FormModal } from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';

const EMPTY = { name: '', cuit: '', contact: '', phone: '', email: '', address: '', notes: '' };

export default function Suppliers() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data, loading, error: loadError, reload } = useFetch(() => api.get('/suppliers', { q }), [q]);

  const open = (s) => {
    setEditing(s);
    setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ''])) });
    setError('');
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post('/suppliers', form);
      toast(editing.id ? 'Proveedor actualizado' : 'Proveedor creado');
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Proveedores" subtitle="Distribuidores y mayoristas que abastecen al local"
        actions={<button className="pill-btn primary" onClick={() => open({})}><Plus size={16} /> Nuevo proveedor</button>} />
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Nombre, CUIT o contacto" /></div>
      <ErrorBox error={loadError} />
      <TableCard>
        {loading && !data ? <Loading /> : data.suppliers.length === 0 ? (
          <EmptyState icon={Truck} title="Sin proveedores" text="Cargá tus proveedores para asociarlos a productos e ingresos." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th className="hidden md:table-cell">Contacto</th>
                <th className="num">Productos</th>
                <th className="num hidden sm:table-cell">A reponer</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/productos?supplier_id=${s.id}`} className="font-medium text-inherit hover:underline">{s.name}</Link>
                    {s.cuit && <div className="muted text-[12px]">CUIT {s.cuit}</div>}
                  </td>
                  <td className="hidden md:table-cell">
                    <div>{s.contact || <span className="muted">—</span>}</div>
                    <div className="muted flex flex-wrap gap-x-3 text-[12px]">
                      {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-inherit"><Phone size={12} />{s.phone}</a>}
                      {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-inherit"><Mail size={12} />{s.email}</a>}
                    </div>
                  </td>
                  <td className="num">{int(s.product_count)}</td>
                  <td className="num hidden sm:table-cell">
                    {s.low_count > 0 ? <Link to={`/reposicion?supplier_id=${s.id}`} className="badge warning">{s.low_count}</Link> : <span className="muted">0</span>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="icon-btn sm" onClick={() => open(s)} aria-label="Editar"><Pencil size={16} /></button>
                    <button className="icon-btn sm danger" onClick={() => setDeleting(s)} aria-label="Eliminar"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <FormModal open={Boolean(editing)} title={editing?.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setEditing(null)}
        onSubmit={save} saving={saving} error={error} width={600}>
        <Field label="Razón social / nombre *"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CUIT"><input value={form.cuit} onChange={set('cuit')} placeholder="30-12345678-9" /></Field>
          <Field label="Contacto"><input value={form.contact} onChange={set('contact')} /></Field>
          <Field label="Teléfono"><input value={form.phone} onChange={set('phone')} type="tel" /></Field>
          <Field label="Email"><input value={form.email} onChange={set('email')} type="email" /></Field>
        </div>
        <Field label="Dirección"><input value={form.address} onChange={set('address')} /></Field>
        <Field label="Notas" hint="Días de visita, condiciones de pago, etc."><textarea value={form.notes} onChange={set('notes')} /></Field>
      </FormModal>
      <ConfirmDialog open={Boolean(deleting)} danger title="Eliminar proveedor" confirmLabel="Eliminar"
        message={`¿Eliminar «${deleting?.name}»? Los productos y documentos asociados quedarán sin proveedor.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api.del(`/suppliers/${deleting.id}`);
          toast('Proveedor eliminado');
          reload();
        }} />
    </>
  );
}
