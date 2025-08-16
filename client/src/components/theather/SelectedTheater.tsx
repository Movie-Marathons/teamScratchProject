import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { resolvePoster } from "../../utils/media";

// Times can come as a nicely formatted display string or raw HH:MM from cache
type ShowingTime = { display_start_time?: string | null; start_time?: string | null };

// Upstream data can vary a bit. Support both old/new shapes.
type Film = {
  film_id?: number; // sometimes numeric id
  imdb_title_id?: string; // sometimes IMDB id like "tt1234567"
  film_name: string;
  synopsis_long?: string;
  duration_hrs_mins?: string; // e.g., "1h 45m"
  duration_min?: number; // fallback if only minutes are provided
  poster_url?: string;
  images?: any; // upstream may send object or array; media util will normalize
  showings?: {
    Standard?: {
      times?: ShowingTime[];
    };
  };
};

// New grouped backend shape
type GroupedFilm = {
  imdb_title_id?: string;
  title: string;
  times: ShowingTime[];
  images?: any;
  poster_url?: string;
  duration_min?: number;
  duration_hrs_mins?: string;
};

type SelectedTheaterProps = {
  theaterName: string;
  films: (Film | GroupedFilm)[];
  cinemaId?: string | number;
  dateISO?: string; // YYYY-MM-DD
  city?: string;
  zip?: string;
};

const toDurationText = (film: Film): string | undefined => {
  if (film.duration_hrs_mins && film.duration_hrs_mins.trim().length > 0) {
    return film.duration_hrs_mins;
  }
  if (typeof film.duration_min === "number" && !Number.isNaN(film.duration_min)) {
    const mins = Math.max(0, Math.floor(film.duration_min));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return undefined;
};

// Display helper: "13:30" -> "1:30 PM"; leaves AM/PM labels unchanged
const to12HourLabel = (raw?: string | null) => {
  if (!raw) return '';
  const s = String(raw).trim();
  // If it already includes AM/PM, return as-is (ensure single space before AM/PM)
  if (/am|pm/i.test(s)) return s.replace(/\s*(AM|PM)$/i, ' $1');
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s; // unknown format; show raw
  let h = Number(m[1]);
  const mm = m[2];
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // 0 -> 12, 13 -> 1
  return `${h}:${mm} ${mer}`;
};

const SelectedTheater: React.FC<SelectedTheaterProps> = ({ theaterName, films, cinemaId, dateISO, city, zip }) => {
  // Collect IMDB ids so we can fetch server-side poster fallbacks
  const imdbIds = useMemo(
    () =>
      films
        .map((f: any) => f?.imdb_title_id)
        .filter((id: any): id is string => typeof id === "string" && id.startsWith("tt")),
    [films]
  );

  // Map of imdb_title_id -> poster url from backend
  const [posterByImdb, setPosterByImdb] = useState<Record<string, string>>({});

  // Try to fetch posters for these imdb ids (backend batches allowed)
  useEffect(() => {
    if (!imdbIds.length) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const qs = encodeURIComponent(imdbIds.join(","));
        // Endpoint expected to return either an array of { imdb_title_id, poster_url }
        // or an object map { [imdb_id]: url }
        const res = await fetch(`/api/moviePosters?ids=${qs}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        // Fast path: backend returns { map: { tt123: url, ... }, posters: [...] }
        if (data && typeof (data as any).map === 'object' && (data as any).map !== null) {
          setPosterByImdb((data as any).map as Record<string, string>);
          return;
        }
        const map: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((p: any) => {
            if (p && p.imdb_title_id && p.poster_url) map[p.imdb_title_id] = p.poster_url as string;
          });
        } else if (data && Array.isArray((data as any).posters)) {
          (data as any).posters.forEach((p: any) => {
            if (p && p.imdb_title_id && p.poster_url) map[p.imdb_title_id] = p.poster_url as string;
          });
        } else if (data && typeof data === "object") {
          Object.keys(data).forEach((k) => {
            const v = (data as any)[k];
            if (typeof v === "string") map[k] = v;
          });
        }
        if (Object.keys(map).length) setPosterByImdb(map);
      } catch (_) {
        // ignore network errors; UI will rely on local resolvePoster
      }
    };

    load();
    return () => controller.abort();
  }, [imdbIds]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="w-full max-w-3xl h-[80vh] overflow-y-auto rounded-lg shadow-lg p-6 space-y-6 bg-gradient-to-b from-red-950 to-red-900 text-red-50 border border-red-800">
        <h3 className="text-lg font-semibold text-center text-red-200">{theaterName} - Movies</h3>
        <div className="flex flex-col space-y-4">
          {films.map((film) => {
          // Normalize across legacy and grouped shapes
          const legacy = film as Film;
          const grouped = film as GroupedFilm;

          const imdbKey = (grouped.imdb_title_id || legacy.imdb_title_id || '').trim();
          const movieId = imdbKey || String(legacy.film_id ?? '');
          const filmName = legacy.film_name || grouped.title || 'Untitled';

          // Only use a real backend image (data URI). No fallbacks on the client.
          const backendPoster = imdbKey ? posterByImdb[imdbKey] : undefined;
          const posterSrc =
            typeof backendPoster === 'string' && backendPoster.startsWith('data:image')
              ? backendPoster
              : undefined;

          // Times: prefer grouped.times; else legacy.showings.Standard.times (display only)
          let times: ShowingTime[] = Array.isArray((grouped as any).times)
            ? (grouped as any).times
            : legacy.showings?.Standard?.times?.map((t) => ({ display_start_time: t.display_start_time ?? (t as any) })) ?? [];

          const durationText = toDurationText({
            duration_hrs_mins: legacy.duration_hrs_mins ?? grouped.duration_hrs_mins,
            duration_min: legacy.duration_min ?? grouped.duration_min,
          } as Film);

          return (
            <div
              key={movieId || filmName}
              className="flex flex-col sm:flex-row bg-red-900/60 border border-red-800 rounded-lg shadow overflow-hidden text-red-50"
            >
              {/* Poster */}
              {posterSrc ? (
                <img
                  key={posterSrc}
                  src={posterSrc}
                  alt={filmName}
                  className="w-full sm:w-36 h-56 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}

              {/* Details */}
              <div className="p-4 flex-1 space-y-2">
                <h4 className="text-md font-bold text-red-100">{filmName}</h4>
                {durationText && (
                  <p className="text-sm text-red-300">{durationText}</p>
                )}
                <div>
                  <p className="font-medium text-sm text-red-200">Showtimes:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {times.length > 0 ? (
                      times.map((time, idx) => {
                        const raw = (time.start_time || time.display_start_time || '') as string;
                        const display = to12HourLabel(raw);
                        return (
                          <Link
                            to={`/planner?movieId=${encodeURIComponent(movieId)}&showtime=${encodeURIComponent(display)}&theater=${encodeURIComponent(theaterName)}${cinemaId ? `&cinemaId=${encodeURIComponent(String(cinemaId))}` : ''}${dateISO ? `&date=${encodeURIComponent(dateISO)}` : ''}${city ? `&city=${encodeURIComponent(city)}` : ''}${zip ? `&zip=${encodeURIComponent(String(zip))}` : ''}`}
                            key={`${movieId}-${raw || idx}`}
                            className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs border border-red-500 transition"
                          >
                            {display}
                          </Link>
                        );
                      })
                    ) : (
                      <span className="text-xs text-red-300">No times</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default SelectedTheater;