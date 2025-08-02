import { useState } from "react";
import "./App.css";

import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import AppShell from "./components/layout/AppShell";
import LocationSearch from "./components/ui/LocationSearch";
import TheaterGrid from "./components/layout/TheaterGrid";
import PlannerPage from "./components/layout/PlannerPage";

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
    <Routes>
      <Route
        path="/"
        element={
          <AppShell>
            <Toaster richColors position="top-right" />
            <div className="flex flex-col gap-8">
              <LocationSearch onSearch={handleSearch} />
              <TheaterGrid searchParams={searchParams} />
            </div>
          </AppShell>
        }
      />
      <Route
        path="/planner"
        element={
          <AppShell>
            <Toaster richColors position="top-right" />
            <PlannerPage />
          </AppShell>
        }
      />
    </Routes>
  );
}

export default App;