import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-normal leading-tight">{title}</h1>
        {subtitle && <p className="muted mt-1 mb-0 text-[13px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

// Búsqueda con debounce
export function SearchInput({ value, onChange, placeholder = 'Buscar…', delay = 300, autoFocus }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  useEffect(() => {
    if (text === (value || '')) return;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full sm:w-72">
      <Search size={16} className="muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
      <input
        className="input"
        style={{ paddingLeft: 34, paddingRight: text ? 34 : 12, borderRadius: 999 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {text && (
        <button
          type="button"
          className="icon-btn sm absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => { setText(''); onChange(''); }}
          aria-label="Limpiar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-end gap-2 border-t border-gcal-border px-3 py-2 text-[13px] muted">
      <span className="tabular">{from}–{to} de {total.toLocaleString('es-AR')}</span>
      <button className="icon-btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior">
        <ChevronLeft size={18} />
      </button>
      <button className="icon-btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Siguiente">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {Icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-gcal-soft muted">
          <Icon size={22} />
        </div>
      )}
      <div className="font-medium text-[15px]">{title}</div>
      {text && <div className="muted max-w-sm text-[13px]">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function TableCard({ children, footer, toolbar }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gcal-border bg-white">
      {toolbar && <div className="border-b border-gcal-border px-3 py-2">{toolbar}</div>}
      <div className="table-wrap">{children}</div>
      {footer}
    </div>
  );
}

export function Loading({ text = 'Cargando…' }) {
  return <div className="muted px-4 py-10 text-center">{text}</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="form-error my-3">{error}</div>;
}
