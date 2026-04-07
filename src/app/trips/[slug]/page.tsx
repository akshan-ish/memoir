import { PageContent } from "@/components/page-content";
import tripsData from "@/data/trips.json";

const trips = tripsData as Array<{ slug: string; manifest: string; photosDir: string }>;
import {
  formatDateRange,
  preparePhotos,
  buildSections,
  type TripManifest,
} from "@/lib/trip-utils";

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

export function generateStaticParams() {
  const params = trips.map((trip) => ({ slug: trip.slug }));
  // Static export requires at least one param for dynamic routes;
  // include a placeholder that resolves to "trip not found" when no trips exist yet
  return params.length > 0 ? params : [{ slug: "_" }];
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const manifest = manifests[slug];

  if (!manifest) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 sm:px-10 lg:px-16">
        <div className="pt-36 pb-24">
          <p className="font-mono text-[11px] font-light uppercase tracking-[0.2em] text-muted">
            Nothing here
          </p>
          <h1 className="mt-5 font-serif text-4xl font-light tracking-tight sm:text-5xl">
            This trip doesn&rsquo;t exist yet
          </h1>
          <a
            href="/"
            className="mt-8 inline-block font-mono text-[11px] font-light tracking-wide text-muted transition-colors hover:text-foreground"
          >
            &larr; Back to all trips
          </a>
        </div>
      </main>
    );
  }

  const dateRangeFormatted = formatDateRange(
    manifest.dateRange.start,
    manifest.dateRange.end
  );
  const photos = preparePhotos(manifest);
  const sections = buildSections(photos);

  const allTripsMeta = trips
    .map((t) => {
      const m = manifests[t.slug];
      return {
        slug: t.slug,
        title: m?.title ?? t.slug,
        dateRange: m ? formatDateRange(m.dateRange.start, m.dateRange.end) : "",
        startDate: m?.dateRange.start ?? "",
      };
    })
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .map(({ startDate, ...rest }) => rest);

  return (
    <PageContent
      title={manifest.title}
      dateRange={dateRangeFormatted}
      photoCount={manifest.photoCount}
      sections={sections}
      photos={photos}
      tripSlug={slug}
      allTrips={allTripsMeta}
    />
  );
}
