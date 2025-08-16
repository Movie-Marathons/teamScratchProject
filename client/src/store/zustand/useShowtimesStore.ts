// src/store/zustand/useShowtimesStore.ts
import { create } from "zustand";

type Query = { zip?: string; cinemaId?: string | number; date: string; time?: string; showDateId?: string | number };
type Theater = any;

type ShowtimesState = {
  data: Theater[] | null;
  loading: boolean;
  error: string | null;
  fetchShowtimes: (q: Query, signal?: AbortSignal) => Promise<void>;
};

// --- Normalization helpers for backend shape differences ---
const normalizeFilms = (films: any[]) =>
  (films ?? []).map((f: any, idx: number) => {
    const title = f.film_name ?? f.title ?? 'Untitled';
    const imdb = f.imdb_title_id ?? null;
    const id = imdb ?? (f.film_id != null ? String(f.film_id) : `${title}-${idx}`);

    // Prefer grouped times if present; otherwise pull legacy Standard.times
    const groupedTimes = Array.isArray(f?.times) ? f.times : [];
    const legacyTimes = f?.showings?.Standard?.times ?? [];
    const times = groupedTimes.length
      ? groupedTimes.map((t: any) => ({
          display_start_time: t.display_start_time ?? t.display ?? t.start_time ?? null,
          start_time: t.start_time ?? null,
        }))
      : legacyTimes.map((t: any) => ({
          display_start_time: t.display_start_time ?? t.time ?? null,
          start_time: t.start_time ?? null,
        }));

    return {
      ...f,
      film_name: title,
      imdb_title_id: imdb,
      film_id: id, // keep a unified id field as string
      times,
    };
  });

const normalizeTheatersPayload = (json: any) => {
  // Primary: array of theaters
  if (Array.isArray(json?.theaters)) {
    return (json.theaters as any[]).map((t: any) => ({
      ...t,
      films: normalizeFilms(t?.films ?? []),
    }));
  }
  // Fallback: single theater response that directly returns films
  if (Array.isArray(json?.films)) {
    const extId = json?.cinemaExternalId ?? json?.cinema_id ?? json?.cinema?.cinema_id ?? null;
    const cname = json?.cinema_name ?? json?.cinema?.cinema_name ?? 'Selected Theater';
    const dateISO = json?.dateISO ?? json?.date ?? undefined;
    return [
      {
        cinema_id: extId,
        name: cname,
        cinema: { cinema_id: extId, cinema_name: cname },
        show_date_id: json?.show_date_id ?? null,
        dateISO,
        films: normalizeFilms(json.films),
      },
    ];
  }
  // Legacy fallback: flat arrays under other keys
  const alt = json?.results ?? json?.showings ?? json?.sample ?? [];
  if (Array.isArray(alt) && alt.length) {
    return [
      {
        name: 'Selected Theater',
        cinema: { cinema_id: json?.cinema_id ?? json?.cinema?.cinema_id ?? null, cinema_name: json?.cinema_name ?? json?.cinema?.cinema_name ?? 'Selected Theater' },
        dateISO: json?.dateISO ?? json?.date ?? undefined,
        films: normalizeFilms(alt),
      },
    ];
  }
  return [];
};

const addFilmKeys = (theaters: any[]) =>
  (theaters ?? []).map((t: any) => ({
    ...t,
    films: (t.films ?? []).map((f: any, idx: number) => {
      const safe = f ?? {};
      const title = safe.film_name ?? safe.title ?? 'Untitled';
      const uid = String(safe.imdb_title_id ?? safe.film_id ?? `noid-${idx}`);
      return {
        ...safe,
        film_name: title,
        __key: `${uid}-${title.trim()}-${idx}`,
      };
    }),
  }));

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "").toString().toLowerCase() === "true";

export const useShowtimesStore = create<ShowtimesState>((set, get) => ({
  data: null,
  loading: false,
  error: null,

  fetchShowtimes: async ({ zip, cinemaId, date, time, showDateId }, signal) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      if (USE_MOCK) {
        // MOCK: ignore zip/date/time because the JSON doesn’t include them
        const mod = await import("@/data/mock_theaters.json"); // ensure file lives in client/src/data/
        const rows = (mod as any).default ?? mod;
        if (signal?.aborted) { set({ loading: false }); return; }
        set({ data: addFilmKeys(rows), loading: false });
        return;
      }

      // LIVE
      const base = import.meta.env.VITE_API_BASE_URL ?? ""; // "" -> use Vite proxy
      const cid = (cinemaId ?? zip ?? '').toString();
      let url = `${base}/api/cinemaShowTimes?cinema_id=${encodeURIComponent(cid)}&date=${encodeURIComponent(date)}`;
      if (showDateId != null && showDateId !== "") {
        url += `&show_date_id=${encodeURIComponent(String(showDateId))}`;
      }
      if (time != null && time !== "") {
        url += `&time=${encodeURIComponent(time)}`;
      }

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (signal?.aborted) { set({ loading: false }); return; }
      const theaters = normalizeTheatersPayload(json);
      const safeTheaters = (Array.isArray(theaters) && theaters.length > 0)
        ? theaters
        : (Array.isArray((json as any)?.films) ? normalizeTheatersPayload({ ...json, theaters: undefined }) : []);
      set({ data: addFilmKeys(safeTheaters), loading: false });
    } catch (e: any) {
      if (e?.name === 'AbortError') { set({ loading: false }); return; }
      set({ error: e?.message ?? "Failed to load showtimes", loading: false });
    }
  },
}));
