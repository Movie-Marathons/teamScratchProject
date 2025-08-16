import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useShowtimesStore } from "@/store/zustand/useShowtimesStore";
import { useScheduleStore } from "@/store/zustand/useScheduleStore";
import LandmarksPage from "./LandmarksPage";

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

/** Display helper: "13:30" -> "1:30 PM"; leaves AM/PM labels unchanged, ensures single space before AM/PM */
const to12HourLabel = (raw: string) => {
  if (!raw) return raw as any;
  const s = String(raw).trim();
  // If it already includes AM/PM, normalize spacing
  if (/am|pm/i.test(s)) return s.replace(/\s*(AM|PM)$/i, ' $1');
  // Expect HH:MM 24h
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  let h = Number(m[1]);
  const mm = m[2];
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // 0 -> 12
  return `${h}:${mm} ${mer}`;
};

// Parse 12h label to minutes from midnight
const parseTime12ToMinutes = (timeStr: string) => {
  const [time, modifier] = String(timeStr).trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  const mod = modifier?.toUpperCase?.() || "";
  if (mod === "PM" && hours < 12) hours += 12;
  if (mod === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const formatMinutesSpan = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getCityFromTheater = (t: any, fallbackZip: string) => {
  return (
    t?.cinema?.city || t?.cinema?.location?.city || t?.cinema?.address?.city || t?.city || fallbackZip
  );
};

const getZipFromTheater = (t: any): string | undefined => {
  const raw = (
    t?.cinema?.zip ||
    t?.cinema?.postcode ||
    t?.cinema?.postal_code ||
    t?.cinema?.postalCode ||
    t?.cinema?.address?.postal_code ||
    t?.cinema?.address?.postalCode ||
    t?.zip ||
    t?.postcode ||
    t?.postal_code ||
    t?.postalCode
  );
  return raw != null ? String(raw) : undefined;
};

const PlannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Query params
  const movieId = searchParams.get("movieId");
  const theaterName = searchParams.get("theater");
  const cinemaId = searchParams.get("cinemaId") || undefined;
  const postcode = searchParams.get("zip") ?? "";
  // effectiveZip defined after selectedTheater is known
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  // Prefer `showtime`, but fall back to `time` if present; if neither, null
  const chosenShowtime = searchParams.get("showtime") ?? searchParams.get("time");
  // For fetching, use the chosen value if any; else a sane default
  const time = chosenShowtime ?? "18:00";
  const baseDate = `${date}T`;
  // Optional: allow ?autofill=0 to disable auto-adding on first load
  const hasAutofill = searchParams.get("autofill") !== "0";
  const queryCity = searchParams.get("city") ?? "";

  // Stores
  const { data: theaters, loading, error, fetchShowtimes } = useShowtimesStore();
  const watchQueue = useScheduleStore((s) => s.watchQueue ?? []);
  const removeFromQueue = useScheduleStore((s) => s.removeFromQueue);


  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    console.log("Store change", { loading, theaters, error });
  }, [loading, theaters, error]);

  // Clear queue when theater/date context changes
  const routeKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${cinemaId || ''}|${theaterName || ''}|${date}`;
    if (routeKeyRef.current && routeKeyRef.current !== key) {
      const current = useScheduleStore.getState().watchQueue ?? [];
      const ids = current.map((i: any) => String(i.id));
      ids.forEach((id) => useScheduleStore.getState().removeFromQueue(id));
      console.log("Queue reset on route change", { from: routeKeyRef.current, to: key, removed: ids.length });
    }
    routeKeyRef.current = key;
  }, [cinemaId, theaterName, date]);

  // Clear queue when leaving the Planner page
  useEffect(() => {
    return () => {
      const current = useScheduleStore.getState().watchQueue ?? [];
      const ids = current.map((i: any) => String(i.id));
      ids.forEach((id) => useScheduleStore.getState().removeFromQueue(id));
      console.log("Queue reset on unmount", { removed: ids.length });
    };
  }, []);

  // Theater chosen by query param (supports array or object shapes)
  const selectedTheater = useMemo(() => {
    console.log("Theaters data", theaters);
    const tdata: any = theaters as any;
    if (!tdata) {
      console.log("Selected theater", null);
      return null;
    }

    // Case 1: array of theaters
    if (Array.isArray(tdata)) {
      if (tdata.length === 0) {
        console.log("Selected theater", null);
        return null;
      }

      // Prefer exact match by cinemaId if provided
      if (cinemaId) {
        const cid = Number(cinemaId);
        const byId = tdata.find((t: any) => {
          const ids = [
            t?.cinema?.external_id,
            t?.cinema?.cinema_id,
            t?.cinema_id,
            t?.external_id,
            t?.id,
          ]
            .map((v) => (v == null ? null : Number(v)))
            .filter((v) => !Number.isNaN(v as any));
          return ids.some((v) => v === cid);
        });
        if (byId) {
          console.log("Selected theater by cinemaId", { cinemaId, match: byId });
          return byId;
        }
      }

      // Fall back to name match
      if (theaterName) {
        const lower = theaterName.trim().toLowerCase();
        const byName = tdata.find((t: any) => {
          const n1 = t?.cinema?.cinema_name?.trim()?.toLowerCase?.();
          const n2 = t?.name?.trim()?.toLowerCase?.();
          const n3 = t?.cinema_name?.trim()?.toLowerCase?.();
          return n1 === lower || n2 === lower || n3 === lower;
        });
        if (byName) {
          console.log("Selected theater by name", { theaterName, match: byName });
          return byName;
        }
      }

      console.log("Selected theater fallback index 0", tdata[0]);
      return tdata[0];
    }

    // Case 2: single theater object already
    if (typeof tdata === 'object') {
      console.log("Selected theater", tdata);
      return tdata;
    }

    console.log("Selected theater", null);
    return null;
  }, [theaters, theaterName, cinemaId]);

  // Compute effectiveZip after selectedTheater is known
  const effectiveZip = useMemo(() => {
    const fromTheater = getZipFromTheater(selectedTheater);
    const val = postcode || fromTheater || "11201";
    console.log("Resolved ZIP", { postcode, fromTheater, effectiveZip: val });
    return val;
  }, [postcode, selectedTheater]);

  // Fetch showtimes (after effectiveZip is available)
  useEffect(() => {
    const payload: any = { date };
    if (cinemaId) payload.cinemaId = cinemaId;
    else payload.zip = effectiveZip;
    if (time) payload.time = time;
    console.log("Fetching showtimes with payload", payload);
    fetchShowtimes(payload);
  }, [cinemaId, effectiveZip, date, time, fetchShowtimes]);

  useEffect(() => {
    if (selectedTheater) {
      const filmsCount = Array.isArray((selectedTheater as any).films)
        ? (selectedTheater as any).films.length
        : 'n/a';
      console.log("SelectedTheater ready", {
        hasFilmsArray: Array.isArray((selectedTheater as any).films),
        filmsCount,
      });
    }
  }, [selectedTheater]);

  // Normalize films to support both legacy and grouped shapes; guard against bad shapes
  const normalizedFilms = useMemo(() => {
    const filmsSrc: any[] = (selectedTheater as any)?.films;
    const films: any[] = Array.isArray(filmsSrc) ? filmsSrc : [];

    const out = films.map((f: any) => {
      const isGrouped = Array.isArray(f?.times);
      const title = isGrouped
        ? (f?.title ?? 'Untitled')
        : (f?.film_name ?? f?.title ?? 'Untitled');

      const rawId = (isGrouped ? f?.imdb_title_id : f?.imdb_title_id)
        ?? (f?.film_id != null ? String(f.film_id) : title);

      const times: string[] = isGrouped
        ? (Array.isArray(f?.times) ? f.times : []).map((t: any) => (t?.display_start_time ?? t?.start_time)).filter(Boolean)
        : (Array.isArray(f?.showings?.Standard?.times) ? f.showings.Standard.times : []).map((t: any) => (t?.display_start_time ?? t?.time)).filter(Boolean);

      const duration_mins = f?.duration_min ?? f?.duration_mins ?? null;
      return { id: String(rawId), title, times, duration_mins };
    });
    console.log("Normalized films", out);
    return out;
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

    console.log("Auto-adding to queue", { film, chosenShowtime, hhmm, key });

    // call action at use-time to avoid stale refs
    useScheduleStore.getState().addToQueue(film.title, chosenShowtime, {
      baseDate,
      convertTo24Hour: convertTo24HourLabel,
      getDurationMins,
      toast,
    });
  }, [hasAutofill, movieId, chosenShowtime, normalizedFilms, date, baseDate, watchQueue.length]);

  const handleAddToQueue = (title: string, startLabel: string) => {
    console.log("Adding manually to queue", { title, startLabel });
    useScheduleStore.getState().addToQueue(title, startLabel, {
      baseDate,
      convertTo24Hour: convertTo24HourLabel,
      getDurationMins,
      toast,
    });
  };

  const handleRemove = (id: string | number) => {
    console.log("Removing from queue", id);
    removeFromQueue(String(id));
  };

  // Helper to clear the entire queue
  const handleClearQueue = () => {
    const current = useScheduleStore.getState().watchQueue ?? [];
    current.forEach((i: any) => useScheduleStore.getState().removeFromQueue(String(i.id)));
    console.log("Queue cleared", { removed: current.length });
  };

  // Sort queue by earliest start time (handles 12h labels)
  const parseTime12 = (timeStr: string) => {
    const [time, modifier] = String(timeStr).trim().split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier?.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (modifier?.toUpperCase() === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };
  const sortedQueue = [...watchQueue].sort((a, b) => parseTime12(a.startTime) - parseTime12(b.startTime));

  const [showLandmarks, setShowLandmarks] = useState(false);

  const [showShare, setShowShare] = useState(false);

  const marathonEnd = useMemo(() => {
    if (sortedQueue.length === 0) return '';
    // Compute latest end, handling past-midnight
    const ends = sortedQueue.map((it) => {
      const s = parseTime12ToMinutes(it.startTime);
      let e = parseTime12ToMinutes(it.endTime);
      if (e < s) e += 24 * 60;
      return e;
    });
    const maxEnd = Math.max(...ends);
    const h = Math.floor(maxEnd / 60) % 24;
    const m = maxEnd % 60;
    const raw = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return to12HourLabel(raw);
  }, [sortedQueue]);

  const buildShareText = () => {
    const lines: string[] = [];
    lines.push(`🎬 Movie Marathon at ${theaterName ?? ''}`.trim());
    if (city) lines.push(`📍 ${city}`);
    if (marathonStart) lines.push(`🕗 Start: ${marathonStart}`);
    if (marathonEnd) lines.push(`🏁 End: ${marathonEnd}`);
    if (totalSpan) lines.push(`⏱ Total: ${totalSpan}`);
    lines.push('');
    lines.push('🍿 Movies:');
    if (sortedQueue.length === 0) {
      lines.push('  (none yet)');
    } else {
      sortedQueue.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.title} — ${it.startTime}`);
      });
    }
    return lines.join('\n');
  };

  const openPrintPdf = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Movie Marathon</title>
      <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;line-height:1.4} h1{margin:0 0 12px} ul{margin:8px 0 0 18px}</style>
      </head><body>
        <h1>Movie Marathon</h1>
        <p><strong>Theater:</strong> ${theaterName ?? ''}</p>
        <p><strong>City:</strong> ${city ?? ''}</p>
        <p><strong>Start:</strong> ${marathonStart || '—'}</p>
        <p><strong>End:</strong> ${marathonEnd || '—'}</p>
        <p><strong>Total:</strong> ${totalSpan || '—'}</p>
        <h2>Movies</h2>
        <ul>
          ${sortedQueue.map(it => `<li>${it.title} — ${it.startTime} → ${it.endTime}</li>`).join('')}
        </ul>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Give the new window a tick to render before printing
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 300);
  };

  const emailSummary = () => {
    const subject = encodeURIComponent('Movie Marathon Plan');
    const body = encodeURIComponent(buildShareText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const textSummary = () => {
    const body = encodeURIComponent(buildShareText());
    // Best-effort: sms: works on mobile; noop on desktop
    window.location.href = `sms:?&body=${body}`;
  };

  const city = useMemo(() => queryCity || getCityFromTheater(selectedTheater, effectiveZip), [queryCity, selectedTheater, effectiveZip]);

  // Marathon start = earliest of queued items; if empty, earliest from available showtimes
  const marathonStart = useMemo(() => {
    if (sortedQueue.length > 0) return sortedQueue[0].startTime;
    // fallback: earliest among all films' times
    let earliest: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    normalizedFilms.forEach((f: any) => {
      f.times.forEach((t: string) => {
        const label = to12HourLabel(t);
        const mins = parseTime12ToMinutes(label);
        if (mins < best) { best = mins; earliest = label; }
      });
    });
    return earliest || '';
  }, [sortedQueue, normalizedFilms]);

  // Total time = span from earliest queued start to latest queued end (handle past-midnight)
  const totalSpan = useMemo(() => {
    if (sortedQueue.length === 0) return '';
    const start0 = parseTime12ToMinutes(sortedQueue[0].startTime);
    let maxEnd = start0;
    sortedQueue.forEach((it) => {
      const s = parseTime12ToMinutes(it.startTime);
      let e = parseTime12ToMinutes(it.endTime);
      if (e < s) e += 24 * 60; // crosses midnight
      if (e > maxEnd) maxEnd = e;
    });
    const span = maxEnd - start0;
    return formatMinutesSpan(span);
  }, [sortedQueue]);

  // Minimal UI to verify initial add + remove work
  if (loading) return <div className="p-4">Loading showtimes…</div>;
  if (!loading && !theaters) {
    return (
      <div className="p-4">
        No data yet.
        <div className="text-xs text-gray-500 mt-2">
          (debug) theaters: {String(theaters)}, error: {error ? String(error) : 'none'}
        </div>
      </div>
    );
  }

  // Top-level params log reflecting new values
  console.log("PlannerPage params", { movieId, theaterName, cinemaId, postcode, effectiveZip, date, chosenShowtime, time, hasAutofill });

  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* LEFT: Available Movies (primary) */}
      <section className="col-span-12 lg:col-span-8">
        <div className="bg-white shadow rounded p-4 h-[calc(100vh-8rem)] flex flex-col">
          <h3 className="text-md font-semibold mb-2">🍿 Available Movies</h3>
          <div className="flex-1 overflow-y-auto pr-2">
            {normalizedFilms?.length ? (
              <ul className="space-y-2">
                {normalizedFilms.map((film: any) => (
                  <li key={film.id} className="border rounded p-3">
                    <div className="font-semibold">{film.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Showtimes{' '}
                      {film.times.length > 0 ? (
                        film.times.map((label: string, idx: number) => {
                          const display = to12HourLabel(label);
                          return (
                            <button
                              key={`${film.id}-${label}-${idx}`}
                              className="inline-block px-2 py-1 m-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              onClick={() => handleAddToQueue(film.title, display)}
                            >
                              {display}
                            </button>
                          );
                        })
                      ) : (
                        <span className="italic text-gray-400">No times</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-sm text-gray-400 italic mt-8">
                No movie data found for this theater.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT: Sticky sidebar with Selected + Queue */}
      <aside className="col-span-12 lg:col-span-4">
        <div className="sticky top-4 flex flex-col gap-4">
          <div className="bg-white shadow rounded p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">🎬 Movie Marathon</h2>
              <button
                className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
                onClick={() => setShowShare(true)}
              >
                Share
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Theater:</span> {theaterName || '—'}</p>
              <p><span className="font-medium">City:</span> {city || '—'}</p>
              <p><span className="font-medium">Start time:</span> {marathonStart || '—'}</p>
              <p><span className="font-medium">Total time:</span> {totalSpan || '—'}</p>
            </div>
            <button
              className="mt-4 px-3 py-2 text-sm border rounded hover:bg-gray-50"
              onClick={() => setShowLandmarks(true)}
            >
              See landmarks
            </button>
          </div>

          <div className="bg-white shadow rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-medium">🎞️ Your Queue</h3>
              <button
                className="text-sm px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={handleClearQueue}
                disabled={sortedQueue.length === 0}
              >
                Clear queue
              </button>
            </div>
            <ul className="divide-y">
              {sortedQueue.map((item) => (
                <li key={item.id} className="py-2 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-gray-500">
                      {item.startTime} → {item.endTime} • {item.duration}
                    </span>
                  </div>
                  <button
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                    onClick={() => handleRemove(String(item.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {sortedQueue.length === 0 && (
                <li className="py-2 text-sm text-gray-500 italic">Nothing queued yet.</li>
              )}
            </ul>
          </div>
        </div>
      </aside>
      {showShare && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Share Your Day</h3>
              <button className="text-sm px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setShowShare(false)}>Close</button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div><span className="font-medium">Start Time:</span> {marathonStart || '—'}</div>
              <div>
                <span className="font-medium">All Movies:</span>
                <ul className="list-disc ml-5 mt-1">
                  {sortedQueue.length === 0 ? (
                    <li>(none yet)</li>
                  ) : (
                    sortedQueue.map((it) => (
                      <li key={it.id}>{it.title} — {it.startTime} → {it.endTime}</li>
                    ))
                  )}
                </ul>
              </div>
              <div><span className="font-medium">End Time:</span> {marathonEnd || '—'}</div>
              <div><span className="font-medium">Total Time:</span> {totalSpan || '—'}</div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
              <button className="px-3 py-2 text-sm border rounded hover:bg-gray-50" onClick={openPrintPdf}>Download PDF</button>
              <button className="px-3 py-2 text-sm border rounded hover:bg-gray-50" onClick={emailSummary}>Email PDF</button>
              <button className="px-3 py-2 text-sm border rounded hover:bg-gray-50" onClick={textSummary}>Text PDF</button>
            </div>
          </div>
        </div>
      )}
      {showLandmarks && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Nearby Landmarks</h3>
              <button className="text-sm px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setShowLandmarks(false)}>Close</button>
            </div>
            <div className="h-[calc(85vh-3rem)] overflow-auto p-2">
              {/* Pass zip (and city) so Landmarks can auto-load context */}
              <LandmarksPage zip={effectiveZip} city={city} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerPage;
