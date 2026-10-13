import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { CustomNodeData } from './CustomNode';
import { PLUGIN_ARCHITECTURES, getPluginArchitecture } from './plugin-architecture-definitions';

interface InfoPanelProps {
  nodeData: CustomNodeData | null;
  onClose: () => void;
  onToggleExpand?: (pluginId: string) => void;
  isExpanded?: boolean;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ 
  nodeData, 
  onClose, 
  onToggleExpand,
  isExpanded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ui' | 'api' | 'data' | 'lifecycle'>('overview');

  if (!nodeData) return null;

  const pluginId = nodeData.technicalId || nodeData.pluginId || '';
  const arch = nodeData.isPlugin || nodeData.status === 'component'
    ? getPluginArchitecture(nodeData.pluginId || pluginId, nodeData.label, nodeData.routes)
    : null;

  // Stochastisches Modell für Predictive Scheduling
  const renderSchedulingDetails = () => (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <section>
        <h3 className="text-xl font-serif text-stone-800 mb-3 border-b border-stone-200/60 pb-2">
          Das stochastische Modell (MDP)
        </h3>
        <p className="text-stone-600 font-sans leading-relaxed text-xs mb-4">
          Die Systemauslastung wird als Markov-Entscheidungsprozess (MDP) modelliert. 
          Der Zustandsraum zum Zeitpunkt <InlineMath math="t" /> definiert sich als <InlineMath math="S_t = (P_t, M_t)" />.
        </p>
        
        <div className="bg-white/70 rounded-2xl p-4 border border-stone-200/60 shadow-xs mb-4">
          <BlockMath math="C(S_t, A_t) = \alpha \cdot W(P_t) + \beta \cdot O(M_t)" />
        </div>

        <ul className="space-y-2 text-xs text-stone-600 font-sans bg-stone-50/80 p-4 rounded-xl border border-stone-100">
          <li className="flex items-center gap-3">
            <span className="font-serif italic font-semibold text-stone-800 text-sm w-4 text-center">P</span> 
            wartende Patienten
          </li>
          <li className="flex items-center gap-3">
            <span className="font-serif italic font-semibold text-stone-800 text-sm w-4 text-center">M</span> 
            aktives Personal
          </li>
          <li className="flex items-center gap-3">
            <span className="font-serif italic font-semibold text-stone-800 text-sm w-4 text-center">α</span> 
            Gewichtung der Wartezeit (0.6)
          </li>
          <li className="flex items-center gap-3">
            <span className="font-serif italic font-semibold text-stone-800 text-sm w-4 text-center">β</span> 
            Gewichtung der Überlastung (0.4)
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl font-serif text-stone-800 mb-3 border-b border-stone-200/60 pb-2">
          Bellman-Optimalitätsgleichung
        </h3>
        <p className="text-stone-600 font-sans leading-relaxed text-xs mb-4">
          Minimierung der kumulierten, diskontierten erwarteten Kosten über einen rollierenden Zeithorizont:
        </p>
        
        <div className="bg-white/70 rounded-2xl p-4 border border-stone-200/60 shadow-xs overflow-x-auto text-xs">
          <BlockMath math="V^*(s) = \min_{a \in A} \left( C(s, a) + \gamma \sum_{s'} P(s' | s, a) V^*(s') \right)" />
        </div>
      </section>
    </div>
  );

  // Neuro-symbolisches Planungsmodell für MedOS Engine v2
  const renderEngineDetails = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <section className="bg-stone-50/90 rounded-2xl p-4 border border-stone-200/80">
        <h3 className="text-base font-serif font-bold text-stone-900 mb-2 border-b border-stone-200 pb-1.5 flex items-center justify-between">
          <span>Neuro-Symbolischer 4-Ebenen Ablauf</span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Zero-Violation
          </span>
        </h3>
        <p className="text-stone-600 font-sans text-xs leading-relaxed mb-3">
          Das Plugin kombiniert deterministische mathematische Optimierung mit stochastischen Simulationen und Metaheuristiken für praxissichere Dienst- und Ressourcenpläne:
        </p>

        <div className="space-y-3 text-xs">
          {/* Ebene 1 */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between font-mono font-bold text-stone-900 mb-1">
              <span className="text-indigo-700">[Ebene 1] MILP-Controller (Nativ)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">Simplex / B&amp;B</span>
            </div>
            <p className="text-stone-600 leading-snug">
              2-Phasen Dense Simplex &amp; Branch-and-Bound berechnen ein deterministisches Basisskelett im 15-Minuten-Raster.
            </p>
            <div className="my-2 p-2 bg-stone-50 rounded-lg border border-stone-200/60 overflow-x-auto text-[11px]">
              <BlockMath math="\min \sum_{e,t} c_{start} y_{e,t} + \sum_{r,t} 10^5 \cdot s_{r,t}" />
            </div>
            <ul className="list-disc list-inside text-[11px] text-stone-500 space-y-0.5">
              <li>ArbZG § 3/4: Mindestdauer 4h, Maximaldauer 10h, Ruhezeit &gt;= 11h</li>
              <li>Big-M Notfall-Slack: Bei Personalmangel kontrollierte Unterdeckung statt Abbruch</li>
              <li>Event-Loop Guard: Unterbricht alle 50 Knoten via setImmediate (500ms Timeout)</li>
            </ul>
          </div>

          {/* Ebene 2 */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between font-mono font-bold text-stone-900 mb-1">
              <span className="text-sky-700">[Ebene 2] Praediktiver Agent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">Stochastik</span>
            </div>
            <p className="text-stone-600 leading-snug">
              Prognostiziert den Poisson-Patientenzulauf mit stündlichen Profilen und No-Show-Raten.
            </p>
            <div className="my-2 p-2 bg-stone-50 rounded-lg border border-stone-200/60 overflow-x-auto text-[11px]">
              <BlockMath math="\lambda(t) = \lambda_{base} \cdot f_{Monat} \cdot f_{Tag} \cdot \omega(t)" />
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              Morning-Rush Peak (1.85x Last zwischen 08:00 und 10:30 Uhr) und Überhang-Kompensation.
            </p>
          </div>

          {/* Ebene 3 */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between font-mono font-bold text-stone-900 mb-1">
              <span className="text-amber-700">[Ebene 3] Digitaler Zwilling</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">Event-Heap</span>
            </div>
            <p className="text-stone-600 leading-snug">
              Diskrete Ereignissimulation (DES) mit binärem Min-Heap (O(log N)) in unter 5 Millisekunden.
            </p>
            <p className="text-[11px] text-stone-500 mt-1 leading-snug">
              Injektion von Schocks (Notfallwellen 2.0x, Krankmeldungen, Geräteausfälle) und Multi-Day Spillover Memory für Überhänge am Praxisende.
            </p>
          </div>

          {/* Ebene 4 */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between font-mono font-bold text-stone-900 mb-1">
              <span className="text-emerald-700">[Ebene 4] ALNS Metaheuristik</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">Metaheuristik</span>
            </div>
            <p className="text-stone-600 leading-snug">
              Adaptive Large Neighborhood Search mit Destroy/Repair Operatoren und Simulated Annealing:
            </p>
            <div className="my-2 p-2 bg-stone-50 rounded-lg border border-stone-200/60 overflow-x-auto text-[11px]">
              <BlockMath math="P(\text{accept}) = \exp\left(-\frac{\Delta \text{Penalty}}{T}\right)" />
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              Reduziert ergonomische Soft-Penalties (Split-Shifts, Pausenlage) um bis zu 60% ohne Verletzung der Hard-Constraints.
            </p>
          </div>
        </div>
      </section>
    </div>
  );

  // Komponentenspezifische Detailansicht (wenn ein Sub-Knoten im Graph angeklickt wurde)
  const renderComponentView = () => {
    if (!arch) return null;
    const cat = nodeData.componentCategory || 'ui';

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-700 font-semibold">
            {nodeData.parentPluginTitle ? `Komponente von: ${nodeData.parentPluginTitle}` : 'Plugin-Komponente'}
          </span>
          <h3 className="text-xl font-serif text-indigo-950">{nodeData.label}</h3>
          <p className="text-xs text-indigo-900/80 leading-relaxed">{nodeData.description}</p>
        </div>

        {cat === 'ui' && (
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Frontend-Komponenten & Screens</h4>
            <div className="flex flex-col gap-3">
              {arch.ui.components.map((comp, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-stone-200/70 shadow-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-stone-900">{comp.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{comp.role}</span>
                  </div>
                  {comp.file && <div className="text-[10px] font-mono text-stone-400">{comp.file}</div>}
                  <p className="text-xs text-stone-600 leading-relaxed">{comp.details}</p>
                  {comp.routes && comp.routes.length > 0 && (
                    <div className="pt-2 flex gap-2">
                      {comp.routes.map((r, rIdx) => (
                        <Link 
                          key={rIdx} 
                          to={r.startsWith('/yeti') ? r.replace(/^\/yeti/, '') || '/' : r}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                        >
                          <span>Live-Ansicht öffnen ({r})</span>
                          <span>↗</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 p-3.5 bg-stone-50 rounded-xl border border-stone-200/60">
              <h5 className="text-[11px] font-semibold text-stone-700 mb-2">Besondere Merkmale:</h5>
              <ul className="list-disc list-inside text-xs text-stone-600 space-y-1">
                {arch.ui.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {cat === 'api' && (
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Registrierte Microkernel-Endpunkte</h4>
            <div className="flex flex-col gap-2.5">
              {arch.api.endpoints.map((ep, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-stone-200/70 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {ep.method}
                    </span>
                    <span className="font-mono text-[11px] text-stone-800 font-semibold">{ep.path}</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{ep.desc}</p>
                  {ep.params && (
                    <div className="text-[10px] text-stone-500">
                      <span className="font-semibold text-stone-600">Parameter: </span>
                      <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-700">{ep.params}</code>
                    </div>
                  )}
                  {ep.responseSnippet && (
                    <div className="bg-stone-900 text-stone-100 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                      {ep.responseSnippet}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600 border border-stone-200/60">
              <span className="font-semibold text-stone-800">Sicherheitsarchitektur: </span>
              {arch.api.security}
            </div>
          </div>
        )}

        {cat === 'data' && (
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Datenmodell & Persistenz-Schema</h4>
            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
              <span className="font-semibold">Speichertyp: </span>
              {arch.data.storageType}
            </div>
            <div className="flex flex-col gap-2.5">
              {arch.data.schemas.map((sc, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-stone-200/70 shadow-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-800">{sc.keyPattern}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600">{sc.type}</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{sc.purpose}</p>
                  {sc.sample && (
                    <div className="bg-stone-900 text-stone-100 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                      {sc.sample}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600 border border-stone-200/60">
              <span className="font-semibold text-stone-800">Resilienz & Isolierung: </span>
              {arch.data.resilience}
            </div>
          </div>
        )}

        {cat === 'lifecycle' && (
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Lifecycle, Events & Sandboxing</h4>
            <div className="p-3.5 rounded-xl bg-white/80 border border-stone-200/70 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-semibold text-stone-700">Erzeugte SSE-Events (Broadcast):</span>
              <div className="flex flex-wrap gap-1.5">
                {arch.lifecycle.eventsProduced.map((ev, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-semibold border border-emerald-200">
                    ⚡ {ev}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 border border-stone-200/70 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-semibold text-stone-700">Implementierte Lifecycle-Hooks:</span>
              <ul className="space-y-1.5 text-xs text-stone-600">
                {arch.lifecycle.hooks.map((h, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600 border border-stone-200/60">
              <span className="font-semibold text-stone-800">Sandbox-Garantie: </span>
              {arch.lifecycle.sandboxing}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`
        absolute top-0 right-0 h-full w-[30rem] bg-white/85 backdrop-blur-3xl border-l border-white 
        shadow-[-10px_0_40px_rgba(0,0,0,0.06)] transition-transform duration-500 ease-out z-20
        flex flex-col overflow-hidden
      `}
    >
      <div className="p-8 pb-4 flex items-center justify-between border-b border-stone-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-stone-400 font-mono font-semibold">
            {nodeData.status === 'component' ? 'Architektur-Komponente' : 'Modul-Spezifikation'}
          </span>
        </div>
        <button 
          onClick={onClose}
          aria-label="Panel schließen"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors focus:outline-none"
        >
          ✕
        </button>
      </div>

      <div className="p-8 pt-6 flex-1 overflow-y-auto custom-scrollbar">
        {/* Titel-Bereich */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {nodeData.icon && <span className="text-3xl">{nodeData.icon}</span>}
            <div>
              <h2 className="text-2xl font-serif text-stone-900 leading-tight">{nodeData.label}</h2>
              {nodeData.technicalId && (
                <div className="mt-1 font-mono text-[11px] text-stone-400 bg-stone-100/90 px-2 py-0.5 rounded w-fit">
                  ID: {nodeData.technicalId} {nodeData.version ? `(v${nodeData.version})` : ''}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-3 text-stone-600 text-xs font-sans leading-relaxed whitespace-pre-line">
            {nodeData.description}
          </div>
        </div>

        {/* Schnellaktionen für Plugins (Aufklappen / Zuklappen & Store) */}
        {nodeData.isPlugin && (
          <div className="mb-6 p-4 bg-stone-50/90 rounded-2xl border border-stone-200/70 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800">Topologie-Ansicht:</span>
              <button
                type="button"
                onClick={() => onToggleExpand && onToggleExpand(pluginId)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                  transition-all active:scale-95 shadow-xs
                  ${isExpanded
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-stone-900 text-stone-50 hover:bg-stone-800'}
                `}
              >
                <span>{isExpanded ? '▲' : '🔍'}</span>
                <span>{isExpanded ? 'Aufbau auf der Karte einklappen' : 'Aufbau auf der Karte aufklappen'}</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              {isExpanded 
                ? 'Die 4 Sub-Komponenten (UI, API, Daten, Lifecycle) sind aktuell im Graphen sichtbar.'
                : 'Klicken Sie auf Aufklappen, um die internen Sub-Komponenten direkt als verknüpfte Knoten im Graphen einzublenden.'}
            </p>
          </div>
        )}

        {/* Store-Installationsbutton für store-available */}
        {nodeData.status === 'store-available' && (
          <div className="mb-6 p-4 bg-stone-100/80 rounded-2xl border border-stone-200 flex flex-col gap-2">
            <div className="text-xs text-stone-600">
              Dieses Modul ist im Plugin-Store registriert und kann mit einem Klick installiert werden.
            </div>
            <Link
              to="/plugins"
              className="
                inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-semibold
                shadow-sm transition-all
              "
            >
              <span>🛒</span>
              <span>Im Plugin-Store öffnen & installieren</span>
            </Link>
          </div>
        )}

        {/* Bereitgestellte Routen */}
        {nodeData.routes && nodeData.routes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-2.5 font-sans">
              Bereitgestellte Routen (URLs)
            </h3>
            <div className="flex flex-col gap-2">
              {nodeData.routes.map((route, idx) => (
                <Link
                  key={idx}
                  to={route.path.startsWith('/yeti') ? route.path.replace(/^\/yeti/, '') || '/' : route.path}
                  className="
                    flex items-center justify-between p-3 rounded-xl
                    bg-white hover:bg-stone-50 border border-stone-200/80
                    transition-all duration-200 group shadow-2xs
                  "
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📍</span>
                    <span className="text-xs font-semibold text-stone-800 group-hover:text-stone-950">
                      {route.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-stone-500 group-hover:text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/50">
                    {route.path} ↗
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Falls es ein Komponenten-Knoten ist */}
        {nodeData.status === 'component' ? (
          renderComponentView()
        ) : arch ? (
          /* Falls es ein Plugin-Knoten ist: Vollständiger Tab- und Struktur-Explorator */
          <div className="flex flex-col gap-6 mt-4">
            <div className="border-b border-stone-200">
              <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-3">
                Interner Aufbau & Architektur
              </h3>
              <div className="flex gap-1.5 pb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'overview' ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  Übersicht
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ui')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeTab === 'ui' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  <span>🖥️</span>
                  <span>UI-Schicht</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('api')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeTab === 'api' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'}`}
                >
                  <span>⚡</span>
                  <span>REST-API</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('data')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeTab === 'data' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                >
                  <span>💾</span>
                  <span>Datenmodell</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lifecycle')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeTab === 'lifecycle' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                >
                  <span>🔄</span>
                  <span>Lifecycle</span>
                </button>
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className="flex flex-col gap-5">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">Geschäftskonzept</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">{nodeData.concept || arch.tagline}</p>
                </div>

                {(nodeData.label.includes('Scheduling') || nodeData.technicalId === 'predictive-scheduling') && renderSchedulingDetails()}
                {(nodeData.label.toLowerCase().includes('engine') || nodeData.technicalId === 'medos-engine-v2' || nodeData.pluginId === 'medos-engine-v2') && renderEngineDetails()}

                <div className="grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => setActiveTab('ui')}
                    className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 cursor-pointer hover:bg-indigo-100/70 transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
                      <span>🖥️</span>
                      <span>UI-Schicht</span>
                    </div>
                    <p className="text-[11px] text-indigo-800/80 leading-relaxed line-clamp-2">{arch.ui.summary}</p>
                    <span className="text-[10px] font-semibold text-indigo-600 mt-2 block">Details ansehen ↗</span>
                  </div>

                  <div 
                    onClick={() => setActiveTab('api')}
                    className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 cursor-pointer hover:bg-sky-100/70 transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 mb-1">
                      <span>⚡</span>
                      <span>REST-API</span>
                    </div>
                    <p className="text-[11px] text-sky-800/80 leading-relaxed line-clamp-2">{arch.api.summary}</p>
                    <span className="text-[10px] font-semibold text-sky-600 mt-2 block">{arch.api.endpoints.length} Endpunkte ↗</span>
                  </div>

                  <div 
                    onClick={() => setActiveTab('data')}
                    className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 cursor-pointer hover:bg-amber-100/70 transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                      <span>💾</span>
                      <span>Datenmodell</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 leading-relaxed line-clamp-2">{arch.data.summary}</p>
                    <span className="text-[10px] font-semibold text-amber-700 mt-2 block">Proxy & Schemas ↗</span>
                  </div>

                  <div 
                    onClick={() => setActiveTab('lifecycle')}
                    className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 cursor-pointer hover:bg-emerald-100/70 transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-1">
                      <span>🔄</span>
                      <span>Lifecycle</span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 leading-relaxed line-clamp-2">{arch.lifecycle.summary}</p>
                    <span className="text-[10px] font-semibold text-emerald-700 mt-2 block">Events & Hooks ↗</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ui' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">{arch.ui.title}</h4>
                <p className="text-xs text-stone-600 leading-relaxed">{arch.ui.summary}</p>
                <div className="flex flex-col gap-3">
                  {arch.ui.components.map((comp, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-stone-900">{comp.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{comp.role}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">{comp.details}</p>
                      {comp.routes && comp.routes.length > 0 && (
                        <div className="pt-2 flex gap-2">
                          {comp.routes.map((r, rIdx) => (
                            <Link 
                              key={rIdx} 
                              to={r.startsWith('/yeti') ? r.replace(/^\/yeti/, '') || '/' : r}
                              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                            >
                              <span>Seite aufrufen ({r})</span>
                              <span>↗</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">{arch.api.title}</h4>
                <p className="text-xs text-stone-600 leading-relaxed">{arch.api.summary}</p>
                <div className="flex flex-col gap-2.5">
                  {arch.api.endpoints.map((ep, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {ep.method}
                        </span>
                        <span className="font-mono text-xs text-stone-800 font-semibold">{ep.path}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">{ep.desc}</p>
                      {ep.responseSnippet && (
                        <div className="bg-stone-900 text-stone-100 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                          {ep.responseSnippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">{arch.data.title}</h4>
                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
                  <span className="font-semibold">Speicher-Technologie: </span>
                  {arch.data.storageType}
                </div>
                <div className="flex flex-col gap-2.5">
                  {arch.data.schemas.map((sc, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-800">{sc.keyPattern}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600">{sc.type}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">{sc.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'lifecycle' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">{arch.lifecycle.title}</h4>
                <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-2">
                  <span className="text-xs font-semibold text-stone-700">Events:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {arch.lifecycle.eventsProduced.map((ev, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-semibold border border-emerald-200">
                        ⚡ {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-2">
                  <span className="text-xs font-semibold text-stone-700">Lifecycle-Pipeline:</span>
                  <ul className="space-y-1.5 text-xs text-stone-600">
                    {arch.lifecycle.hooks.map((h, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Falls es ein Infrastruktur-Knoten ist (Kernel, DB, Nginx, SPA) */
          <div className="flex flex-col gap-6 mt-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-2">Architektur-Rolle</h3>
              <p className="text-xs text-stone-700 leading-relaxed">{nodeData.concept || nodeData.description}</p>
            </div>

            {nodeData.label.includes('Kernel') && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Kern-Aufgaben des Microkernels</h4>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">1. Isolierte Sandbox & Context:</span>
                  Plugins erhalten niemals direkten Zugriff auf den Root-Kernel. Context-Objekte werden via <code className="font-mono bg-stone-100 px-1 py-0.5 rounded">Object.freeze()</code> eingefroren.
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">2. Zero-Downtime Hot-Swapping:</span>
                  Chokidar-Dateisystem-Watcher erkennt Modul-Änderungen live. Dynamic Imports mit Timestamp-Busting laden Plugins ohne Serverneustart neu.
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">3. Reaktiver SSE-Eventstream:</span>
                  Unidirektionaler Broadcast-Stream über HTTP/1.1 Keep-Alive mit automatischem 15s-Ping zur Vermeidung verwaister Sockets.
                </div>
              </div>
            )}

            {nodeData.label.includes('Datenbank') && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Persistenz & Sicherheits-Scoping</h4>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">PluginDBProxy:</span>
                  Erzwingt striktes Partitionieren auf die Tabelle <code className="font-mono bg-stone-100 px-1 py-0.5 rounded">PluginData</code>. Sperrt Raw-SQL, $connect und unbefugte Fremdzugriffe.
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">Plattform-Resilienz:</span>
                  Lazy Loading und automatischer In-Memory Fallback sichern den unterbrechungsfreien Betrieb auf ARM64 Windows und Serverumgebungen.
                </div>
              </div>
            )}

            {nodeData.label.includes('Proxy') && (
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Gateway & Netzwerk-Ebene</h4>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">Nginx Reverse Proxy:</span>
                  Terminiert TLS 1.3 und leitet Anfragen an Port 5173 (Frontend) und Port 4000 (Backend SSE Kernel) transparent weiter.
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-1">SSE-Bypass & Keep-Alive:</span>
                  <code className="font-mono bg-stone-100 px-1 py-0.5 rounded">proxy_buffering off;</code> verhindert Zwischenspeicherung von Server-Sent-Events.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-stone-100 text-[11px] text-stone-400 text-center font-sans">
          Architektur-Dokumentation entspricht dem aktuellen MedOS Yeti System-Register.
        </div>
      </div>
    </div>
  );
};
