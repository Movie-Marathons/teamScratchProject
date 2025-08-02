import React, { useState } from "react";
import theaters from "../../../data/mock_theaters.json";
import { toast } from "sonner";
console.log("All theater objects:", theaters);
theaters.forEach((t: any, idx: number) => {
  console.log(`Theater ${idx}:`, t);
});
import { useSearchParams } from "react-router-dom";
import { WatchQueueTable } from "../ui/WatchQueueTable";
import type { WatchItem } from "../ui/WatchQueueTable";

const PlannerPage = () => {
  const [searchParams] = useSearchParams();

  const movieId = searchParams.get("movieId");
  const showtime = searchParams.get("showtime");
  const theater = searchParams.get("theater");

  const selectedTheater = theaters.find(
    (t: any) =>
      t?.cinema?.cinema_name?.trim().toLowerCase() === theater?.trim().toLowerCase()
  );

  const [watchQueue, setWatchQueue] = useState<WatchItem[]>([]);

  const durationMinutes = 101;

  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const baseDate = "1970-01-01T";
  const selectedStart = showtime ? new Date(`${baseDate}${convertTo24Hour(showtime)}`) : null;
  const selectedMovieEnd = selectedStart ? new Date(selectedStart.getTime() + durationMinutes * 60000) : null;

  const addToQueue = (movieTitle: string, startTime: string) => {
    if (watchQueue.some((item) => item.title === movieTitle && item.startTime === startTime)) {
      toast.error("This movie and showtime is already in your queue.");
      return;
    }

    if (watchQueue.some((item) => item.startTime === startTime)) {
      toast.error("A movie with the same start time already exists in your queue.");
      return;
    }

    const start = new Date(`${baseDate}${convertTo24Hour(startTime)}`);
    if (selectedMovieEnd && start <= selectedMovieEnd) {
      toast.error("This showtime overlaps with the current movie.");
      return;
    }

    const end = new Date(start.getTime() + durationMinutes * 60000);
    const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const newItem: WatchItem = {
      id: Date.now().toString(),
      title: movieTitle,
      startTime,
      endTime,
      duration: "1h 41m",
    };

    setWatchQueue((prev) => [...prev, newItem]);
  };

  return (
    <div className="flex h-full p-6 gap-6">
      {/* Left column - Selected Movie */}
      <div className="w-1/3 bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-4">🎬 Selected Movie</h2>
        <div className="space-y-2">
          <p><span className="font-medium">Movie ID:</span> {movieId}</p>
          <p><span className="font-medium">Showtime:</span> {showtime}</p>
          <p><span className="font-medium">Theater:</span> {theater}</p>
          <div className="w-full h-40 bg-gray-200 mt-4 flex items-center justify-center text-gray-500">
            Poster Placeholder
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white shadow rounded p-4 min-h-[120px]">
          <h3 className="text-md font-medium">🔍 Filters</h3>
        </div>

        {selectedTheater?.films?.length ? (
          <div className="bg-white shadow rounded p-4">
            <h3 className="text-md font-medium mb-2">🍿 Available Movies</h3>
            <ul className="space-y-2">
              {selectedTheater.films.map((film: any) => (
                <li key={film.film_id} className="border rounded p-2">
                  <div className="font-semibold">{film.film_name}</div>
                  <div className="text-xs text-gray-500">
                    Showtimes:{" "}
                    {film.showings?.Standard?.times
                      .filter((time: any) => {
                        const showStart = new Date(`${baseDate}${convertTo24Hour(time.display_start_time)}`);
                        return !selectedMovieEnd || showStart > selectedMovieEnd;
                      })
                      .map((time: any, idx: number) => (
                        <button
                          key={idx}
                          className="inline-block px-2 py-1 m-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          onClick={() => addToQueue(film.film_name, time.display_start_time)}
                        >
                          {time.display_start_time}
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white shadow rounded p-4">
            <h3 className="text-md font-medium mb-2">🍿 Available Movies</h3>
            <p className="text-sm text-gray-400 italic">No movie data found.</p>
          </div>
        )}

        <div className="bg-white shadow rounded p-4 flex-1">
          <h3 className="text-md font-medium mb-2">🎞️ Your Watch Queue</h3>
          <WatchQueueTable
            data={watchQueue}
            onRemove={(id) =>
              setWatchQueue((prev) => prev.filter((item) => item.id !== id))
            }
          />
        </div>

        {/* Movie Posters from Watch Queue */}
        <div className="bg-white shadow rounded p-4 w-full">
          <h3 className="text-md font-medium mb-2">🖼️ Your Movie Posters</h3>
          <div className="flex gap-4 overflow-x-auto">
            {watchQueue.map((movie) => (
              <div
                key={movie.id}
                className="w-24 h-36 bg-gray-300 flex items-center justify-center text-xs text-gray-600 rounded"
              >
                {movie.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerPage;