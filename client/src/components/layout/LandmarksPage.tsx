import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, Point } from 'geojson';

type LandmarkProps = {
  RESNAME?: string;
  Address?: string;
  City?: string;
  State?: string;
};

type LandmarkFeature = Feature<Point | any, LandmarkProps>;

// Optional: configure a base for API calls (defaults to '/api')
const API_BASE = '/api';

export default function LandmarksPage() {
  // set state for how many pages to show per click
  const INITIAL_PAGE_SIZE = 10;
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  const [features, setFeatures] = useState<LandmarkFeature[]>([]);
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('10001'); // starting ZIP
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // DEBUGGING
  //   useEffect(() => {
  //     if (features.length) {
  //       console.log('feature[0].properties =', features[0]?.properties);
  //     }
  //   }, [features]);

  // Backend call: /api/landmarks/by-zip
  const loadByZip = async () => {
    try {
      setErr(null);
      setLoading(true);

      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        throw new Error('Enter a valid US ZIP');
      }

      const params = new URLSearchParams({
        zip,
        // radiusMi: '3',   // optional to pass through
        // limit: '50',     // optional
      });

      const res = await fetch(
        `${API_BASE}/landmarks/by-zip?${params.toString()}`
      );

      // Helpful: clearer error if HTML is returned instead of JSON
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

      // Accept FeatureCollection or an array
      const next: LandmarkFeature[] = Array.isArray(data)
        ? (data as LandmarkFeature[])
        : (((data as FeatureCollection).features ?? []) as LandmarkFeature[]);

      setFeatures(next);
    } catch (e: any) {
      setErr(e?.message || 'Unknown error');
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadByZip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [features, q, pageSize]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return features;

    return features.filter((f) => {
      const p = f.properties ?? {};
      const name = (p.RESNAME ?? '').toLowerCase();
      const addr = [p.Address ?? '', p.City ?? '', p.State ?? '']
        .filter(Boolean)
        .join(', ')
        .toLowerCase();
      return name.includes(term) || addr.includes(term);
    });
  }, [q, features]);

  const displayed = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  if (loading) return <div className="p-6">Loading landmarks…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold">Historic Landmarks</h2>
        <small className="text-gray-500">
          Showing {displayed.length} of {features.length}
        </small>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="border rounded px-3 py-2 w-32"
          placeholder="ZIP (e.g. 10001)"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded bg-black text-white"
          onClick={loadByZip}
        >
          Search by ZIP
        </button>

        <input
          className="border rounded px-3 py-2 w-full max-w-md ml-auto"
          placeholder="Filter by name or address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y border rounded">
        {displayed.map((f, i) => {
          const p = f.properties ?? {};
          const name = p.RESNAME ?? 'Unknown';
          const addr =
            [p.Address, p.City, p.State].filter(Boolean).join(', ') || '—';

          return (
            <li key={f.id?.toString() ?? i} className="p-3">
              <div className="font-medium">{name}</div>
              <div className="text-sm text-gray-600">{addr}</div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 pt-2">
        <label className="text-sm text-gray-600">
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
