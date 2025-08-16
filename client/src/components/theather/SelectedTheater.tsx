import React from "react";
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

const SelectedTheater: React.FC<SelectedTheaterProps> = ({ theaterName, films, cinemaId, dateISO }) => {
  return (
    <div className="mt-4 space-y-6">
      <h3 className="text-lg font-semibold text-center">{theaterName} - Movies</h3>

      <div className="flex flex-col space-y-4">
        {films.map((film) => {
          // Normalize across legacy and grouped shapes
          const legacy = film as Film;
          const grouped = film as GroupedFilm;

          const movieId = grouped.imdb_title_id ?? legacy.imdb_title_id ?? String(legacy.film_id ?? '');
          const filmName = legacy.film_name || grouped.title || 'Untitled';

          const posterSrc =
            resolvePoster({
              name: filmName,
              images: (legacy as any).images ?? grouped.images,
              poster_url: (legacy as any).poster_url ?? grouped.poster_url,
            } as any) || undefined;

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
              className="flex flex-col sm:flex-row bg-white border rounded-lg shadow overflow-hidden"
            >
              {/* Poster */}
              <img
                src={posterSrc}
                alt={filmName}
                className="w-full sm:w-36 h-56 object-cover"
                onError={(e) => {
                  // Hide broken images cleanly
                  (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                }}
              />

              {/* Details */}
              <div className="p-4 flex-1 space-y-2">
                <h4 className="text-md font-bold">{filmName}</h4>
                {durationText && (
                  <p className="text-sm text-gray-500">{durationText}</p>
                )}
                <div>
                  <p className="font-medium text-sm">Showtimes:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {times.length > 0 ? (
                      times.map((time, idx) => (
                        <Link
                          to={`/planner?movieId=${encodeURIComponent(movieId)}&showtime=${encodeURIComponent(
                            (time.start_time || time.display_start_time || '') as string
                          )}&theater=${encodeURIComponent(theaterName)}${cinemaId ? `&cinemaId=${encodeURIComponent(String(cinemaId))}` : ''}${
                            dateISO ? `&date=${encodeURIComponent(dateISO)}` : ''
                          }`}
                          key={`${movieId}-${time.start_time || time.display_start_time || idx}`}
                          className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 transition"
                        >
                          {time.display_start_time || time.start_time}
                        </Link>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">No times</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectedTheater;