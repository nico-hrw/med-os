import React, { useEffect, useState, useCallback } from 'react';

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
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

  // SSE für Echtzeit-Updates (Install Progress, Plugin Load/Unload)
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
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
          } else if (data.action === 'LOAD') {
            // Ein Plugin wurde aktiviert — Liste aktualisieren
            fetchPlugins();
          }
        }
      } catch (err) {
        console.error('SSE Parse-Fehler:', err);
      }
    };

    return () => eventSource.close();
  }, [fetchPlugins]);

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
        <div className="grid gap-6">
          {plugins.map((plugin) => {
            const progress = installing[plugin.name];
            const error = errors[plugin.name];
            const isInstalling = !!progress;
            const isInstalled = plugin.installed;

            return (
              <div
                key={plugin.name}
                className="
                  relative overflow-hidden
                  bg-gradient-to-br from-white/70 to-white/40
                  backdrop-blur-xl
                  border border-stone-200/50
                  rounded-2xl
                  shadow-[0_4px_24px_rgba(0,0,0,0.03)]
                  transition-all duration-300
                  hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]
                  hover:border-stone-300/60
                "
              >
                {/* Progress bar — positioned at the very bottom of the card */}
                {isInstalling && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-100">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}

                <div className="p-8 flex items-start gap-6">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200/50 flex items-center justify-center text-2xl shadow-sm">
                    {plugin.icon || '🧩'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-stone-800 tracking-tight">
                        {plugin.name}
                      </h3>
                      <span className="text-xs font-mono text-stone-400 bg-stone-100/80 px-2 py-0.5 rounded-full">
                        v{plugin.version}
                      </span>
                      {plugin.category && (
                        <span className="text-xs text-stone-500 bg-stone-100/50 px-2.5 py-0.5 rounded-full border border-stone-200/30">
                          {plugin.category}
                        </span>
                      )}
                    </div>

                    <p className="text-stone-500 text-sm leading-relaxed mb-1">
                      {plugin.description || 'Keine Beschreibung verfügbar.'}
                    </p>

                    {plugin.author && (
                      <p className="text-xs text-stone-400">
                        von <span className="font-medium">{plugin.author}</span>
                      </p>
                    )}

                    {/* Progress message */}
                    {isInstalling && progress.message && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-sm text-emerald-700 font-medium">
                          {progress.message}
                        </span>
                        <span className="text-xs text-stone-400 ml-auto tabular-nums">
                          {progress.percent}%
                        </span>
                      </div>
                    )}

                    {/* Error message */}
                    {error && (
                      <div className="mt-3 px-3 py-2 bg-red-50/80 border border-red-200/50 rounded-xl">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="flex-shrink-0 ml-4">
                    {isInstalled ? (
                      <span className="
                        inline-flex items-center gap-1.5
                        px-5 py-2.5 rounded-xl
                        bg-emerald-50 text-emerald-700
                        border border-emerald-200/50
                        text-sm font-semibold
                        cursor-default
                      ">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Aktiv
                      </span>
                    ) : isInstalling ? (
                      <span className="
                        inline-flex items-center gap-1.5
                        px-5 py-2.5 rounded-xl
                        bg-stone-100 text-stone-400
                        border border-stone-200/50
                        text-sm font-semibold
                        cursor-wait
                      ">
                        Installiert...
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstall(plugin.name)}
                        className="
                          px-5 py-2.5 rounded-xl
                          bg-stone-900 text-stone-50
                          text-sm font-semibold
                          shadow-lg shadow-stone-900/15
                          hover:bg-stone-800
                          hover:shadow-xl hover:shadow-stone-900/20
                          active:scale-[0.97]
                          transition-all duration-200
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
    </div>
  );
};
