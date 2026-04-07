"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Trip {
  slug: string;
  title: string;
  dateRange: string;
}

interface LandingNavProps {
  trips: Trip[];
  currentSlug?: string;
}

export function LandingNav({ trips, currentSlug }: LandingNavProps) {
  const isLinkMode = !!currentSlug;
  const [activeIndex, setActiveIndex] = useState(() =>
    currentSlug ? trips.findIndex((t) => t.slug === currentSlug) : 0
  );
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [closestItem, setClosestItem] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which card is visible via horizontal scroll (landing page only)
  useEffect(() => {
    if (isLinkMode) return;

    const viewport = document.querySelector(".trip-carousel-viewport");
    if (!viewport) return;

    const cards = document.querySelectorAll(".trip-carousel-card");
    if (cards.length === 0) return;

    const onScroll = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const anchor = viewportRect.left + viewportRect.width * 0.33;

      let minDist = Infinity;
      let minIdx = 0;
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const dist = Math.abs(anchor - cardCenter);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      });
      setActiveIndex(minIdx);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [trips.length, isLinkMode]);

  // Find closest item to mouse
  useEffect(() => {
    if (!isHovering || mouseX === null) {
      setClosestItem(null);
      return;
    }

    let minDist = Infinity;
    let minIdx = 0;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(mouseX - center);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    });
    setClosestItem(minIdx);
  }, [mouseX, isHovering]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMouseX(e.clientX);
  }, []);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setIsHovering(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setIsHovering(false);
      setMouseX(null);
      setClosestItem(null);
    }, 300);
  }, []);

  const scrollToCard = (index: number) => {
    const viewport = document.querySelector(".trip-carousel-viewport");
    const cards = document.querySelectorAll(".trip-carousel-card");
    if (!viewport || !cards[index]) return;

    const card = cards[index] as HTMLElement;
    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardCenter = cardRect.left + cardRect.width / 2;
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const offset = cardCenter - viewportCenter;

    viewport.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (trips.length <= 1) return null;

  return (
    <div
      className="landing-nav"
      ref={railRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={handleMouseMove}
    >
      <div className="landing-nav-bars">
        {trips.map((trip, i) => {
          const isActive = i === activeIndex;
          const isClosest = closestItem === i;

          const bar = (
            <>
              <div
                className={`landing-nav-bar ${isActive ? "landing-nav-bar--active" : ""} ${isClosest && isHovering ? "landing-nav-bar--hovered" : ""}`}
                style={{ height: 24 }}
              />
              <div className={`landing-nav-label ${isClosest && isHovering ? "landing-nav-label--visible" : ""}`}>
                <span className="landing-nav-title">{trip.title}</span>
                <span className="landing-nav-date">{trip.dateRange}</span>
              </div>
            </>
          );

          if (isLinkMode) {
            return (
              <Link
                key={trip.slug}
                ref={(el) => { itemRefs.current[i] = el; }}
                href={`/trips/${trip.slug}`}
                className="landing-nav-btn"
              >
                {bar}
              </Link>
            );
          }

          return (
            <button
              key={trip.slug}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="landing-nav-btn"
              onClick={() => scrollToCard(i)}
            >
              {bar}
            </button>
          );
        })}
      </div>
    </div>
  );
}
