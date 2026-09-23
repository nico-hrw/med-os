import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { CustomNodeData } from './CustomNode';

interface InfoPanelProps {
  nodeData: CustomNodeData | null;
  onClose: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ nodeData, onClose }) => {
  
  // Spezial-Renderer für die prädiktive Dienstplanung
  const renderSchedulingDetails = () => (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-right-4 duration-700 delay-150">
      <section>
        <h3 className="text-2xl font-serif text-stone-800 mb-4 border-b border-stone-200/60 pb-2">
          Das stochastische Modell
        </h3>
        <p className="text-stone-600 font-sans leading-relaxed text-sm mb-6">
          Die Systemauslastung wird als Markov-Entscheidungsprozess (MDP) modelliert. 
          Der Zustandsraum zum Zeitpunkt <InlineMath math="t" /> definiert sich als <InlineMath math="S_t = (P_t, M_t)" />.
        </p>
        
        <div className="bg-white/60 rounded-2xl p-6 border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
          <BlockMath math="C(S_t, A_t) = \alpha \cdot W(P_t) + \beta \cdot O(M_t)" />
        </div>

        <ul className="space-y-3 text-sm text-stone-600 font-sans bg-stone-50/70 p-5 rounded-2xl border border-stone-100/50">
          <li className="flex items-center gap-4">
            <span className="font-serif italic font-semibold text-stone-800 text-base w-4 text-center">P</span> 
            wartende Patienten
          </li>
          <li className="flex items-center gap-4">
            <span className="font-serif italic font-semibold text-stone-800 text-base w-4 text-center">M</span> 
            aktives Personal
          </li>
          <li className="flex items-center gap-4">
            <span className="font-serif italic font-semibold text-stone-800 text-base w-4 text-center">α</span> 
            Gewichtung der Wartezeit
          </li>
          <li className="flex items-center gap-4">
            <span className="font-serif italic font-semibold text-stone-800 text-base w-4 text-center">β</span> 
            Gewichtung der Überlastung
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-2xl font-serif text-stone-800 mb-4 border-b border-stone-200/60 pb-2">
          Kostenoptimierung & Strategie
        </h3>
        <p className="text-stone-600 font-sans leading-relaxed text-sm mb-6">
          Das Ziel ist die Minimierung der kumulierten, diskontierten erwarteten Kosten über einen unendlichen Zeithorizont. 
          Dies wird durch die Lösung der Bellman-Optimalitätsgleichung erreicht:
        </p>
        
        <div className="bg-white/60 rounded-2xl p-6 border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-x-auto custom-scrollbar">
          <BlockMath math="V^*(s) = \min_{a \in A} \left( C(s, a) + \gamma \sum_{s'} P(s' | s, a) V^*(s') \right)" />
        </div>
      </section>
    </div>
  );

  return (
    <div 
      // Erweitert auf w-[30rem] (480px) für bessere Formel-Darstellung
      className={`absolute top-0 right-0 h-full w-[30rem] bg-white/75 backdrop-blur-3xl border-l border-white shadow-[-10px_0_40px_rgba(0,0,0,0.04)] transition-transform duration-500 ease-out z-10 ${nodeData ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {nodeData && (
        <div className="p-10 flex flex-col h-full overflow-y-auto">
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-8 h-8 flex items-center justify-center rounded-full bg-stone-100/80 hover:bg-stone-200 text-stone-500 transition-colors focus:outline-none"
          >
            ✕
          </button>
          
          <div className="mt-8 mb-8">
            <div className="text-xs uppercase tracking-widest text-stone-400 font-sans font-semibold mb-3">Modul-Spezifikation</div>
            <h2 className="text-4xl font-serif text-stone-900 leading-tight">{nodeData.label}</h2>
            {nodeData.technicalId && (
              <div className="mt-1.5 font-mono text-xs text-stone-400 bg-stone-100/80 px-2 py-0.5 rounded w-fit">
                ID: {nodeData.technicalId}
              </div>
            )}
            <div className="mt-4 text-stone-500 text-sm font-sans leading-relaxed">{nodeData.description}</div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-stone-200 via-stone-200/80 to-transparent my-8" />

          {/* Spezial-View für Predictive Scheduling, ansonsten Fallback */}
          {nodeData.label === 'Predictive Scheduling' ? (
            renderSchedulingDetails()
          ) : (
            <>
              <div className="mb-8">
                <h3 className="text-2xl font-serif text-stone-800 mb-4 border-b border-stone-200/60 pb-2">Geschäftslogik & Konzept</h3>
                <p className="text-stone-600 font-sans leading-relaxed text-sm">
                  {nodeData.concept}
                </p>
              </div>

              {nodeData.mathModel && (
                <div className="mb-8 p-6 bg-stone-50/80 rounded-2xl border border-stone-100 shadow-inner">
                  <h3 className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-3 font-sans">Mathematisches Modell</h3>
                  <p className="text-stone-800 font-mono text-sm leading-relaxed overflow-x-auto">
                    {nodeData.mathModel}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-auto pt-10">
            <div className="text-xs text-stone-400 text-center font-sans">
              Detaillierte Spezifikationen sind im Architektur-Register hinterlegt.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
