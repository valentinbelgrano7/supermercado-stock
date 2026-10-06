import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, title, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Modal con <form>: el submit se dispara con Enter o con el botón primario.
export function FormModal({ open, title, onClose, onSubmit, children, submitLabel = 'Guardar', saving, error, width }) {
  return (
    <Modal open={open} title={title} onClose={onClose} width={width}>
      <form
        id="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {error && <div className="form-error">{error}</div>}
        {children}
        <div className="modal-footer" style={{ padding: '8px 0 4px' }}>
          <button type="button" className="pill-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pill-btn primary" disabled={saving}>
            {saving ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
