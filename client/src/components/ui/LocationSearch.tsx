"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
//inject zustand
import { useSearchStore } from "@/store/zustand/useSearchStore";

type ZipSuggestion = { zip: string; city?: string; state?: string; distance?: number };

type Props = {
  onSearch: (params: { zip: string; date: Date | undefined; time: string }) => void;
};

export default function LocationSearch({ onSearch }: Props) {
  // const [zip, setZip] = React.useState("");
  // const [date, setDate] = React.useState<Date | undefined>(new Date());
  const { zip, date, time, setZip, setDate, setTime } = useSearchStore();

//ensure date passed is real or undefined
const uiDate = 
date instanceof Date
? date
: typeof date === "string"
? new Date(date)
: undefined;

  const [open, setOpen] = React.useState(false);
  // const [time, setTime] = React.useState("08:00");

  const [suggestions, setSuggestions] = React.useState<ZipSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1);
  const [loadingSuggest, setLoadingSuggest] = React.useState(false);
  const [suggestError, setSuggestError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  const normalizeSuggestions = (data: any): ZipSuggestion[] => {
    const arr = Array.isArray(data) ? data : (data?.postalCodes ?? data?.results ?? data?.items ?? data?.zips ?? []);
    return arr
      .map((it: any) => {
        const zip = String(it?.postalCode ?? it?.zip ?? it?.postcode ?? "");
        if (!zip) return null;
        return {
          zip,
          city: it?.placeName ?? it?.city ?? it?.locality ?? undefined,
          state: it?.adminCode1 ?? it?.state ?? it?.region ?? undefined,
        } as ZipSuggestion;
      })
      .filter(Boolean) as ZipSuggestion[];
  };

  const fetchZipSuggestions = (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingSuggest(true);
    setSuggestError(null);

    const params = new URLSearchParams({ q, limit: '8' });
    const url = `/api/geo/postal?${params.toString()}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const list = normalizeSuggestions(data);
        setSuggestions(list);
        setShowSuggestions(true);
        setHighlightedIndex(list.length ? 0 : -1);
      })
      .catch((err) => {
        if ((err as any).name === 'AbortError') return;
        console.error('ZIP autocomplete error:', err);
        setSuggestError((err as Error).message);
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      })
      .finally(() => setLoadingSuggest(false));
  };

  const handleZipChange = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 5); // digits-only, clamp to 5
    setZip(v);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (v.length >= 2) {
      debounceRef.current = window.setTimeout(() => fetchZipSuggestions(v), 250);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const selectSuggestion = (s: ZipSuggestion | null) => {
    if (!s) return;
    //write zip into store
    setZip(s.zip);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const onZipKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = suggestions[highlightedIndex] ?? suggestions[0];
      selectSuggestion(s);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const closeSuggestionsSoon = () => {
    // allow click selection before blur clears
    window.setTimeout(() => setShowSuggestions(false), 120);
  };

  const handleSearch = () => {
    if (!zip || !uiDate || !time) return;
    onSearch({ zip, uiDate, time });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-center text-gray-800">
        Search Theaters by ZIP, Date & Time
      </h2>

      <div className="flex flex-wrap gap-6 justify-center items-end">
        {/* ZIP input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="zip" className="px-1 text-white">ZIP</Label>
          <div className="relative w-40">
            <Input
              id="zip"
              placeholder="Enter Zip"
              value={zip}
              onChange={(e) => handleZipChange(e.target.value)}
              onKeyDown={onZipKeyDown}
              onFocus={() => zip.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={closeSuggestionsSoon}
              className="w-40 bg-white text-black"
              inputMode="numeric"
              autoComplete="postal-code"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls="zip-suggest-list"
              aria-activedescendant={highlightedIndex >= 0 ? `zip-opt-${highlightedIndex}` : undefined}
            />
            {showSuggestions && (
              <ul
                id="zip-suggest-list"
                role="listbox"
                className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-64 overflow-auto"
              >
                {loadingSuggest && (
                  <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
                )}
                {!loadingSuggest && suggestError && (
                  <li className="px-3 py-2 text-sm text-red-600">{suggestError}</li>
                )}
                {!loadingSuggest && !suggestError && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
                )}
                {!loadingSuggest && !suggestError && suggestions.map((s, idx) => (
                  <li
                    key={`${s.zip}-${idx}`}
                    id={`zip-opt-${idx}`}
                    role="option"
                    aria-selected={idx === highlightedIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${idx === highlightedIndex ? 'bg-gray-100' : ''}`}
                  >
                    <span className="font-medium">{s.zip}</span>
                    {(s.city || s.state) && (
                      <span className="text-gray-600"> — {s.city ?? ''}{s.city && s.state ? ', ' : ''}{s.state ?? ''}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="date-picker" className="px-1 text-white">Date</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="date-picker"
                className="w-40 justify-between font-normal"
              >
                {uiDate ? uiDate.toLocaleDateString() : "Select date"}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={uiDate}
                captionLayout="dropdown"
                onSelect={(uiDate) => {
                  //write date into store
                  setDate(uiDate);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="time-picker" className="px-1 text-white">Time</Label>
          <Input
            type="time"
            id="time-picker"
            value={time}
            //write time into store
            onChange={(e) => setTime(e.target.value)}
            step="1800"
            className="w-36 bg-white text-black appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>

        {/* Submit */}
        <Button onClick={handleSearch}>Search</Button>
      </div>
    </div>
  );
}