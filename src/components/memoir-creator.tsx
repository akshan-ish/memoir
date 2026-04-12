"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  processPhoto,
  buildClientSections,
  comparePhotosByDate,
  reverseGeocodePhotos,
  type ClientPhoto,
  type Section,
} from "@/lib/client-pipeline";
import {
  saveMemoir,
  loadMemoir,
  deleteMemoir,
  type StoredMemoir,
} from "@/lib/memoir-storage";

const MEMOIR_ID = "current"; // single-memoir MVP; stored in IndexedDB

// A reactive wrapper around a photo's thumb blob that produces a stable object URL.
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function PhotoTile({ photo, onOpen }: { photo: ClientPhoto; onOpen: () => void }) {
  const url = useObjectUrl(photo.thumbBlob);
  return (
    <button className="photo-card" onClick={onOpen} aria-label={photo.name}>
      <div
        className="photo-skeleton-wrap photo-skeleton-wrap--loaded"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      >
        {url && <img src={url} alt={photo.name} loading="lazy" />}
        <div className="photo-overlay" />
      </div>
    </button>
  );
}

function SimpleLightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: ClientPhoto[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];
  const url = useObjectUrl(photo?.originalBlob ?? null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onPrev, onNext]);

  if (!photo) return null;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-image-wrap">
          {url && <img src={url} alt={photo.name} />}
        </div>
        <div className="lightbox-meta">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--muted)" }}>
            {photo.date ? photo.date.slice(0, 10) : "Undated"}
            {photo.city && ` \u00b7 ${photo.city}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MemoirCreator() {
  const [title, setTitle] = useState("Untitled memoir");
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState<{ done: number; total: number } | null>(null);
  const [geocoding, setGeocoding] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load any saved memoir on mount.
  useEffect(() => {
    (async () => {
      try {
        const existing = await loadMemoir(MEMOIR_ID);
        if (existing) {
          setTitle(existing.title);
          setPhotos(existing.photos);
        }
      } catch { /* IndexedDB unavailable; keep blank state */ }
      setLoaded(true);
    })();
  }, []);

  // Auto-save when photos/title change (debounced).
  useEffect(() => {
    if (!loaded) return;
    if (photos.length === 0) return;
    const handle = setTimeout(async () => {
      const memoir: StoredMemoir = {
        id: MEMOIR_ID,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photos,
      };
      try { await saveMemoir(memoir); } catch { /* quota, etc. — ignore */ }
    }, 600);
    return () => clearTimeout(handle);
  }, [photos, title, loaded]);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    if (list.length === 0) return;

    setProcessing({ done: 0, total: list.length });
    setErrors([]);
    const newPhotos: ClientPhoto[] = [];
    const newErrors: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      try {
        const photo = await processPhoto(f);
        newPhotos.push(photo);
      } catch (e) {
        newErrors.push(`${f.name} \u2014 couldn't decode (HEIC needs Safari, or try exporting as JPG)`);
      }
      setProcessing({ done: i + 1, total: list.length });
    }

    setPhotos((prev) => [...prev, ...newPhotos].sort(comparePhotosByDate));
    if (newErrors.length) setErrors(newErrors);
    setProcessing(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  }, [ingestFiles]);

  const doGeocode = useCallback(async () => {
    if (geocoding) return;
    const withGps = photos.filter((p) => p.lat != null && p.lng != null);
    if (withGps.length === 0) return;
    setGeocoding({ done: 0, total: withGps.length });
    const updated = await reverseGeocodePhotos([...photos], (done, total) => {
      setGeocoding({ done, total });
      // also snapshot so the UI updates live
      setPhotos((prev) => [...prev]);
    });
    setPhotos([...updated]);
    setGeocoding(null);
  }, [photos, geocoding]);

  const downloadManifest = useCallback(() => {
    // Produce a JSON shaped like the server-side manifest so it's portable.
    const dates = photos.map((p) => p.date).filter(Boolean).sort() as string[];
    const start = dates[0]?.slice(0, 10) ?? "";
    const end = dates[dates.length - 1]?.slice(0, 10) ?? "";
    const locations = [...new Set(photos.map((p) => p.region).filter(Boolean))];
    const countries = [...new Set(photos.map((p) => p.country).filter(Boolean))];

    const manifest = {
      title,
      dateRange: { start, end, startFormatted: start, endFormatted: end },
      locations,
      countries,
      photoCount: photos.length,
      photos: photos.map((p, i) => ({
        id: i + 1,
        src: `/photos/${p.name}`,
        thumb: `/photos/${p.name.replace(/\.[^.]+$/, "")}_thumb.jpg`,
        width: p.width,
        height: p.height,
        aspectRatio: p.aspectRatio,
        date: p.date,
        lat: p.lat,
        lng: p.lng,
        city: p.city,
        region: p.region,
        country: p.country,
      })),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase() || "memoir"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [photos, title]);

  const clearAll = useCallback(async () => {
    if (!confirm("Delete this memoir? Photos are only stored in your browser and will be lost.")) return;
    setPhotos([]);
    setTitle("Untitled memoir");
    try { await deleteMemoir(MEMOIR_ID); } catch { /* ignore */ }
  }, []);

  const sections: Section[] = useMemo(() => buildClientSections(photos), [photos]);
  const hasPhotos = photos.length > 0;
  const hasGps = photos.some((p) => p.lat != null && p.lng != null);

  return (
    <main className="create-page">
      <header className="create-header">
        <p className="create-eyebrow">
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>&larr; Memoir</Link>
        </p>
        <h1 className="create-title">Make a memoir.</h1>
        <p className="create-subtitle">
          Drop in photos from a trip. Everything stays on your device &mdash; we parse the EXIF,
          group by day, and lay it out. No upload, no account.
        </p>
      </header>

      {hasPhotos ? (
        <>
          <div className="create-form">
            <div className="create-field">
              <label className="create-label">Title</label>
              <input
                className="create-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="August in Provence"
              />
            </div>
          </div>

          <div className="create-toolbar">
            <div className="create-toolbar-info">
              {photos.length} {photos.length === 1 ? "photograph" : "photographs"}
              {sections.length > 1 && ` \u00b7 ${sections.length} days`}
              {hasGps && ` \u00b7 GPS available`}
            </div>
            <div className="create-toolbar-actions">
              <button className="create-action-btn" onClick={() => fileInputRef.current?.click()}>
                Add more
              </button>
              {hasGps && (
                <button
                  className="create-action-btn"
                  onClick={doGeocode}
                  disabled={!!geocoding}
                  title="Reverse-geocode GPS via OpenStreetMap"
                >
                  {geocoding ? `Locating\u2026 ${geocoding.done}/${geocoding.total}` : "Fetch locations"}
                </button>
              )}
              <button className="create-action-btn" onClick={downloadManifest}>
                Download manifest
              </button>
              <button className="create-action-btn create-action-btn--danger" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>
        </>
      ) : (
        <div
          className={`create-drop-zone ${dragActive ? "create-drop-zone--active" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <div className="create-drop-zone-icon">+</div>
          <div className="create-drop-zone-text">Drop photos here, or click to choose</div>
          <div className="create-drop-zone-hint">JPG &middot; PNG &middot; WEBP &middot; HEIC (Safari only)</div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) ingestFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {processing && (
        <div className="create-progress">
          <div className="create-progress-label">
            <span>Processing photographs</span>
            <span>{processing.done} / {processing.total}</span>
          </div>
          <div className="create-progress-bar">
            <div
              className="create-progress-bar-fill"
              style={{ width: `${(processing.done / processing.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="create-progress">
          <div className="create-progress-label">
            <span>Skipped {errors.length} file{errors.length === 1 ? "" : "s"}</span>
          </div>
          <ul style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
            {errors.slice(0, 5).map((msg, i) => <li key={i}>&middot; {msg}</li>)}
            {errors.length > 5 && <li>&middot; &hellip; and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}

      {sections.map((section, si) => (
        <section key={si} className="photo-section">
          <div className="section-heading section-heading--visible">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 300 }}>
              {section.label}
            </h2>
            {section.sublabel && (
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--muted)",
                marginTop: "0.25rem",
              }}>
                {section.sublabel}
              </p>
            )}
          </div>
          <div className="offset-grid">
            {section.photos.map((p) => {
              const globalIdx = photos.indexOf(p);
              return (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  onOpen={() => setLightboxIdx(globalIdx)}
                />
              );
            })}
          </div>
        </section>
      ))}

      {hasPhotos && (
        <p className="create-empty-note">
          Everything here lives in your browser. Close this tab and it stays; clear browsing data and it&rsquo;s gone.
        </p>
      )}

      {lightboxIdx !== null && (
        <SimpleLightbox
          photos={photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => i === null ? i : Math.max(0, i - 1))}
          onNext={() => setLightboxIdx((i) => i === null ? i : Math.min(photos.length - 1, i + 1))}
        />
      )}
    </main>
  );
}
