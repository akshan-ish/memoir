@AGENTS.md

# Memoir

A post-trip static site generator that turns a folder of photos into a beautiful, self-contained photo memoir website.

## Vision

Start simple: point at a photo folder, get a curated website. End goal: a "start/stop memoir" app that pulls from your camera roll in real-time during a trip and builds the site automatically when you're done.

## Design Aesthetic

**Kinfolk meets Are.na.** Editorial, typography-led, generous white space. Photos are moments, not a dump.

Key principles:
- Let the photos create the variety, not the layout. Keep grids simple and consistent.
- Generous negative space matters more than clever layout tricks.
- Typography is the architecture: Cormorant Garamond (serif, display) + JetBrains Mono (monospace, metadata).
- Warm palette: near-white (#fafaf8), soft black (#1a1a1a), muted stone (#999). Dark and parchment themes available.
- No decoration — just precision. Every element earns its place.
- The user rejected complex algorithmic layout variety (hero rows, asymmetric pairs) as feeling "random." Simple 3-column grid with subtle refinements is preferred.

## Architecture

### Processing Pipeline (`scripts/process.mjs`)

A Node.js CLI script that reads a photo folder and outputs optimized images + a JSON manifest.

```
node scripts/process.mjs <folder> [--aggressive] [--output dir] [--manifest path]
```

Pipeline steps:
1. **Scan** — find jpg/jpeg/heic/png, skip Live Photo duplicates (`(1)` suffix)
2. **Analyze** — EXIF metadata, perceptual hash (16x16 average hash), blur score (Laplacian variance), exposure score (histogram), screenshot/document detection
3. **Deduplicate** — time proximity (within N seconds) + visual similarity (hamming distance). Keeps highest quality from each cluster.
4. **Filter** — remove blurry, badly exposed, screenshots, documents. `--aggressive` mode: tighter thresholds + keep only top 60% by quality.
5. **Reverse geocode** — Nominatim (zoom 18). Two-tier: detailed name for photo overlays (POI/landmark), broad name for section headings (city/province, with Vietnamese/French prefixes stripped).
6. **Curate** — MMR (Maximum Marginal Relevance) algorithm selects 60 photos for mini mode. Proportional allocation across days, then greedy selection optimizing quality while penalizing similarity to already-picked photos.
7. **Optimize** — Sharp: auto-rotate, resize to 2400px max, generate 800px thumbs, output as JPEG.
8. **Manifest** — JSON with trip metadata, photo array (src, thumb, dimensions, date, location, curated flag).

### Frontend (Next.js App Router, static export)

```
src/
  app/
    page.tsx              — landing page (trip browser)
    layout.tsx            — root layout, fonts
    globals.css           — all styles, theme variables
    trips/[slug]/page.tsx — individual trip page (generateStaticParams)
  components/
    page-content.tsx      — trip page shell (layout/density state, header, footer)
    masonry-grid.tsx      — 3-column grid with sections, lightbox, scroll reveal
    editorial-layout.tsx  — editorial mode (varied sizes, offsets, negative space)
    top-bar.tsx           — fixed nav: back link, trip arrows, settings dropdown
    landing-theme.tsx     — applies saved theme on landing page
  lib/
    trip-utils.ts         — shared types, date/coordinate formatting, section builder
  data/
    trips.json            — trip registry (slug, manifest path, photos dir)
    manifest.json         — Vietnam trip data
    manifest-france.json  — France trip data
    manifest-patagonia.json — Patagonia trip data
```

Output is `output: 'export'` — fully self-contained static HTML/CSS/JS + images in `out/`.

### Multi-trip Setup

Each trip is processed separately with its own `--output` and `--manifest` paths. Adding a new trip:
1. Export photos from Photos.app (or point to any folder)
2. Run `node scripts/process.mjs <folder> --output public/photos-<slug> --manifest src/data/manifest-<slug>.json`
3. Add entry to `src/data/trips.json`
4. Add static import in `src/app/page.tsx` and `src/app/trips/[slug]/page.tsx`
5. Rebuild

## Key Decisions

- **No external dependencies at runtime.** Fonts self-hosted via next/font/google (downloaded at build time). No CDN, no API calls from the browser.
- **Plain `<img>` tags, not `next/image`.** Static export doesn't support the Next.js image optimization API. Images are pre-optimized by Sharp in the pipeline.
- **CSS columns were rejected for masonry.** They flow top-to-bottom per column, breaking chronological left-to-right reading order. Using CSS Grid instead.
- **Nominatim for geocoding.** Free, no API key. Rate-limited to 1 req/sec. Cached by ~100m grid precision to reduce API calls.
- **Deduplication uses both time + vision.** Time alone misses burst shots from different sessions. Vision alone is too expensive for large sets. Combined: photos within N seconds AND visually similar get clustered.
- **Curated mode uses MMR, not just top-N by quality.** Pure quality ranking would cluster the best shots from one location. MMR ensures diversity across the full trip.
- **Screenshot detection via PNG extension + EXIF + content analysis.** PNGs from phones are almost always screenshots. Content analysis checks for flat color regions, low saturation, device screen resolutions.

## Coding Conventions

- CSS is in `globals.css`, not Tailwind-only. Complex component styles (masonry, lightbox, editorial layout, skeleton states) use plain CSS classes. Tailwind is used for utility styling in JSX.
- Theme variables are in `:root` and `[data-theme]` selectors. All colors reference CSS variables so themes work everywhere.
- Client components use `"use client"` directive. Server components handle data loading (manifest imports, section building).
- The processing pipeline is a single `.mjs` file with no framework dependencies beyond sharp and exifreader.

## Working with Photos.app

Export via AppleScript:
```
osascript -e 'tell application "Photos"
  set theAlbum to album "Album Name"
  set theItems to media items 1 thru 50 of theAlbum
  export theItems to POSIX file "/path/to/output" with using originals
end tell'
```
- Batch in groups of 50 to avoid AppleEvent timeouts
- Live Photos export as both JPEG + MOV — the pipeline skips `(1)` suffixed files and video extensions
- Clean out .MOV/.MP4 files after export

## Current Test Data

- **Vietnam** — 234 photos in, 207 after dedup/filter, November 2025. Locations: Ha Noi, Ninh Binh, Ho Chi Minh City.
- **France** — 642 photos in, 275 after aggressive filter, August 2024. Locations: Marseille, Arles, Camargue.
- **Patagonia** — 45 photos in, 30 after filter, December 2017. No GPS data.

## Running Locally

```bash
# Process a trip
node scripts/process.mjs /path/to/photos --output public/photos-mytrip --manifest src/data/manifest-mytrip.json

# Build static site
npx next build

# Serve locally
npx serve out -l 3456
```

## Design Context

### Users
People revisiting their own travel photos — alone, reflectively, after the trip is over. They want their camera roll transformed into something that feels curated and meaningful, not a photo dump. The context is personal and private: this is a journal, not a portfolio.

### Brand Personality
**Minimal, personal, honest.** No pretension — just your photos, presented beautifully. The interface should disappear so the memories can breathe. "A quiet record of where you've been."

### Emotional Goals
- **Quiet nostalgia** — calm, reflective, like flipping through a printed photo book alone
- **Intimate & personal** — feels like a private journal, not a social feed or portfolio

### Aesthetic Direction
**Kinfolk meets Are.na, with rauno.me interaction craft.**

- Editorial, typography-led, generous negative space
- Cormorant Garamond (serif, display) + JetBrains Mono (mono, metadata) — typography is the architecture
- Warm palette: near-white `#fafaf8`, soft black `#1a1a1a`, muted stone `#999`. Three themes: light, dark, parchment
- Subtle, fluid micro-interactions (proximity-reactive elements, smooth transitions, scroll reveal)
- No decoration — just precision. Every element earns its place
- Let photos create the variety, not the layout

### Anti-References (what this must NOT feel like)
- **Google Photos / iCloud** — utilitarian grid, photos as files not moments
- **Instagram / social media** — no likes, no metrics, no performative sharing
- **Generic template sites** — no cookie-cutter Squarespace/Wix portfolio energy
- **Data dashboards** — no charts, stats, or analytics feel; this is emotional not informational

### Design Principles

1. **Photos are the content, not the chrome.** The interface serves the photographs. Layouts stay simple and consistent — the photos themselves provide all the visual variety needed. Reject algorithmic layout tricks that feel "random."

2. **Negative space is a feature.** Generous whitespace signals intention and calm. Resist the urge to fill every pixel. Breathing room between elements matters more than clever layout.

3. **Quiet until invited.** UI elements (sidebar, overlays, controls) stay subtle at rest and reveal themselves on interaction. Nothing competes with the photos for attention. Blur, fade, and proximity are the vocabulary.

4. **Precision over decoration.** No borders for the sake of borders, no shadows for depth theater, no gradients for visual interest. Every visual element must earn its place through function.

5. **Transitions are part of the design.** Movement should feel intentional and physical — spring easings `cubic-bezier(0.16, 1, 0.3, 1)`, 0.3-0.6s durations, opacity fades over hard cuts. The interface should feel alive but unhurried.
