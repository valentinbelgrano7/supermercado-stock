import { useEffect, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { api } from '../api/client.js';
import { qtyUnit } from '../lib/format.js';

/**
 * Buscador de productos compatible con lectores de código de barras:
 * el lector "tipea" el código y manda Enter → búsqueda exacta por EAN/SKU.
 */
export default function ProductPicker({ onPick, placeholder = 'Escaneá o buscá un producto (nombre, SKU, código)…' }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get('/products', { q, pageSize: 8 })
        .then((r) => {
          setResults(r.products);
          setActive(-1);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (p, code) => {
    onPick(p);
    // Con lectores rápidos puede llegar otro código antes de que responda la búsqueda:
    // solo limpiamos si el input todavía tiene el código que resolvimos.
    if (code !== undefined && inputRef.current && inputRef.current.value.trim() !== code) return;
    if (inputRef.current) inputRef.current.value = '';
    setText('');
    setResults([]);
    setOpen(false);
    setError('');
    inputRef.current?.focus();
  };

  const onKeyDown = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && results[active]) return pick(results[active]);
      const code = e.currentTarget.value.trim();
      if (!code) return;
      try {
        const r = await api.get('/products/lookup', { code });
        pick(r.product, code);
      } catch {
        if (results.length === 1) pick(results[0]);
        else if (results.length > 1) setOpen(true);
        else setError(`No se encontró «${code}».`);
      }
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <ScanBarcode size={18} className="muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
      <input
        ref={inputRef}
        className="input"
        style={{ paddingLeft: 38, height: 42 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setError('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {error && <div className="mt-1 text-[12px]" style={{ color: 'var(--gcal-danger)' }}>{error}</div>}
      {open && results.length > 0 && (
        <div className="dropdown">
          {results.map((p, i) => (
            <button type="button" key={p.id} className={`dropdown-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => pick(p)}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="muted block text-[12px]">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</span>
              </span>
              <span className={`badge ${p.stock <= 0 ? 'danger' : p.stock <= p.min_stock ? 'warning' : ''}`}>
                {qtyUnit(p.stock, p.unit)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
