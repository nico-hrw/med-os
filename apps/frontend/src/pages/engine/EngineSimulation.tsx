import React, { useState, useEffect, useCallback } from 'react';
import { useKernelEvents } from '../../context/EventContext';

const API_BASE = '/yeti/api';

interface SimulationMetrics {
  totalArrivals: number;
  completedPatients: number;
  spilloverCount: number;
  averageWaitTimeMin: number;
  p90WaitTimeMin: number;
  p95WaitTimeMin: number;
  resilienceScore: number;
  bottlenecksDetected: string[];
}

interface SimulationResult {
  dayId: string;
  nextDayId: string;
  metrics: SimulationMetrics;
  executionTimeMs: number;
  timelineSample?: Array<{ minute: number; event: string; patientId: string }>;
}

interface HourlyArrivalRate {
  hour: number;
  expectedArrivals: number;
  peakFactor: number;
}

interface DemandProfile {
  date: string;
  totalExpectedPatients: number;
  noShowProbability: number;
  hourlyArrivalRates?: HourlyArrivalRate[];
  generatedPatients?: any[];
}

export const EngineSimulation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedShocks, setSelectedShocks] = useState<string[]>(['EMERGENCY_SURGE']);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [demandProfile, setDemandProfile] = useState<DemandProfile | null>(null);
  const [targetDate, setTargetDate] = useState<string>('2026-10-15');

  // Live SSE-Broadcasts
  useKernelEvents(
    useCallback((data: any) => {
      if (data.type === 'SIMULATION_SPILLOVER_ALERT') {
        console.warn('Spillover-Alert erhalten:', data);
      }
    }, [])
  );

  const fetchDemandForecast = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/engine/predict-demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await res.json();
      if (data.success && data.profile) {
        setDemandProfile(data.profile);
      }
    } catch (err) {
      console.warn('Fehler beim Abruf der Bedarfsprognose:', err);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchDemandForecast();
  }, [fetchDemandForecast]);

  const toggleShock = (type: string) => {
    setSelectedShocks((prev) =>
      prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]
    );
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const shocks = selectedShocks.map((s) => ({
        type: s,
        severity: s === 'EMERGENCY_SURGE' ? 2.0 : 1.5,
        startMinute: 120, // 10:00 Uhr
        durationMinutes: 180,
      }));

      const res = await fetch(`${API_BASE}/engine/stress-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayId: targetDate,
          nextDayId: '2026-10-16',
          shocks,
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setSimResult(data.result);
      }
    } catch (err) {
      console.error('Fehler bei der Stresstest-Simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Kopfbereich */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-stone-900 text-stone-50">
              Digitaler Zwilling
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
              High-Speed Event-Heap
            </span>
          </div>
          <h1 className="text-3xl font-serif text-stone-900 tracking-tight">
            Stresstest &amp; Resilienz-Simulator
          </h1>
          <p className="text-stone-500 text-sm mt-1 max-w-2xl">
            Vektorisierte diskrete Ereignissimulation (DES) in Reinst-TypeScript. Testet Schichtpläne unter unvorhergesehenen Schocks, Notfallwellen und Multi-Day Spillover.
          </p>
        </div>

        {/* Aktionsleiste */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3.5 py-2 rounded-2xl bg-stone-100 border border-stone-200 text-xs font-mono text-stone-800"
          />
          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={loading}
            className="px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-semibold font-mono shadow-md shadow-stone-900/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Simuliere...' : 'Stresstest starten'}
          </button>
        </div>
      </div>

      {/* Schock-Konfiguration */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl border border-stone-200/80 shadow-xs">
        <h2 className="text-base font-serif font-semibold text-stone-900 mb-1">
          Schock-Szenarien &amp; Belastungsfaktoren
        </h2>
        <p className="text-xs text-stone-500 mb-4">
          Wählen Sie Stressoren zur Evaluierung der Puffer und Engpass-Resilienz aus:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => toggleShock('EMERGENCY_SURGE')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedShocks.includes('EMERGENCY_SURGE')
                ? 'bg-red-50/80 border-red-300 text-red-900 shadow-xs'
                : 'bg-stone-50/80 border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                EMERGENCY_SURGE
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white border border-stone-200">
                2.0x Last
              </span>
            </div>
            <div className="text-xs font-medium">Plötzliche Notfallwelle</div>
            <div className="text-[11px] text-stone-500 mt-1">
              Verdopplung unangekündigter Notfälle zwischen 10:00 und 13:00 Uhr.
            </div>
          </button>

          <button
            type="button"
            onClick={() => toggleShock('STAFF_ABSENCE')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedShocks.includes('STAFF_ABSENCE')
                ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-xs'
                : 'bg-stone-50/80 border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                STAFF_ABSENCE
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white border border-stone-200">
                -1 Arzt / MFA
              </span>
            </div>
            <div className="text-xs font-medium">Kurzfristige Krankmeldung</div>
            <div className="text-[11px] text-stone-500 mt-1">
              Spontaner Ausfall einer Fachkraft ab Schichtbeginn.
            </div>
          </button>

          <button
            type="button"
            onClick={() => toggleShock('EQUIPMENT_OUTAGE')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedShocks.includes('EQUIPMENT_OUTAGE')
                ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-xs'
                : 'bg-stone-50/80 border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                EQUIPMENT_OUTAGE
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white border border-stone-200">
                OP / Röntgen
              </span>
            </div>
            <div className="text-xs font-medium">Gerätedefekt &amp; Wartung</div>
            <div className="text-[11px] text-stone-500 mt-1">
              Temporäre Schließung eines Spezialraums für 120 Minuten.
            </div>
          </button>
        </div>
      </div>

      {/* KPI Kacheln des Stresstests */}
      {simResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
          <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
              Resilienz-Score (0-100)
            </span>
            <div className="text-3xl font-serif text-stone-900 flex items-baseline gap-2">
              <span>{simResult.metrics.resilienceScore}</span>
              <span className="text-xs text-stone-400 font-mono">/ 100</span>
            </div>
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                style={{ width: `${simResult.metrics.resilienceScore}%` }}
                className={`h-full ${
                  simResult.metrics.resilienceScore >= 70
                    ? 'bg-emerald-500'
                    : simResult.metrics.resilienceScore >= 45
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
              Multi-Day Spillover
            </span>
            <div className="text-3xl font-serif text-stone-900 flex items-baseline gap-2">
              <span>{simResult.metrics.spilloverCount}</span>
              <span className="text-xs text-stone-500 font-mono">Patienten</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              {simResult.metrics.spilloverCount === 0
                ? 'Kein Rückstau: Alle Fälle am Tag versorgt'
                : 'Ueberhang wird priorisiert auf Folgetag uebertragen'}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
              P95 Spitzen-Wartezeit
            </span>
            <div className="text-3xl font-serif text-stone-900 flex items-baseline gap-2">
              <span>{Math.round(simResult.metrics.p95WaitTimeMin)}</span>
              <span className="text-xs text-stone-500 font-mono">Minuten</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Durchschnitt: {Math.round(simResult.metrics.averageWaitTimeMin)} Min (P90: {Math.round(simResult.metrics.p90WaitTimeMin)} Min)
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
              Simulations-Laufzeit
            </span>
            <div className="text-3xl font-serif text-emerald-700 flex items-baseline gap-2">
              <span>{simResult.executionTimeMs}</span>
              <span className="text-xs text-stone-500 font-mono">ms</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Vektorisierter Event-Heap (0ms SimPy-Overhead)
            </p>
          </div>
        </div>
      )}

      {/* Stochastisches Nachfrageprofil */}
      {demandProfile && (
        <div className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-semibold text-stone-900">
                Stochastischer Patientenzulauf &amp; Morning-Rush
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Stochastische Ankunftsraten pro Stunde mit Poisson-Verteilung und Triage-Gewichtung
              </p>
            </div>
            <div className="text-right font-mono text-xs text-stone-600">
              <div>Erwartetes Volumen: <span className="font-bold">{demandProfile.totalExpectedPatients || 0}</span></div>
              <div className="text-stone-400 text-[11px]">No-Show Rate: {((demandProfile.noShowProbability || 0) * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Stündliche Verlaufskurve */}
          <div className="pt-4">
            <div className="h-28 flex items-end gap-2 border-b border-stone-200 pb-2">
              {(demandProfile.hourlyArrivalRates || []).map((rate, i) => {
                const hour = rate.hour;
                const isPeak = hour >= 8 && hour <= 10;
                const weight = rate.peakFactor || 1.0;
                const heightPercent = Math.min(100, Math.round((weight / 2.0) * 100));

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[9px] font-mono text-stone-500">{weight.toFixed(1)}x</span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-lg transition-all ${
                        isPeak ? 'bg-indigo-600' : 'bg-stone-300'
                      }`}
                      title={`${hour}:00 Uhr: ca. ${rate.expectedArrivals} Patienten (${weight}x Last)`}
                    />
                    <span className="text-[10px] font-mono text-stone-400">{hour}:00</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 mt-2">
              <span>08:00 - 10:30 Uhr: Akuter Morning Rush Peak (1.85x)</span>
              <span>18:00 Uhr: Praxis-Ende (Spillover-Cutoff)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
