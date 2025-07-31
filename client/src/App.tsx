import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
// src/App.tsx
import AppShell from "./components/layout/AppShell";
import LocationSearch from "./components/ui/LocationSearch";

function App() {
  return (
    <AppShell>
      <div className="text-center text-gray-600">
        <LocationSearch />
      </div>
    </AppShell>
  );
}

export default App;
