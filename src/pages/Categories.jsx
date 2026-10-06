import { useState } from 'react';
import { Link } from 'react-router';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useFetch } from '../lib/useFetch.js';
import { int, money } from '../lib/format.js';
import { EmptyState, ErrorBox, Field, Loading, PageHeader, SearchInput, TableCard } from '../components/ui.jsx';
import { FormModal } from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Categories() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data, loading, error: loadError, reload } = useFetch(() => api.get('/categories', { q }), [q]);

  const open = (c) => {
    setEditing(c);
    setName(c.name || '');
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.put(`/categories/${editing.id}`, { name });
      else await api.post('/categories', { name });
      toast(editing.id ? 'Categoría actualizada' : 'Categoría creada');
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
      <PageHeader title="Categorías" subtitle="Rubros para agrupar productos y analizar el stock"
        actions={<button className="pill-btn primary" onClick={() => open({})}><Plus size={16} /> Nueva categoría</button>} />
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Buscar categoría" /></div>
      <ErrorBox error={loadError} />
      <TableCard>
        {loading && !data ? <Loading /> : data.categories.length === 0 ? (
          <EmptyState icon={Tags} title="Sin categorías" text="Creá categorías como Almacén, Bebidas o Lácteos." />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th className="num">Productos</th><th className="num hidden sm:table-cell">Valor del stock</th><th style={{ width: 90 }} /></tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium"><Link to={`/productos?category_id=${c.id}`} className="text-inherit hover:underline">{c.name}</Link></td>
                  <td className="num">{int(c.product_count)}</td>
                  <td className="num hidden sm:table-cell">{money(c.stock_value)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="icon-btn sm" onClick={() => open(c)} aria-label="Editar"><Pencil size={16} /></button>
                    <button className="icon-btn sm danger" onClick={() => setDeleting(c)} aria-label="Eliminar"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <FormModal open={Boolean(editing)} title={editing?.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setEditing(null)}
        onSubmit={save} saving={saving} error={error} width={420}>
        <Field label="Nombre *"><input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
      </FormModal>
      <ConfirmDialog open={Boolean(deleting)} danger title="Eliminar categoría" confirmLabel="Eliminar"
        message={`¿Eliminar «${deleting?.name}»? Sus ${deleting?.product_count || 0} productos quedarán sin categoría.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api.del(`/categories/${deleting.id}`);
          toast('Categoría eliminada');
          reload();
        }} />
    </>
  );
}
