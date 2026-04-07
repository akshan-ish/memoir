export interface PhotoWithCoords {
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
  curated?: boolean;
}

export interface PhotoSection {
  label: string;
  sublabel?: string;
  photos: PhotoWithCoords[];
  startIndex: number;
}

export interface TripManifest {
  title: string;
  dateRange: {
    start: string;
    end: string;
    startFormatted: string;
    endFormatted: string;
  };
  locations: string[];
  countries: string[];
  photoCount: number;
  photos: Array<{
    id: number;
    src: string;
    thumb: string;
    width: number;
    height: number;
    aspectRatio: number;
    date: string;
    lat: number;
    lng: number;
    city: string;
    region: string;
    country: string;
  }>;
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const startDay = s.getDate();
  const endDay = e.getDate();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
  const startMonth = monthFmt.format(s);
  const endMonth = monthFmt.format(e);
  const year = s.getFullYear();
  if (startMonth === endMonth && s.getFullYear() === e.getFullYear()) {
    if (startDay === endDay) return `${startMonth} ${startDay}, ${year}`;
    return `${startMonth} ${startDay}\u2013${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} \u2013 ${endMonth} ${endDay}, ${year}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  const latDeg = Math.abs(lat);
  const lngDeg = Math.abs(lng);
  const latMin = (latDeg % 1) * 60;
  const lngMin = (lngDeg % 1) * 60;
  return `${Math.floor(latDeg)}\u00b0${latMin.toFixed(0).padStart(2, "0")}\u2032${latDir} ${Math.floor(lngDeg)}\u00b0${lngMin.toFixed(0).padStart(2, "0")}\u2032${lngDir}`;
}

function formatSectionDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function preparePhotos(manifest: TripManifest): PhotoWithCoords[] {
  return manifest.photos.map((p) => ({
    ...p,
    coordinates:
      p.lat && p.lng ? formatCoordinates(p.lat, p.lng) : null,
  })) as PhotoWithCoords[];
}

export function buildSections(photos: PhotoWithCoords[]): PhotoSection[] {
  const sections: PhotoSection[] = [];
  let currentDateKey = "";

  photos.forEach((photo, i) => {
    const dateKey = photo.date ? photo.date.split(" ")[0] : "undated";

    if (dateKey !== currentDateKey || sections.length === 0) {
      sections.push({
        label: photo.date ? formatSectionDate(photo.date) : "Undated",
        photos: [photo],
        startIndex: i,
      });
      currentDateKey = dateKey;
    } else {
      sections[sections.length - 1].photos.push(photo);
    }
  });

  for (const section of sections) {
    const regions = [...new Set(
      section.photos.map(p => p.region).filter(Boolean)
    )];
    if (regions.length > 0) {
      section.sublabel = regions.slice(0, 2).join(" \u00b7 ");
    }
  }

  return sections;
}
