import { useState } from 'react';
import Modal from './Modal.jsx';

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onClose, children,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : () => { setError(''); onClose(); }}
      width={440}
      footer={
        <>
          <button type="button" className="pill-btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className={`pill-btn ${danger ? 'danger' : 'primary'}`} onClick={run} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {message && <p className="m-0">{message}</p>}
        {children}
        {error && <div className="form-error">{error}</div>}
      </div>
    </Modal>
  );
}
