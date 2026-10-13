import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/yeti/api';

interface Constraint {
  id: string;
  name: string;
  category: 'labor_law' | 'medical_safety' | 'ergonomics' | 'data_privacy' | 'economics';
  type: 'Hard_Must' | 'Hard_Must_Not' | 'Soft_Prefer' | 'Soft_Avoid';
  description: string;
  target_roles: string[];
  evaluation_logic: {
    condition: string;
    penalty_score?: number;
    exceptions?: Array<{ condition: string; reason: string }>;
  };
  ui_visibility: boolean;
  user_editable: boolean;
  enabled: boolean;
}

const CATEGORY_NAMES: Record<string, string> = {
  all: 'Alle Domänen',
  labor_law: '01 Arbeitsrecht (ArbZG)',
  medical_safety: '02 Medizin & Hygiene',
  ergonomics: '03 Ergonomie & Workflow',
  data_privacy: '04 Datenschutz (DSGVO)',
  economics: '05 Wirtschaftlichkeit',
};

export const EngineConstraints: React.FC = () => {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchConstraints = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/engine/constraints`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setConstraints(json.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Constraints:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConstraints();
  }, [fetchConstraints]);

  const handleToggleEnabled = (id: string) => {
    setConstraints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handlePenaltyChange = (id: string, newPenalty: number) => {
    setConstraints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              evaluation_logic: {
                ...c.evaluation_logic,
                penalty_score: newPenalty,
              },
            }
          : c
      )
    );
  };

  const filtered = constraints.filter((c) => {
    const matchesCategory = activeCategory === 'all' || c.category === activeCategory;
    const matchesSearch =
      searchTerm.trim() === '' ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const hardCount = constraints.filter((c) => c.type.startsWith('Hard_')).length;
  const softCount = constraints.filter((c) => c.type.startsWith('Soft_')).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Kopfbereich */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-stone-900 text-stone-50">
              Regelwerk-Registry
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
              5 Fachdomänen
            </span>
          </div>
          <h1 className="text-3xl font-serif text-stone-900 tracking-tight">
            Richtlinien- &amp; Constraint-Manager
          </h1>
          <p className="text-stone-500 text-sm mt-1 max-w-2xl">
            Zentrale Konfiguration für rechtliche Mindeststandards (Hard Constraints) und betriebliche Optimierungsziele (Soft Constraints).
          </p>
        </div>

        {/* Status-Kacheln */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-stone-100 border border-stone-200 text-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block">
              Hard Constraints
            </span>
            <span className="text-base font-serif font-bold text-stone-900">
              {hardCount} aktiv
            </span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-stone-100 border border-stone-200 text-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block">
              Soft Constraints
            </span>
            <span className="text-base font-serif font-bold text-stone-900">
              {softCount} gewichtet
            </span>
          </div>
        </div>
      </div>

      {/* Filterleiste & Schnellsuche */}
      <div className="bg-white/80 backdrop-blur-2xl p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Kategorie-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium whitespace-nowrap transition-all ${
                activeCategory === key
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'bg-stone-100/70 hover:bg-stone-200/70 text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Suche */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Regel oder ID suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-1.5 rounded-xl bg-stone-100/70 border border-stone-200 text-xs font-mono text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-900"
          />
        </div>
      </div>

      {/* Constraint-Liste */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 font-mono text-sm">
          Lade Regelwerk...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/70 rounded-3xl border border-stone-200 text-stone-400 text-sm">
          Keine passenden Constraints gefunden.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isHard = item.type.startsWith('Hard_');

            return (
              <div
                key={item.id}
                className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Obere Badge-Leiste */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                        {item.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                          isHard
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`}
                      >
                        {isHard ? 'Hard Constraint (Unverhandelbar)' : 'Soft Constraint (Penalty)'}
                      </span>
                    </div>

                    {/* Aktivierungs-Schalter */}
                    <button
                      type="button"
                      disabled={isHard} // Hard Constraints dürfen niemals deaktiviert werden
                      onClick={() => handleToggleEnabled(item.id)}
                      className={`text-xs font-mono px-2.5 py-1 rounded-xl transition-all ${
                        item.enabled
                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                          : 'bg-stone-100 text-stone-400'
                      } ${isHard ? 'cursor-not-allowed opacity-90' : 'hover:opacity-80 active:scale-95'}`}
                      title={isHard ? 'Hard Constraints sind gesetzlich fest verankert' : 'Aktivieren / Deaktivieren'}
                    >
                      {item.enabled ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>

                  {/* Titel & Beschreibung */}
                  <h3 className="text-base font-serif font-semibold text-stone-900 leading-snug">
                    {item.name}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Zielrollen */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold">
                      Gilt fuer:
                    </span>
                    {item.target_roles.map((role, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200"
                      >
                        {role}
                      </span>
                    ))}
                  </div>

                  {/* Formale Bedingung */}
                  <div className="mt-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 font-mono text-[11px] text-stone-700">
                    <span className="text-stone-400 block text-[9px] uppercase tracking-wider mb-0.5">
                      Pruefbedingung (DSL):
                    </span>
                    <code>{item.evaluation_logic.condition}</code>
                  </div>
                </div>

                {/* Unterer Penalty-Bereich (nur bei Soft Constraints editierbar) */}
                {!isHard && item.user_editable && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-stone-500">Penalty-Gewichtung:</span>
                      <span className="font-bold text-stone-900">
                        +{item.evaluation_logic.penalty_score || 0} Pkt
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={1000}
                      step={50}
                      value={item.evaluation_logic.penalty_score || 0}
                      onChange={(e) => handlePenaltyChange(item.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-stone-400 mt-0.5">
                      <span>Niedrig (50)</span>
                      <span>Mittel (500)</span>
                      <span>Hoch (1000)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
