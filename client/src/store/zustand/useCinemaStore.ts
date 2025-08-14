import { create } from "zustand";

type ShowDate = { date:string; display_date: string; id?: string; show_date_id?: string };

type Cinema = {
    cinema_id: number;
    cinema_name: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    show_dates: ShowDate[];
    search_zip?: string;
    distance?: number;
};

export type TheaterEntry = { cinema: Cinema; films: any[] };
type Query = { zip: string; date?: string };

type CinemaState = {
    list: TheaterEntry[] | null;
    loading: boolean;
    error: string | null;
    fetchCinemas: (q: Query, signal?: AbortSignal) => Promise<void>;
    clear: () => void;
};

function normalize(items: any[]): TheaterEntry[] {
    return (items ?? []).map((item: any) => {
        if (item?.cinema) return item as TheaterEntry;
        const postcode = item?.postcode ?? item?.zip ?? item?.postal_code ?? "";
        const show_dates = Array.isArray(item?.show_dates) ? item.show_dates : [];
        return {
            cinema: {
                cinema_id: item?.cinema_id ?? item?.id ?? item?.external_id ?? 0,
                cinema_name: item?.cinema_name ?? item?.name ?? "",
                address: item?.address ?? "",
                city: item?.city ?? "",
                state: item?.state ?? "",
                postcode: String(postcode),
                show_dates,
                search_zip: item?.zip ? String(item.zip) : undefined,
                distance: typeof item?.distance === "number" ? item.distance : undefined,
            },
            films: item?.films ?? [],
        } as TheaterEntry;
    });
}
export const useCinemaStore = create<CinemaState>((set, get) => ({
    list: null,
    loading: false,
    error: null,

    clear: () => set({ list: null, error: null}),

    fetchCinemas: async ({ zip, date }, signal) => {
        if(get().loading) return;
        set({ loading: true, error: null });

        try {
             const base = import.meta.env.VITE_API_BASE_URL ?? ""; // "" uses Vite proxy in dev
            const params = new URLSearchParams({ zip });
            if (date) params.set("date", date);
            const res = await fetch(`${base}/api/cinemas?${params.toString()}`, { signal });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const json = await res.json();
            const items = Array.isArray(json) ? json : (json.results ?? json.cinemas ?? []);
            set({ list: normalize(items), loading: false });
        }   catch (e: any) {
            if (e?.name === "AbortError") return;
            set({ error: e?.message ?? "Failed to load cinemas", loading: false });
        }
    },
}));