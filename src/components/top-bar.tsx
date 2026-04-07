"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
let siteTitle = "Memoir";
try { siteTitle = require("@/data/config.json").siteTitle; } catch {}

export type Theme = "light" | "dark" | "parchment";
export type Layout = "grid" | "editorial";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  parchment: "Parchment",
};

const LAYOUT_LABELS: Record<Layout, string> = {
  grid: "Grid",
  editorial: "Editorial",
};

interface TopBarProps {
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  tripSlug?: string;
  allTrips?: { slug: string; title: string; dateRange: string }[];
}

export function TopBar({ layout, onLayoutChange, tripSlug, allTrips }: TopBarProps) {
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

  return (
    <nav className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link href="/" className="topbar-logo">
            {siteTitle}
          </Link>
        </div>
        {allTrips && allTrips.length > 1 && (
          <LandingNav trips={allTrips} currentSlug={tripSlug} />
        )}
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
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
