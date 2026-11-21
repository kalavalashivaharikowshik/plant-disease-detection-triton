import { createContext, useContext } from "react";

export type EngineMode = "server" | "device";

export interface Preferences {
  techMode: boolean;
  setTechMode: (value: boolean) => void;
  language: string;
  setLanguage: (value: string) => void;
  engineMode: EngineMode;
  setEngineMode: (value: EngineMode) => void;
}

export const PreferencesContext = createContext<Preferences | null>(null);

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
