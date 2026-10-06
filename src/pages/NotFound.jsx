import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Página no encontrada"
      text="La dirección no existe o fue movida."
      action={<Link to="/" className="pill-btn primary">Volver al inicio</Link>}
    />
  );
}
