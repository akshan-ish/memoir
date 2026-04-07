# Memoir

A quiet record of where you've been.

Turn your trip photos into a beautiful, self-contained photo memoir website. Point at a folder of photos — Memoir handles the rest.

## Getting Started

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
