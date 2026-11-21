import clsx from "clsx";
import { Camera, History, Info, LayoutGrid, ScanLine } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { usePreferences } from "@/lib/usePreferences";

const NAV = [
  { to: "/", label: "Scan", icon: ScanLine, end: true },
  { to: "/live", label: "Live", icon: Camera },
  { to: "/field", label: "Field survey", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/about", label: "About", icon: Info },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <path d="M6 26C6 13 15 5 27 5c0 13-8 21-21 21z" fill="#4f7a5a" />
        <path d="M6 26 20 12" stroke="#f3f5ef" strokeWidth="2" strokeLinecap="round" />
        <circle cx="21" cy="11" r="3" fill="#e2a229" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight text-ink">LeafScan</span>
    </span>
  );
}

function TechToggle() {
  const { techMode, setTechMode } = usePreferences();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={techMode}
        onChange={(e) => setTechMode(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 rounded-full bg-mist transition-colors peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-turmeric"
      >
        <span
          className={clsx(
            "absolute top-1 h-4 w-4 rounded-full bg-sheet transition-all",
            techMode ? "left-5" : "left-1",
          )}
        />
      </span>
      Tech mode
    </label>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-sheet focus:p-2">
        Skip to content
      </a>
      <header className="no-print border-b border-mist bg-paper/95 backdrop-blur">
        <div className="page flex h-16 items-center justify-between gap-4">
          <NavLink to="/" aria-label="LeafScan home">
            <Logo />
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                    isActive ? "bg-ink text-paper" : "text-body hover:bg-mist",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <TechToggle />
        </div>
      </header>

      <main id="main" className="flex-1 pb-24 md:pb-12">
        {children}
      </main>

      <footer className="no-print hidden border-t border-mist py-6 text-sm md:block">
        <div className="page flex flex-wrap items-center justify-between gap-2">
          <span>Built by Kalavala Shiva Hari Kowshik. Guidance is educational; confirm serious cases locally.</span>
          <span>© {new Date().getFullYear()} LeafScan</span>
        </div>
      </footer>

      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-mist bg-sheet md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-bold",
                isActive ? "text-ink" : "text-moss",
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
