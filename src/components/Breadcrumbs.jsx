import { createContext, useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

const CrumbContext = createContext({ setLast: () => {} });

const SECTIONS = {
  productos: 'Productos',
  categorias: 'Categorías',
  proveedores: 'Proveedores',
  ingresos: 'Ingresos',
  egresos: 'Egresos',
  movimientos: 'Movimientos',
  reposicion: 'Reposición',
  vencimientos: 'Vencimientos',
  configuracion: 'Configuración',
  nuevo: 'Nuevo',
};

export function CrumbProvider({ children }) {
  const [last, setLast] = useState(null);
  const { pathname } = useLocation();
  useEffect(() => setLast(null), [pathname]);
  return <CrumbContext.Provider value={{ last, setLast }}>{children}</CrumbContext.Provider>;
}

// Permite a una página de detalle nombrar el último crumb (ej. nombre del producto).
export function useCrumb(label) {
  const { setLast } = useContext(CrumbContext);
  useEffect(() => {
    if (label) setLast(label);
  }, [label, setLast]);
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { last } = useContext(CrumbContext);
  const parts = pathname.split('/').filter(Boolean);

  const crumbs = [{ to: '/', label: 'Inicio' }];
  parts.forEach((p, i) => {
    const to = '/' + parts.slice(0, i + 1).join('/');
    const isLast = i === parts.length - 1;
    crumbs.push({ to, label: SECTIONS[p] ?? (isLast ? last ?? '…' : `#${p}`) });
  });

  return (
    <nav className="crumbs" aria-label="Ruta de navegación">
      {crumbs.map((c, i) =>
        i === crumbs.length - 1 ? (
          <span key={c.to} className="crumb current" aria-current="page">{c.label}</span>
        ) : (
          <Link key={c.to} to={c.to} className="crumb">{c.label}</Link>
        )
      )}
    </nav>
  );
}
