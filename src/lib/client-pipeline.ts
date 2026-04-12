// Browser-only photo pipeline: parses EXIF, generates a thumbnail, records dimensions.
// No server — everything happens on the user's device.

import ExifReader from "exifreader";

export interface ClientPhoto {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: number;
  date: string | null;        // "YYYY-MM-DD HH:MM:SS" or null
  lat: number | null;
  lng: number | null;
  city: string | null;        // filled in later by optional reverse geocode
  region: string | null;
  country: string | null;
  originalBlob: Blob;         // the original file
  thumbBlob: Blob;            // resized ~THUMB_MAX jpeg
  orientation: number;        // 1–8
}

const THUMB_MAX = 1200;       // longest edge for display thumbnail
const FULL_MAX = 2400;        // longest edge for full image
const JPEG_QUALITY = 0.82;

function parseExifDate(s: string | undefined | null): string | null {
  if (!s) return null;
  // EXIF: "2024:08:15 14:30:22"  →  "2024-08-15 14:30:22"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
}

async function readExif(file: File): Promise<{
  date: string | null;
  lat: number | null;
  lng: number | null;
  orientation: number;
}> {
  try {
    const buf = await file.arrayBuffer();
    const tags = ExifReader.load(buf, { expanded: false });

    const dateStr =
      (tags.DateTimeOriginal as any)?.description ??
      (tags.DateTime as any)?.description ??
      (tags.DateTimeDigitized as any)?.description ??
      null;

    const latVal = (tags.GPSLatitude as any)?.description;
    const lngVal = (tags.GPSLongitude as any)?.description;
    const latRef = (tags.GPSLatitudeRef as any)?.value?.[0] ?? (tags.GPSLatitudeRef as any)?.description;
    const lngRef = (tags.GPSLongitudeRef as any)?.value?.[0] ?? (tags.GPSLongitudeRef as any)?.description;

    let lat: number | null = null;
    let lng: number | null = null;
    if (latVal != null && !Number.isNaN(Number(latVal))) {
      lat = Number(latVal);
      if (latRef && String(latRef).toUpperCase().startsWith("S") && lat > 0) lat = -lat;
    }
    if (lngVal != null && !Number.isNaN(Number(lngVal))) {
      lng = Number(lngVal);
      if (lngRef && String(lngRef).toUpperCase().startsWith("W") && lng > 0) lng = -lng;
    }

    const orientation = Number((tags.Orientation as any)?.value) || 1;

    return { date: parseExifDate(dateStr), lat, lng, orientation };
  } catch {
    return { date: null, lat: null, lng: null, orientation: 1 };
  }
}

// Fall back: if EXIF date missing, try File.lastModified.
function fallbackDate(file: File): string | null {
  if (!file.lastModified) return null;
  const d = new Date(file.lastModified);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Load an image source (File) into an HTMLImageElement. Uses object URLs so large
// files never get base64-inflated in memory.
function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

// Apply EXIF orientation while drawing onto a canvas sized to max `targetMax`
// along the longest edge. Returns a JPEG blob and the final display dims.
async function renderToBlob(
  img: HTMLImageElement,
  orientation: number,
  targetMax: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  // Swapped dims for orientations 5–8
  const swap = orientation >= 5 && orientation <= 8;
  const srcW = swap ? img.naturalHeight : img.naturalWidth;
  const srcH = swap ? img.naturalWidth : img.naturalHeight;

  const longest = Math.max(srcW, srcH);
  const scale = longest > targetMax ? targetMax / longest : 1;
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Transform so that downstream drawImage(img, 0, 0, srcW, srcH) produces
  // correctly-oriented pixels.
  switch (orientation) {
    case 2: ctx.translate(outW, 0); ctx.scale(-1, 1); break;
    case 3: ctx.translate(outW, outH); ctx.rotate(Math.PI); break;
    case 4: ctx.translate(0, outH); ctx.scale(1, -1); break;
    case 5: ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break;
    case 6: ctx.rotate(0.5 * Math.PI); ctx.translate(0, -outW); break;
    case 7: ctx.rotate(0.5 * Math.PI); ctx.translate(outH, -outW); ctx.scale(-1, 1); break;
    case 8: ctx.rotate(-0.5 * Math.PI); ctx.translate(-outH, 0); break;
    default: break;
  }

  // Natural source dims (un-swapped) — match pre-transform coordinate space.
  const drawW = swap ? outH : outW;
  const drawH = swap ? outW : outH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, drawW, drawH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });

  return { blob, width: outW, height: outH };
}

/** Process a single file into a ClientPhoto. Throws if the browser can't decode it. */
export async function processPhoto(file: File): Promise<ClientPhoto> {
  const { date, lat, lng, orientation } = await readExif(file);
  const { img, revoke } = await loadImageFromFile(file);

  try {
    const thumb = await renderToBlob(img, orientation, THUMB_MAX, JPEG_QUALITY);
    // For the "full" size, we re-encode to JPEG only if the source was very
    // large or used an awkward orientation; otherwise we keep the original File
    // as-is (cheap + preserves quality).
    let original: Blob = file;
    if (orientation !== 1 || Math.max(img.naturalWidth, img.naturalHeight) > FULL_MAX + 200) {
      const full = await renderToBlob(img, orientation, FULL_MAX, 0.9);
      original = full.blob;
    }

    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      width: thumb.width,
      height: thumb.height,
      aspectRatio: thumb.width / thumb.height,
      date: date ?? fallbackDate(file),
      lat,
      lng,
      city: null,
      region: null,
      country: null,
      originalBlob: original,
      thumbBlob: thumb.blob,
      orientation,
    };
  } finally {
    revoke();
  }
}

export interface Section {
  label: string;        // "Thursday, August 15"
  sublabel?: string;    // "Arles · Marseille"
  photos: ClientPhoto[];
  startIndex: number;
}

function formatSectionDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Group photos by day and build display sections. Photos should already be sorted. */
export function buildClientSections(photos: ClientPhoto[]): Section[] {
  const sections: Section[] = [];
  let currentKey = "";

  photos.forEach((photo, i) => {
    const key = photo.date ? photo.date.slice(0, 10) : "undated";
    if (key !== currentKey || sections.length === 0) {
      sections.push({
        label: photo.date ? formatSectionDate(photo.date) : "Undated",
        photos: [photo],
        startIndex: i,
      });
      currentKey = key;
    } else {
      sections[sections.length - 1].photos.push(photo);
    }
  });

  for (const s of sections) {
    const regions = [...new Set(s.photos.map((p) => p.region).filter(Boolean))];
    if (regions.length > 0) {
      s.sublabel = regions.slice(0, 2).join(" \u00b7 ");
    }
  }

  return sections;
}

export function comparePhotosByDate(a: ClientPhoto, b: ClientPhoto): number {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
}

// ─── Optional: reverse geocoding via Nominatim ────────────────────────────────
// Rate-limited client-side. Results are cached per ~100m grid cell in sessionStorage.

const GEOCODE_CACHE_KEY = "memoir-geocode-cache-v1";

function roundKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function getCache(): Record<string, { city: string | null; region: string | null; country: string | null }> {
  try {
    return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch { return {}; }
}

function setCache(cache: Record<string, any>) {
  try { sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function geocodeOne(lat: number, lng: number): Promise<{ city: string | null; region: string | null; country: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&accept-language=en`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || null;
    const region = addr.state || addr.region || addr.province || addr.county || null;
    const country = addr.country || null;
    return { city, region: region || city, country };
  } catch { return null; }
}

export async function reverseGeocodePhotos(
  photos: ClientPhoto[],
  onProgress?: (done: number, total: number) => void,
): Promise<ClientPhoto[]> {
  const cache = getCache();
  const withGps = photos.filter((p) => p.lat != null && p.lng != null);
  let done = 0;

  for (const p of withGps) {
    const key = roundKey(p.lat as number, p.lng as number);
    let hit = cache[key];
    if (!hit) {
      const result = await geocodeOne(p.lat as number, p.lng as number);
      if (result) {
        cache[key] = result;
        setCache(cache);
        hit = result;
      }
      // Nominatim courtesy rate limit: 1 req/sec.
      await new Promise((r) => setTimeout(r, 1100));
    }
    if (hit) {
      p.city = hit.city;
      p.region = hit.region;
      p.country = hit.country;
    }
    done++;
    onProgress?.(done, withGps.length);
  }
  return photos;
}
