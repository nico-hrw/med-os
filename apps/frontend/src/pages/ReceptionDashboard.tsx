import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useKernelEvents } from '../context/EventContext';

const API_BASE = '/yeti/api';

interface PatientRecord {
  id: string;
  key: string;
  payload: string; // JSON string
  createdAt: string;
}

interface ParsedPatient {
  id: string;
  key: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  insurance?: string;
  insuranceNumber?: string;
  phone?: string;
  emergencyContact?: string;
  triageLevel: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
  chiefComplaint?: string;
  allergies?: string;
  admittedAt: string;
}

const TRIAGE_MAP: Record<string, { label: string; badge: string; dot: string }> = {
  red: { label: '1 - Sofort', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500 animate-pulse' },
  orange: { label: '2 - Sehr dringend', badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500 animate-pulse' },
  yellow: { label: '3 - Dringend', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  green: { label: '4 - Normal', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  blue: { label: '5 - Nicht dringend', badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
};

export const ReceptionDashboard: React.FC = () => {
  const [patients, setPatients] = useState<ParsedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [triageFilter, setTriageFilter] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<ParsedPatient | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/onboarding/list`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const parsed: ParsedPatient[] = json.data.map((rec: PatientRecord) => {
          let data: any = {};
          try {
            data = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : rec.payload;
          } catch {
            data = {};
          }
          return {
            id: rec.id || rec.key,
            key: rec.key,
            firstName: data.firstName || 'Unbekannt',
            lastName: data.lastName || '',
            birthDate: data.birthDate,
            gender: data.gender,
            insurance: data.insurance,
            insuranceNumber: data.insuranceNumber,
            phone: data.phone,
            emergencyContact: data.emergencyContact,
            triageLevel: data.triageLevel || 'yellow',
            chiefComplaint: data.chiefComplaint,
            allergies: data.allergies,
            admittedAt: data.admittedAt || rec.createdAt || new Date().toISOString(),
          };
        });
        setPatients(parsed);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Patientenliste:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Live-Synchronisation über zentralen SSE-Stream
  useKernelEvents(useCallback((data: any) => {
    if (data.type === 'NEW_PATIENT') {
      fetchPatients();
    }
  }, [fetchPatients]));

  // Gefilterte Liste
  const filtered = patients.filter((p) => {
    const matchesSearch =
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.insuranceNumber && p.insuranceNumber.toLowerCase().includes(search.toLowerCase())) ||
      (p.chiefComplaint && p.chiefComplaint.toLowerCase().includes(search.toLowerCase()));

    const matchesTriage = triageFilter === 'all' || p.triageLevel === triageFilter;

    return matchesSearch && matchesTriage;
  });

  // Metriken
  const countRed = patients.filter(p => p.triageLevel === 'red').length;
  const countOrange = patients.filter(p => p.triageLevel === 'orange').length;
  const countAcute = countRed + countOrange;
  const countYellow = patients.filter(p => p.triageLevel === 'yellow').length;
  const countNormal = patients.filter(p => p.triageLevel === 'green' || p.triageLevel === 'blue').length;

  return (
    <div className="max-w-6xl mx-auto mt-4 pb-16">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📋</span>
            <span className="text-xs font-mono uppercase tracking-widest text-stone-400 font-semibold">
              Live Monitor
            </span>
          </div>
          <h2 className="text-4xl font-serif text-stone-900 tracking-tight">Empfangs-Dashboard</h2>
          <p className="text-stone-500 text-base mt-1">
            Echtzeit-Warteschlange und strukturierter Triage-Status der zentralen Patientenaufnahme.
          </p>
        </div>

        <Link
          to="/patient"
          className="
            inline-flex items-center gap-2 px-5 py-3 rounded-2xl
            bg-stone-900 hover:bg-stone-800 text-stone-50
            shadow-lg shadow-stone-900/15 text-sm font-semibold
            transition-all duration-200 active:scale-[0.98] self-start md:self-auto
          "
        >
          <span>＋</span>
          <span>Neuen Patienten aufnehmen</span>
        </Link>
      </header>

      {/* KPI Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-stone-200/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block mb-1">
            Warteschlange Gesamt
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif text-stone-900">{patients.length}</span>
            <span className="text-xs text-stone-400">Patienten</span>
          </div>
        </div>

        <div className="bg-red-50/70 backdrop-blur-xl p-5 rounded-2xl border border-red-200/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600 block mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Akutfälle (Rot / Orange)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif text-red-900">{countAcute}</span>
            <span className="text-xs text-red-600 font-medium">höchste Priorität</span>
          </div>
        </div>

        <div className="bg-amber-50/70 backdrop-blur-xl p-5 rounded-2xl border border-amber-200/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 block mb-1">
            Dringlich (Gelb)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif text-amber-900">{countYellow}</span>
            <span className="text-xs text-amber-600">max. 30 Min</span>
          </div>
        </div>

        <div className="bg-emerald-50/70 backdrop-blur-xl p-5 rounded-2xl border border-emerald-200/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
            Standard (Grün / Blau)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif text-emerald-900">{countNormal}</span>
            <span className="text-xs text-emerald-600">stabil</span>
          </div>
        </div>
      </div>

      {/* Filterleiste */}
      <div className="bg-white/70 backdrop-blur-xl p-4 rounded-2xl border border-stone-200/70 shadow-xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Suche */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nach Name, Versichertennummer oder Symptom suchen..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-xs"
          />
          <span className="absolute left-3 top-2.5 text-stone-400 text-xs">🔍</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2 text-stone-400 hover:text-stone-700 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Triage-Filter Pillen */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <span className="text-xs font-medium text-stone-400 mr-1 hidden sm:inline">Triage:</span>
          {[
            { id: 'all', label: 'Alle' },
            { id: 'red', label: 'Rot' },
            { id: 'orange', label: 'Orange' },
            { id: 'yellow', label: 'Gelb' },
            { id: 'green', label: 'Grün' },
            { id: 'blue', label: 'Blau' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTriageFilter(t.id)}
              className={`
                px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${triageFilter === t.id
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/80'}
              `}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patienten-Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white/50 rounded-3xl border border-stone-200/50">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-stone-200/60 p-12 text-center">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-stone-600 text-base font-medium">Keine Patienten in dieser Ansicht vorhanden.</p>
          <p className="text-stone-400 text-xs mt-1">
            {search || triageFilter !== 'all'
              ? 'Passen Sie die Filtereinstellungen an.'
              : 'Nehmen Sie neue Patienten über das Aufnahmeformular auf.'}
          </p>
          <Link
            to="/patient"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-semibold hover:bg-stone-800 transition-colors"
          >
            Zur Patientenaufnahme →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => {
            const triageInfo = TRIAGE_MAP[patient.triageLevel] || TRIAGE_MAP['yellow'];
            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="
                  p-5 rounded-2xl bg-white/80 hover:bg-white backdrop-blur-xl
                  border border-stone-200/70 hover:border-stone-300
                  shadow-xs hover:shadow-md transition-all duration-150
                  flex flex-col sm:flex-row sm:items-center justify-between gap-4
                  cursor-pointer group
                "
              >
                <div className="flex items-start sm:items-center gap-4">
                  {/* Triage Dot & Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xl flex-shrink-0 relative">
                    <span>{patient.gender === 'weiblich' ? '👩' : patient.gender === 'männlich' ? '👨' : '👤'}</span>
                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${triageInfo.dot} ring-2 ring-white`} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-semibold text-stone-900 text-base group-hover:text-stone-950">
                        {patient.firstName} {patient.lastName}
                      </h4>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${triageInfo.badge}`}>
                        {triageInfo.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                      {patient.birthDate && <span>Geb.: {patient.birthDate}</span>}
                      {patient.insurance && <span>• {patient.insurance}</span>}
                      {patient.insuranceNumber && <span className="font-mono">({patient.insuranceNumber})</span>}
                    </div>

                    {patient.chiefComplaint && (
                      <p className="text-xs text-stone-600 mt-1.5 line-clamp-1 italic">
                        „{patient.chiefComplaint}“
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-semibold">
                      Aufnahme
                    </span>
                    <span className="text-xs font-mono text-stone-600">
                      {new Date(patient.admittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span className="text-stone-300 group-hover:text-stone-600 text-sm transition-colors">
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Patienten-Detail-Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="
            relative w-full max-w-lg
            bg-white/95 backdrop-blur-2xl
            border border-stone-200/80
            rounded-3xl shadow-2xl
            p-8 flex flex-col gap-6
          ">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-2xl">
                  {selectedPatient.gender === 'weiblich' ? '👩' : selectedPatient.gender === 'männlich' ? '👨' : '👤'}
                </div>
                <div>
                  <h3 className="text-xl font-serif text-stone-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TRIAGE_MAP[selectedPatient.triageLevel]?.badge}`}>
                      {TRIAGE_MAP[selectedPatient.triageLevel]?.label}
                    </span>
                    <span className="text-xs text-stone-400">
                      Aufgenommen um {new Date(selectedPatient.admittedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPatient(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-stone-50/80 p-4 rounded-2xl border border-stone-200/60 text-xs">
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Geburtsdatum</span>
                <span className="text-stone-800 font-medium">{selectedPatient.birthDate || 'Nicht angegeben'}</span>
              </div>
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Geschlecht</span>
                <span className="text-stone-800 font-medium capitalize">{selectedPatient.gender || 'Nicht angegeben'}</span>
              </div>
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Krankenkasse</span>
                <span className="text-stone-800 font-medium">{selectedPatient.insurance || 'Nicht angegeben'}</span>
              </div>
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Versichertennummer</span>
                <span className="text-stone-800 font-mono">{selectedPatient.insuranceNumber || 'Nicht angegeben'}</span>
              </div>
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Telefon</span>
                <span className="text-stone-800">{selectedPatient.phone || 'Keine Angabe'}</span>
              </div>
              <div>
                <span className="text-stone-400 uppercase tracking-wider block font-medium mb-0.5">Notfallkontakt</span>
                <span className="text-stone-800">{selectedPatient.emergencyContact || 'Keine Angabe'}</span>
              </div>
            </div>

            {selectedPatient.chiefComplaint && (
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 text-xs">
                <span className="text-amber-800 uppercase tracking-wider block font-semibold mb-1">Leitsymptom / Triage-Notiz</span>
                <p className="text-stone-700 leading-relaxed italic">{selectedPatient.chiefComplaint}</p>
              </div>
            )}

            {selectedPatient.allergies && (
              <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/60 text-xs">
                <span className="text-rose-800 uppercase tracking-wider block font-semibold mb-1">Allergien & Vorerkrankungen</span>
                <p className="text-stone-700 leading-relaxed">{selectedPatient.allergies}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
