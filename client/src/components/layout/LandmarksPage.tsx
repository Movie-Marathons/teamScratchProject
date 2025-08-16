import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, Point } from 'geojson';

type LandmarkProps = {
  RESNAME?: string;
  Address?: string;
  City?: string;
  State?: string;
};

type LandmarkFeature = Feature<Point | any, LandmarkProps>;

const API_BASE = '/api';

type SimpleLandmark = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
};

export default function LandmarksPage({ zip: initialZip, city }: { zip?: string; city?: string }) {
  const INITIAL_PAGE_SIZE = 10;
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [features, setFeatures] = useState<LandmarkFeature[]>([]);
  const [q, setQ] = useState('');
  const [zip, setZip] = useState(initialZip || '10001');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadByZip = async (z?: string) => {
    try {
      setErr(null);
      setLoading(true);

      const activeZip = (z ?? zip)?.trim();
      if (!/^\d{5}(-\d{4})?$/.test(activeZip)) {
        throw new Error('Enter a valid US ZIP');
      }

      const params = new URLSearchParams({ zip: activeZip });
      const res = await fetch(
        `${API_BASE}/landmarks/by-zip?${params.toString()}`
      );

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await res.text();
        throw new Error(
          `Expected JSON but got ${res.status} ${ct}. Body starts: ${text.slice(
            0,
            80
          )}`
        );
      }

      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || `Request failed (${res.status})`);

      const next: LandmarkFeature[] = Array.isArray(data)
        ? (data as LandmarkFeature[])
        : (((data as FeatureCollection).features ?? []) as LandmarkFeature[]);

      setFeatures(next);
      setVisibleCount(INITIAL_PAGE_SIZE);
      setExpanded(new Set());
    } catch (e: any) {
      setErr(e?.message || 'Unknown error');
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  // Keep local ZIP in sync with parent-provided ZIP
  useEffect(() => {
    if (initialZip && initialZip !== zip) {
      setZip(initialZip);
    }
  }, [initialZip]);

  // Whenever local ZIP changes (including after sync), (re)load
  useEffect(() => {
    if (zip) {
      loadByZip(zip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [features, q, pageSize]);

  const simplified = useMemo<SimpleLandmark[]>(() => {
    return features.map((f, idx) => {
      const p = f.properties ?? {};
      const name = p.RESNAME ?? 'Unknown';
      const address = p.Address;
      const city = p.City;
      const state = p.State;

      let lat: number | undefined;
      let lon: number | undefined;
      const coords = (f.geometry as Point | undefined)?.coordinates;
      if (
        Array.isArray(coords) &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        lon = coords[0];
        lat = coords[1];
      }

      const id =
        (f.id != null ? String(f.id) : undefined) ??
        `${name}-${address ?? ''}-${lat ?? ''}-${lon ?? ''}-${idx}`;

      return { id, name, address, city, state, lat, lon };
    });
  }, [features]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return simplified;

    return simplified.filter((item) => {
      const name = (item.name ?? '').toLowerCase();
      const addr = [item.address ?? '', item.city ?? '', item.state ?? '']
        .filter(Boolean)
        .join(', ')
        .toLowerCase();
      return name.includes(term) || addr.includes(term);
    });
  }, [q, simplified]);

  const displayed = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-6 text-white">Loading landmarks…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-white font-bold">Historic Landmarks</h2>
        <div className="flex flex-col items-end">
          {city && (
            <small className="text-white">City: {city}</small>
          )}
          <small className="text-white">
            Showing {displayed.length} of {features.length}
          </small>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="border rounded px-3 py-2 w-32 text-white"
          placeholder="ZIP (e.g. 10001)"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') loadByZip(zip);
          }}
        />
        <button
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow transition"
          onClick={() => loadByZip(zip)}
        >
          Search by ZIP
        </button>

        <input
          className="border rounded px-3 py-2 w-full max-w-md ml-auto text-white"
          placeholder="Filter by name or address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y border-2 border-black rounded">
        {displayed.map((item) => {
          const isOpen = expanded.has(item.id);
          const addrLine =
            [item.address, item.city, item.state].filter(Boolean).join(', ') ||
            '—';

          const mapUrl =
            typeof item.lat === 'number' && typeof item.lon === 'number'
              ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${item.name} ${addrLine}`.trim()
                )}`;

          return (
            <li key={item.id} className="p-3 border-2 border-black text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{item.name}</div>
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="text-sm px-3 py-1 rounded-lg border-2 border-black hover:shadow text-white"
                  aria-expanded={isOpen}
                  aria-controls={`details-${item.id}`}
                >
                  {isOpen ? 'Hide details' : 'Show more details'}
                </button>
              </div>

              {isOpen && (
                <div
                  id={`details-${item.id}`}
                  className="mt-2 text-sm space-y-2 bg-transparent rounded-lg p-3 border-2 border-black text-white"
                >
                  <div className="text-white">
                    <span className="font-medium">Address: </span>
                    <span>{addrLine}</span>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow transition"
                    >
                      View on map
                    </a>
                    {typeof item.lat === 'number' &&
                      typeof item.lon === 'number' && (
                        <span className="text-xs text-white self-center">
                          ({item.lat.toFixed(5)}, {item.lon.toFixed(5)})
                        </span>
                      )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 pt-2">
        <label className="text-sm text-white">
          Page size:{' '}
          <select
            className="border rounded px-2 py1"
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value);
              setPageSize(next);
              setVisibleCount(next);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>

        {displayed.length < filtered.length && (
          <button
            className="px-3 py-2 rounded bg-gray-900 text-white"
            onClick={() => {
              setVisibleCount((c) => Math.min(c + pageSize, filtered.length));
            }}
          >
            Load {Math.min(pageSize, filtered.length - displayed.length)} more
          </button>
        )}
      </div>
    </div>
  );
}
