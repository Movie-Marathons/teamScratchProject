import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SelectedTheater from "../theather/SelectedTheater";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    show_dates: { date: string; display_date: string }[];
  };
  films: any[];
}

export default function TheaterGrid({ searchParams }: Props) {
  const [theaters, setTheaters] = useState<TheaterEntry[]>([]);
  const [selectedTheater, setSelectedTheater] = useState<TheaterEntry | null>(null);

  useEffect(() => {
    fetch("/data/mock_theaters.json")
      .then((res) => res.json())
      .then((data) => setTheaters(data))
      .catch((err) => console.error("Failed to load theaters:", err));
  }, []);

  if (!searchParams) return null;

  const selectedDateStr = searchParams.date?.toISOString().split("T")[0];

  const filtered = theaters.filter((entry) => {
    const zipMatches = entry.cinema.postcode.toString() === searchParams.zip;
    const dateMatches = entry.cinema.show_dates.some(
      (d) => d.date === selectedDateStr
    );
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
              key={theater.cinema_id}
              className="w-full shadow-sm border border-slate-200"
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  {theater.cinema_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {theater.address}, {theater.city}, {theater.state} {theater.postcode}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 pb-4">
                <p>🎟️ Show Dates:</p>
                <ul className="list-disc list-inside">
                  {theater.show_dates.map((d) => (
                    <li key={d.date}>{d.display_date}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTheater(entry)}
                  >
                    View Movies
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={selectedTheater !== null} onOpenChange={() => setSelectedTheater(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Now Playing</DialogTitle>
          </DialogHeader>

          {selectedTheater && (
            <SelectedTheater
              theaterName={selectedTheater.cinema.cinema_name}
              films={selectedTheater.films}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}