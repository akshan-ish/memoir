#!/usr/bin/env node

/**
 * Memoir — Photo Processing Pipeline
 *
 * Usage: node scripts/process.mjs <photo-folder>
 *
 * Steps:
 * 1. Scan folder for images (jpg, jpeg, heic, png)
 * 2. Extract EXIF metadata (GPS, date, camera info)
 * 3. Compute perceptual hashes for deduplication
 * 4. Score quality (blur detection via Laplacian variance, exposure)
 * 5. Deduplicate — keep best quality from each cluster
 * 6. Filter out bad photos (too blurry, too dark/bright)
 * 7. Reverse geocode GPS coordinates to place names
 * 8. Build timeline and output manifest
 */

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import ExifReader from "exifreader";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".heic",
  ".png",
  ".tiff",
  ".webp",
]);
const AGGRESSIVE = process.argv.includes("--aggressive");
const HASH_SIZE = 16;
const DEDUP_HASH_THRESHOLD = AGGRESSIVE ? 50 : 40;
const DEDUP_TIME_WINDOW = AGGRESSIVE ? 30 : 10; // seconds
const BLUR_THRESHOLD = AGGRESSIVE ? 200 : 50;
const EXPOSURE_THRESHOLD = AGGRESSIVE ? 35 : 0; // minimum exposure score
const QUALITY_PERCENTILE = AGGRESSIVE ? 0.6 : 0; // keep top N% by quality
const OUTPUT_DIR = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : "public/photos";
const MANIFEST_PATH = process.argv.includes("--manifest")
  ? process.argv[process.argv.indexOf("--manifest") + 1]
  : "src/data/manifest.json";
const MAX_DIMENSION = 2400; // resize longest edge for web
const THUMB_SIZE = 800;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

async function scanFolder(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const photos = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Skip duplicates from Live Photos export (files with " (1)" suffix)
    if (entry.name.includes(" (1)")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      photos.push(path.join(folder, entry.name));
    }
  }
  return photos.sort();
}

async function extractMetadata(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const tags = ExifReader.load(buffer, { expanded: true });

    let lat = null,
      lng = null;
    if (tags.gps && tags.gps.Latitude !== undefined) {
      lat = tags.gps.Latitude;
      lng = tags.gps.Longitude;
    }

    let date = null;
    if (tags.exif && tags.exif.DateTimeOriginal) {
      const raw = tags.exif.DateTimeOriginal.description;
      // EXIF format: "2024:01:15 10:30:00"
      date = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    }

    let focalLength = null;
    if (tags.exif && tags.exif.FocalLength) {
      focalLength = tags.exif.FocalLength.description;
    }

    // Detect screenshots via EXIF software field
    let isScreenshot = false;
    const software = tags.exif?.Software?.description?.toLowerCase() || "";
    const userComment = tags.exif?.UserComment?.description?.toLowerCase() || "";
    if (
      software.includes("screenshot") ||
      userComment.includes("screenshot") ||
      // PNG files from phones are almost always screenshots
      filePath.toLowerCase().endsWith(".png")
    ) {
      isScreenshot = true;
    }

    return { lat, lng, date, focalLength, isScreenshot };
  } catch (e) {
    return { lat: null, lng: null, date: null, focalLength: null, isScreenshot: false };
  }
}

async function detectScreenshotOrDocument(filePath) {
  // Analyzes image content to detect screenshots, documents, bills, etc.
  // Returns { isScreenshot, isDocument, reason }
  //
  // Signals:
  // - Screenshots: large flat color regions (status bar, backgrounds), exact device aspect ratios
  // - Documents: very low color saturation, high contrast edges (text), uniform background

  const { data, info } = await sharp(filePath)
    .resize(128, 128, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Array.from(data);
  const pixelCount = width * height;

  // 1. Measure color saturation — screenshots/docs are mostly gray/white
  let totalSaturation = 0;
  let nearWhiteCount = 0;
  let flatColorBuckets = new Map(); // quantized color -> count

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    totalSaturation += saturation;

    // Near-white pixels (backgrounds of docs/screenshots)
    if (r > 230 && g > 230 && b > 230) nearWhiteCount++;

    // Quantize to 4-bit per channel for flat color detection
    const bucket = `${r >> 4},${g >> 4},${b >> 4}`;
    flatColorBuckets.set(bucket, (flatColorBuckets.get(bucket) || 0) + 1);
  }

  const avgSaturation = totalSaturation / pixelCount;
  const whiteRatio = nearWhiteCount / pixelCount;

  // 2. Measure flat color regions — screenshots have large uniform areas
  const sortedBuckets = [...flatColorBuckets.values()].sort((a, b) => b - a);
  // What % of pixels are in the top 3 most common colors?
  const topColorsRatio = sortedBuckets.slice(0, 3).reduce((a, b) => a + b, 0) / pixelCount;

  // 3. Check for exact device screenshot aspect ratios
  const meta = await sharp(filePath).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const screenResolutions = [
    // iPhone
    [1170, 2532], [1179, 2556], [1290, 2796], [1284, 2778],
    [1125, 2436], [1242, 2688], [1080, 2340], [750, 1334], [1242, 2208],
    // iPad
    [2048, 2732], [1668, 2388], [1620, 2160],
    // Android common
    [1080, 1920], [1080, 2400], [1440, 3200], [1440, 2560],
  ];
  const isScreenRes = screenResolutions.some(
    ([sw, sh]) => (w === sw && h === sh) || (w === sh && h === sw)
  );

  // Decision logic
  let isScreenshot = false;
  let isDocument = false;
  let reason = null;

  // Screenshots: exact screen resolution OR (very flat colors + low saturation)
  if (isScreenRes && avgSaturation < 0.2) {
    isScreenshot = true;
    reason = `screen resolution ${w}x${h}, low saturation ${avgSaturation.toFixed(2)}`;
  } else if (topColorsRatio > 0.5 && avgSaturation < 0.12) {
    isScreenshot = true;
    reason = `flat colors ${(topColorsRatio * 100).toFixed(0)}%, saturation ${avgSaturation.toFixed(2)}`;
  }

  // Documents: mostly white + very low saturation
  if (whiteRatio > 0.5 && avgSaturation < 0.08) {
    isDocument = true;
    reason = `white ${(whiteRatio * 100).toFixed(0)}%, saturation ${avgSaturation.toFixed(2)}`;
  }

  return { isScreenshot, isDocument, reason };
}

async function computePerceptualHash(filePath) {
  // Resize to small grayscale, then compute a simple average hash
  const { data, info } = await sharp(filePath)
    .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Average hash: compare each pixel to the mean
  const pixels = Array.from(data);
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  return pixels.map((p) => (p >= mean ? "1" : "0")).join("");
}

async function computeBlurScore(filePath) {
  // Laplacian variance — higher = sharper
  // We apply a Laplacian-like convolution via sharp
  const { data, info } = await sharp(filePath)
    .resize(512, 512, { fit: "inside" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = Array.from(data);

  // Simple Laplacian: for each pixel, compute |4*center - up - down - left - right|
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        4 * pixels[idx] -
        pixels[(y - 1) * width + x] -
        pixels[(y + 1) * width + x] -
        pixels[y * width + (x - 1)] -
        pixels[y * width + (x + 1)];
      sum += laplacian * laplacian;
      count++;
    }
  }

  return sum / count; // variance of Laplacian
}

async function computeExposureScore(filePath) {
  // Histogram-based exposure scoring
  const { data } = await sharp(filePath)
    .resize(256, 256, { fit: "inside" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  const variance =
    pixels.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pixels.length;
  const stddev = Math.sqrt(variance);

  // Good exposure: mean around 100-160, decent spread
  // Score 0-100, higher is better
  const meanScore = 100 - Math.abs(mean - 128) * 0.8;
  const spreadScore = Math.min(stddev / 0.6, 100);
  return (meanScore + spreadScore) / 2;
}

async function reverseGeocode(lat, lng) {
  // Using OpenStreetMap Nominatim — zoom=18 for max detail (building/POI level)
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Memoir/1.0 (photo-memoir-generator)" },
    });
    const data = await res.json();

    if (data.address) {
      const a = data.address;

      // Try to get the most specific/recognizable name:
      // POI/landmark > neighbourhood > suburb > town > city
      const landmark = a.tourism || a.amenity || a.building || a.historic ||
        a.leisure || a.shop || a.man_made;
      const neighbourhood = a.neighbourhood || a.quarter;
      const suburb = a.suburb;
      const town = a.city || a.town || a.village || a.hamlet;
      const region = a.county || a.state;
      const country = a.country;

      // Detailed name for photo overlay (POI/landmark level)
      let detail;
      if (landmark) {
        detail = landmark;
      } else if (neighbourhood) {
        detail = neighbourhood;
      } else if (suburb) {
        detail = suburb;
      } else {
        detail = town || region;
      }

      // Broad name for section headings — city or state/province level, cleaned up
      const rawBroad = a.state || town || region || "";
      const broad = rawBroad
        .replace(/^Tỉnh\s+/i, "")        // "Tỉnh Ninh Bình" → "Ninh Bình"
        .replace(/^Thành phố\s+/i, "")    // "Thành phố Hà Nội" → "Hà Nội"
        .replace(/^Thủ Đức$/i, "Hồ Chí Minh")  // Thủ Đức is a district of HCMC
        .replace(/^Province of\s+/i, "")
        .replace(/^City of\s+/i, "")
        || "Unknown";

      return { city: detail, region: broad, country, raw: data.display_name };
    }
    return { city: null, country: null, raw: null };
  } catch (e) {
    return { city: null, country: null, raw: null };
  }
}

async function processImage(filePath, outputDir) {
  const filename = path.basename(filePath, path.extname(filePath));
  const webName = `${filename}.jpg`;
  const thumbName = `${filename}_thumb.jpg`;

  // Full size for web (rotate based on EXIF orientation)
  await sharp(filePath)
    .rotate() // auto-rotate based on EXIF
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(path.join(outputDir, webName));

  // Thumbnail
  await sharp(filePath)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toFile(path.join(outputDir, thumbName));

  // Get dimensions of the processed image
  const meta = await sharp(path.join(outputDir, webName)).metadata();

  return {
    web: `/${OUTPUT_DIR.replace(/^public\//, "")}/${webName}`,
    thumb: `/${OUTPUT_DIR.replace(/^public\//, "")}/${thumbName}`,
    width: meta.width,
    height: meta.height,
    aspectRatio: meta.width / meta.height,
  };
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function main() {
  const inputFolder = process.argv[2];
  if (!inputFolder) {
    console.error("Usage: node scripts/process.mjs <photo-folder> [--aggressive] [--output dir] [--manifest path]");
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputFolder);
  console.log(`\n📂 Scanning: ${resolvedInput}${AGGRESSIVE ? " (aggressive mode)" : ""}\n`);

  // Step 1: Scan
  const files = await scanFolder(resolvedInput);
  console.log(`Found ${files.length} images\n`);

  if (files.length === 0) {
    console.error("No supported images found.");
    process.exit(1);
  }

  // Step 2: Extract metadata + compute hashes + quality scores
  console.log("Analyzing photos...");
  const photos = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.basename(file);
    process.stdout.write(`  [${i + 1}/${files.length}] ${name}\r`);

    try {
      const [metadata, hash, blurScore, exposureScore, contentType] = await Promise.all([
        extractMetadata(file),
        computePerceptualHash(file),
        computeBlurScore(file),
        computeExposureScore(file),
        detectScreenshotOrDocument(file),
      ]);

      // Skip screenshots and documents immediately
      if (metadata.isScreenshot || contentType.isScreenshot) {
        console.log(`  ✗ ${name} — screenshot (EXIF)`);
        continue;
      }
      if (contentType.isDocument) {
        console.log(`  ✗ ${name} — document/text (${contentType.reason})`);
        continue;
      }
      if (contentType.isScreenshot) {
        console.log(`  ✗ ${name} — screenshot (${contentType.reason})`);
        continue;
      }

      photos.push({
        path: file,
        name,
        ...metadata,
        hash,
        blurScore,
        exposureScore,
        qualityScore: blurScore * 0.6 + exposureScore * 0.4,
      });
    } catch (e) {
      console.log(`  ⚠ Skipping ${name}: ${e.message}`);
    }
  }
  console.log(`\nAnalyzed ${photos.length} photos\n`);

  // Step 3: Deduplicate using time proximity + visual similarity
  // Sort by date first so time-based clustering works
  console.log("Deduplicating...");
  photos.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < photos.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [i];
    assigned.add(i);

    for (let j = i + 1; j < photos.length; j++) {
      if (assigned.has(j)) continue;

      const hashDist = hammingDistance(photos[i].hash, photos[j].hash);

      // Check time proximity between photos
      let timeDelta = Infinity;
      if (photos[i].date && photos[j].date) {
        timeDelta = Math.abs(
          new Date(photos[i].date) - new Date(photos[j].date)
        ) / 1000;
      }

      // Duplicates: visually similar AND taken close together in time
      // OR extremely visually similar regardless of time (e.g. same scene, different day)
      const isTimeDupe = timeDelta <= DEDUP_TIME_WINDOW && hashDist <= DEDUP_HASH_THRESHOLD;
      const isVisualDupe = hashDist <= 15; // very tight — nearly identical

      if (isTimeDupe || isVisualDupe) {
        cluster.push(j);
        assigned.add(j);
        if (isTimeDupe) {
          console.log(`  ✗ ${photos[j].name} ≈ ${photos[i].name} (${timeDelta.toFixed(0)}s apart, hash dist ${hashDist})`);
        } else {
          console.log(`  ✗ ${photos[j].name} ≈ ${photos[i].name} (visual match, hash dist ${hashDist})`);
        }
      }
    }
    clusters.push(cluster);
  }

  // Keep the best from each cluster
  const dedupedPhotos = clusters.map((cluster) => {
    const sorted = cluster.sort(
      (a, b) => photos[b].qualityScore - photos[a].qualityScore
    );
    return photos[sorted[0]];
  });

  const dupsRemoved = photos.length - dedupedPhotos.length;
  console.log(
    `\n  ${dedupedPhotos.length} unique photos (removed ${dupsRemoved} duplicates)\n`
  );

  // Step 4: Filter bad photos
  console.log(`Filtering quality${AGGRESSIVE ? " (aggressive)" : ""}...`);
  let filtered = dedupedPhotos.filter((p) => {
    if (p.blurScore < BLUR_THRESHOLD) {
      console.log(`  ✗ ${p.name} — too blurry (${p.blurScore.toFixed(0)})`);
      return false;
    }
    if (EXPOSURE_THRESHOLD > 0 && p.exposureScore < EXPOSURE_THRESHOLD) {
      console.log(`  ✗ ${p.name} — bad exposure (${p.exposureScore.toFixed(0)})`);
      return false;
    }
    return true;
  });

  // In aggressive mode, also trim to top percentile by quality
  if (QUALITY_PERCENTILE > 0 && filtered.length > 30) {
    const sorted = [...filtered].sort((a, b) => b.qualityScore - a.qualityScore);
    const keepCount = Math.max(30, Math.ceil(filtered.length * QUALITY_PERCENTILE));
    const cutoff = sorted[keepCount - 1].qualityScore;
    const before = filtered.length;
    filtered = filtered.filter((p) => p.qualityScore >= cutoff);
    console.log(`  Kept top ${filtered.length} by quality (trimmed ${before - filtered.length})`);
  }

  console.log(
    `  ${filtered.length} photos passed (removed ${dedupedPhotos.length - filtered.length})\n`
  );

  // Step 5: Reverse geocode unique GPS coordinates
  console.log("Reverse geocoding...");
  const geoCache = new Map();
  const locations = new Set();

  for (const photo of filtered) {
    if (photo.lat == null || photo.lng == null) continue;

    // Round to ~1km precision for caching
    // ~100m precision for caching — enough to distinguish nearby POIs
    const key = `${photo.lat.toFixed(3)},${photo.lng.toFixed(3)}`;
    if (geoCache.has(key)) {
      const cached = geoCache.get(key);
      photo.city = cached.city;
      photo.region = cached.region;
      photo.country = cached.country;
    } else {
      // Rate limit: 1 req/sec for Nominatim
      await new Promise((r) => setTimeout(r, 1100));
      const geo = await reverseGeocode(photo.lat, photo.lng);
      geoCache.set(key, geo);
      photo.city = geo.city;
      photo.region = geo.region;
      photo.country = geo.country;
      if (geo.city) {
        console.log(`  📍 ${geo.city} (${geo.region}), ${geo.country}`);
        locations.add(geo.region || geo.city);
      }
    }
  }
  console.log();

  // Step 6: Build timeline
  const datedPhotos = filtered.filter((p) => p.date);
  datedPhotos.sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstDate = datedPhotos.length > 0 ? datedPhotos[0].date : null;
  const lastDate =
    datedPhotos.length > 0 ? datedPhotos[datedPhotos.length - 1].date : null;

  // Sort all photos by date for display
  filtered.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  // Step 7: Process images (resize, optimize, copy to public)
  console.log("Processing images for web...");
  const outputDir = path.resolve(OUTPUT_DIR);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(path.resolve(MANIFEST_PATH)), { recursive: true });

  const manifest = [];
  for (let i = 0; i < filtered.length; i++) {
    const photo = filtered[i];
    process.stdout.write(
      `  [${i + 1}/${filtered.length}] ${photo.name}\r`
    );

    const images = await processImage(photo.path, outputDir);

    manifest.push({
      id: i,
      src: images.web,
      thumb: images.thumb,
      width: images.width,
      height: images.height,
      aspectRatio: images.aspectRatio,
      date: photo.date,
      lat: photo.lat,
      lng: photo.lng,
      city: photo.city || null,
      region: photo.region || null,
      country: photo.country || null,
      qualityScore: photo.qualityScore,
      hash: photo.hash,
      curated: false,
    });
  }
  console.log(`\nProcessed ${manifest.length} images\n`);

  // Step 8: Curate mini selection (MMR — Maximum Marginal Relevance)
  const MINI_BUDGET = 60;
  if (manifest.length > MINI_BUDGET) {
    console.log(`Curating mini selection (${MINI_BUDGET} photos)...`);

    // Group photos by date (day) for proportional allocation
    const dayBuckets = new Map();
    for (const photo of manifest) {
      const day = photo.date ? photo.date.split(" ")[0] : "undated";
      if (!dayBuckets.has(day)) dayBuckets.set(day, []);
      dayBuckets.get(day).push(photo);
    }

    // Allocate budget proportionally across days (min 1 per day)
    const days = [...dayBuckets.keys()];
    const totalPhotos = manifest.length;
    const allocations = new Map();
    let allocated = 0;

    for (const day of days) {
      const count = dayBuckets.get(day).length;
      const share = Math.max(1, Math.round((count / totalPhotos) * MINI_BUDGET));
      allocations.set(day, share);
      allocated += share;
    }

    // Adjust if we over/under-allocated
    while (allocated > MINI_BUDGET) {
      // Shrink the largest bucket
      const largest = [...allocations.entries()].sort((a, b) => b[1] - a[1])[0];
      if (largest[1] > 1) {
        allocations.set(largest[0], largest[1] - 1);
        allocated--;
      } else break;
    }
    while (allocated < MINI_BUDGET) {
      // Grow the largest source bucket
      const candidates = [...allocations.entries()]
        .filter(([day]) => allocations.get(day) < dayBuckets.get(day).length)
        .sort((a, b) => dayBuckets.get(b[0]).length - dayBuckets.get(a[0]).length);
      if (candidates.length === 0) break;
      allocations.set(candidates[0][0], candidates[0][1] + 1);
      allocated++;
    }

    // MMR selection within each day bucket
    for (const [day, budget] of allocations) {
      const pool = dayBuckets.get(day);
      if (pool.length <= budget) {
        // Keep all
        pool.forEach((p) => { p.curated = true; });
        continue;
      }

      const selected = [];
      const remaining = new Set(pool.map((_, i) => i));

      for (let s = 0; s < budget; s++) {
        let bestIdx = -1;
        let bestScore = -Infinity;

        for (const idx of remaining) {
          const photo = pool[idx];
          let quality = photo.qualityScore;

          // Penalize similarity to already-selected photos
          let maxSimilarity = 0;
          for (const selIdx of selected) {
            const dist = hammingDistance(photo.hash, pool[selIdx].hash);
            // Normalize: 0 = identical, 1 = completely different
            const similarity = 1 - dist / photo.hash.length;
            maxSimilarity = Math.max(maxSimilarity, similarity);
          }

          // MMR score: lambda * quality - (1-lambda) * similarity
          // lambda=0.6 favors quality, 0.4 weight on diversity
          const mmrScore = selected.length === 0
            ? quality
            : 0.6 * quality - 0.4 * (maxSimilarity * quality);

          if (mmrScore > bestScore) {
            bestScore = mmrScore;
            bestIdx = idx;
          }
        }

        if (bestIdx >= 0) {
          selected.push(bestIdx);
          remaining.delete(bestIdx);
        }
      }

      selected.forEach((idx) => { pool[idx].curated = true; });
    }

    const curatedCount = manifest.filter((p) => p.curated).length;
    console.log(`  Selected ${curatedCount} photos for mini mode\n`);

    // Log per-day breakdown
    for (const [day, budget] of allocations) {
      const pool = dayBuckets.get(day);
      const picked = pool.filter((p) => p.curated).length;
      console.log(`    ${day}: ${picked}/${pool.length}`);
    }
    console.log();
  } else {
    // Fewer photos than budget — all are curated
    manifest.forEach((p) => { p.curated = true; });
  }

  // Step 9: Generate auto trip title
  const allCountries = [
    ...new Set(manifest.filter((p) => p.country).map((p) => p.country)),
  ];
  const allCities = [
    ...new Set(manifest.filter((p) => p.city).map((p) => p.city)),
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const tripData = {
    title: allCountries.length > 0 ? allCountries.join(" & ") : "Untitled Trip",
    dateRange: {
      start: firstDate,
      end: lastDate,
      startFormatted: formatDate(firstDate),
      endFormatted: formatDate(lastDate),
    },
    locations: allCities,
    countries: allCountries,
    photoCount: manifest.length,
    photos: manifest.map(({ hash, ...rest }) => rest),
  };

  await fs.writeFile(
    path.resolve(MANIFEST_PATH),
    JSON.stringify(tripData, null, 2)
  );

  // Summary
  console.log("─".repeat(50));
  console.log(`✓ Memoir: ${tripData.title}`);
  console.log(
    `  ${tripData.dateRange.startFormatted} → ${tripData.dateRange.endFormatted}`
  );
  console.log(`  ${tripData.locations.join(", ")}`);
  console.log(`  ${manifest.length} photos`);
  console.log(`  Output: ${MANIFEST_PATH}`);
  console.log("─".repeat(50));
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
