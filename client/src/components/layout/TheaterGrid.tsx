import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SelectedTheater from '../theather/SelectedTheater';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSearchStore } from '@/store/zustand/useSearchStore';

interface Props {
  searchParams: {
    zip: string;
    date: Date | undefined;
    time: string;
  } | null;
  filters: {
    genres: string[];
    timeOfDay: string;
    languages: string[];
  };
}

interface TheaterEntry {
  cinema: {
    cinema_id: number;
    cinema_name: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    show_dates: { date: string; display_date: string; id?: string | number; show_date_id?: string | number }[];
    search_zip?: string;
    distance?: number;
  };
  films: any[];
}

export default function TheaterGrid({ searchParams }: Props) {
  const [theaters, setTheaters] = useState<TheaterEntry[]>([]);
  const [selectedTheater, setSelectedTheater] = useState<TheaterEntry | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { date: storeDate } = useSearchStore();

  const handleViewMovies = (entry: TheaterEntry) => {
    if (!entry?.cinema?.cinema_id || entry.cinema.cinema_id === 0) {
      setDialogError('Invalid cinema ID — cannot load showtimes.');
      return;
    }
    // Open dialog immediately with cinema info; films will load
    setSelectedTheater({ ...entry, films: [] });
    setDialogError(null);

    const cinemaId = String(entry?.cinema?.cinema_id ?? '');

    // Choose a date: prefer Zustand store date, then prop date, then first available show_date
    const selected = storeDate || searchParams?.date;
    const chosenDate = selected
      ? new Date(selected).toISOString().split('T')[0]
      : entry?.cinema?.show_dates?.[0]?.date ?? '';

    // Try to find a show_date_id for that date if present
    const sd = Array.isArray(entry?.cinema?.show_dates)
      ? entry.cinema.show_dates.find((d: any) => d?.date === chosenDate)
      : undefined;
    const showDateId = (sd as any)?.id || (sd as any)?.show_date_id || '';

    if (!chosenDate && !showDateId) {
      setDialogError('Missing date for showtimes — pick a date and try again.');
      return;
    }

    const params = new URLSearchParams();
    if (cinemaId) params.set('cinema_id', cinemaId);
    if (chosenDate) params.set('date', chosenDate);
    if (showDateId) params.set('show_date_id', String(showDateId));

    const url = `/api/cinemaShowTimes?${params.toString()}`;

    setDialogLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        console.log('Raw showtimes API response:', data);
        let items = Array.isArray(data)
          ? data
          : data?.films ?? data?.results ?? data?.showings ?? data?.sample ?? [];

        // If the payload is flat showings (title + start_time per row), group into films with times[]
        if (Array.isArray(items) && items.length > 0 && 'start_time' in (items[0] as any)) {
          const map = new Map<string, { title: string; imdb_title_id?: string | null; times: { start_time: string; display_start_time?: string | null }[] }>();
          for (const s of items as any[]) {
            const key = String(s.imdb_title_id || s.title || 'unknown');
            const title = s.title || 'Untitled';
            const slot = { start_time: s.start_time, display_start_time: s.display_start_time ?? null };
            if (!map.has(key)) {
              map.set(key, { title, imdb_title_id: s.imdb_title_id ?? null, times: [slot] });
            } else {
              map.get(key)!.times.push(slot);
            }
          }
          items = Array.from(map.values());
        }

        setSelectedTheater((prev) => (prev ? { ...prev, films: items } : prev));
        console.log('Loaded showtimes (grouped films):', Array.isArray(items) ? items.length : items);
      })
      .catch((err) => {
        console.error('Failed to load showtimes:', err);
        setDialogError((err as Error).message);
      })
      .finally(() => setDialogLoading(false));
  };

  useEffect(() => {
    if (!searchParams?.zip) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ zip: searchParams.zip });
    const dateStr = searchParams.date
      ? new Date(searchParams.date).toISOString().split('T')[0]
      : undefined;
    if (dateStr) params.set('date', dateStr);

    const url = `/api/cinemas?${params.toString()}`;

    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data?.results ?? data?.cinemas ?? [];
        console.log(
          'Loaded theaters from backend:',
          Array.isArray(list) ? list.length : list
        );
        console.log(
          'Sample theater item:',
          list && list.length ? list[0] : null
        );

        // Normalize to TheaterEntry shape
        const normalized: TheaterEntry[] = (list as any[]).map((item: any) => {
          if (item?.cinema) {
            // Already in expected shape
            return item as TheaterEntry;
          }
          // Flattened shape from backend -> wrap into { cinema, films }
          const postcode =
            item?.postcode ?? item?.zip ?? item?.postal_code ?? '';
          const rawShowDates = item?.show_dates ?? [];
          const show_dates = Array.isArray(rawShowDates)
            ? rawShowDates.map((d: any) => ({
                date: d?.date ?? '',
                display_date: d?.display_date ?? d?.displayDate ?? '',
                id: d?.id,
                show_date_id: d?.show_date_id ?? d?.showDateId,
              }))
            : [];
          return {
            cinema: {
              cinema_id: item?.cinema_id ?? item?.id ?? item?.external_id ?? 0,
              cinema_name: item?.cinema_name ?? item?.name ?? '',
              address: item?.address ?? '',
              city: item?.city ?? '',
              state: item?.state ?? '',
              postcode: String(postcode),
              show_dates,
              search_zip: item?.zip ? String(item.zip) : undefined,
              distance:
                typeof item?.distance === 'number' ? item.distance : undefined,
            },
            films: item?.films ?? [],
          } as TheaterEntry;
        });

        setTheaters(normalized);
      })
      .catch((err) => {
        if ((err as any).name === 'AbortError') return;
        console.error(
          `Failed to load theaters from ${url}: ${(err as Error).message}`,
          err
        );
        setError(
          `Sorry — we couldn't load theaters from ${url}. (${
            (err as Error).message
          })`
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [searchParams?.zip, searchParams?.date]);

  if (!searchParams) return null;

  if (loading) {
    return <p className="text-center mt-10">Loading theaters…</p>;
  }

  if (error) {
    return <p className="text-center text-red-600 mt-10">{error}</p>;
  }

  const selectedDateStr = searchParams.date?.toISOString().split('T')[0];

  const filtered = theaters.filter((entry) => {
    const qzip = String(searchParams?.zip ?? '');
    const pc = entry?.cinema?.postcode ? String(entry.cinema.postcode) : '';
    const sz = (entry?.cinema as any)?.search_zip
      ? String((entry.cinema as any).search_zip)
      : '';
    const zipMatches =
      (pc && pc === qzip) || (sz && sz === qzip) || (!pc && !sz); // if no zip data, don't exclude

    const dates = Array.isArray(entry?.cinema?.show_dates)
      ? entry.cinema.show_dates
      : [];
    const hasDates = dates.length > 0;
    const dateMatches =
      !selectedDateStr ||
      !hasDates ||
      dates.some((d) => d?.date === selectedDateStr);

    return zipMatches && dateMatches;
  });

  if (filtered.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-10">
        No theaters found for that ZIP and date.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filtered.map((entry) => {
          const theater = entry.cinema;
          return (
            <Card
              key={
                theater.cinema_id ||
                `${theater.cinema_name}-${theater.postcode}`
              }
              className="w-full shadow-md border border-red-900 bg-gradient-to-b from-red-950 to-red-800 text-red-50"
            >
              <CardHeader>
                <CardTitle className="text-lg text-red-200 font-bold">{theater.cinema_name}</CardTitle>
                <p className="text-sm text-red-300">
                  {theater.address}, {theater.city}, {theater.state}{' '}
                  {theater.postcode}
                </p>
                {typeof theater.distance === 'number' && (
                  <p className="text-xs text-red-400">
                    {theater.distance.toFixed(1)} miles away
                  </p>
                )}
              </CardHeader>
              <CardContent className="text-sm text-red-100 pb-4">
                <p className="font-semibold text-red-200"></p>
                <ul className="list-disc list-inside">
                  {theater.show_dates.map((d) => (
                    <li key={d.date} className="text-red-100">{d.display_date}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  {theater.cinema_id && theater.cinema_id !== 0 ? (
                    <Button
                      className="bg-red-700 hover:bg-red-600 text-white border-red-600"
                      onClick={() => handleViewMovies(entry)}
                    >
                      View Movies
                    </Button>
                  ) : (
                    <Button className="bg-red-900 text-red-400 border-red-800" disabled>
                      No Movies Available
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={selectedTheater !== null}
        onOpenChange={() => setSelectedTheater(null)}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Now Playing</DialogTitle>
          </DialogHeader>

          {dialogLoading && (
            <p className="text-sm text-gray-600">Loading showtimes…</p>
          )}
          {dialogError && <p className="text-sm text-red-600">{dialogError}</p>}

          {selectedTheater && (
            <SelectedTheater
              theaterName={selectedTheater.cinema.cinema_name}
              films={selectedTheater.films}
              cinemaId={selectedTheater.cinema.cinema_id}
              dateISO={
                (storeDate
                  ? new Date(storeDate).toISOString().split('T')[0]
                  : (searchParams?.date
                      ? new Date(searchParams.date).toISOString().split('T')[0]
                      : undefined))
              }
              city={selectedTheater.cinema.city}
              zip={selectedTheater.cinema.postcode}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
