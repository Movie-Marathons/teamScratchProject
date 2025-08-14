import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SearchState = {
    zip: string;
    date: Date | undefined;
    time: string;
    setZip: (v: string) => void;
    setDate: (v: Date | undefined) => void;
    setTime: (v: string) => void;
    setAll: (v: Partial<Pick<SearchState, "zip" | "date" | "time">>) => void;
    reset: () => void;
};

//convert date string to Date on read
const storage = createJSONStorage(() => ({
    getItem: (name: string) => {
        const raw = localStorage.getItem(name);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        //revive date
        if (parsed?.state?.date && typeof parsed.state.date === "string") {
            parsed.state.date = new Date(parsed.state.date);
    }
    return parsed;
},
setItem: (name: string, value: unknown) => {
    //convert Date to ISO so it can be revived later
    const copy: any = typeof value === "object" ? JSON.parse(JSONstringify(value)) : value;
    if (copy?.state?.date instanceof Date) {
        copy.state.date = (copy.state.date as Date).toISOString();
    }
    localStorage.setItem(name, JSON.stringify(copy));
},
removeItem: (name: string) => localStorage.removeItem(name),
}
));


// const todayISO = () => new Date().toISOString().slice(0, 10);

export const useSearchStore = create<SearchState>()(
    persist(
        (set) => ({
            zip: "32250",
            date: new Date(),
            time: "08:00",
            setZip: (zip) => set({ zip }),
            setDate: (date) => set({ date }),
            setTime: (time) => set({ time }),
            setAll: (v) => set(v),
            reset: () => set({ zip: "32250", date: todayISO(), time: "08:00" }),
        }),
        { name: "search-store", storage }
    )
);