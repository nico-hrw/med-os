import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { PluginRouteGuard } from './components/PluginRouteGuard';
import { Dashboard } from './pages/Dashboard';
import { TopologyMap } from './pages/TopologyMap';
import { PluginManager } from './pages/PluginManager';
import { PatientOnboarding } from './pages/PatientOnboarding';
import { ReceptionDashboard } from './pages/ReceptionDashboard';
import { EventProvider } from './context/EventContext';

export const AppContent: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#FAFAF9] text-stone-800 font-sans selection:bg-stone-200 overflow-hidden">
      {/* Mobile Top Header (nur auf kleinen Bildschirmen sichtbar) */}
      <header className="md:hidden flex items-center justify-between px-5 py-3.5 bg-white/80 backdrop-blur-xl border-b border-stone-200/70 z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center text-sm font-semibold">
            Y
          </div>
          <div>
            <h1 className="text-base font-serif font-semibold text-stone-900 leading-none">
              MedOS Yeti
            </h1>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-mono font-semibold">
              Core System
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Navigation öffnen"
          className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center text-lg transition-all"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 md:hidden transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onItemClick={() => setMobileOpen(false)} />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar />
      </div>

      {/* Hauptinhalt mit responsivem Padding */}
      <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/topology" element={<TopologyMap />} />
          <Route path="/plugins" element={<PluginManager />} />
          <Route
            path="/patient"
            element={
              <PluginRouteGuard pluginId="patient-onboarding" pluginTitle="Patientenaufnahme">
                <PatientOnboarding />
              </PluginRouteGuard>
            }
          />
          <Route
            path="/reception"
            element={
              <PluginRouteGuard pluginId="patient-onboarding" pluginTitle="Empfangs-Dashboard">
                <ReceptionDashboard />
              </PluginRouteGuard>
            }
          />
          {/* Fallback für unbekannte Routen verhindert weiße Seiten */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router basename="/yeti">
      <EventProvider>
        <AppContent />
      </EventProvider>
    </Router>
  );
};

