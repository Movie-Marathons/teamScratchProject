// src/components/layout/AppShell.tsx
import { type ReactNode } from 'react';
import SidebarPosters from './PosterAside';
// import LandmarksPage from './LandmarksPage';

// <div>
//   <LandmarksPage />
// </div>
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden max-w-full bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white text-center">
        <img
          src="/movie-marathon-logo.png"
          alt="Movie Marathon Logo"
          className="h-16 inline-block align-middle"
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 bg-slate-800 text-white p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">Goblin-Sharks</h2>
          <h2 className="text-lg font-bold mb-2">Iteration</h2>
          <h2 className="text-lg font-bold mb-2">Cat-Snakes</h2>
          <p className="text-sm text-slate-300">
            Paython, Cris, Victoria, Lorenc.
          </p>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-4 bg-transparent min-w-0">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="w-60 bg-slate-800 text-white p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-2 text-white">Now Playing</h2>
          <SidebarPosters />
        </aside>
      </div>
    </div>
  );
}
