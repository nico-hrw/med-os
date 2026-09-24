import React from 'react';
import { Link } from 'react-router-dom';
import { useKernelEvents } from '../context/EventContext';

interface PluginRouteGuardProps {
  pluginId: string;
  pluginTitle: string;
  children: React.ReactNode;
}

export const PluginRouteGuard: React.FC<PluginRouteGuardProps> = ({
  pluginId,
  pluginTitle,
  children,
}) => {
  const { isPluginActive } = useKernelEvents();
  const active = isPluginActive(pluginId);

  if (!active) {
    return (
      <div className="max-w-2xl mx-auto my-auto py-16 px-4">
        <div className="
          bg-white/80 backdrop-blur-2xl
          border border-stone-200/80
          rounded-3xl p-8 sm:p-12 text-center
          shadow-[0_8px_30px_rgba(0,0,0,0.04)]
        ">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 text-3xl flex items-center justify-center mx-auto mb-6 shadow-xs">
            🧩
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-100/70 border border-amber-200/60 text-amber-800 text-xs font-mono font-semibold uppercase tracking-wider mb-3">
            Modul nicht aktiv
          </div>

          <h2 className="text-3xl font-serif text-stone-900 mb-3 tracking-tight">
            {pluginTitle}
          </h2>

          <p className="text-stone-600 text-sm sm:text-base leading-relaxed mb-8 max-w-lg mx-auto">
            Diese Ansicht benötigt das Modul <code className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-mono text-xs sm:text-sm">{pluginId}</code>. 
            Das Plugin ist derzeit im Microkernel deinstalliert oder deaktiviert.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/plugins"
              className="
                w-full sm:w-auto px-6 py-3 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-sm font-semibold shadow-lg shadow-stone-900/15
                transition-all duration-150 active:scale-95 flex items-center justify-center gap-2
              "
            >
              <span>🛒</span>
              <span>Im Plugin-Store installieren</span>
            </Link>

            <Link
              to="/"
              className="
                w-full sm:w-auto px-6 py-3 rounded-2xl
                bg-stone-100 hover:bg-stone-200 text-stone-700
                text-sm font-medium transition-all duration-150
                flex items-center justify-center gap-2
              "
            >
              <span>Dashboard</span>
              <span>↗</span>
            </Link>
          </div>

          <p className="text-stone-400 text-xs mt-8">
            Das MedOS Hot-Swapping-System registriert und lädt Routen sofort ohne Server-Neustart, sobald das Modul aktiviert wird.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
