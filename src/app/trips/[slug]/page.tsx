import { PageContent } from "@/components/page-content";
import trips from "@/data/trips.json";
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
  return trips.map((trip) => ({ slug: trip.slug }));
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
