import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// --- internal fallbacks (do not export) ---
const toDateOnlyISO = (d: Date) => d.toISOString().slice(0, 10);

function parseTimeLabel(label: string): { hours: number; minutes: number } | null {
  if (!label || typeof label !== 'string') return null;
  const t = label.trim();
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m24) {
    const h = Math.max(0, Math.min(23, parseInt(m24[1], 10)));
    const m = Math.max(0, Math.min(59, parseInt(m24[2], 10)));
    return { hours: h, minutes: m };
  }
  const m12 = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(t);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = Math.max(0, Math.min(59, parseInt(m12[2], 10)));
    const ap = m12[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return { hours: h, minutes: m };
  }
  return null;
}

function convertToHHMMFallback(label: string): string | null {
  const tm = parseTimeLabel(label);
  if (!tm) return null;
  const hh = String(tm.hours).padStart(2, '0');
  const mm = String(tm.minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resolveBaseDatePrefix(explicitBaseDate?: string): string {
  // If an explicit baseDate (YYYY-MM-DDT) is provided, trust it when valid
  if (explicitBaseDate && /^\d{4}-\d{2}-\d{2}T$/.test(explicitBaseDate)) return explicitBaseDate;

  // URL ?date=YYYY-MM-DD
  try {
    const url = new URL(window.location.href);
    const dateParam = url.searchParams.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return `${dateParam}T`;
  } catch {}

  // Pull from search store if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSearchStore } = require('@/store/zustand/useSearchStore');
    const d = useSearchStore.getState().date as Date | string | undefined;
    if (d) {
      const dd = d instanceof Date ? d : new Date(d);
      if (!isNaN(dd as any)) return `${toDateOnlyISO(dd as Date)}T`;
    }
  } catch {}

  // Today
  return `${toDateOnlyISO(new Date())}T`;
}

export type WatchItem = {
  id: string;          // deterministic: `${title}__${baseDate}${HH:MM}`
  title: string;
  startTime: string;   // label as shown to user, e.g. "12:30 PM"
  endTime: string;     // label, e.g. "2:18 PM"
  duration: string;    // "1h 48m"
};

type Helpers = {
  baseDate?: string; // preferred format: "YYYY-MM-DDT" (if missing we derive it)
  convertTo24Hour?: (label: string) => string | null; // if missing or returns null we fallback
  getDurationMins?: (title: string) => number; // optional; default 90
  toast?: { error?: (m: string) => void; message?: (m: string) => void };
};

type ScheduleState = {
  watchQueue: WatchItem[];
  addToQueue: (title: string, startLabel: string, helpers: Helpers) => void;
  removeFromQueue: (id: string | number) => void;
  clearQueue: () => void;
  reset: () => void;
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      watchQueue: [],

      addToQueue: (title, startLabel, { baseDate, convertTo24Hour, getDurationMins, toast } = {}) => {
        // Resolve base date prefix (YYYY-MM-DDT)
        const base = resolveBaseDatePrefix(baseDate);

        // Prefer provided converter, else fallback parser that accepts HH:MM or h:mm AM/PM
        const hhmm = (typeof convertTo24Hour === 'function' ? convertTo24Hour(startLabel) : null) || convertToHHMMFallback(startLabel);
        if (!hhmm) {
          toast?.error?.('Invalid start time');
          return;
        }

        const start = new Date(`${base}${hhmm}`);
        const mins = Math.max(30, Math.min(360, Number(getDurationMins?.(title) ?? 90)));
        const end = new Date(start.getTime() + mins * 60000);

        const endLabel = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const durationLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;

        // Deterministic ID so remove works reliably
        const id = `${title}__${base}${hhmm}`;

        // Duplicate guard (defensive against bad persisted state)
        const current = Array.isArray(get().watchQueue) ? get().watchQueue : [];
        if (current.some((i) => i.id === id)) {
          toast?.message?.('Already in queue');
          return;
        }

        // Overlap guard (same baseDate)
        const overlaps = current.some((i) => {
          const s = (typeof convertTo24Hour === 'function' ? convertTo24Hour(i.startTime) : null) || convertToHHMMFallback(i.startTime);
          const e = (typeof convertTo24Hour === 'function' ? convertTo24Hour(i.endTime) : null) || convertToHHMMFallback(i.endTime);
          if (!s || !e) return false;
          const si = new Date(`${base}${s}`);
          const ei = new Date(`${base}${e}`);
          return start < ei && end > si;
        });
        if (overlaps) {
          toast?.error?.('This showtime overlaps another in your queue.');
          return;
        }

        set({
          watchQueue: [
            ...current,
            { id, title, startTime: startLabel, endTime: endLabel, duration: durationLabel },
          ],
        });
      },

      removeFromQueue: (id) => {
        const current = Array.isArray(get().watchQueue) ? get().watchQueue : [];
        set({ watchQueue: current.filter((i) => i.id !== String(id)) });
      },

      clearQueue: () => set({ watchQueue: [] }),

      // Strong reset: clear state and remove persisted keys so stale queues don't rehydrate
      reset: () =>
        set((s) => {
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              const keys = Object.keys(window.localStorage);
              keys.forEach((k) => {
                if (
                  k === 'mm:schedule' ||
                  k === 'mm:schedule:v1' ||
                  k === 'mm:schema' ||
                  k.endsWith(':schedule') ||
                  k.includes('watchQueue')
                ) {
                  try { window.localStorage.removeItem(k); } catch {}
                }
              });
            }
          } catch {}
          return { ...s, watchQueue: [] };
        }),
    }),
    {
      name: "mm:schedule:v1",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: any, _version: number) => {
        const q = Array.isArray(persisted?.watchQueue) ? persisted.watchQueue : [];
        return { ...persisted, watchQueue: q };
      },
    }
  )
);
