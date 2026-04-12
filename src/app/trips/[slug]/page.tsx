import { PageContent } from "@/components/page-content";
import {
  formatDateRange,
  preparePhotos,
  buildSections,
} from "@/lib/trip-utils";
import { loadTripRegistry, loadManifests, loadSiteTitle } from "@/lib/load-trips";

export function generateStaticParams() {
  const params = loadTripRegistry().map((trip) => ({ slug: trip.slug }));
  // Static export requires at least one param for dynamic routes;
  // include a placeholder that resolves to "trip not found" when no trips exist yet.
  return params.length > 0 ? params : [{ slug: "_" }];
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trips = loadTripRegistry();
  const manifests = loadManifests(trips);
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
      siteTitle={loadSiteTitle()}
    />
  );
}
