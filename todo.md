# Memoir — Todo

## Ideas

- **Edit view** — user can remove photos from the memoir. Toggled via a button. Click photos to mark for removal, confirm to re-generate.
- **Hosting / distribution** — desktop app (Electron/Tauri) is probably the sweet spot: local, user-friendly, no terminal. Start with CLI or Claude Code skill as MVP, graduate to desktop app. Could also do one-click deploy to Vercel/Netlify for sharing.
- **Map mode** — view photos plotted on a map by GPS coordinates. Click a pin to see the photo. Could use a timeline scrubber to animate the trip route.
- **Date-range photo selection** — instead of pointing to a folder/album, select photos by date range ("photos from Aug 1-31 2024"). Can query Photos.app via AppleScript date filters. Closer to the start/stop memoir vision.
- **Video integration** — include short video clips in the memoir. Could auto-extract a still frame for the grid + play on hover/click. Need to handle MOV/MP4, extract thumbnails, maybe auto-trim to key moments. Consider video as part of the editorial layout.
- **Ambient music** — optional background music while browsing. Location-specific: pull ambient/local music based on trip country (e.g. Vietnamese folk for Vietnam, bossa nova for Brazil). Could use Spotify embeds, Apple Music API, or bundle royalty-free ambient tracks. Subtle play/pause control in the corner.
- **Onboarding and setup** — first-run experience for new users. Guide through pointing at a photo folder, processing, and generating the first memoir. Could be a wizard-style flow or a simple CLI walkthrough. Should feel welcoming and low-friction.

## Done

- Photo processing pipeline — scan, EXIF extraction, perceptual hashing, blur/exposure scoring, image optimization with Sharp
- Deduplication — time-proximity (10s window) + visual similarity (hamming distance). Keeps best quality from each cluster.
- Reverse geocoding via Nominatim — cached by ~1km grid, rate-limited
- Auto EXIF rotation fix
- Timeline construction from date metadata
- Auto trip title from country names, date range formatting
- Static site generation — Next.js App Router, static export, self-contained bundle
- Cormorant Garamond + JetBrains Mono typography (self-hosted via next/font)
- 3-column grid layout (3 desktop, 2 tablet, 1 mobile) with chronological ordering
- Lightbox with arrow key navigation
- Hover overlay showing location, coordinates, date
- Scroll-triggered fade-in animation
- Video file exclusion from pipeline
- Photos Library integration via AppleScript (export from named album)
- Location/time subheadings — sections grouped by date + location with editorial dividers
- Viewport edge fades — fixed top/bottom gradients for smooth scroll appearance
- Skeleton loading states — shimmer placeholders while images load, aspect-ratio-preserved
- Theme switcher — light, dark, parchment modes with smooth transitions, persisted in localStorage
- Memoir logo top-right with settings dropdown
- Editorial layout mode — varied photo sizes, dramatic offsets, negative space, experiential scroll
- Lightbox fade transitions between photos
- Aggressive filtering mode (--aggressive flag) — tighter dedup, stricter blur/exposure, quality percentile trimming
- Detailed location names — POI/landmark level for photo overlays, city/region for section headings
- Two-tier geocoding — detailed (Nominatim zoom 18) for overlays, broad (state/province cleaned) for sections
- Multi-trip pipeline support (--output, --manifest flags)
- Multi-trip navigation — landing page with trip cards, per-trip routes, arrow nav between trips
- Screenshot and document filtering — PNG detection, EXIF software field, content analysis (flat colors, low saturation, device resolutions)
- Curated mini mode (60 photos) — MMR algorithm with proportional day allocation, quality + diversity optimization. Instant toggle in dropdown.
- Left side nav — fixed rail with proximity-reactive lines, full-page blur overlay, date/location hierarchy, click-to-scroll navigation
