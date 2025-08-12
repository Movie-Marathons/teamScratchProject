// src/store/zustand/useShowtimesStore.ts
import { create } from "zustand";

type Query = { zip: string; date: string; time: string };
type Theater = any;

type ShowtimesState = {
  data: Theater[] | null;
  loading: boolean;
  error: string | null;
  fetchShowtimes: (q: Query, signal?: AbortSignal) => Promise<void>;
};

const addFilmKeys = (theaters: any[]) =>
  (theaters ?? []).map((t: any) => ({
    ...t,
    films: (t.films ?? []).map((f: any, idx: number) => ({
      ...f,
      __key: `${String(f.film_id ?? "noid")}-${(f.film_name ?? "").trim()}-${idx}`,
    })),
  }));

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "").toString().toLowerCase() === "true";

export const useShowtimesStore = create<ShowtimesState>((set, get) => ({
  data: null,
  loading: false,
  error: null,

  fetchShowtimes: async ({ zip, date, time }, signal) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      if (USE_MOCK) {
        // MOCK: ignore zip/date/time because the JSON doesn’t include them
        const mod = await import("@/data/mock_theaters.json"); // ensure file lives in client/src/data/
        const rows = (mod as any).default ?? mod;
        if (signal?.aborted) return;
        set({ data: addFilmKeys(rows), loading: false });
        return;
      }

      // LIVE
      const base = import.meta.env.VITE_API_BASE_URL ?? ""; // "" -> use Vite proxy
      const url =
        `${base}/api/showtimes` +
        `?zip=${encodeURIComponent(zip)}` +
        `&date=${encodeURIComponent(date)}` +
        `&time=${encodeURIComponent(time)}`;

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (signal?.aborted) return;
      set({ data: addFilmKeys(json.theaters ?? []), loading: false });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      set({ error: e?.message ?? "Failed to load showtimes", loading: false });
    }
  },
}));
