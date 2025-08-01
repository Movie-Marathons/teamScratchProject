import { useState } from "react";
import "./App.css";

import AppShell from "./components/layout/AppShell";
import LocationSearch from "./components/ui/LocationSearch";
import TheaterGrid from "./components/layout/TheaterGrid";

function App() {
  const [searchParams, setSearchParams] = useState<{
    zip: string;
    date: Date | undefined;
    time: string;
  } | null>(null);

  const handleSearch = (params: { zip: string; date: Date | undefined; time: string }) => {
    setSearchParams(params);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <LocationSearch onSearch={handleSearch} />
        <TheaterGrid searchParams={searchParams} />
      </div>
    </AppShell>
  );
}

export default App;