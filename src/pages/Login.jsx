import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import PoweredBy from '../components/PoweredBy.jsx';
import { PRODUCT_NAME } from '../components/Layout.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gcal-soft px-4 pt-8 pb-24">
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-gcal-border bg-white px-6 py-8 sm:px-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="app-logo mb-3" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <ShoppingCart size={26} />
          </span>
          <h1 className="text-[24px] font-normal">{PRODUCT_NAME}</h1>
          <p className="muted mt-1 mb-0">Control de stock para supermercados</p>
        </div>
        <div className="flex flex-col gap-4">
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="pill-btn primary mt-2 w-full" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </form>
      <PoweredBy />
    </div>
  );
}
