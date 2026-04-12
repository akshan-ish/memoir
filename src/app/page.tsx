import Link from "next/link";
import tripsData from "@/data/trips.json";

const trips = tripsData as Array<{ slug: string; manifest: string; photosDir: string }>;
import { formatDateRange, type TripManifest } from "@/lib/trip-utils";
import { LandingTheme } from "@/components/landing-theme";
import { WaitlistHero } from "@/components/waitlist-hero";

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
      startDate: m.dateRange.start,
    };
  });

  tripData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <>
      <LandingTheme siteTitle={siteTitle} />

      <WaitlistHero />

      <section className="examples-section">
        <header className="examples-header header-reveal" style={{ animationDelay: "0.4s" }}>
          <p className="examples-eyebrow">Examples</p>
          <h2 className="examples-title">Memoirs made with Memoir.</h2>
        </header>

        <div className="examples-grid">
          {tripData.map((trip, i) => (
            <Link
              key={trip.slug}
              href={`/trips/${trip.slug}`}
              className="example-card header-reveal"
              style={{ animationDelay: `${0.5 + i * 0.08}s` }}
            >
              <div className="example-card-image">
                <img
                  src={trip.heroSrc}
                  alt={trip.title}
                  loading={i < 3 ? "eager" : "lazy"}
                />
              </div>
              <div className="example-card-info">
                <h3 className="example-card-title">{trip.title}</h3>
                <p className="example-card-meta">{trip.dateRange}</p>
                <p className="example-card-meta">{trip.photoCount} photographs</p>
                {trip.regions.length > 0 && (
                  <p className="example-card-regions">
                    {trip.regions.join(" \u00b7 ")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p className="landing-footer-text">
          A quiet record of where you&rsquo;ve been.
        </p>
      </footer>
    </>
  );
}
