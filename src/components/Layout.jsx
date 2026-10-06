import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  AlarmClock, ArrowDownToLine, ArrowUpFromLine, Boxes, LayoutDashboard, LogOut, Menu, Package,
  PackageSearch, Settings, ShoppingCart, Tags, Truck, History,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSettings } from '../store/SettingsProvider.jsx';
import PoweredBy from './PoweredBy.jsx';
import Breadcrumbs, { CrumbProvider } from './Breadcrumbs.jsx';

export const PRODUCT_NAME = 'Góndola';

const NAV = [
  { section: null, items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard, end: true }] },
  {
    section: 'Inventario',
    items: [
      { to: '/productos', label: 'Productos', icon: Package },
      { to: '/categorias', label: 'Categorías', icon: Tags },
      { to: '/proveedores', label: 'Proveedores', icon: Truck },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { to: '/ingresos', label: 'Ingresos', icon: ArrowDownToLine },
      { to: '/egresos', label: 'Egresos', icon: ArrowUpFromLine },
      { to: '/movimientos', label: 'Movimientos', icon: History },
    ],
  },
  {
    section: 'Alertas',
    items: [
      { to: '/reposicion', label: 'Reposición', icon: PackageSearch, alert: 'restock' },
      { to: '/vencimientos', label: 'Vencimientos', icon: AlarmClock, alert: 'expiring' },
    ],
  },
  { section: 'Sistema', items: [{ to: '/configuracion', label: 'Configuración', icon: Settings }] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings, alerts, refreshAlerts } = useSettings();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    refreshAlerts();
  }, [pathname, refreshAlerts]);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <CrumbProvider>
      <div className="app-shell">
        <header className="app-header">
          <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <NavLink to="/" className="flex min-w-0 items-center gap-3 pr-2 lg:w-[220px]">
            <span className="app-logo"><ShoppingCart size={20} /></span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[18px] font-medium text-[#202124]">{PRODUCT_NAME}</span>
              <span className="muted truncate text-[11px]">{settings.business_name}</span>
            </span>
          </NavLink>
          <div className="ml-auto flex items-center gap-1">
            <div className="relative" ref={menuRef}>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gcal-blue text-[13px] font-semibold text-white"
                onClick={() => setMenu((m) => !m)}
                aria-label="Menú de usuario"
                title={user?.name}
              >
                {initials}
              </button>
              {menu && (
                <div className="dropdown" style={{ left: 'auto', width: 240 }}>
                  <div className="border-b border-gcal-border px-4 py-3">
                    <div className="font-medium">{user?.name}</div>
                    <div className="muted text-[12px]">{user?.email}</div>
                    <span className="badge info mt-2">{user?.role === 'admin' ? 'Administrador' : 'Operador'}</span>
                  </div>
                  <NavLink to="/configuracion" className="dropdown-item" onClick={() => setMenu(false)}>
                    <span className="flex items-center gap-2"><Settings size={16} /> Configuración</span>
                  </NavLink>
                  <button className="dropdown-item" onClick={logout}>
                    <span className="flex items-center gap-2"><LogOut size={16} /> Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegación principal">
          <div className="mb-2 flex items-center gap-3 px-6 py-2 lg:hidden">
            <span className="app-logo"><ShoppingCart size={20} /></span>
            <span className="text-[18px] font-medium">{PRODUCT_NAME}</span>
          </div>
          {NAV.map((group, i) => (
            <div key={i}>
              {group.section && <div className="sidebar-section">{group.section}</div>}
              {group.items.map(({ to, label, icon: Icon, end, alert }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Icon size={20} strokeWidth={1.8} />
                  <span>{label}</span>
                  {alert && alerts[alert] > 0 && <span className="nav-count">{alerts[alert]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="mt-6 flex items-center gap-2 px-6 text-[12px] muted">
            <Boxes size={14} /> Control de stock
          </div>
        </aside>

        <main className="main-content">
          <Breadcrumbs />
          <Outlet />
        </main>
        <PoweredBy />
      </div>
    </CrumbProvider>
  );
}
