// src/components/sidebar/SidebarPosters.tsx
'use client';

import { useEffect, useState } from "react";

interface Film {
  film_id: number;
  film_name: string;
  images: {
    poster: {
      [key: string]: {
        medium: {
          film_image: string;
        };
      };
    };
  };
}

export default function SidebarPosters() {
  const [films, setFilms] = useState<Film[]>([]);

  useEffect(() => {
    fetch("/data/mock_theaters.json")
      .then((res) => res.json())
      .then((data) => {
        const allFilms: Film[] = data.flatMap((entry: any) => entry.films);
        setFilms(allFilms.slice(0, 6)); // Limit to first 6 posters
      });
  }, []);

  return (
    <div className="space-y-4">
      {films.map((film) => {
        const posterUrl = film.images?.poster?.["1"]?.medium?.film_image;
        return (
          <div key={film.film_id} className="w-full">
            <img
              src={posterUrl}
              alt={film.film_name}
              className="w-full h-auto rounded shadow"
            />
          </div>
        );
      })}
    </div>
  );
}
