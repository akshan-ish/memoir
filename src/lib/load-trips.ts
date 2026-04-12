// Loads the trip registry and manifests from disk at build time.
// The data files live in `src/data/` and are gitignored (user-specific, produced
// by the pipeline). Reading via `fs` instead of `import` means a fresh clone
// with no trips still builds cleanly — the site just renders in its empty state.

import fs from "node:fs";
import path from "node:path";
import type { TripManifest } from "@/lib/trip-utils";

const DATA_DIR = path.join(process.cwd(), "src", "data");

export interface TripRegistryEntry {
  slug: string;
  manifest: string;    // filename within src/data (e.g. "manifest-france.json")
  photosDir: string;   // public URL path (e.g. "/photos-france")
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadTripRegistry(): TripRegistryEntry[] {
  return readJson<TripRegistryEntry[]>("trips.json") ?? [];
}

export function loadManifests(
  registry: TripRegistryEntry[] = loadTripRegistry(),
): Record<string, TripManifest> {
  const out: Record<string, TripManifest> = {};
  for (const entry of registry) {
    const m = readJson<TripManifest>(entry.manifest);
    if (m) out[entry.slug] = m;
  }
  return out;
}

export function loadSiteTitle(): string {
  const config = readJson<{ siteTitle?: string }>("config.json");
  return config?.siteTitle || "Memoir";
}
