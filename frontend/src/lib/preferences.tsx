import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type EngineMode = "server" | "device";

interface Preferences {
  techMode: boolean;
  setTechMode: (value: boolean) => void;
  language: string;
  setLanguage: (value: string) => void;
  engineMode: EngineMode;
  setEngineMode: (value: EngineMode) => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

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

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
