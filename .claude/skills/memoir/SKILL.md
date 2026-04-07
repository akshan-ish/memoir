---
name: memoir
description: Create a photo memoir from your trip photos. Handles first-time setup and adding new collections. Use when the user wants to create or add to their memoir site.
disable-model-invocation: true
argument-hint: [photo source - folder path, album name, or date range]
---

# Memoir — Photo Collection Creator

Turn a folder of trip photos into a beautiful, self-contained photo memoir website.

## Input: $ARGUMENTS

If the input is empty or missing, ask the user: "Where are your photos? You can give me a folder path, a Photos.app album name, or a date range."

## Step 0: Find or Create the Memoir Project

Check if a memoir project already exists by looking for a `package.json` with `"name": "memoir"` in the current directory or common locations.

**If no memoir project exists — this is a fresh setup:**

1. Ask the user: "What name should we use for your memoir? (e.g., 'Alex' → Alex's Memoir)"
2. Ask: "Where should I create the project? (default: `./memoir`)"
3. Clone the memoir project:
   ```bash
   git clone https://github.com/akshan-ish/memoir.git "<chosen-path>"
   cd "<chosen-path>"
   npm install
   ```
4. Create `src/data/config.json`:
   ```json
   { "ownerName": "<name>", "siteTitle": "<name>'s Memoir" }
   ```
5. Clear out any existing demo/sample trip data:
   - Empty `src/data/trips.json` to `[]`
   - Remove any existing manifest files (`src/data/manifest*.json`) 
   - Remove any existing photo directories in `public/photos*`
   - Clean up the static imports in `src/app/page.tsx` and `src/app/trips/[slug]/page.tsx` — remove all hardcoded manifest imports and reset the `manifests` object to `{}`

**If memoir project exists:**
- Read `src/data/config.json`. If it's missing `ownerName`, ask: "What name should we use for your memoir?"
- `cd` into the project directory for all subsequent steps.

## Step 1: Parse the Photo Source

Determine what kind of source the user specified from `$ARGUMENTS`:

**Folder path** — if they mention a path or folder:
- Examples: `~/Pictures/thailand`, `the folder called Thailand on my desktop`, `/Users/me/photos`
- Resolve to an absolute path. Verify the folder exists and contains images. If ambiguous, ask.

**Photos.app album** — if they mention an album:
- Examples: `my album called "Vietnam 2025"`, `the France album`
- Will need to export via AppleScript first.

**Date range** — if they mention dates:
- Examples: `photos from oct 17 to nov 11 2025`, `pictures taken in august 2024`
- Not yet supported. Tell the user: "Date range selection is coming soon. For now, you can either point me to a folder of photos, or tell me a Photos.app album name."

If the input is ambiguous, ask one clarifying question.

## Step 2: Determine the Slug

Derive a URL-friendly slug from the trip name or folder name (lowercase, hyphens, no special chars).
Check `src/data/trips.json` to make sure it doesn't already exist. If it does, ask the user what to name it.

## Step 3: Export Photos (if needed)

**If Photos.app album:**
```bash
mkdir -p /tmp/memoir-export-<slug>
osascript -e 'tell application "Photos"
  set theAlbum to album "<album-name>"
  set theCount to count of media items of theAlbum
  set batchSize to 50
  repeat with i from 1 to theCount by batchSize
    set endIdx to i + batchSize - 1
    if endIdx > theCount then set endIdx to theCount
    set theItems to media items i thru endIdx of theAlbum
    export theItems to POSIX file "/tmp/memoir-export-<slug>" with using originals
  end repeat
end tell'
```
Then clean up video files: `rm -f /tmp/memoir-export-<slug>/*.{MOV,MP4,mov,mp4}`

**If folder:** Use the path directly, no export needed.

## Step 4: Run the Processing Pipeline

```bash
node scripts/process.mjs "<photo-source-path>" \
  --output public/photos-<slug> \
  --manifest src/data/manifest-<slug>.json
```

If there are many photos (500+), suggest adding `--aggressive` for tighter curation.

Show the user the pipeline output as it runs. When done, report:
- How many photos found → how many after filtering
- Trip title (auto-detected from locations)
- Date range

Ask: "Look good? I'll add it to your memoir."

## Step 5: Register the Trip

1. Read `src/data/trips.json` and add the new entry:
```json
{
  "slug": "<slug>",
  "manifest": "manifest-<slug>.json",
  "photosDir": "/photos-<slug>"
}
```

2. Add the manifest import to `src/app/page.tsx`:
   - Add `import <slug>Manifest from "@/data/manifest-<slug>.json";` with the other imports
   - Add `<slug>: <slug>Manifest as unknown as TripManifest,` to the manifests object

3. Add the same manifest import to `src/app/trips/[slug]/page.tsx`:
   - Add `import <slug>Manifest from "@/data/manifest-<slug>.json";` with the other imports
   - Add `<slug>: <slug>Manifest as unknown as TripManifest,` to the manifests object

**Important:** If this is the first trip being added (trips.json was empty), the page files may have an empty manifests object — that's fine, just add the new entry.

## Step 6: Verify & Launch

Run `npx next build` to make sure everything compiles.

If it succeeds:
"Your <trip-title> collection is ready! Run `npx next dev -p 3456` to see it at http://localhost:3456"

If the build fails, diagnose and fix the issue before telling the user it's ready.
