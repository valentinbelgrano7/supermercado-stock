import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSettings } from '../store/SettingsProvider.jsx';
import { useFetch } from '../lib/useFetch.js';
import { date } from '../lib/format.js';
import { Field, PageHeader, TableCard } from '../components/ui.jsx';
import { FormModal } from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';

const TIMEZONES = [
  'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza',
  'America/Argentina/Salta', 'America/Argentina/Ushuaia', 'America/Montevideo', 'America/Santiago',
  'America/Asuncion', 'America/Sao_Paulo', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid',
];
const CURRENCIES = ['ARS', 'USD', 'UYU', 'CLP', 'PYG', 'BRL', 'PEN', 'COP', 'MXN', 'EUR'];

export default function Settings() {
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Configuración" subtitle="Datos del negocio, reglas de stock y usuarios" />
      <div className="flex max-w-4xl flex-col gap-6">
        <BusinessSettings readOnly={!isAdmin} />
        {isAdmin && <Users />}
        <ChangePassword />
      </div>
    </>
  );
}

function Section({ title, subtitle, children, actions }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle && <div className="muted text-[12px]">{subtitle}</div>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function BusinessSettings({ readOnly }) {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setForm(settings), [settings]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await api.put('/settings', form);
      update(r.settings);
      toast('Configuración guardada');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Negocio" subtitle={readOnly ? 'Solo un administrador puede modificar estos datos.' : null}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <div className="form-error">{error}</div>}
        <fieldset disabled={readOnly} className="m-0 flex flex-col gap-4 border-0 p-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del negocio *"><input value={form.business_name || ''} onChange={set('business_name')} required /></Field>
            <Field label="CUIT"><input value={form.cuit || ''} onChange={set('cuit')} /></Field>
          </div>
          <Field label="Dirección"><input value={form.address || ''} onChange={set('address')} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Moneda">
              <select value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Zona horaria">
              <select value={form.timezone} onChange={set('timezone')}>
                {[...new Set([form.timezone, ...TIMEZONES])].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Alerta de vencimiento (días)">
              <input type="number" min="1" max="365" value={form.expiry_alert_days} onChange={set('expiry_alert_days')} />
            </Field>
          </div>
          <div className="flex flex-col gap-3 rounded-lg bg-gcal-soft p-3">
            <label className="check">
              <input type="checkbox" checked={Boolean(form.update_cost_on_purchase)} onChange={set('update_cost_on_purchase')} />
              <span>Actualizar el costo del producto al confirmar una compra</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={Boolean(form.allow_negative_stock)} onChange={set('allow_negative_stock')} />
              <span>Permitir stock negativo (egresos sin stock suficiente)</span>
            </label>
          </div>
        </fieldset>
        {!readOnly && (
          <div className="flex justify-end">
            <button type="submit" className="pill-btn primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        )}
      </form>
    </Section>
  );
}

const EMPTY_USER = { name: '', email: '', role: 'operador', active: true, password: '' };

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, reload } = useFetch(() => api.get('/users'), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = (u) => {
    setEditing(u);
    setForm({ ...EMPTY_USER, ...u, password: '' });
    setError('');
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.put(`/users/${editing.id}`, form);
      else await api.post('/users', form);
      toast(editing.id ? 'Usuario actualizado' : 'Usuario creado');
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Usuarios"
      subtitle="Los operadores cargan ingresos, egresos y ajustes; los administradores además gestionan usuarios y configuración."
      actions={<button className="pill-btn sm primary" onClick={() => open({})}><Plus size={15} /> Nuevo usuario</button>}
    >
      <TableCard>
        <table className="data-table">
          <thead>
            <tr><th>Nombre</th><th className="hidden sm:table-cell">Email</th><th>Rol</th><th className="hidden md:table-cell">Alta</th><th style={{ width: 90 }} /></tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.name} {!u.active && <span className="badge cancelled ml-1">Inactivo</span>}
                  <div className="muted text-[12px] font-normal sm:hidden">{u.email}</div>
                </td>
                <td className="hidden sm:table-cell">{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'info' : ''}`}>{u.role === 'admin' ? 'Administrador' : 'Operador'}</span></td>
                <td className="muted hidden md:table-cell">{date(u.created_at)}</td>
                <td className="whitespace-nowrap text-right">
                  <button className="icon-btn sm" onClick={() => open(u)} aria-label="Editar"><Pencil size={16} /></button>
                  {u.id !== me.id && (
                    <button className="icon-btn sm danger" onClick={() => setDeleting(u)} aria-label="Eliminar"><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <FormModal open={Boolean(editing)} title={editing?.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setEditing(null)}
        onSubmit={save} saving={saving} error={error} width={480}>
        <Field label="Nombre *"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email *"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Rol">
          <select value={form.role} onChange={set('role')}>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>
        <Field label={editing?.id ? 'Nueva contraseña' : 'Contraseña *'} hint={editing?.id ? 'Dejala vacía para no cambiarla.' : 'Mínimo 6 caracteres.'}>
          <input type="password" value={form.password} onChange={set('password')} required={!editing?.id} minLength={6} autoComplete="new-password" />
        </Field>
        {editing?.id && (
          <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Usuario activo</label>
        )}
      </FormModal>
      <ConfirmDialog open={Boolean(deleting)} danger title="Eliminar usuario" confirmLabel="Eliminar"
        message={`¿Eliminar a ${deleting?.name}? Sus movimientos quedan registrados sin usuario. Si solo querés bloquear el acceso, desactivalo.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api.del(`/users/${deleting.id}`);
          toast('Usuario eliminado');
          reload();
        }} />
    </Section>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.repeat) return setError('Las contraseñas no coinciden.');
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/password', { current: form.current, next: form.next });
      setForm({ current: '', next: '', repeat: '' });
      toast('Contraseña actualizada');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Mi contraseña">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <div className="form-error">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Actual"><input type="password" value={form.current} onChange={set('current')} required autoComplete="current-password" /></Field>
          <Field label="Nueva"><input type="password" value={form.next} onChange={set('next')} required minLength={6} autoComplete="new-password" /></Field>
          <Field label="Repetir nueva"><input type="password" value={form.repeat} onChange={set('repeat')} required minLength={6} autoComplete="new-password" /></Field>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="pill-btn" disabled={saving}>{saving ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>
      </form>
    </Section>
  );
}
