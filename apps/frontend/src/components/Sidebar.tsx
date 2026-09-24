import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useKernelEvents } from '../context/EventContext';

interface SidebarProps {
  onItemClick?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onItemClick, className = '' }) => {
  const { isPluginActive } = useKernelEvents();
  const location = useLocation();

  const isPatientOnboardingActive = isPluginActive('patient-onboarding');

  const getLinkClasses = (path: string) => {
    const isActive = location.pathname === path;
    return `px-4 py-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2.5 ${
      isActive
        ? 'bg-stone-900 text-stone-50 shadow-sm'
        : 'text-stone-700 hover:bg-stone-100/70 hover:text-stone-900'
    }`;
  };

  return (
    <aside className={`w-72 h-full p-6 flex flex-col bg-white/70 backdrop-blur-2xl border-r border-stone-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${className}`}>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight text-stone-900">
            MedOS Yeti
          </h1>
          <p className="text-xs text-stone-400 mt-0.5 uppercase tracking-widest font-semibold font-mono">
            Core System
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold px-4 mb-1">
          System
        </span>
        <Link 
          to="/" 
          onClick={onItemClick}
          className={getLinkClasses('/')}
        >
          <span>📊</span>
          <span>Dashboard</span>
        </Link>
        <Link 
          to="/plugins" 
          onClick={onItemClick}
          className={getLinkClasses('/plugins')}
        >
          <span>🧩</span>
          <span>Plugin-Store</span>
        </Link>

        {/* Klinische Module: Nur anzeigen, wenn das entsprechende Plugin aktiv ist */}
        {isPatientOnboardingActive && (
          <>
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold px-4 mt-5 mb-1 flex items-center justify-between">
              <span>Klinische Module</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            <Link 
              to="/patient" 
              onClick={onItemClick}
              className={getLinkClasses('/patient')}
            >
              <span>🏥</span>
              <span>Patientenaufnahme</span>
            </Link>
            <Link 
              to="/reception" 
              onClick={onItemClick}
              className={getLinkClasses('/reception')}
            >
              <span>📋</span>
              <span>Empfangs-Dashboard</span>
            </Link>
          </>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-stone-100">
        <Link 
          to="/topology" 
          onClick={onItemClick}
          className="block w-full text-center px-4 py-3 rounded-2xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-all shadow-md shadow-stone-900/10 active:scale-[0.98]"
        >
          System-Topologie (Doku)
        </Link>
      </div>
    </aside>
  );
};
