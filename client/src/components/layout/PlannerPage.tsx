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
  const showtime = searchParams.get("showtime");
  const theaterName = searchParams.get("theater");
  const zip = searchParams.get("zip") ?? "11201";
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const time = searchParams.get("time") ?? "18:00";
  const baseDate = `${date}T`;
  // Optional: allow ?autofill=0 to disable auto-adding on first load
  const hasAutofill = searchParams.get("autofill") !== "0";

  // Stores
  const { data: theaters, loading, error, fetchShowtimes } = useShowtimesStore();
  const watchQueue = useScheduleStore((s) => s.watchQueue);
  const removeFromQueue = useScheduleStore((s) => s.removeFromQueue);

  // Fetch showtimes (mock for now)
  useEffect(() => {
    const ctrl = new AbortController();
    fetchShowtimes({ zip, date, time }, ctrl.signal);
    return () => ctrl.abort();
  }, [zip, date, time, fetchShowtimes]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Theater chosen by query param
  const selectedTheater = useMemo(() => {
    if (!theaters || !theaterName) return null;
    return (
      theaters.find(
        (t: any) =>
          t?.cinema?.cinema_name?.trim().toLowerCase() === theaterName.trim().toLowerCase()
      ) ?? null
    );
  }, [theaters, theaterName]);

  const getDurationMins = (title: string) => {
    const film = selectedTheater?.films?.find((f: any) => f.film_name === title);
    return film?.duration_mins ?? 90;
  };

  // Auto-add once per (movieId|showtime|date) if enabled and queue empty
  const lastAutoAddKey = useRef<string | null>(null);
  useEffect(() => {
    if (!hasAutofill) return;
    if (!movieId || !showtime || !selectedTheater) return;
    if (watchQueue.length > 0) return;

    const film = selectedTheater.films?.find((f: any) => f.film_id?.toString() === movieId);
    if (!film) return;

    const hhmm = convertTo24HourLabel(showtime);
    if (!hhmm) return;

    const key = `${movieId}|${hhmm}|${date}`;
    if (lastAutoAddKey.current === key) return;
    lastAutoAddKey.current = key;

    // call action at use-time to avoid stale refs
    useScheduleStore.getState().addToQueue(film.film_name, showtime, {
      baseDate,
      convertTo24Hour: convertTo24HourLabel,
      getDurationMins,
      toast,
    });
  }, [hasAutofill, movieId, showtime, selectedTheater, date, baseDate, watchQueue.length]);

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
  if (!loading && !theaters) return <div className="p-4">No data yet.</div>;

  return (
    <div className="flex h-full p-6 gap-6">
      {/* Left: Selected */}
      <div className="w-full md:w-1/3 bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-4">🎬 Selected Movie</h2>
        <div className="space-y-2">
          <p><span className="font-medium">Theater:</span> {theaterName || "—"}</p>
          <p><span className="font-medium">Movie ID:</span> {movieId || "—"}</p>
          <p><span className="font-medium">Showtime:</span> {showtime || "—"}</p>
          <p><span className="font-medium">Date:</span> {date}</p>
        </div>
      </div>

      {/* Right: Movies + Queue */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Available Movies */}
        {selectedTheater?.films?.length ? (
  <div className="bg-white shadow rounded p-4">
    <h3 className="text-md font-medium mb-2">🍿 Available Movies</h3>
    <ul className="space-y-2">
      {(selectedTheater?.films ?? []).map((film: any) => (
        <li key={film.__key} className="border rounded p-2">
          <div className="font-semibold">{film.film_name}</div>
          <div className="text-xs text-gray-500">
            Showtimes:{" "}
            {film.showings?.Standard?.times?.map((t: any, idx: number) => (
              <button
                key={`${film.__key}-${t.display_start_time}-${idx}`}
                className="inline-block px-2 py-1 m-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={() => handleAddToQueue(film.film_name, t.display_start_time)}
              >
                {t.display_start_time}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  </div>
        ) : (
          <div className="bg-white shadow rounded p-4">
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
