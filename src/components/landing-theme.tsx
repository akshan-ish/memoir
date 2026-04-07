"use client";

import { useEffect } from "react";

export function LandingTheme() {
  useEffect(() => {
    const saved = localStorage.getItem("memoir-theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  return null;
}
