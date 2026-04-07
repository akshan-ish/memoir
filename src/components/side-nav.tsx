"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SideNavSection {
  label: string;
  sublabel?: string;
}

interface SideNavProps {
  sections: SideNavSection[];
  onExpandChange?: (expanded: boolean) => void;
}

interface NavItem {
  type: "day" | "location";
  dayLabel: string;
  locationLabel?: string;
  sectionIndex: number;
}

export function SideNav({ sections, onExpandChange }: SideNavProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [closestItem, setClosestItem] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build flat list of nav items
  const items: NavItem[] = [];
  sections.forEach((section, si) => {
    const locs = section.sublabel ? section.sublabel.split(" · ") : [];
    if (locs.length <= 1) {
      // Single or no location — one combined line
      items.push({
        type: "day",
        dayLabel: shortDate(section.label),
        locationLabel: locs[0] || undefined,
        sectionIndex: si,
      });
    } else {
      // Multiple locations — day line + sub-lines
      items.push({ type: "day", dayLabel: shortDate(section.label), sectionIndex: si });
      locs.forEach((loc) => {
        items.push({ type: "location", dayLabel: shortDate(section.label), locationLabel: loc, sectionIndex: si });
      });
    }
  });

  // Track active section
  useEffect(() => {
    const headings = document.querySelectorAll(".photo-section");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const idx = Array.from(headings).indexOf(visible[0].target as Element);
          if (idx >= 0) setActiveIndex(idx);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  // Find the closest item to mouse
  useEffect(() => {
    if (!isHovering || mouseY === null) {
      setClosestItem(null);
      return;
    }

    let minDist = Infinity;
    let minIdx = 0;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(mouseY - center);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    });
    setClosestItem(minIdx);
  }, [mouseY, isHovering]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMouseY(e.clientY);
  }, []);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setIsHovering(true);
    onExpandChange?.(true);
  }, [onExpandChange]);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setIsHovering(false);
      setMouseY(null);
      setClosestItem(null);
      onExpandChange?.(false);
    }, 300);
  }, [onExpandChange]);

  const scrollToSection = (sectionIndex: number) => {
    const headings = document.querySelectorAll(".photo-section");
    if (headings[sectionIndex]) {
      headings[sectionIndex].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getLineWidth = (itemIndex: number, type: "day" | "location"): number => {
    const DAY_MIN = 10;
    const DAY_MAX = 36;
    const LOC_MIN = 6;
    const LOC_MAX = 24;
    const ACTIVE_BOOST = 4;
    const RADIUS = 80;

    const min = type === "day" ? DAY_MIN : LOC_MIN;
    const max = type === "day" ? DAY_MAX : LOC_MAX;
    const item = items[itemIndex];
    const isActive = item.sectionIndex === activeIndex;
    const base = isActive ? min + ACTIVE_BOOST : min;

    if (!isHovering || mouseY === null) return base;

    const el = itemRefs.current[itemIndex];
    if (!el) return base;

    const rect = el.getBoundingClientRect();
    const lineCenter = rect.top + rect.height / 2;
    const dist = Math.abs(mouseY - lineCenter);

    if (dist > RADIUS) return base;

    const t = 1 - (dist / RADIUS) ** 2;
    return base + (max - base) * t;
  };

  // Determine which section is hovered (if any)
  const hoveredSectionIndex = closestItem !== null && isHovering
    ? items[closestItem]?.sectionIndex ?? null
    : null;

  return (
    <>
      <div className={`sidenav-backdrop ${isHovering ? "sidenav-backdrop--visible" : ""}`} />

      <div
        className={`sidenav-rail ${isHovering ? "sidenav-rail--active" : ""}`}
        ref={railRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="sidenav-lines">
          {items.map((item, i) => {
            const isActive = item.sectionIndex === activeIndex;
            const isClosest = closestItem === i;
            const isDay = item.type === "day";
            const w = getLineWidth(i, item.type);
            const sectionHovered = hoveredSectionIndex === item.sectionIndex;

            return (
              <button
                key={i}
                ref={(el) => { itemRefs.current[i] = el; }}
                className={`sidenav-line-btn ${isDay ? "" : "sidenav-line-btn--sub"}`}
                onClick={() => scrollToSection(item.sectionIndex)}
              >
                <div className="sidenav-marker-slot">
                  {isClosest && isHovering && <span className="sidenav-active-dot sidenav-active-dot--red" />}
                  {!isClosest && isActive && isDay && <span className="sidenav-active-dot" />}
                </div>

                <div
                  className={`sidenav-bar ${isDay ? "sidenav-bar--day" : "sidenav-bar--loc"} ${isActive ? "sidenav-bar--active" : ""} ${isClosest && isHovering ? "sidenav-bar--hovered" : ""}`}
                  style={{ width: w }}
                />

                <div className={`sidenav-label-wrap ${(isClosest || (sectionHovered && (isDay || !isDay))) && isHovering ? "sidenav-label-wrap--visible" : ""}`}>
                  {isDay && (
                    <>
                      <span className="sidenav-lbl-date">{item.dayLabel}</span>
                      {item.locationLabel && (
                        <span className="sidenav-lbl-loc">{item.locationLabel}</span>
                      )}
                    </>
                  )}
                  {!isDay && item.locationLabel && (
                    <span className="sidenav-lbl-loc">{item.locationLabel}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function shortDate(label: string): string {
  const parts = label.split(", ");
  if (parts.length > 1) {
    const m = parts[1]?.match(/(\w+)\s+(\d+)/);
    if (m) return `${m[1].slice(0, 3)} ${m[2]}`;
  }
  const m = label.match(/(\w+)\s+(\d+)/);
  if (m) return `${m[1].slice(0, 3)} ${m[2]}`;
  return label;
}
