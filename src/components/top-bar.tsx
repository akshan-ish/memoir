"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
let siteTitle = "Memoir";
try { siteTitle = require("@/data/config.json").siteTitle; } catch {}

export type Theme = "light" | "dark" | "parchment";
export type Layout = "grid" | "editorial";
export type Density = "all" | "mini";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  parchment: "Parchment",
};

const LAYOUT_LABELS: Record<Layout, string> = {
  grid: "Grid",
  editorial: "Editorial",
};

const DENSITY_LABELS: Record<Density, string> = {
  all: "All photos",
  mini: "Curated 60",
};

interface TopBarProps {
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  hasCurated: boolean;
  tripSlug?: string;
  allTrips?: string[];
}

export function TopBar({ layout, onLayoutChange, density, onDensityChange, hasCurated, tripSlug, allTrips }: TopBarProps) {
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

  const switchLayout = (l: Layout) => {
    onLayoutChange(l);
    localStorage.setItem("memoir-layout", l);
  };

  const switchDensity = (d: Density) => {
    onDensityChange(d);
    localStorage.setItem("memoir-density", d);
  };

  // Find prev/next trip for navigation
  const currentIdx = allTrips?.indexOf(tripSlug || "") ?? -1;
  const prevTrip = currentIdx > 0 ? allTrips![currentIdx - 1] : null;
  const nextTrip = currentIdx >= 0 && currentIdx < (allTrips?.length ?? 0) - 1
    ? allTrips![currentIdx + 1]
    : null;

  return (
    <nav className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link href="/" className="topbar-logo">
            {siteTitle}
          </Link>
        </div>
        <div className="topbar-right" ref={dropdownRef}>
          {allTrips && allTrips.length > 1 && (
            <div className="topbar-trip-nav">
              {prevTrip ? (
                <Link href={`/trips/${prevTrip}`} className="topbar-nav-arrow">
                  &larr;
                </Link>
              ) : (
                <span className="topbar-nav-arrow topbar-nav-arrow--disabled">&larr;</span>
              )}
              {nextTrip ? (
                <Link href={`/trips/${nextTrip}`} className="topbar-nav-arrow">
                  &rarr;
                </Link>
              ) : (
                <span className="topbar-nav-arrow topbar-nav-arrow--disabled">&rarr;</span>
              )}
            </div>
          )}
          <button
            className="topbar-settings-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Settings"
          >
            ✳︎
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
              <div className="topbar-dropdown-divider" />
              <div className="topbar-dropdown-section">
                <span className="topbar-dropdown-label">Layout</span>
                {(Object.keys(LAYOUT_LABELS) as Layout[]).map((l) => (
                  <button
                    key={l}
                    className={`topbar-dropdown-item ${l === layout ? "topbar-dropdown-item--active" : ""}`}
                    onClick={() => switchLayout(l)}
                  >
                    {LAYOUT_LABELS[l]}
                  </button>
                ))}
              </div>
              {hasCurated && (
                <>
                  <div className="topbar-dropdown-divider" />
                  <div className="topbar-dropdown-section">
                    <span className="topbar-dropdown-label">Photos</span>
                    {(Object.keys(DENSITY_LABELS) as Density[]).map((d) => (
                      <button
                        key={d}
                        className={`topbar-dropdown-item ${d === density ? "topbar-dropdown-item--active" : ""}`}
                        onClick={() => switchDensity(d)}
                      >
                        {DENSITY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
