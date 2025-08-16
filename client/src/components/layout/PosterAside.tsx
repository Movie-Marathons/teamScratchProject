// src/components/layout/PosterAside.tsx
'use client';

import { useEffect, useState } from 'react';

interface PosterRow {
  film_id: string;      // uuid
  image_base64: string; // base64 without data URI prefix
  alt_text: string | null;
}

export default function SidebarPosters() {
  const [posters, setPosters] = useState<PosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        // Fetch a few latest posters from the backend.
        const res = await fetch('/api/moviePosters?limit=5');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PosterRow[] = await res.json();
        if (isMounted) setPosters(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (isMounted) setError(e?.message ?? 'Failed to load posters');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div className="space-y-2 text-sm text-muted-foreground">Loading posters…</div>;
  }

  if (error) {
    return (
      <div className="space-y-2 text-sm text-red-600">
        Failed to load posters: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posters.map((p, idx) => {
        const src = `data:image/jpeg;base64,${p.image_base64}`; // most IMDB posters are jpeg; adjust if needed
        const alt = p.alt_text ?? 'Movie poster';
        return (
          <div key={`${p.film_id}-${idx}`} className="w-full">
            <img src={src} alt={alt} className="w-full h-auto rounded shadow" />
          </div>
        );
      })}
    </div>
  );
}
