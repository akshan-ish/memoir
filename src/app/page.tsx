import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { formatDateRange } from "@/lib/trip-utils";
import { loadTripRegistry, loadManifests, loadSiteTitle } from "@/lib/load-trips";
import { LandingTheme } from "@/components/landing-theme";
import { WaitlistHero } from "@/components/waitlist-hero";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/akshan-ish/memoir";

function hasScreens(): { home: boolean; trip: boolean } {
  const dir = path.join(process.cwd(), "public", "screens");
  const exists = (f: string) => {
    try { return fs.statSync(path.join(dir, f)).isFile(); } catch { return false; }
  };
  return { home: exists("home.png"), trip: exists("trip.png") };
}

export default function Home() {
  const trips = loadTripRegistry();
  const manifests = loadManifests(trips);
  const siteTitle = loadSiteTitle();
  const screens = hasScreens();

  const tripData = trips
    .filter((t) => manifests[t.slug])
    .map((trip) => {
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
        heroSrc: hero ? `${trip.photosDir}/${hero.src.split("/").pop()}` : "",
        regions: [...new Set(m.photos.map((p) => p.region).filter(Boolean))].slice(0, 3),
        startDate: m.dateRange.start,
      };
    });

  tripData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <>
      <LandingTheme siteTitle={siteTitle} />

      <WaitlistHero />

      {(screens.home || screens.trip) && (
        <section className="landing-screens">
          <div className="landing-screens-inner">
            {screens.home && (
              <figure className="landing-screen header-reveal" style={{ animationDelay: "0.2s" }}>
                <img
                  src="/screens/home.png"
                  alt="Memoir iOS app home screen — a list of trips with cover photos"
                  loading="eager"
                />
                <figcaption className="landing-screen-caption">All your trips, in one place.</figcaption>
              </figure>
            )}
            {screens.trip && (
              <figure className="landing-screen header-reveal" style={{ animationDelay: "0.35s" }}>
                <img
                  src="/screens/trip.png"
                  alt="Memoir iOS app trip view — photos organized by day and location"
                  loading="eager"
                />
                <figcaption className="landing-screen-caption">Grouped by day, labelled by place.</figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      <section className="landing-features">
        <div className="landing-features-inner">
          <p className="landing-section-eyebrow">What it does</p>
          <h2 className="landing-section-title">
            Your trip, quietly curated.
          </h2>

          <div className="landing-features-grid">
            <div className="landing-feature">
              <h3 className="landing-feature-title">Automatic curation</h3>
              <p className="landing-feature-text">
                Blurry shots, duplicates, and screenshots are filtered out.
                A selection of the best photographs is chosen from what&rsquo;s left.
              </p>
            </div>

            <div className="landing-feature">
              <h3 className="landing-feature-title">Places, not coordinates</h3>
              <p className="landing-feature-text">
                Locations from GPS are reverse-geocoded into real place names and
                grouped by day, so a Sunday in Marseille reads like a Sunday in Marseille.
              </p>
            </div>

            <div className="landing-feature">
              <h3 className="landing-feature-title">Editorial, not feed</h3>
              <p className="landing-feature-text">
                A typography-led layout in Cormorant and JetBrains Mono. Three themes:
                light, dark, parchment. Negative space as a feature.
              </p>
            </div>

            <div className="landing-feature">
              <h3 className="landing-feature-title">Private by default</h3>
              <p className="landing-feature-text">
                Photos never leave your device. No account, no cloud, no tracking.
                The final site is a folder of static HTML you can host anywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-oss">
        <div className="landing-oss-inner">
          <p className="landing-section-eyebrow">Available today</p>
          <h2 className="landing-section-title">
            Open source. Runs on your machine.
          </h2>
          <p className="landing-oss-copy">
            The iOS app is on the way. The memoir engine itself is open source
            and available now as a <span className="landing-oss-emph">Claude Code skill</span>.
            Point it at a folder of photos or a Photos.app album and it builds you
            a static site in a few minutes.
          </p>
          <div className="landing-oss-actions">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="landing-oss-btn"
            >
              View on GitHub &rarr;
            </a>
            <a
              href={`${GITHUB_URL}#getting-started`}
              target="_blank"
              rel="noreferrer"
              className="landing-oss-btn landing-oss-btn--secondary"
            >
              Install instructions
            </a>
          </div>
        </div>
      </section>

      {tripData.length > 0 && (
        <section className="examples-section">
          <header className="examples-header header-reveal" style={{ animationDelay: "0.2s" }}>
            <p className="examples-eyebrow">Examples</p>
            <h2 className="examples-title">Memoirs made with Memoir.</h2>
          </header>

          <div className="examples-grid">
            {tripData.map((trip, i) => (
              <Link
                key={trip.slug}
                href={`/trips/${trip.slug}`}
                className="example-card header-reveal"
                style={{ animationDelay: `${0.3 + i * 0.08}s` }}
              >
                <div className="example-card-image">
                  {trip.heroSrc && (
                    <img
                      src={trip.heroSrc}
                      alt={trip.title}
                      loading="lazy"
                    />
                  )}
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
      )}

      <footer className="landing-footer">
        <p className="landing-footer-text">
          A quiet record of where you&rsquo;ve been.
        </p>
      </footer>
    </>
  );
}
