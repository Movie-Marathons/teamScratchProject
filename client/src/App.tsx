import { useState } from 'react';
import './App.css';

import { Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppShell from './components/layout/AppShell';
import LocationSearch from './components/ui/LocationSearch';
import TheaterGrid from './components/layout/TheaterGrid';
import PlannerPage from './components/layout/PlannerPage';
import LandmarksPage from './components/layout/LandmarksPage';

function App() {
  const [searchParams, setSearchParams] = useState<{
    zip: string;
    date: Date | undefined;
    time: string;
  } | null>(null);

  const handleSearch = (params: {
    zip: string;
    date: Date | undefined;
    time: string;
  }) => {
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
              <Link
                to="/landmarks"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow transition text-sm"
              >
                Take a break and explore the area?
              </Link>
              <TheaterGrid
                searchParams={searchParams}
                filters={{ genres: [], timeOfDay: '', languages: [] }}
              />
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
      <Route
        path="/landmarks"
        element={
          <AppShell>
            <Toaster richColors position="top-right" />
            <LandmarksPage />
          </AppShell>
        }
      />
    </Routes>
  );
}

export default App;
