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

interface EditorialLayoutProps {
  photos: Photo[];
  sections?: PhotoSection[];
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

type Placement = {
  width: string;       // CSS width
  marginLeft: string;  // horizontal offset
  marginTop: string;   // vertical breathing room
};

// Deterministic placement pattern — cycles through varied positions
// Each photo gets a unique feel without randomness
function getPlacement(index: number, aspectRatio: number): Placement {
  const isLandscape = aspectRatio > 1.2;
  const isPortrait = aspectRatio < 0.8;

  // 12-step cycle with varied compositions
  const step = index % 12;

  switch (step) {
    case 0: // Full width opener
      return { width: "90%", marginLeft: "5%", marginTop: index === 0 ? "0" : "10vh" };
    case 1: // Small, tucked right
      return { width: isPortrait ? "28%" : "35%", marginLeft: "58%", marginTop: "8vh" };
    case 2: // Medium, left-leaning
      return { width: isLandscape ? "60%" : "45%", marginLeft: "8%", marginTop: "12vh" };
    case 3: // Large centered
      return { width: "70%", marginLeft: "15%", marginTop: "6vh" };
    case 4: // Small, far left
      return { width: isPortrait ? "30%" : "38%", marginLeft: "4%", marginTop: "10vh" };
    case 5: // Wide, slight right offset
      return { width: isLandscape ? "75%" : "55%", marginLeft: "20%", marginTop: "14vh" };
    case 6: // Tiny, centered
      return { width: isPortrait ? "25%" : "32%", marginLeft: "38%", marginTop: "8vh" };
    case 7: // Large, flush left
      return { width: "65%", marginLeft: "2%", marginTop: "10vh" };
    case 8: // Medium, right
      return { width: isLandscape ? "55%" : "40%", marginLeft: "42%", marginTop: "12vh" };
    case 9: // Full bleed
      return { width: "95%", marginLeft: "2.5%", marginTop: "16vh" };
    case 10: // Small, upper right
      return { width: isPortrait ? "26%" : "34%", marginLeft: "62%", marginTop: "6vh" };
    case 11: // Medium left with big gap after
      return { width: "50%", marginLeft: "10%", marginTop: "14vh" };
    default:
      return { width: "60%", marginLeft: "20%", marginTop: "10vh" };
  }
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
      { threshold: 0.05, rootMargin: "80px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.98)",
        transition: `opacity 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

export function EditorialLayout({ photos, sections }: EditorialLayoutProps) {
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
      if (next >= 0 && next < photos.length) {
        setFading(true);
        pendingIndex.current = next;
        setTimeout(() => {
          setLightboxIndex(pendingIndex.current);
          setFading(false);
        }, 300);
      }
    },
    [lightboxIndex, photos.length, fading]
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
      <div className="editorial-flow">
        {(sections || [{ label: "", photos, startIndex: 0 }]).map((section, si) => {
          // Track running photo index for placement continuity across sections
          const globalOffset = section.startIndex;

          return (
            <div key={si} className="photo-section">
              {sections && (
                <ScrollReveal>
                  <div
                    className="editorial-marker"
                    style={{ marginTop: si === 0 ? "0" : "16vh" }}
                  >
                    <p className="font-serif text-2xl font-light tracking-tight sm:text-3xl">
                      {section.label}
                    </p>
                    {section.sublabel && (
                      <p className="mt-1 font-mono text-[11px] font-light tracking-wide text-muted">
                        {section.sublabel}
                      </p>
                    )}
                  </div>
                </ScrollReveal>
              )}

              {section.photos.map((photo, pi) => {
                const globalIndex = globalOffset + pi;
                const placement = getPlacement(globalIndex, photo.aspectRatio);

                return (
                  <ScrollReveal key={photo.id}>
                    <div
                      className="editorial-item"
                      style={{
                        width: placement.width,
                        marginLeft: placement.marginLeft,
                        marginTop: placement.marginTop,
                      }}
                    >
                      <div
                        className="photo-card"
                        onClick={() => openLightbox(globalIndex)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && openLightbox(globalIndex)}
                      >
                        <img
                          src={photo.src}
                          alt=""
                          width={photo.width}
                          height={photo.height}
                          loading={globalIndex < 3 ? "eager" : "lazy"}
                          style={{ display: "block", width: "100%", height: "auto" }}
                        />
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
                  </ScrollReveal>
                );
              })}
            </div>
          );
        })}

        <div style={{ height: "20vh" }} />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className={`lightbox-backdrop ${closing ? "lightbox-backdrop--closing" : ""}`} onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-image-wrap">
              <img
                src={photos[lightboxIndex].src}
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
                {photos[lightboxIndex].city && (
                  <p className="font-serif text-xl font-light">
                    {photos[lightboxIndex].city}
                  </p>
                )}
                {photos[lightboxIndex].date && (
                  <p className="mt-1 font-mono text-[11px] font-light text-muted">
                    {formatPhotoDate(photos[lightboxIndex].date!)}
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
            {lightboxIndex < photos.length - 1 && (
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
