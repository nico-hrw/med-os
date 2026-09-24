import React from 'react';
import { useKernelEvents } from '../context/EventContext';

export const Dashboard: React.FC = () => {
  const { activeModules } = useKernelEvents();

  return (
    <div className="max-w-5xl mx-auto mt-4">
      <header className="mb-10">
        <h2 className="text-4xl font-serif text-stone-900 mb-2">Stationsübersicht</h2>
        <p className="text-stone-500 text-lg">Zentrale Systemmetriken und Modulstatus.</p>
      </header>

      {/* Große Willkommens-Kachel mit sanftem, warmen Gradienten */}
      <section className="bg-gradient-to-br from-[#fdfbf6] to-[#f4f0e6] p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#eae5d9]">
        <h3 className="text-3xl font-serif font-medium text-stone-800 mb-4">
          Explore your performance
        </h3>
        <p className="text-stone-600 max-w-xl leading-relaxed mb-8">
          Überwachen Sie Lebenserhaltungssysteme, Netzwerk-Latenzen und kritische Plugin-Ressourcen in Echtzeit. 
          Die modulare Architektur gewährleistet redundante Ausfallsicherheit.
        </p>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/40">
            <span className="text-sm text-stone-500 font-semibold tracking-wide uppercase">Aktive Module</span>
            <p className="text-3xl font-serif text-stone-800 mt-2">{activeModules}</p>
          </div>
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/40">
            <span className="text-sm text-stone-500 font-semibold tracking-wide uppercase">Systemlatenz</span>
            <p className="text-3xl font-serif text-stone-800 mt-2">4.2 ms</p>
          </div>
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/40">
            <span className="text-sm text-stone-500 font-semibold tracking-wide uppercase">Isolations-Status</span>
            <p className="text-3xl font-serif text-green-700 mt-2">Stabil</p>
          </div>
        </div>
      </section>
    </div>
  );
};
