import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type FilterState = {
  selectedGenres: string[];
  selectedRatings: string[];
  date: Date | null;

  // internal persisted value to rehydrate the Date safely
  dateTs: number | null;

  toggleGenre: (g: string) => void;
  toggleRating: (r: string) => void;
  setDate: (d: Date | null) => void;
  clearFilters: () => void;
};

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      selectedGenres: [],
      selectedRatings: [],
      date: null,
      dateTs: null,

      toggleGenre: (g) => {
        const has = get().selectedGenres.includes(g);
        set({
          selectedGenres: has
            ? get().selectedGenres.filter((x) => x !== g)
            : [...get().selectedGenres, g],
        });
      },

      toggleRating: (r) => {
        const has = get().selectedRatings.includes(r);
        set({
          selectedRatings: has
            ? get().selectedRatings.filter((x) => x !== r)
            : [...get().selectedRatings, r],
        });
      },

      setDate: (d) => set({ date: d, dateTs: d ? d.getTime() : null }),

      clearFilters: () => set({
        selectedGenres: [],
        selectedRatings: [],
        date: null,
        dateTs: null,
      }),
    }),
    {
      name: "filter-store-v1",
      storage: createJSONStorage(() => localStorage),
      // persist only what's needed; revive Date from timestamp
      partialize: (s) => ({
        selectedGenres: s.selectedGenres,
        selectedRatings: s.selectedRatings,
        dateTs: s.dateTs,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<FilterState>;
        const revivedDate = typeof p.dateTs === "number" ? new Date(p.dateTs) : null;
        return { ...current, ...p, date: revivedDate } as FilterState;
      },
      version: 1,
    }
  )
);
