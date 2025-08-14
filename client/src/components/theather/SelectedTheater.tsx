import React from "react";
import { Link } from "react-router-dom";
import { resolvePoster } from "../../utils/media";

// Upstream data can vary a bit. Support both old/new shapes.
type ShowingTime = { display_start_time: string };

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

type SelectedTheaterProps = {
  theaterName: string;
  films: Film[];
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

const SelectedTheater: React.FC<SelectedTheaterProps> = ({ theaterName, films }) => {
  return (
    <div className="mt-4 space-y-6">
      <h3 className="text-lg font-semibold text-center">{theaterName} - Movies</h3>

      <div className="flex flex-col space-y-4">
        {films.map((film) => {
          // Prefer IMDB id when present, fall back to numeric id
          const movieId = film.imdb_title_id ?? String(film.film_id ?? "");

          // Safely resolve a poster URL regardless of images shape
          const posterSrc =
            resolvePoster({
              name: film.film_name,
              images: film.images,
              poster_url: film.poster_url,
            } as any) || undefined;

          const times = film.showings?.Standard?.times ?? [];
          const durationText = toDurationText(film);

          return (
            <div
              key={movieId || film.film_name}
              className="flex flex-col sm:flex-row bg-white border rounded-lg shadow overflow-hidden"
            >
              {/* Poster */}
              <img
                src={posterSrc}
                alt={film.film_name}
                className="w-full sm:w-36 h-56 object-cover"
                onError={(e) => {
                  // Hide broken images cleanly
                  (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                }}
              />

              {/* Details */}
              <div className="p-4 flex-1 space-y-2">
                <h4 className="text-md font-bold">{film.film_name}</h4>
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
                            time.display_start_time
                          )}&theater=${encodeURIComponent(theaterName)}`}
                          key={idx}
                          className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 transition"
                        >
                          {time.display_start_time}
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