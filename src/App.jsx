import { Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import { SettingsProvider } from './store/SettingsProvider.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Categories from './pages/Categories.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Documents from './pages/Documents.jsx';
import DocumentForm from './pages/DocumentForm.jsx';
import Movements from './pages/Movements.jsx';
import Restock from './pages/Restock.jsx';
import Expiries from './pages/Expiries.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <SettingsProvider>
                  <Layout />
                </SettingsProvider>
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<Products />} />
            <Route path="productos/:id" element={<ProductDetail />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="proveedores" element={<Suppliers />} />
            <Route path="ingresos" element={<Documents type="ingreso" />} />
            <Route path="ingresos/nuevo" element={<DocumentForm type="ingreso" />} />
            <Route path="ingresos/:id" element={<DocumentForm type="ingreso" />} />
            <Route path="egresos" element={<Documents type="egreso" />} />
            <Route path="egresos/nuevo" element={<DocumentForm type="egreso" />} />
            <Route path="egresos/:id" element={<DocumentForm type="egreso" />} />
            <Route path="movimientos" element={<Movements />} />
            <Route path="reposicion" element={<Restock />} />
            <Route path="vencimientos" element={<Expiries />} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
