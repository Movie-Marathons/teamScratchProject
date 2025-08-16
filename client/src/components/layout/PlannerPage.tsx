import React, { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useShowtimesStore } from "@/store/zustand/useShowtimesStore";
import { useScheduleStore } from "@/store/zustand/useScheduleStore";

/** Tolerant time normalizer: "7:30 PM" | "7:30PM" | "07:30" -> "HH:MM" */
const convertTo24HourLabel = (raw: string) => {
  const s = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  // 12h like 7:30PM
  const m12 = s.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (m12) {
    let h = Number(m12[1]), m = Number(m12[2]);
    const mer = m12[3];
    if (mer === "PM" && h < 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  // 24h like 07:30
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]), m = Number(m24[2]);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
};

const PlannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Query params
  const movieId = searchParams.get("movieId");
  const theaterName = searchParams.get("theater");
  const cinemaId = searchParams.get("cinemaId") || undefined;
  const zip = searchParams.get("zip") ?? "11201";
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  // Prefer `showtime`, but fall back to `time` if present; if neither, null
  const chosenShowtime = searchParams.get("showtime") ?? searchParams.get("time");
  // For fetching, use the chosen value if any; else a sane default
  const time = chosenShowtime ?? "18:00";
  const baseDate = `${date}T`;
  // Optional: allow ?autofill=0 to disable auto-adding on first load
  const hasAutofill = searchParams.get("autofill") !== "0";
  const showDateId = searchParams.get("showDateId") || undefined;

  // Stores
  const { data: theaters, loading, error, fetchShowtimes } = useShowtimesStore();
  const watchQueue = useScheduleStore((s) => s.watchQueue ?? []);
  const removeFromQueue = useScheduleStore((s) => s.removeFromQueue);

  // Fetch showtimes (mock for now)
  useEffect(() => {
    const ctrl = new AbortController();
    const payload: any = { date };
    if (cinemaId) payload.cinemaId = cinemaId; else payload.zip = zip;
    if (time) payload.time = time;
    if (showDateId) payload.showDateId = showDateId;
    fetchShowtimes(payload, ctrl.signal);
    return () => ctrl.abort();
  }, [cinemaId, zip, date, time, showDateId, fetchShowtimes]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Theater chosen by query param
  const selectedTheater = useMemo(() => {
    if (!theaters || (Array.isArray(theaters) && theaters.length === 0)) return null;
    // If a theater name was provided, try a few common fields
    if (theaterName) {
      const lower = theaterName.trim().toLowerCase();
      const match = (theaters as any[]).find((t: any) => {
        const n1 = t?.cinema?.cinema_name?.trim()?.toLowerCase?.();
        const n2 = t?.name?.trim()?.toLowerCase?.();
        const n3 = t?.cinema_name?.trim()?.toLowerCase?.();
        return n1 === lower || n2 === lower || n3 === lower;
      });
      if (match) return match;
    }
    // Fallback: first theater in the list
    return (theaters as any[])?.[0] ?? null;
  }, [theaters, theaterName]);

  // Normalize films to support both legacy and grouped shapes
  const normalizedFilms = useMemo(() => {
    const films: any[] = (selectedTheater as any)?.films ?? [];
    return films.map((f: any) => {
      const isGrouped = Array.isArray(f?.times);
      const title = isGrouped ? (f?.title ?? 'Untitled') : (f?.film_name ?? f?.title ?? 'Untitled');
      const id = (isGrouped ? f?.imdb_title_id : f?.imdb_title_id) ?? (f?.film_id != null ? String(f.film_id) : title);
      const times: string[] = isGrouped
        ? (f?.times ?? []).map((t: any) => (t?.display_start_time ?? t?.start_time)).filter(Boolean)
        : (f?.showings?.Standard?.times ?? []).map((t: any) => (t?.display_start_time ?? t?.time)).filter(Boolean);
      const duration_mins = f?.duration_min ?? f?.duration_mins ?? null;
      return { id: String(id), title, times, duration_mins };
    });
  }, [selectedTheater]);

  const getDurationMins = (title: string) => {
    const film = normalizedFilms.find((f: any) => f.title === title);
    return film?.duration_mins ?? 90;
  };

  // Auto-add once per (movieId|showtime|date) if enabled and queue empty
  const lastAutoAddKey = useRef<string | null>(null);
  useEffect(() => {
    if (!hasAutofill) return;
    if (!movieId || !chosenShowtime || !normalizedFilms) return;
    if (watchQueue.length > 0) return;

    const film = normalizedFilms.find((f: any) => f.id === String(movieId));
    if (!film) return;

    const hhmm = convertTo24HourLabel(chosenShowtime);
    if (!hhmm) return;

    const key = `${movieId}|${hhmm}|${date}`;
    if (lastAutoAddKey.current === key) return;
    lastAutoAddKey.current = key;

    // call action at use-time to avoid stale refs
    useScheduleStore.getState().addToQueue(film.title, chosenShowtime, {
      baseDate,
      convertTo24Hour: convertTo24HourLabel,
      getDurationMins,
      toast,
    });
  }, [hasAutofill, movieId, chosenShowtime, normalizedFilms, date, baseDate, watchQueue.length]);

  const handleAddToQueue = (title: string, startLabel: string) => {
    useScheduleStore.getState().addToQueue(title, startLabel, {
      baseDate,
      convertTo24Hour: convertTo24HourLabel,
      getDurationMins,
      toast,
    });
  };

  const handleRemove = (id: string | number) => removeFromQueue(String(id));

  // Minimal UI to verify initial add + remove work
  if (loading) return <div className="p-4">Loading showtimes…</div>;
  if (!loading && (!theaters || (Array.isArray(theaters) && theaters.length === 0))) return <div className="p-4">No data yet.</div>;

  return (
    <div className="flex h-full p-6 gap-6">
      {/* Left: Selected */}
      <div className="w-full md:w-1/3 bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-4">🎬 Selected Movie</h2>
        <div className="space-y-2">
          <p><span className="font-medium">Theater:</span> {theaterName || "—"}</p>
          <p><span className="font-medium">Movie ID:</span> {movieId || "—"}</p>
          <p><span className="font-medium">Showtime:</span> {chosenShowtime || "—"}</p>
          <p><span className="font-medium">Date:</span> {date}</p>
        </div>
      </div>

      {/* Right: Movies + Queue */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Available Movies */}
        {normalizedFilms?.length ? (
          <div className="bg-white shadow rounded p-4 mx-auto w-full max-w-3xl">
            <h3 className="text-md font-medium mb-2 text-center">🍿 Available Movies</h3>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <ul className="space-y-2">
                {normalizedFilms.map((film: any) => (
                  <li key={film.id} className="border rounded p-2">
                    <div className="font-semibold">{film.title}</div>
                    <div className="text-xs text-gray-500">
                      Showtimes:{' '}
                      {film.times.length > 0 ? (
                        film.times.map((label: string, idx: number) => (
                          <button
                            key={`${film.id}-${label}-${idx}`}
                            className="inline-block px-2 py-1 m-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            onClick={() => handleAddToQueue(film.title, label)}
                          >
                            {label}
                          </button>
                        ))
                      ) : (
                        <span className="italic text-gray-400">No times</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded p-4 mx-auto w-full max-w-3xl text-center">
            <h3 className="text-md font-medium mb-2">🍿 Available Movies</h3>
            <p className="text-sm text-gray-400 italic">No movie data found for this theater.</p>
          </div>
        )}

        {/* Queue */}
        <div className="bg-white shadow rounded p-4">
          <h3 className="text-md font-medium mb-2">🎞️ Your Queue</h3>
          <ul className="divide-y">
            {watchQueue.map((item) => (
              <li key={item.id} className="py-2 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-gray-500">
                    {item.startTime} → {item.endTime} • {item.duration}
                  </span>
                </div>
                <button
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                  onClick={() => handleRemove(item.id)}
                >
                  Remove
                </button>
              </li>
            ))}
            {watchQueue.length === 0 && (
              <li className="py-2 text-sm text-gray-500 italic">Nothing queued yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlannerPage;
