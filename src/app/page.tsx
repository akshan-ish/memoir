import Link from "next/link";
import trips from "@/data/trips.json";
import { formatDateRange, type TripManifest } from "@/lib/trip-utils";
import { LandingTheme } from "@/components/landing-theme";

// --- MANIFESTS: added by /memoir skill (do not edit this block) ---
// --- END MANIFESTS ---

const manifests: Record<string, TripManifest> = {
  // --- MANIFEST_ENTRIES: added by /memoir skill (do not edit this block) ---
  // --- END MANIFEST_ENTRIES ---
};

let siteTitle = "Memoir";
try { siteTitle = require("@/data/config.json").siteTitle; } catch {};

export default function Home() {
  const tripData = trips.map((trip) => {
    const m = manifests[trip.slug];
    // Pick a hero photo — representative and portrait-friendly
    // Find the most photographed region (most representative location)
    const regionCounts: Record<string, number> = {};
    m.photos.forEach((p) => {
      if (p.region) regionCounts[p.region] = (regionCounts[p.region] || 0) + 1;
    });
    const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Score each photo: portrait-friendliness + quality + location match
    const hero = m.photos.reduce((best, p) => {
      const score = (candidate: typeof p) => {
        // Prefer aspect ratios close to 3:4 (0.75) — penalize ultra-wide
        const portraitFit = 1 - Math.min(Math.abs(candidate.aspectRatio - 0.75) * 1.5, 1);
        // Quality score if available (0-1 normalized, assume max ~500)
        const quality = (candidate as any).qualityScore
          ? Math.min((candidate as any).qualityScore / 500, 1)
          : 0.5;
        // Bonus for being in the most photographed region
        const locationMatch = candidate.region === topRegion ? 0.2 : 0;
        return portraitFit * 0.4 + quality * 0.4 + locationMatch;
      };
      return score(p) > score(best) ? p : best;
    }, m.photos[0]);

    return {
      slug: trip.slug,
      title: m.title,
      dateRange: formatDateRange(m.dateRange.start, m.dateRange.end),
      photoCount: m.photoCount,
      heroSrc: `${trip.photosDir}/${hero.src.split("/").pop()}`,
      heroThumb: `${trip.photosDir}/${hero.thumb.split("/").pop()}`,
      regions: [...new Set(m.photos.map((p) => p.region).filter(Boolean))].slice(0, 3),
    };
  });

  // Sort newest first
  tripData.sort((a, b) => {
    const mA = manifests[a.slug];
    const mB = manifests[b.slug];
    return new Date(mB.dateRange.start).getTime() - new Date(mA.dateRange.start).getTime();
  });

  return (
    <>
      <LandingTheme />
      <div className="carousel-edge-fade carousel-edge-fade--left" />
      <div className="carousel-edge-fade carousel-edge-fade--right" />
      <main className="trip-carousel-viewport">
        <div className="trip-carousel-header header-reveal">
          <p className="font-mono text-[10px] font-light uppercase tracking-[0.25em] text-muted">
            {siteTitle}
          </p>
        </div>
        <section className="trip-carousel">
          {tripData.map((trip, i) => (
            <Link
              key={trip.slug}
              href={`/trips/${trip.slug}`}
              className="trip-carousel-card header-reveal"
              style={{ animationDelay: `${0.2 + i * 0.15}s` }}
            >
              <div className="trip-carousel-info">
                <h2 className="font-serif text-2xl font-light tracking-tight sm:text-3xl">
                  {trip.title}
                </h2>
                <p className="mt-2 font-mono text-[10px] font-light tracking-wide text-muted">
                  {trip.dateRange}
                </p>
                <p className="mt-1 font-mono text-[10px] font-light tracking-wide text-muted">
                  {trip.photoCount} photographs
                </p>
                <p className="mt-2 font-serif text-sm font-light italic text-muted" style={{ minHeight: '1.25em' }}>
                  {trip.regions.length > 0 ? trip.regions.join(" \u00b7 ") : "\u00a0"}
                </p>
              </div>
              <div className="trip-carousel-image">
                <img
                  src={trip.heroSrc}
                  alt={trip.title}
                  loading={i < 2 ? "eager" : "lazy"}
                />
              </div>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
