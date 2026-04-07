"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MasonryGrid } from "@/components/masonry-grid";
import { EditorialLayout } from "@/components/editorial-layout";
import { TopBar, type Layout, type Density } from "@/components/top-bar";
import { SideNav } from "@/components/side-nav";
let siteTitle = "Memoir";
try { siteTitle = require("@/data/config.json").siteTitle; } catch {}

interface Photo {
  id: number;
  src: string;
  thumb: string;
  width: number;
  height: number;
  aspectRatio: number;
  date: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  coordinates: string | null;
  curated?: boolean;
}

interface PhotoSection {
  label: string;
  sublabel?: string;
  photos: Photo[];
  startIndex: number;
}

interface PageContentProps {
  title: string;
  dateRange: string;
  photoCount: number;
  sections: PhotoSection[];
  photos: Photo[];
  tripSlug?: string;
  allTrips?: string[];
}

export function PageContent({
  title,
  dateRange,
  photoCount,
  sections,
  photos,
  tripSlug,
  allTrips,
}: PageContentProps) {
  const [layout, setLayout] = useState<Layout>("grid");
  const [density, setDensity] = useState<Density>("all");


  const hasCurated = photos.some((p) => p.curated === true) && photos.some((p) => p.curated === false);

  useEffect(() => {
    const savedLayout = localStorage.getItem("memoir-layout") as Layout | null;
    if (savedLayout === "grid" || savedLayout === "editorial") {
      setLayout(savedLayout);
    }
    const savedDensity = localStorage.getItem("memoir-density") as Density | null;
    if (savedDensity === "all" || savedDensity === "mini") {
      setDensity(savedDensity);
    }
  }, []);

  // Filter photos and rebuild sections based on density
  const activePhotos = density === "mini" && hasCurated
    ? photos.filter((p) => p.curated)
    : photos;

  const activeSections = density === "mini" && hasCurated
    ? sections
        .map((s) => ({
          ...s,
          photos: s.photos.filter((p) => p.curated),
        }))
        .filter((s) => s.photos.length > 0)
    : sections;

  // Recompute startIndex for filtered sections
  let runningIndex = 0;
  const indexedSections = activeSections.map((s) => {
    const section = { ...s, startIndex: runningIndex };
    runningIndex += s.photos.length;
    return section;
  });

  return (
    <>
      {layout === "grid" && <SideNav sections={indexedSections} />}
      <main className="mx-auto max-w-[1200px] px-6 sm:px-10 lg:pl-20 lg:pr-16">
        <TopBar
          layout={layout}
          onLayoutChange={setLayout}
          density={density}
          onDensityChange={setDensity}
          hasCurated={hasCurated}
          tripSlug={tripSlug}
          allTrips={allTrips}
        />

        {/* Header */}
        <header className="pb-16 pt-20 sm:pb-20 sm:pt-28 lg:pb-24 lg:pt-36">
          <p className="header-reveal font-mono text-[12px] font-light tracking-wide text-muted">
            {dateRange}
          </p>

          <h1 className="header-reveal header-reveal-delay-1 mt-5 font-serif text-5xl font-light leading-[1.1] tracking-tight sm:text-7xl lg:text-8xl">
            {title}
          </h1>

          <p className="header-reveal header-reveal-delay-2 mt-6 font-mono text-[11px] font-light uppercase tracking-[0.2em] text-muted sm:mt-8">
            {activePhotos.length} photographs{density === "mini" && hasCurated ? " (curated)" : ""}
          </p>
        </header>

        {/* Photo content */}
        <section className="pb-24 sm:pb-32 lg:pb-40">
          {layout === "grid" ? (
            <MasonryGrid sections={indexedSections} allPhotos={activePhotos} />
          ) : (
            <EditorialLayout photos={activePhotos} />
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border pb-16 pt-10">
          <Link href="/" className="font-mono text-[10px] font-light uppercase tracking-[0.25em] text-muted transition-colors hover:text-foreground">
            {siteTitle}
          </Link>
        </footer>
      </main>
    </>
  );
}
