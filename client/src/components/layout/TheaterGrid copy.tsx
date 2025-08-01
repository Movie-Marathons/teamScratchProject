import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SelectedTheater from "../theather/SelectedTheater";

interface Props {
  searchParams: {
    zip: string;
    date: Date | undefined;
    time: string;
  } | null;
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
      {filtered.map((entry) => {
        const theater = entry.cinema;
        return (
          <Accordion
            key={theater.cinema_id}
            type="single"
            collapsible
            className="w-full border rounded-lg"
          >
            <AccordionItem value="open">
              <AccordionTrigger className="p-0 hover:no-underline">
                <Card className="w-full shadow-sm border-none">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {theater.cinema_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {theater.address}, {theater.city}, {theater.state}{" "}
                      {theater.postcode}
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-700 pb-4">
                    <p>🎟️ Show Dates:</p>
                    <ul className="list-disc list-inside">
                      {theater.show_dates.map((d) => (
                        <li key={d.date}>{d.display_date}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </AccordionTrigger>

              <AccordionContent className="bg-slate-50 rounded-b-lg p-4">
                <SelectedTheater
                  theaterName={theater.cinema_name}
                  films={entry.films}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
}