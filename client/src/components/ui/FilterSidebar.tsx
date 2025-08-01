import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Props {
  selectedGenres: string[];
  setSelectedGenres: (genres: string[]) => void;
  selectedLanguages: string[];
  setSelectedLanguages: (langs: string[]) => void;
  timeOfDay: string;
  setTimeOfDay: (time: string) => void;
}

export default function FilterSidebar({
  selectedGenres,
  setSelectedGenres,
  selectedLanguages,
  setSelectedLanguages,
  timeOfDay,
  setTimeOfDay,
}: Props) {
  const toggleGenre = (genre: string) => {
    setSelectedGenres(
      selectedGenres.includes(genre)
        ? selectedGenres.filter((g) => g !== genre)
        : [...selectedGenres, genre]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(
      selectedLanguages.includes(lang)
        ? selectedLanguages.filter((l) => l !== lang)
        : [...selectedLanguages, lang]
    );
  };

  return (
    <div className="p-4 space-y-6 bg-slate-900 text-white min-w-[200px]">
      <div>
        <h3 className="text-md font-semibold mb-2">🎬 Genre</h3>
        {["Action", "Comedy", "Drama", "Horror", "Romance"].map((genre) => (
          <div key={genre} className="flex items-center gap-2">
            <Checkbox
              id={genre}
              checked={selectedGenres.includes(genre)}
              onCheckedChange={() => toggleGenre(genre)}
            />
            <Label htmlFor={genre} className="text-white">{genre}</Label>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-md font-semibold mb-2">🕒 Time of Day</h3>
        <RadioGroup value={timeOfDay} onValueChange={setTimeOfDay}>
          {["Morning", "Afternoon", "Evening", "Late Night"].map((slot) => (
            <div key={slot} className="flex items-center space-x-2">
              <RadioGroupItem value={slot} id={slot} />
              <Label htmlFor={slot} className="text-white">{slot}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div>
        <h3 className="text-md font-semibold mb-2">🗣️ Language</h3>
        {["English", "Spanish", "French", "Korean"].map((lang) => (
          <div key={lang} className="flex items-center gap-2">
            <Checkbox
              id={lang}
              checked={selectedLanguages.includes(lang)}
              onCheckedChange={() => toggleLanguage(lang)}
            />
            <Label htmlFor={lang} className="text-white">{lang}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}