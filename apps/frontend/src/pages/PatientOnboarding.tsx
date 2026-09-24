import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = '/yeti/api';

type TriageLevel = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

interface TriageOption {
  level: TriageLevel;
  label: string;
  sub: string;
  color: string;
  bg: string;
  border: string;
}

const TRIAGE_OPTIONS: TriageOption[] = [
  { level: 'red', label: '1 - Sofort', sub: 'Lebensgefahr (0 Min)', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
  { level: 'orange', label: '2 - Sehr dringend', sub: 'Kritisch (10 Min)', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
  { level: 'yellow', label: '3 - Dringend', sub: 'Stabil (30 Min)', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
  { level: 'green', label: '4 - Normal', sub: 'Standard (90 Min)', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  { level: 'blue', label: '5 - Nicht dringend', sub: 'Routine (120 Min)', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-300' },
];

export const PatientOnboarding: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('divers');
  const [insurance, setInsurance] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [triageLevel, setTriageLevel] = useState<TriageLevel>('yellow');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergies, setAllergies] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successEntry, setSuccessEntry] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Bitte Vor- und Nachnamen angeben.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      gender,
      insurance: insurance.trim(),
      insuranceNumber: insuranceNumber.trim(),
      phone: phone.trim(),
      emergencyContact: emergencyContact.trim(),
      triageLevel,
      chiefComplaint: chiefComplaint.trim(),
      allergies: allergies.trim(),
      admittedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE}/onboarding/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Fehler beim Speichern der Aufnahmedaten.');
      }

      setSuccessEntry({
        id: json.data?.id || `patient_${Date.now()}`,
        name: `${firstName} ${lastName}`,
        triageLevel,
      });

      // Formular zurücksetzen
      setFirstName('');
      setLastName('');
      setBirthDate('');
      setInsurance('');
      setInsuranceNumber('');
      setPhone('');
      setEmergencyContact('');
      setChiefComplaint('');
      setAllergies('');
    } catch (err: any) {
      console.error('Fehler bei Patientenaufnahme:', err);
      setError(err.message || 'Verbindungsfehler beim Übermitteln der Daten.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-2 sm:mt-4 pb-12 sm:pb-16 px-1 sm:px-2">
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xl">🏥</span>
            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-stone-400 font-semibold">
              Modul: patient-onboarding
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-stone-900 tracking-tight">
            Digitale Patientenaufnahme
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm md:text-base mt-1 leading-relaxed">
            Strukturierte Erstaufnahme & Triage nach Manchester-Triage-System (MTS).
          </p>
        </div>

        <Link
          to="/reception"
          className="
            inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            bg-white/80 hover:bg-white text-stone-700 hover:text-stone-900
            border border-stone-200/80 shadow-xs hover:shadow text-xs sm:text-sm font-medium
            transition-all duration-150 w-full sm:w-auto
          "
        >
          <span>📋</span>
          <span>Zum Empfangs-Dashboard</span>
        </Link>
      </header>

      {/* Erfolgs-Banner */}
      {successEntry && (
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-emerald-50/90 border border-emerald-200/80 backdrop-blur-xl shadow-lg shadow-emerald-900/5 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-lg sm:text-xl shadow-sm flex-shrink-0">
                ✓
              </div>
              <div>
                <h4 className="font-semibold text-emerald-950 text-sm sm:text-base">
                  Patient erfolgreich aufgenommen!
                </h4>
                <p className="text-emerald-700 text-xs sm:text-sm mt-0.5">
                  <span className="font-medium text-emerald-900">{successEntry.name}</span> wurde in die Warteschlange eingetragen.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
              <Link
                to="/reception"
                className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                In Live-Übersicht ansehen →
              </Link>
              <button
                type="button"
                onClick={() => setSuccessEntry(null)}
                className="text-emerald-600 hover:text-emerald-900 text-xs font-medium px-2 py-1"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 text-xs font-bold ml-2">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-8">
        {/* Sektion 1: Stammdaten */}
        <section className="bg-white/80 backdrop-blur-xl p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl border border-stone-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-base sm:text-lg font-semibold text-stone-900 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="text-base">👤</span>
            <span>Patienten-Stammdaten</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Vorname *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="z.B. Clara"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Nachname *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="z.B. Schumann"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Geburtsdatum
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Geschlecht
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              >
                <option value="weiblich">Weiblich</option>
                <option value="männlich">Männlich</option>
                <option value="divers">Divers</option>
              </select>
            </div>
          </div>
        </section>

        {/* Sektion 2: Krankenversicherung & Kontakt */}
        <section className="bg-white/80 backdrop-blur-xl p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl border border-stone-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-base sm:text-lg font-semibold text-stone-900 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="text-base">💳</span>
            <span>Versicherung & Notfallkontakt</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Krankenkasse
              </label>
              <input
                type="text"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                placeholder="z.B. Techniker Krankenkasse"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Versichertennummer
              </label>
              <input
                type="text"
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                placeholder="z.B. A123456789"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Telefon / Mobilnummer
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="z.B. +49 170 1234567"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Notfallkontakt (Name & Rufnummer)
              </label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="z.B. Robert Schumann (Ehemann, 0171...)"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>
          </div>
        </section>

        {/* Sektion 3: Triage & Leitsymptom */}
        <section className="bg-white/80 backdrop-blur-xl p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-3xl border border-stone-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-base sm:text-lg font-semibold text-stone-900 mb-1.5 flex items-center gap-2">
            <span className="text-base">🚨</span>
            <span>Triage & Dringlichkeitsstufe (MTS)</span>
          </h3>
          <p className="text-stone-500 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
            Wählen Sie die Prioritätsstufe zur automatisierten Wartezeit- und Ressourcenallokation.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-6">
            {TRIAGE_OPTIONS.map((opt) => {
              const isSelected = triageLevel === opt.level;
              return (
                <button
                  type="button"
                  key={opt.level}
                  onClick={() => setTriageLevel(opt.level)}
                  className={`
                    p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 min-h-[72px] sm:min-h-[80px]
                    ${opt.bg} ${opt.border}
                    ${isSelected ? 'ring-2 ring-stone-900 shadow-md scale-[1.02]' : 'opacity-70 hover:opacity-100 hover:shadow-xs'}
                  `}
                >
                  <span className={`text-xs font-bold ${opt.color}`}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-stone-600 mt-1 font-medium leading-tight">
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Leitsymptom / Hauptbeschwerde
              </label>
              <textarea
                rows={3}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="z.B. Akute Dyspnoe seit 2 Stunden, Thoraxdruck, Blutdruck 160/95..."
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Bekannte Allergien & Vorerkrankungen
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="z.B. Penicillin-Allergie, KHK, Diabetes Typ 2"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
              />
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="
              w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl
              bg-stone-900 hover:bg-stone-800
              text-stone-50 font-semibold text-sm
              shadow-xl shadow-stone-900/15
              transition-all duration-200 active:scale-[0.98]
              disabled:opacity-50 flex items-center justify-center gap-2.5
            "
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-300 border-t-white rounded-full animate-spin" />
                <span>Übermittle Falldaten...</span>
              </>
            ) : (
              <>
                <span>Aufnahme abschließen</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
