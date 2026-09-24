import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useKernelEvents } from '../context/EventContext';

interface PluginRoute {
  name: string;
  path: string;
}

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  dependencies?: { id: string; name: string }[];
  routes?: PluginRoute[];
  installed: boolean;
}

interface InstallProgress {
  message: string;
  percent: number;
}

const API_BASE = '/yeti/api';

export const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<Record<string, InstallProgress | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);
  const [keepData, setKeepData] = useState<boolean>(true);
  const [uninstalling, setUninstalling] = useState<boolean>(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginManifest | null>(null);

  // Verfügbare Plugins laden
  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/plugins/available`);
      const json = await res.json();
      if (json.success) {
        setPlugins(json.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  // SSE für Echtzeit-Updates (Install Progress, Plugin Load/Unload, Uninstall)
  useKernelEvents(useCallback((data: any) => {
    if (data.type === 'PLUGIN_UPDATE') {
      if (data.action === 'INSTALL_PROGRESS') {
        setInstalling(prev => ({
          ...prev,
          [data.plugin]: { message: data.message, percent: data.percent },
        }));
      } else if (data.action === 'INSTALL_COMPLETE') {
        // Installation abgeschlossen — kurz den Fortschrittsbalken bei 100% zeigen
        setInstalling(prev => ({
          ...prev,
          [data.plugin]: { message: data.message, percent: 100 },
        }));
        // Nach kurzer Verzögerung aufräumen und Plugin-Liste aktualisieren
        setTimeout(() => {
          setInstalling(prev => {
            const next = { ...prev };
            delete next[data.plugin];
            return next;
          });
          fetchPlugins();
        }, 1500);
      } else if (data.action === 'INSTALL_ERROR') {
        setErrors(prev => ({ ...prev, [data.plugin]: data.error }));
        setInstalling(prev => {
          const next = { ...prev };
          delete next[data.plugin];
          return next;
        });
      } else if (data.action === 'LOAD' || data.action === 'UNLOAD' || data.action === 'UNINSTALL_COMPLETE') {
        // Plugin-Status hat sich geändert — Liste aktualisieren
        fetchPlugins();
      }
    }
  }, [fetchPlugins]));

  // Plugin installieren
  const handleInstall = async (pluginId: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[pluginId];
      return next;
    });
    setInstalling(prev => ({
      ...prev,
      [pluginId]: { message: 'Starte Installation...', percent: 0 },
    }));

    try {
      await fetch(`${API_BASE}/system/plugins/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId }),
      });
    } catch (err) {
      console.error('Fehler beim Starten der Installation:', err);
      setErrors(prev => ({ ...prev, [pluginId]: 'Netzwerkfehler beim Starten der Installation.' }));
      setInstalling(prev => {
        const next = { ...prev };
        delete next[pluginId];
        return next;
      });
    }
  };

  // Plugin deinstallieren
  const handleConfirmUninstall = async () => {
    if (!uninstallTarget) return;
    const pluginId = uninstallTarget.name;
    setUninstalling(true);

    try {
      const res = await fetch(`${API_BASE}/system/plugins/uninstall`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId, keepData }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fehler beim Deinstallieren');
      }
      setUninstallTarget(null);
      await fetchPlugins();
    } catch (err: any) {
      console.error('Fehler beim Deinstallieren:', err);
      setErrors(prev => ({ ...prev, [pluginId]: err.message || 'Deinstallation fehlgeschlagen.' }));
      setUninstallTarget(null);
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-4">
      <header className="mb-10">
        <h2 className="text-4xl font-serif text-stone-900 mb-2">Plugin Store</h2>
        <p className="text-stone-500 text-lg">
          Erweitern Sie MedOS Yeti mit modularen Funktionsbausteinen.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      ) : plugins.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-stone-200/50 p-12 text-center">
          <p className="text-stone-500 text-lg">Keine Plugins verfügbar.</p>
          <p className="text-stone-400 text-sm mt-2">
            Legen Sie Plugin-Vorlagen in <code className="bg-stone-100 px-2 py-0.5 rounded text-xs">plugins-available/</code> ab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plugins.map((plugin) => {
            const progress = installing[plugin.name];
            const error = errors[plugin.name];
            const isInstalling = !!progress;
            const isInstalled = plugin.installed;

            return (
              <div
                key={plugin.name}
                onClick={() => setSelectedPlugin(plugin)}
                className="
                  relative overflow-hidden
                  bg-gradient-to-br from-white/80 to-white/50
                  backdrop-blur-xl
                  border border-stone-200/60 hover:border-stone-300
                  rounded-3xl
                  h-[260px] p-6
                  flex flex-col justify-between
                  shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)]
                  transition-all duration-200 cursor-pointer group select-none
                "
              >
                {/* Progress bar at top edge */}
                {isInstalling && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-stone-100">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}

                {/* Card Top / Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100/90 border border-stone-200/60 flex items-center justify-center text-2xl flex-shrink-0 shadow-xs">
                      {plugin.icon || '🧩'}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                        v{plugin.version}
                      </span>
                      {plugin.category && (
                        <span className="text-[10px] text-stone-600 bg-stone-100/70 px-2 py-0.5 rounded-full border border-stone-200/40">
                          {plugin.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-stone-900 group-hover:text-stone-950 tracking-tight truncate">
                    {plugin.name}
                  </h3>

                  {/* Kurze 2-zeilige Beschreibung */}
                  <p className="text-stone-500 text-xs leading-relaxed mt-2 line-clamp-2">
                    {plugin.description || 'Keine Beschreibung verfügbar.'}
                  </p>

                  {/* Fehleranzeige inline */}
                  {error && (
                    <p className="text-[11px] text-red-600 mt-1.5 truncate">
                      ⚠️ {error}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-stone-200/50 flex items-center justify-between mt-auto">
                  <div className="text-[11px] text-stone-400 font-medium flex items-center gap-1">
                    {plugin.routes && plugin.routes.length > 0 ? (
                      <span className="text-stone-500">📍 {plugin.routes.length} Route{plugin.routes.length > 1 ? 'n' : ''}</span>
                    ) : (
                      <span>Details ↗</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isInstalled ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Aktiv
                      </span>
                    ) : isInstalling ? (
                      <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2.5 py-1 rounded-xl">
                        {progress.percent}%
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstall(plugin.name)}
                        className="
                          px-3.5 py-1.5 rounded-xl
                          bg-stone-900 text-stone-50 text-xs font-semibold
                          shadow-md shadow-stone-900/10 hover:bg-stone-800
                          active:scale-95 transition-all
                        "
                      >
                        Installieren
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Von rechts einfliegende Detail-Seite (Slide-over Drawer) */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/25 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedPlugin(null)}
          />

          {/* Slide-in Panel */}
          <div className="
            relative w-full max-w-lg bg-white/95 backdrop-blur-2xl
            border-l border-stone-200/80 shadow-2xl h-full p-8 overflow-y-auto
            flex flex-col z-50 animate-in slide-in-from-right duration-300
          ">
            <button
              onClick={() => setSelectedPlugin(null)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>

            <div className="flex items-start gap-4 mb-6 mt-2">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-3xl shadow-xs flex-shrink-0">
                {selectedPlugin.icon || '🧩'}
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold font-mono block">
                  Plugin Spezifikation
                </span>
                <h2 className="text-2xl font-serif text-stone-900 tracking-tight mt-0.5 truncate">
                  {selectedPlugin.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    v{selectedPlugin.version}
                  </span>
                  {selectedPlugin.category && (
                    <span className="text-xs text-stone-600 bg-stone-100/70 px-2 py-0.5 rounded-full border border-stone-200">
                      {selectedPlugin.category}
                    </span>
                  )}
                  {selectedPlugin.author && (
                    <span className="text-xs text-stone-400">
                      von <span className="text-stone-700 font-medium">{selectedPlugin.author}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Vollständige Beschreibung */}
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-2 font-mono">
                Funktionsumfang & Beschreibung
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-line bg-stone-50/70 p-5 rounded-2xl border border-stone-200/60">
                {selectedPlugin.description || 'Keine Beschreibung verfügbar.'}
              </p>
            </div>

            {/* Bereitgestellte Routen mit Links */}
            {selectedPlugin.routes && selectedPlugin.routes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-2.5 font-mono">
                  Bereitgestellte Routen & Oberflächen
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedPlugin.routes.map((route, idx) => (
                    <Link
                      key={idx}
                      to={route.path.startsWith('/yeti') ? route.path.replace(/^\/yeti/, '') || '/' : route.path}
                      onClick={() => setSelectedPlugin(null)}
                      className="
                        flex items-center justify-between p-3.5 rounded-2xl
                        bg-stone-50 hover:bg-stone-100 border border-stone-200/70
                        transition-all group
                      "
                    >
                      <div className="flex items-center gap-2.5">
                        <span>📍</span>
                        <span className="text-sm font-semibold text-stone-800 group-hover:text-stone-950">
                          {route.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-stone-500 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                        {route.path} ↗
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Abhängigkeiten */}
            {selectedPlugin.dependencies && selectedPlugin.dependencies.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-2 font-mono">
                  System-Abhängigkeiten
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPlugin.dependencies.map((dep, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-xl border border-stone-200 flex items-center gap-1.5"
                    >
                      <span>🔗</span>
                      <span className="font-medium">{dep.name || dep.id}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Aktionen im Drawer Footer */}
            <div className="mt-auto pt-6 border-t border-stone-200 flex items-center justify-between gap-4">
              {selectedPlugin.installed ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Dieses Modul ist aktiv
                  </span>
                  <button
                    onClick={() => {
                      setUninstallTarget(selectedPlugin);
                      setKeepData(true);
                      setSelectedPlugin(null);
                    }}
                    className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-all"
                  >
                    Deinstallieren
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleInstall(selectedPlugin.name);
                    setSelectedPlugin(null);
                  }}
                  className="
                    w-full py-3 rounded-2xl
                    bg-stone-900 hover:bg-stone-800 text-stone-50
                    font-semibold text-sm shadow-lg shadow-stone-900/15
                    transition-all active:scale-[0.98]
                  "
                >
                  Modul jetzt installieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Soft Uninstall Bestätigungsdialog (Glassmorphism) */}
      {uninstallTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-sm">
          <div className="
            relative w-full max-w-md
            bg-white/95 backdrop-blur-2xl
            border border-stone-200/80
            rounded-3xl shadow-2xl
            p-7 flex flex-col gap-5
          ">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-xl flex-shrink-0">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-stone-900 tracking-tight">
                  Plugin deinstallieren
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  Möchten Sie das Modul <span className="font-semibold text-stone-700">{uninstallTarget.name}</span> wirklich entfernen?
                </p>
              </div>
            </div>

            <div className="bg-stone-50/90 border border-stone-200/60 rounded-2xl p-4 flex flex-col gap-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepData}
                  onChange={(e) => setKeepData(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                />
                <div className="text-xs leading-relaxed text-stone-600">
                  <span className="font-medium text-stone-800 block mb-0.5">
                    Patientendaten im System behalten (Soft Uninstall)
                  </span>
                  Möchten Sie die mit diesem Plugin verknüpften Patientendaten behalten? Falls deaktiviert, werden verknüpfte Tabelleneinträge bereinigt.
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUninstallTarget(null)}
                disabled={uninstalling}
                className="
                  px-4 py-2.5 rounded-xl
                  text-stone-600 hover:text-stone-900
                  hover:bg-stone-100 text-sm font-medium
                  transition-colors
                "
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmUninstall}
                disabled={uninstalling}
                className="
                  px-5 py-2.5 rounded-xl
                  bg-stone-900 hover:bg-stone-800
                  text-stone-50 text-sm font-semibold
                  shadow-lg shadow-stone-900/15
                  transition-all active:scale-[0.98]
                  disabled:opacity-50
                "
              >
                {uninstalling ? 'Wird deinstalliert...' : 'Deinstallieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
