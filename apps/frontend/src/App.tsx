import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TopologyMap } from './pages/TopologyMap';

export const App: React.FC = () => {
  return (
    <Router>
      {/* Creme-Weißer Hintergrund, weiche Textfarbe */}
      <div className="flex h-screen w-full bg-[#FAFAF9] text-stone-800 font-sans selection:bg-stone-200">
        <Sidebar />
        <main className="flex-1 h-full overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/topology" element={<TopologyMap />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};
