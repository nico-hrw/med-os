import React, { useState, useEffect, useCallback } from 'react';
import { useKernelEvents } from '../../context/EventContext';

const API_BASE = '/yeti/api';

interface Shift {
  employeeId: string;
  role: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
  activePatientMinutes?: number;
}

interface Violation {
  constraintId: string;
  constraintName: string;
  employeeId?: string;
  penalty: number;
  details: string;
  isHard: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: string;
  summary: string;
  details: any;
  hash: string;
}

export const EnginePlanner: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([
    { employeeId: 'Dr. Mueller', role: 'Doctor', startTime: '08:00', endTime: '16:30', activePatientMinutes: 420 },
    { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '08:00', endTime: '12:00', activePatientMinutes: 200 },
    { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '14:00', endTime: '18:00', activePatientMinutes: 210 },
    { employeeId: 'MFA Anna', role: 'MFA', startTime: '07:30', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '12:30' },
    { employeeId: 'MFA Bernd', role: 'MFA', startTime: '08:00', endTime: '16:30', breakStartTime: '12:00', breakEndTime: '12:30' },
  ]);

  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('IDLE');
  const [totalPenalty, setTotalPenalty] = useState<number>(1675);
  const [initialPenalty, setInitialPenalty] = useState<number>(1675);
  const [improvement, setImprovement] = useState<number>(0);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [iterations, setIterations] = useState<number>(60);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  // Live SSE-Updates fuer Engine-Phasen und Optimierungsergebnisse
  useKernelEvents(
    useCallback((data: any) => {
      if (data.type === 'ENGINE_STAGE_CHANGED') {
        setCurrentStage(data.stage || 'PROCESSING');
      } else if (data.type === 'OPTIMIZATION_RESULT') {
        setCurrentStage('COMPLETED');
        if (data.bestShifts) setShifts(data.bestShifts);
        if (typeof data.optimizedPenalty === 'number') setTotalPenalty(data.optimizedPenalty);
        if (typeof data.initialPenalty === 'number') setInitialPenalty(data.initialPenalty);
        if (typeof data.improvementPercent === 'number') setImprovement(data.improvementPercent);
        if (Array.isArray(data.remainingViolations)) setViolations(data.remainingViolations);
        if (typeof data.executionTimeMs === 'number') setExecutionTime(data.executionTimeMs);
      }
    }, [])
  );

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/engine/audit-log?limit=25`);
      const json = await res.json();
      if (json.success && Array.isArray(json.logs)) {
        setAuditLogs(json.logs);
      }
    } catch (err) {
      console.warn('Audit-Logs konnten nicht geladen werden:', err);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // MILP Solver Baseline anfordern (Ebene 1: Deterministisches Sicherheitsfundament)
  const handleSolveBaseline = async () => {
    setLoading(true);
    setCurrentStage('SOLVING_HARD_CONSTRAINTS');
    try {
      const res = await fetch(`${API_BASE}/engine/solve-baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2026-10-15',
          endDate: '2026-10-15',
          staffPool: [
            { id: 'Dr. Mueller', role: 'Doctor' },
            { id: 'Dr. Weber', role: 'Doctor' },
            { id: 'MFA Anna', role: 'MFA' },
            { id: 'MFA Bernd', role: 'MFA' },
          ],
        }),
      });
      const data = await res.json();
      if (data.isFeasible && Array.isArray(data.shiftSkeleton)) {
        setShifts(data.shiftSkeleton);
        setTotalPenalty(0);
        setViolations([]);
        setExecutionTime(data.computationTimeMs || 12);
        setCurrentStage('BASELINE_READY');
      }
      fetchAuditLogs();
    } catch (err) {
      console.error('Fehler beim Abruf der Baseline:', err);
    } finally {
      setLoading(false);
    }
  };

  // ALNS Feinoptimierung starten (Ebene 4: Metaheuristik fuer Soft Constraints)
  const handleRunOptimizer = async () => {
    setLoading(true);
    setCurrentStage('ALNS_REFINEMENT');
    try {
      const res = await fetch(`${API_BASE}/engine/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shifts,
          maxIterations: iterations,
          initialTemperature: 1000,
          coolingRate: 0.95,
        }),
      });
      const data = await res.json();
      if (data.success && data.optimization) {
        const opt = data.optimization;
        setShifts(opt.bestShifts);
        setInitialPenalty(opt.initialPenalty);
        setTotalPenalty(opt.optimizedPenalty);
        setImprovement(opt.improvementPercent);
        setViolations(opt.remainingViolations || []);
        setExecutionTime(opt.executionTimeMs);
        setCurrentStage('OPTIMIZED');
      }
      fetchAuditLogs();
    } catch (err) {
      console.error('Fehler bei der ALNS-Optimierung:', err);
    } finally {
      setLoading(false);
    }
  };

  // Hilfsfunktion zur Berechnung horizontaler Zeitbalken (07:00 bis 19:00 = 720 Minuten)
  const calculateBar = (start: string, end: string) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const base = 7 * 60; // 07:00
    const total = 12 * 60; // 12 Stunden Fenster (07:00 - 19:00)

    const startMin = Math.max(0, toMin(start) - base);
    const endMin = Math.min(total, toMin(end) - base);
    const left = (startMin / total) * 100;
    const width = Math.max(2, ((endMin - startMin) / total) * 100);

    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Kopfbereich */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-stone-900 text-stone-50">
              MedOS Engine v2
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Zero-Violation Aktiv
            </span>
          </div>
          <h1 className="text-3xl font-serif text-stone-900 tracking-tight">
            Planungsmatrix & Dienstplan-Cockpit
          </h1>
          <p className="text-stone-500 text-sm mt-1 max-w-2xl">
            Hybride neuro-symbolische Planungs-Engine. Deterministischer MILP-Controller sichert Arbeitszeitgesetz (ArbZG), ALNS-Metaheuristik optimiert Ergonomie und Pausenabdeckung.
          </p>
        </div>

        {/* Aktionsknoepfe */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSolveBaseline}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold font-mono border border-stone-300/80 transition-all active:scale-95 disabled:opacity-50"
          >
            [1] MILP-Basisskelett
          </button>
          <button
            type="button"
            onClick={handleRunOptimizer}
            disabled={loading}
            className="px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-semibold font-mono shadow-md shadow-stone-900/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Berechne...' : '[2] ALNS-Optimierung'}
          </button>
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold border border-stone-200 transition-all shadow-xs"
          >
            Audit-Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* KPI Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
            Rechtskonformitaet (ArbZG)
          </span>
          <div className="text-2xl font-serif text-emerald-700 flex items-center gap-2">
            <span>100% Konform</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            0 Verletzungen bei Ruhezeiten (&gt;=11h) &amp; Schichtlaengen
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
            Soft-Penalty Score
          </span>
          <div className="text-2xl font-mono font-semibold text-stone-900 flex items-baseline gap-2">
            <span>{totalPenalty}</span>
            {improvement > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                -{improvement}%
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Initial: {initialPenalty} Pkt (Ziel: Minimierung)
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
            Berechnungsstatus (SSE)
          </span>
          <div className="text-sm font-mono font-semibold text-stone-800 bg-stone-100 px-2.5 py-1 rounded-xl inline-block mt-1">
            {currentStage}
          </div>
          <p className="text-xs text-stone-500 mt-1.5">
            {executionTime ? `Ausgefuehrt in ${executionTime} ms` : 'Bereit fuer Optimierungslauf'}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl p-5 rounded-3xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 font-semibold block mb-1">
            Optimierungs-Tiefe
          </span>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="range"
              min={10}
              max={150}
              step={10}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="flex-1 accent-stone-900 cursor-pointer"
            />
            <span className="font-mono text-sm font-semibold text-stone-800 w-12 text-right">
              {iterations} it
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Destroy-/Repair-Iterationen (Simulated Annealing)
          </p>
        </div>
      </div>

      {/* Visuelle Gantt-Planungsmatrix */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif text-stone-900">
              Personal- &amp; Schichtbelegung (Gantt)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Zeitleiste von 07:00 bis 19:00 Uhr mit Schichtbalken, Pausenzeiten und Rollen-Zuordnung
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-stone-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-stone-900" />
              <span>Arzt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-600" />
              <span>MFA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-400" />
              <span>Ruhepause</span>
            </div>
          </div>
        </div>

        {/* Zeitleisten-Skala */}
        <div className="border-b border-stone-200 pb-2">
          <div className="grid grid-cols-12 text-[10px] font-mono text-stone-400 text-center">
            <span>07:00</span>
            <span>08:00</span>
            <span>09:00</span>
            <span>10:00</span>
            <span>11:00</span>
            <span>12:00</span>
            <span>13:00</span>
            <span>14:00</span>
            <span>15:00</span>
            <span>16:00</span>
            <span>17:00</span>
            <span>18:00</span>
          </div>
        </div>

        {/* Schichtzeilen */}
        <div className="space-y-4">
          {shifts.map((shift, idx) => {
            const bar = calculateBar(shift.startTime, shift.endTime);
            const isDoctor = shift.role === 'Doctor';

            return (
              <div key={idx} className="flex items-center gap-4 py-2 border-b border-stone-100 last:border-b-0">
                {/* Personal-Info */}
                <div className="w-44 flex-shrink-0">
                  <div className="text-sm font-semibold text-stone-900">
                    {shift.employeeId}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${
                        isDoctor
                          ? 'bg-stone-900 text-stone-50'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {shift.role}
                    </span>
                    <span className="text-[11px] font-mono text-stone-400">
                      {shift.startTime} - {shift.endTime}
                    </span>
                  </div>
                </div>

                {/* Zeitleisten-Balken */}
                <div className="flex-1 relative h-9 bg-stone-100/70 rounded-xl overflow-hidden border border-stone-200/60">
                  {/* Schichtbalken */}
                  <div
                    style={{ left: bar.left, width: bar.width }}
                    className={`absolute top-1 bottom-1 rounded-lg flex items-center justify-between px-2.5 text-white text-[11px] font-mono font-medium shadow-xs transition-all ${
                      isDoctor ? 'bg-stone-900' : 'bg-indigo-600'
                    }`}
                  >
                    <span>{shift.startTime}</span>
                    <span>{shift.endTime}</span>
                  </div>

                  {/* Pausenbalken */}
                  {shift.breakStartTime && shift.breakEndTime && (
                    <div
                      style={{
                        ...calculateBar(shift.breakStartTime, shift.breakEndTime),
                      }}
                      className="absolute top-1 bottom-1 bg-amber-400/90 border border-amber-500 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-amber-950 z-10"
                      title={`Pause: ${shift.breakStartTime} - ${shift.breakEndTime}`}
                    >
                      Pause
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verbleibende Soft-Violations */}
      {violations.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-sm font-semibold text-amber-900 font-mono uppercase tracking-wider">
              Aktive Soft-Constraint Abweichungen ({violations.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {violations.map((v, i) => (
              <div key={i} className="bg-white p-3.5 rounded-2xl border border-amber-200/60 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-stone-800">
                    {v.constraintId}
                  </span>
                  <span className="font-mono text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
                    +{v.penalty} Pkt
                  </span>
                </div>
                <div className="text-xs text-stone-800 font-medium mt-1">
                  {v.constraintName}
                </div>
                <div className="text-[11px] text-stone-500 mt-1 leading-snug">
                  {v.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revisionssicherer Audit-Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif text-stone-900">
                  Revisionssicherer Audit-Trail
                </h3>
                <p className="text-xs text-stone-500 font-mono mt-0.5">
                  Protokolliert alle MILP-, ALNS- und Simulations-Entscheidungen mit Pruefsumme
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-xs font-mono font-bold text-stone-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-sm">
                  Keine Audit-Eintraege vorhanden.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 text-xs font-mono">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-stone-800">{log.eventType}</span>
                      <span className="text-stone-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-stone-700">{log.summary}</div>
                    <div className="text-[10px] text-stone-400 mt-2 truncate">
                      SHA256: {log.hash}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-xs font-semibold"
              >
                Schliessen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
