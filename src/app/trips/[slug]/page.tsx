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
// --- END MANIFESTS ---

const manifests: Record<string, TripManifest> = {
  // --- MANIFEST_ENTRIES: added by /memoir skill (do not edit this block) ---
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
    return <div>Trip not found</div>;
  }

  const dateRangeFormatted = formatDateRange(
    manifest.dateRange.start,
    manifest.dateRange.end
  );
  const photos = preparePhotos(manifest);
  const sections = buildSections(photos);

  const allSlugs = trips.map((t) => t.slug);

  return (
    <PageContent
      title={manifest.title}
      dateRange={dateRangeFormatted}
      photoCount={manifest.photoCount}
      sections={sections}
      photos={photos}
      tripSlug={slug}
      allTrips={allSlugs}
    />
  );
}
