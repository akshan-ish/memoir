"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface LightboxPhoto {
  src: string;
  city: string | null;
  date: string | null;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  onClose: () => void;
}

function formatPhotoDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Lightbox({ photos, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [fading, setFading] = useState(false);
  const [closing, setClosing] = useState(false);
  const pendingIndex = useRef<number | null>(null);

  // Sync when initialIndex changes (new photo opened)
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const close = () => {
    setClosing(true);
    setTimeout(() => onClose(), 280);
  };

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (fading) return;
      const next = index + dir;
      if (next >= 0 && next < photos.length) {
        setFading(true);
        pendingIndex.current = next;
        setTimeout(() => {
          setIndex(pendingIndex.current!);
          setFading(false);
        }, 300);
      }
    },
    [index, photos.length, fading]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [navigate]);

  const photo = photos[index];

  return (
    <div
      className={`lightbox-backdrop ${closing ? "lightbox-backdrop--closing" : ""}`}
      onClick={close}
    >
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-image-wrap">
          <img
            src={photo.src}
            alt=""
            className={fading ? "lightbox-img--fading" : ""}
          />
        </div>
        <div
          className="lightbox-meta flex items-start justify-between"
          style={{
            opacity: fading ? 0 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          <div>
            {photo.city && (
              <p className="font-serif text-xl font-light">
                {photo.city}
              </p>
            )}
            {photo.date && (
              <p className="mt-1 font-mono text-[11px] font-light text-muted">
                {formatPhotoDate(photo.date)}
              </p>
            )}
          </div>
        </div>

        {index > 0 && (
          <button
            className="absolute -left-14 top-1/2 -translate-y-1/2 font-mono text-2xl text-muted transition-colors hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            aria-label="Previous photo"
          >
            ←
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            className="absolute -right-14 top-1/2 -translate-y-1/2 font-mono text-2xl text-muted transition-colors hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); navigate(1); }}
            aria-label="Next photo"
          >
            →
          </button>
        )}
      </div>
    </div>
  );
}
