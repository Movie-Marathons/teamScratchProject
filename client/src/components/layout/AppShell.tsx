// src/components/layout/AppShell.tsx
import { ReactNode } from "react";
import SidebarPosters from "./PosterAside";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden max-w-full">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow">
        <h1 className="text-xl font-semibold">🎬 Movie Browser</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 bg-slate-800 text-white p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">Filters</h2>
          <p className="text-sm text-slate-300">Genre, date, etc.</p>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50 min-w-0">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="w-60 bg-slate-200 p-4 overflow-y-auto">
         <h2 className="text-lg font-bold mb-2">Now Playing</h2>
          <SidebarPosters />
        </aside>
      </div>
    </div>
  );
}