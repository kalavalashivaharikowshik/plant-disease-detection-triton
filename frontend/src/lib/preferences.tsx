import { useEffect, useState, type ReactNode } from "react";
import { PreferencesContext, type EngineMode } from "./usePreferences";

function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  }, [key, value]);
  return [value, setValue];
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [techMode, setTechMode] = useStored("leafscan.techMode", false);
  const [language, setLanguage] = useStored("leafscan.language", "en");
  const [engineMode, setEngineMode] = useStored<EngineMode>("leafscan.engine", "server");
  return (
    <PreferencesContext.Provider value={{ techMode, setTechMode, language, setLanguage, engineMode, setEngineMode }}>
      {children}
    </PreferencesContext.Provider>
  );
}
