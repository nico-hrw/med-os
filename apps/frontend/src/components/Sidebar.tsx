import React from 'react';
import { Link } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    /* Glassmorphism: Transluzenter Hintergrund, weicher Schatten, subtiler Border */
    <aside className="w-72 h-full p-6 flex flex-col bg-white/60 backdrop-blur-xl border-r border-stone-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="mb-12">
        <h1 className="text-2xl font-serif font-medium tracking-tight text-stone-900">
          MedOS Yeti
        </h1>
        <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-semibold">
          Core System
        </p>
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold px-4 mb-1">
          System
        </span>
        <Link 
          to="/" 
          className="px-4 py-2.5 rounded-xl hover:bg-stone-100/60 transition-colors text-stone-700 font-medium text-sm flex items-center gap-2.5"
        >
          <span>📊</span>
          <span>Dashboard</span>
        </Link>
        <Link 
          to="/plugins" 
          className="px-4 py-2.5 rounded-xl hover:bg-stone-100/60 transition-colors text-stone-700 font-medium text-sm flex items-center gap-2.5"
        >
          <span>🧩</span>
          <span>Plugin-Store</span>
        </Link>

        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold px-4 mt-4 mb-1">
          Klinische Module
        </span>
        <Link 
          to="/patient" 
          className="px-4 py-2.5 rounded-xl hover:bg-stone-100/60 transition-colors text-stone-700 font-medium text-sm flex items-center gap-2.5"
        >
          <span>🏥</span>
          <span>Patientenaufnahme</span>
        </Link>
        <Link 
          to="/reception" 
          className="px-4 py-2.5 rounded-xl hover:bg-stone-100/60 transition-colors text-stone-700 font-medium text-sm flex items-center gap-2.5"
        >
          <span>📋</span>
          <span>Empfangs-Dashboard</span>
        </Link>
      </nav>

      <div className="mt-auto">
        <Link 
          to="/topology" 
          className="block w-full text-center px-4 py-3 rounded-xl bg-stone-900 text-stone-50 font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20"
        >
          System-Topologie (Doku)
        </Link>
      </div>
    </aside>
  );
};
