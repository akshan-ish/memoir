"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Photo {
  id: number;
  src: string;
  thumb: string;
  width: number;
  height: number;
  aspectRatio: number;
  date: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  coordinates: string | null;
}

interface PhotoSection {
  label: string;
  sublabel?: string;
  photos: Photo[];
  startIndex: number;
}

interface MasonryGridProps {
  sections: PhotoSection[];
  allPhotos: Photo[];
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

function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "60px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

function PhotoCard({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: (i: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="offset-grid-item">
      <div
        className="photo-card"
        onClick={() => onOpen(index)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(index)}
      >
        <div className={`photo-skeleton-wrap ${loaded ? "photo-skeleton-wrap--loaded" : ""}`}>
          <img
            ref={imgRef}
            src={photo.thumb}
            alt=""
            width={photo.width}
            height={photo.height}
            loading={index < 9 ? "eager" : "lazy"}
            onLoad={() => setLoaded(true)}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
        <div className="photo-overlay">
          {photo.city && (
            <p className="font-serif text-lg font-light text-white sm:text-xl">
              {photo.city}
            </p>
          )}
          {photo.date && (
            <p className="mt-1 font-mono text-[10px] font-light tracking-wider text-white/50">
              {formatPhotoDate(photo.date)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ section }: { section: PhotoSection }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "60px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "opacity, transform",
      }}
    >
      <div className={`section-heading ${visible ? "section-heading--visible" : ""}`}>
        <h2 className="font-serif text-2xl font-light tracking-tight sm:text-3xl">
          {section.label}
        </h2>
        {section.sublabel && (
          <p className="mt-1 font-mono text-[11px] font-light tracking-wide text-muted">
            {section.sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

export function MasonryGrid({ sections, allPhotos }: MasonryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const [closing, setClosing] = useState(false);
  const pendingIndex = useRef<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => {
    setClosing(true);
    setTimeout(() => {
      setLightboxIndex(null);
      setClosing(false);
    }, 280);
  };

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (lightboxIndex === null || fading) return;
      const next = lightboxIndex + dir;
      if (next >= 0 && next < allPhotos.length) {
        setFading(true);
        pendingIndex.current = next;
        setTimeout(() => {
          setLightboxIndex(pendingIndex.current);
          setFading(false);
        }, 300);
      }
    },
    [lightboxIndex, allPhotos.length, fading]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [lightboxIndex, navigate]);

  return (
    <>
      {/* Viewport edge fades */}
      <div className="edge-fade edge-fade--top" />
      <div className="edge-fade edge-fade--bottom" />

      {sections.map((section, si) => (
        <div key={si} className="photo-section">
          {/* Section heading */}
          <SectionHeading section={section} />

          {/* Photo grid */}
          <div className="offset-grid">
            {section.photos.map((photo, pi) => (
              <ScrollReveal key={photo.id} delay={(pi % 3) * 0.08}>
                <PhotoCard
                  photo={photo}
                  index={section.startIndex + pi}
                  onOpen={openLightbox}
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className={`lightbox-backdrop ${closing ? "lightbox-backdrop--closing" : ""}`} onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-image-wrap">
              <img
                src={allPhotos[lightboxIndex].src}
                alt=""
                className={`shadow-lg ${fading ? "lightbox-img--fading" : ""}`}
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
                {allPhotos[lightboxIndex].city && (
                  <p className="font-serif text-xl font-light">
                    {allPhotos[lightboxIndex].city}
                  </p>
                )}
                {allPhotos[lightboxIndex].date && (
                  <p className="mt-1 font-mono text-[11px] font-light text-muted">
                    {formatPhotoDate(allPhotos[lightboxIndex].date!)}
                  </p>
                )}
              </div>
            </div>

            {lightboxIndex > 0 && (
              <button
                className="absolute -left-14 top-1/2 -translate-y-1/2 font-mono text-2xl text-muted transition-colors hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                aria-label="Previous photo"
              >
                ←
              </button>
            )}
            {lightboxIndex < allPhotos.length - 1 && (
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
      )}
    </>
  );
}
