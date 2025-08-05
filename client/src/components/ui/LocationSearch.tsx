"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

type Props = {
  onSearch: (params: { zip: string; date: Date | undefined; time: string }) => void;
};

export default function LocationSearch({ onSearch }: Props) {
  const [zip, setZip] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>();
  const [open, setOpen] = React.useState(false);
  const [time, setTime] = React.useState("08:00");

  const handleSearch = () => {
    if (!zip || !date || !time) return;
    onSearch({ zip, date, time });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-center text-gray-800">
        Search Theaters by ZIP, Date & Time
      </h2>

      <div className="flex flex-wrap gap-6 justify-center items-end">
        {/* ZIP input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="zip" className="px-1">ZIP</Label>
          <Input
            id="zip"
            placeholder="Enter Zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-40"
          />
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="date-picker" className="px-1">Date</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="date-picker"
                className="w-40 justify-between font-normal"
              >
                {date ? date.toLocaleDateString() : "Select date"}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                captionLayout="dropdown"
                onSelect={(date) => {
                  setDate(date);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="time-picker" className="px-1">Time</Label>
          <Input
            type="time"
            id="time-picker"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step="1800"
            className="w-36 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>

        {/* Submit */}
        <Button onClick={handleSearch}>Search</Button>
      </div>
    </div>
  );
}