#!/usr/bin/env node

/**
 * Export photos from Photos.app by date range.
 *
 * Usage: node scripts/export-by-date.mjs --start 2025-10-17 --end 2025-11-11 --output /tmp/memoir-export
 *
 * Uses AppleScript to query Photos.app for media items within the date range,
 * then exports originals in batches of 50 to avoid AppleEvent timeouts.
 */

import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const startDate = getArg("start");
const endDate = getArg("end");
const outputDir = getArg("output") || "/tmp/memoir-export";

if (!startDate || !endDate) {
  console.error("Usage: node scripts/export-by-date.mjs --start YYYY-MM-DD --end YYYY-MM-DD [--output dir]");
  process.exit(1);
}

// Validate dates
const start = new Date(startDate);
const end = new Date(endDate);
if (isNaN(start.getTime()) || isNaN(end.getTime())) {
  console.error("Invalid date format. Use YYYY-MM-DD.");
  process.exit(1);
}
if (start > end) {
  console.error("Start date must be before end date.");
  process.exit(1);
}

// Add one day to end date so it's inclusive
const endPlusOne = new Date(end);
endPlusOne.setDate(endPlusOne.getDate() + 1);

// Format dates for AppleScript (date string format macOS understands)
function formatForAppleScript(d) {
  // AppleScript date format: "month/day/year"
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const asStart = formatForAppleScript(start);
const asEnd = formatForAppleScript(endPlusOne);

console.log(`\nExporting photos from ${startDate} to ${endDate}`);
console.log(`Output: ${outputDir}\n`);

// Create output directory
await fs.mkdir(outputDir, { recursive: true });

// Step 1: Count matching photos
console.log("Querying Photos.app for matching photos...");

const countScript = `
tell application "Photos"
  set startDate to date "${asStart}"
  set endDate to date "${asEnd}"
  set matchingItems to (every media item whose date is greater than or equal to startDate and date is less than endDate)
  return count of matchingItems
end tell
`;

let totalCount;
try {
  const result = execSync(`osascript -e '${countScript.replace(/'/g, "'\\''")}'`, {
    timeout: 60000,
    encoding: "utf-8",
  }).trim();
  totalCount = parseInt(result, 10);
} catch (err) {
  console.error("Failed to query Photos.app. Make sure Photos is accessible.");
  console.error(err.message);
  process.exit(1);
}

if (totalCount === 0) {
  console.log("No photos found in that date range.");
  process.exit(0);
}

console.log(`Found ${totalCount} photos. Exporting in batches...\n`);

// Step 2: Export in batches of 50
const batchSize = 50;
const batches = Math.ceil(totalCount / batchSize);

for (let batch = 0; batch < batches; batch++) {
  const batchStart = batch * batchSize + 1;
  const batchEnd = Math.min((batch + 1) * batchSize, totalCount);

  console.log(`  Batch ${batch + 1}/${batches} (photos ${batchStart}-${batchEnd})...`);

  const exportScript = `
tell application "Photos"
  set startDate to date "${asStart}"
  set endDate to date "${asEnd}"
  set matchingItems to (every media item whose date is greater than or equal to startDate and date is less than endDate)
  set batchItems to items ${batchStart} thru ${batchEnd} of matchingItems
  export batchItems to POSIX file "${outputDir}" with using originals
end tell
`;

  try {
    execSync(`osascript -e '${exportScript.replace(/'/g, "'\\''")}'`, {
      timeout: 300000, // 5 min per batch
      encoding: "utf-8",
    });
  } catch (err) {
    console.error(`  Failed on batch ${batch + 1}: ${err.message}`);
    console.error("  Continuing with remaining batches...");
  }
}

// Step 3: Clean up video files
console.log("\nCleaning up video files...");
const files = await fs.readdir(outputDir);
let removed = 0;
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if ([".mov", ".mp4", ".m4v", ".avi"].includes(ext)) {
    await fs.unlink(path.join(outputDir, file));
    removed++;
  }
}
if (removed > 0) {
  console.log(`  Removed ${removed} video files.`);
}

// Count final photos
const remaining = (await fs.readdir(outputDir)).filter((f) => {
  const ext = path.extname(f).toLowerCase();
  return [".jpg", ".jpeg", ".heic", ".png"].includes(ext);
});

console.log(`\nDone! ${remaining.length} photos exported to ${outputDir}`);
