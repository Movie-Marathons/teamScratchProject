import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type WatchItem = {
  id: string;          // deterministic: `${title}__${baseDate}${HH:MM}`
  title: string;
  startTime: string;   // label as shown to user, e.g. "12:30 PM"
  endTime: string;     // label, e.g. "2:18 PM"
  duration: string;    // "1h 48m"
};

type Helpers = {
  baseDate: string; // "YYYY-MM-DDT"
  convertTo24Hour: (label: string) => string | null;
  getDurationMins: (title: string) => number;
  toast?: { error?: (m: string) => void; message?: (m: string) => void };
};

type ScheduleState = {
  watchQueue: WatchItem[];
  addToQueue: (title: string, startLabel: string, helpers: Helpers) => void;
  removeFromQueue: (id: string | number) => void;
  clearQueue: () => void;
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      watchQueue: [],

      addToQueue: (title, startLabel, { baseDate, convertTo24Hour, getDurationMins, toast }) => {
        const hhmm = convertTo24Hour(startLabel);
        if (!hhmm) {
          toast?.error?.("Invalid start time");
          return;
        }

        const start = new Date(`${baseDate}${hhmm}`);
        const mins = getDurationMins(title) ?? 90;
        const end = new Date(start.getTime() + mins * 60000);

        const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const durationLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;

        // Deterministic ID so remove works reliably
        const id = `${title}__${baseDate}${hhmm}`;

        // Duplicate guard
        if (get().watchQueue.some((i) => i.id === id)) {
          toast?.message?.("Already in queue");
          return;
        }

        // Overlap guard (same baseDate)
        const overlaps = get().watchQueue.some((i) => {
          const s = convertTo24Hour(i.startTime);
          const e = convertTo24Hour(i.endTime);
          if (!s || !e) return false;
          const si = new Date(`${baseDate}${s}`);
          const ei = new Date(`${baseDate}${e}`);
          return start < ei && end > si;
        });
        if (overlaps) {
          toast?.error?.("This showtime overlaps another in your queue.");
          return;
        }

        set({
          watchQueue: [
            ...get().watchQueue,
            { id, title, startTime: startLabel, endTime: endLabel, duration: durationLabel },
          ],
        });
      },

      removeFromQueue: (id) =>
        set({ watchQueue: get().watchQueue.filter((i) => i.id !== String(id)) }),

      clearQueue: () => set({ watchQueue: [] }),
    }),
    {
      name: "mm:schedule:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
