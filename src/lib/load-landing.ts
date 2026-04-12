// Reads marketing photos from public/landing/ at build time.
// Drop any number of JPG/PNG/WEBP files in that directory and they become
// the hero strip on the landing page, in alphabetical order.

import fs from "node:fs";
import path from "node:path";

export interface LandingPhoto {
  src: string;          // URL path served by Next.js (e.g. "/landing/01.jpg")
  name: string;         // filename without extension, used for alt text
}

export function loadLandingPhotos(): LandingPhoto[] {
  try {
    const dir = path.join(process.cwd(), "public", "landing");
    return fs.readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => ({
        src: `/landing/${f}`,
        name: f.replace(/\.[^.]+$/, ""),
      }));
  } catch {
    return [];
  }
}
