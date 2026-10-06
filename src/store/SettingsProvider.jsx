import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { configureFormat } from '../lib/format.js';

const SettingsContext = createContext(null);

const DEFAULTS = {
  business_name: 'Mi Supermercado',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  expiry_alert_days: 30,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [reasons, setReasons] = useState({ ingreso: {}, egreso: {} });
  const [alerts, setAlerts] = useState({ restock: 0, expiring: 0 });

  const refreshAlerts = useCallback(() => {
    Promise.all([api.get('/reports/restock'), api.get('/reports/expiries')])
      .then(([r, e]) => setAlerts({ restock: r.products.length, expiring: e.items.length }))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const r = await api.get('/settings');
    configureFormat(r.settings);
    setSettings(r.settings);
    setReasons(r.reasons);
  }, []);

  useEffect(() => {
    load().catch(() => {});
    refreshAlerts();
  }, [load, refreshAlerts]);

  const update = useCallback((s) => {
    configureFormat(s);
    setSettings(s);
  }, []);

  const value = useMemo(
    () => ({ settings, reasons, update, reload: load, alerts, refreshAlerts }),
    [settings, reasons, update, load, alerts, refreshAlerts]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
