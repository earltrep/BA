import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../lib/api";

const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  const refresh = useCallback(async () => {
    const { data } = await api.get("/settings");
    setSettings(data);
    return data;
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const update = async (patch) => {
    const { data } = await api.put("/settings", patch);
    setSettings((s) => ({ ...s, ...data }));
    return data;
  };

  const baseCurrency = settings?.base_currency || "USD";
  const currencies = useMemo(() => settings?.currencies || {}, [settings]);

  const convert = useCallback(
    (amount, from = "USD", to = baseCurrency) => {
      const rf = currencies[from]?.rate || 1;
      const rt = currencies[to]?.rate || 1;
      return (Number(amount || 0) / rf) * rt;
    },
    [currencies, baseCurrency]
  );

  const refreshRates = useCallback(async () => {
    const { data } = await api.post("/rates/refresh");
    setSettings((s) => ({ ...s, currencies: data.rates, rates_updated: data.updated }));
    return data;
  }, []);

  return (
    <SettingsCtx.Provider
      value={{ settings, baseCurrency, currencies, convert, refresh, update, refreshRates, ratesUpdated: settings?.rates_updated }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}
