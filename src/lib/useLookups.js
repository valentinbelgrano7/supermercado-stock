import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Categorías y proveedores para selects y filtros.
export function useLookups() {
  const [state, setState] = useState({ categories: [], suppliers: [] });
  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/suppliers')])
      .then(([c, s]) => setState({ categories: c.categories, suppliers: s.suppliers }))
      .catch(() => {});
  }, []);
  return state;
}
