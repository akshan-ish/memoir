"use client";

import { useState, useEffect, useRef } from "react";

type Theme = "light" | "dark" | "parchment";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  parchment: "Parchment",
};

export function LandingTheme({ siteTitle = "Memoir", children }: { siteTitle?: string; children?: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("memoir-theme") as Theme | null;
    if (saved && THEME_LABELS[saved]) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("memoir-theme", t);
  };

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <span className="topbar-logo">{siteTitle}</span>
        </div>
        {children}
        <div className="topbar-right" ref={dropdownRef}>
          <button
            className="topbar-settings-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Settings"
          >
            Settings
          </button>
          {open && (
            <div className="topbar-dropdown">
              <div className="topbar-dropdown-section">
                <span className="topbar-dropdown-label">Theme</span>
                {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                  <button
                    key={t}
                    className={`topbar-dropdown-item ${t === theme ? "topbar-dropdown-item--active" : ""}`}
                    onClick={() => switchTheme(t)}
                  >
                    <span className={`topbar-theme-dot topbar-theme-dot--${t}`} />
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
