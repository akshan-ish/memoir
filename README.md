# Memoir

A quiet record of where you've been.

Turn your trip photos into a beautiful, self-contained photo memoir website. Point at a folder of photos — Memoir handles the rest.

## Two ways to use it

**In your browser** &mdash; visit the site, go to `/create`, drop in a folder of photos, and you get a memoir laid out instantly. Everything stays on your device; nothing is uploaded.

**With Claude Code** (the full pipeline) &mdash; deduplication, blur detection, curation, reverse geocoding and all. Great for large trips and for building a site with multiple collections.

## Getting Started (Claude Code)

You'll need [Claude Code](https://claude.ai/code) installed.

### 1. Install the skill

Give Claude Code the link to this Github repo and ask it to install the memoir skill

or if you want to do it manually

```bash
mkdir -p ~/.claude/skills/memoir
curl -o ~/.claude/skills/memoir/SKILL.md \
  https://raw.githubusercontent.com/akshan-ish/memoir/main/.claude/skills/memoir/SKILL.md
```

### 2. Create your first memoir

Open Claude Code anywhere and run:

```
/memoir
```

It will ask for your name and where your photos are. You can also pass that directly:

```
/memoir ~/Pictures/thailand-trip
/memoir my album called "Japan 2025"
```

That's it. Memoir processes your photos, builds the site, and tells you where to view it.

### 3. Add more trips

Run `/memoir` again with a different folder or album. Each trip becomes a new collection on your site.

## What it does

- Scans your photos for EXIF data (dates, GPS coordinates)
- Removes duplicates, blurry shots, and screenshots automatically
- Reverse geocodes locations into place names
- Generates optimized images and thumbnails
- Builds a static site you can open locally or deploy anywhere

## What you get

- Horizontal carousel landing page with all your trips
- Per-trip photo grid organized by date and location
- Lightbox viewer with keyboard navigation
- Side navigation timeline
- Three themes: light, dark, parchment
- Editorial layout mode
- Curated "best 60" mode for longer trips
- Fully static — no server needed, works offline

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://claude.ai/code)
- macOS (for Photos.app album export — folder import works anywhere)

## Manual usage

If you prefer not to use the Claude Code skill:

```bash
# Clone and install
git clone https://github.com/akshan-ish/memoir.git
cd memoir
npm install

# Process a folder of photos
node scripts/process.mjs ~/path/to/photos \
  --output public/photos-mytrip \
  --manifest src/data/manifest-mytrip.json

# Then add the trip to src/data/trips.json and
# add manifest imports to the page files (see CLAUDE.md)

# Build and serve
npx next build
npx serve out -l 3456
```

## Deploy to Vercel

The site is a static export, which Vercel hosts as-is.

1. Push this repo to GitHub.
2. Import the repo in the Vercel dashboard. The defaults from `vercel.json` are
   correct (framework: Next.js, output: `out`).
3. Optional: set `NEXT_PUBLIC_WAITLIST_ENDPOINT` to a URL that accepts
   `POST { email }` (e.g. a Formspree form, Buttondown signup endpoint, or a
   simple serverless function). If unset, waitlist signups are still recorded
   locally in the visitor's `localStorage` so nothing is lost during testing.

## Waitlist & browser creator

- `/` is a waitlist landing page. Fill in `NEXT_PUBLIC_WAITLIST_ENDPOINT` to
  collect signups; otherwise the form stores them in the visitor's browser.
- `/create` is a client-side memoir creator. It uses the File API, `exifreader`,
  Canvas (for thumbnails), and IndexedDB (to persist across reloads). No data
  leaves the device. Location-name lookup is optional and uses the public
  Nominatim service when enabled.
