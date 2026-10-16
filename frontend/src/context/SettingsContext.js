import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  return (
    <SettingsCtx.Provider value={{ settings, baseCurrency, refresh, update }}>
      {children}
    </SettingsCtx.Provider>
  );
}
