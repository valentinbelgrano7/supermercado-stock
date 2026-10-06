import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos async y re-ejecuta cuando cambian las deps. Ignora respuestas viejas.
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const seq = useRef(0);

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    return fn()
      .then((data) => {
        if (id === seq.current) setState({ data, loading: false, error: '' });
      })
      .catch((err) => {
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error: err.message }));
      });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
