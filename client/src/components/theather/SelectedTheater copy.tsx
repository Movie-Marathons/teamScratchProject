import React from "react";

type Film = {
  film_id: number;
  film_name: string;
  synopsis_long: string;
  duration_hrs_mins: string;
  images: {
    poster: {
      [key: string]: {
        medium: { film_image: string };
      };
    };
  };
  showings: {
    Standard: {
      times: { display_start_time: string }[];
    };
  };
};

type SelectedTheaterProps = {
  theaterName: string;
  films: Film[];
};

const SelectedTheater: React.FC<SelectedTheaterProps> = ({ theaterName, films }) => {
  return (
    <div className="mt-4 space-y-6">
      <h3 className="text-lg font-semibold text-center">{theaterName} - Movies</h3>

      <div className="flex flex-col space-y-4">
        {films.map((film) => (
          <div
            key={film.film_id}
            className="flex flex-col sm:flex-row bg-white border rounded-lg shadow overflow-hidden"
          >
            <img
              src={film.images.poster["1"].medium.film_image}
              alt={film.film_name}
              className="w-full sm:w-36 h-56 object-cover"
            />
            <div className="p-4 flex-1 space-y-2">
              <h4 className="text-md font-bold">{film.film_name}</h4>
              <p className="text-sm text-gray-500">{film.duration_hrs_mins}</p>
              <div>
                <p className="font-medium text-sm">Showtimes:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {film.showings.Standard.times.map((time, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-100 rounded text-xs"
                    >
                      {time.display_start_time}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectedTheater;