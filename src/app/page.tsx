import Link from "next/link";
import tripsData from "@/data/trips.json";

const trips = tripsData as Array<{ slug: string; manifest: string; photosDir: string }>;
import { formatDateRange, type TripManifest } from "@/lib/trip-utils";
import { LandingTheme } from "@/components/landing-theme";
import { LandingNav } from "@/components/landing-nav";

// --- MANIFESTS: added by /memoir skill (do not edit this block) ---
import vietnamManifest from "@/data/manifest.json";
import franceManifest from "@/data/manifest-france.json";
import patagoniaManifest from "@/data/manifest-patagonia.json";
import sloveniaCroatiaManifest from "@/data/manifest-slovenia-croatia.json";
import weddingManifest from "@/data/manifest-wedding.json";
import review2024Manifest from "@/data/manifest-2024-review.json";
// --- END MANIFESTS ---

const manifests: Record<string, TripManifest> = {
  // --- MANIFEST_ENTRIES: added by /memoir skill (do not edit this block) ---
  vietnam: vietnamManifest as unknown as TripManifest,
  france: franceManifest as unknown as TripManifest,
  patagonia: patagoniaManifest as unknown as TripManifest,
  "slovenia-croatia": sloveniaCroatiaManifest as unknown as TripManifest,
  wedding: weddingManifest as unknown as TripManifest,
  "2024-review": review2024Manifest as unknown as TripManifest,
  // --- END MANIFEST_ENTRIES ---
};

let siteTitle = "Memoir";
try { siteTitle = require("@/data/config.json").siteTitle; } catch {};

export default function Home() {
  const tripData = trips.map((trip) => {
    const m = manifests[trip.slug];
    // Pick a hero photo — use coverPhoto if set, otherwise score by portrait-friendliness + quality
    const coverFilename = (m as any).coverPhoto;
    const coverMatch = coverFilename
      ? m.photos.find((p) => p.src.endsWith(coverFilename))
      : null;

    const hero = coverMatch ?? (() => {
      const regionCounts: Record<string, number> = {};
      m.photos.forEach((p) => {
        if (p.region) regionCounts[p.region] = (regionCounts[p.region] || 0) + 1;
      });
      const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      return m.photos.reduce((best, p) => {
        const score = (candidate: typeof p) => {
          const portraitFit = 1 - Math.min(Math.abs(candidate.aspectRatio - 0.75) * 1.5, 1);
          const quality = (candidate as any).qualityScore
            ? Math.min((candidate as any).qualityScore / 500, 1)
            : 0.5;
          const locationMatch = candidate.region === topRegion ? 0.2 : 0;
          return portraitFit * 0.4 + quality * 0.4 + locationMatch;
        };
        return score(p) > score(best) ? p : best;
      }, m.photos[0]);
    })();

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
      <LandingTheme siteTitle={siteTitle}>
        <LandingNav trips={tripData.map((t) => ({ slug: t.slug, title: t.title, dateRange: t.dateRange }))} />
      </LandingTheme>
      <div className="carousel-edge-fade carousel-edge-fade--left" />
      <div className="carousel-edge-fade carousel-edge-fade--right" />
      <main className="trip-carousel-viewport">
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
