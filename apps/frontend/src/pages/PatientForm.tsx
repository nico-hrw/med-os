import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = '/yeti/api';

export interface FormFieldSchema {
  id: string;
  type: 'text' | 'textarea' | 'scale' | 'boolean' | 'select';
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  defaultValue?: any;
}

export interface PatientProfile {
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  insurance?: string;
  insuranceNumber: string;
  phone?: string;
  emergencyContact?: string;
  lastVisit?: string;
  upcomingAppointment?: string;
  triageLevel?: string;
}

type Step = 'welcome' | 'master_data' | 'welcome_back' | 'questions' | 'review' | 'success';

export const PatientForm: React.FC = () => {
  const [step, setStep] = useState<Step>('welcome');

  // Login-Suche
  const [searchInsurance, setSearchInsurance] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Patientendaten
  const [patientData, setPatientData] = useState<PatientProfile>({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: 'divers',
    insurance: '',
    insuranceNumber: '',
    phone: '',
    emergencyContact: '',
  });

  const [isExistingPatient, setIsExistingPatient] = useState(false);

  // Dynamisches Schema & Antworten
  const [schema, setSchema] = useState<FormFieldSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Abschluss-Optionen
  const [saveProfile, setSaveProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedIntake, setConfirmedIntake] = useState<any | null>(null);

  // Formular-Schema vom Kernel laden
  useEffect(() => {
    setSchemaLoading(true);
    fetch(`${API_BASE}/onboarding/schema`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setSchema(json.data);
          // Initialwerte setzen
          const initialAnswers: Record<string, any> = {};
          json.data.forEach((field: FormFieldSchema) => {
            if (field.defaultValue !== undefined) {
              initialAnswers[field.id] = field.defaultValue;
            } else if (field.type === 'scale') {
              initialAnswers[field.id] = field.min || 1;
            } else if (field.type === 'boolean') {
              initialAnswers[field.id] = false;
            } else {
              initialAnswers[field.id] = '';
            }
          });
          setAnswers(initialAnswers);
        }
      })
      .catch((err) => console.warn('Schema-Ladefehler:', err))
      .finally(() => setSchemaLoading(false));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1. Suche nach bestehendem Patienten
  // ─────────────────────────────────────────────────────────────
  const handleSearchPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInsurance.trim();
    if (!query) {
      setSearchError('Bitte geben Sie Ihre Versichertennummer ein.');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const res = await fetch(`${API_BASE}/onboarding/patient/${encodeURIComponent(query)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Patient konnte nicht gefunden werden.');
      }

      const profile: PatientProfile = json.data;
      setPatientData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        birthDate: profile.birthDate || '',
        gender: profile.gender || 'divers',
        insurance: profile.insurance || '',
        insuranceNumber: profile.insuranceNumber || query,
        phone: profile.phone || '',
        emergencyContact: profile.emergencyContact || '',
        lastVisit: profile.lastVisit || 'Vor kurzem',
        upcomingAppointment: profile.upcomingAppointment || 'Heute (Akutaufnahme)',
      });

      setIsExistingPatient(true);
      setStep('welcome_back');
    } catch (err: any) {
      setSearchError(err.message || 'Versichertennummer nicht gefunden.');
    } finally {
      setSearchLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. Neuanmeldung starten
  // ─────────────────────────────────────────────────────────────
  const handleStartNewPatient = () => {
    setIsExistingPatient(false);
    setPatientData({
      firstName: '',
      lastName: '',
      birthDate: '',
      gender: 'divers',
      insurance: '',
      insuranceNumber: '',
      phone: '',
      emergencyContact: '',
    });
    setSearchError(null);
    setStep('master_data');
  };

  // ─────────────────────────────────────────────────────────────
  // 3. Antwort im dynamischen Fragebogen ändern
  // ─────────────────────────────────────────────────────────────
  const handleAnswerChange = (fieldId: string, val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Finale Übermittlung
  // ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      patientData,
      answers,
      saveProfile,
    };

    try {
      const res = await fetch(`${API_BASE}/onboarding/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Fehler beim Übermitteln der Aufnahme.');
      }

      setConfirmedIntake(json.data);
      setStep('success');
    } catch (err: any) {
      console.error('Submit Fehler:', err);
      setSubmitError(err.message || 'Netzwerkfehler beim Absenden der Aufnahmedaten.');
    } finally {
      setSubmitting(false);
    }
  };

  // Zurücksetzen für neue Aufnahme
  const handleReset = () => {
    setStep('welcome');
    setSearchInsurance('');
    setConfirmedIntake(null);
    setSubmitError(null);
    setSearchError(null);
    setIsExistingPatient(false);
  };

  return (
    <div className="max-w-4xl mx-auto mt-2 sm:mt-4 pb-16 px-1 sm:px-2">
      {/* Header */}
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xl">🏥</span>
            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-stone-400 font-semibold">
              Klinisches Modul: patient-onboarding
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-stone-900 tracking-tight">
            Patientenaufnahme & Self-Check-in
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm md:text-base mt-1">
            Digitale Erstaufnahme mit dynamischer Anamnese und MTS-Triage
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

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 1: WILLKOMMENS-BILDSCHIRM (A: Bestandspatient | B: Neuanmeldung)
         ───────────────────────────────────────────────────────────── */}
      {step === 'welcome' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-white/80 backdrop-blur-xl border border-stone-200/70 p-6 sm:p-10 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xs">
              👋
            </div>
            <h3 className="text-2xl sm:text-3xl font-serif text-stone-900 mb-2">
              Herzlich willkommen im MedOS Aufnahmeportal
            </h3>
            <p className="text-stone-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Wählen Sie bitte aus, ob Sie bereits bei uns behandelt wurden oder sich heute zum ersten Mal vorstellen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OPTION [A]: Bereits Patient */}
            <div className="bg-white/85 backdrop-blur-xl border border-stone-200/80 hover:border-stone-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-2xl">
                    🆔
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 font-semibold">
                    Schnell-Check-in
                  </span>
                </div>

                <h4 className="text-xl font-serif text-stone-900 mb-2">
                  Ich bin bereits Patient
                </h4>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed mb-6">
                  Geben Sie Ihre Versichertennummer ein. Ihre Stammdaten werden automatisch geladen.
                </p>

                <form onSubmit={handleSearchPatient} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                      Versichertennummer
                    </label>
                    <input
                      type="text"
                      value={searchInsurance}
                      onChange={(e) => {
                        setSearchInsurance(e.target.value);
                        setSearchError(null);
                      }}
                      placeholder="z.B. A123456789"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm font-mono uppercase"
                    />
                  </div>

                  {searchError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>⚠️</span>
                        <span>{searchError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartNewPatient}
                        className="text-left text-[11px] underline font-semibold text-rose-800 hover:text-rose-950 mt-0.5"
                      >
                        Jetzt als neuer Patient registrieren →
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="
                      mt-2 w-full py-3 rounded-xl
                      bg-stone-900 hover:bg-stone-800 text-stone-50
                      text-xs sm:text-sm font-semibold shadow-md shadow-stone-900/10
                      transition-all active:scale-[0.98] disabled:opacity-50
                      flex items-center justify-center gap-2
                    "
                  >
                    {searchLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-stone-300 border-t-white rounded-full animate-spin" />
                        <span>Prüfe Versichertendaten...</span>
                      </>
                    ) : (
                      <>
                        <span>Daten laden & Weiter</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400 font-mono">
                <span>Demo-Nummer:</span>
                <button
                  type="button"
                  onClick={() => setSearchInsurance('A123456789')}
                  className="text-stone-700 hover:underline font-semibold"
                >
                  A123456789 (Clara Schumann)
                </button>
              </div>
            </div>

            {/* OPTION [B]: Neuer Patient */}
            <div className="bg-white/85 backdrop-blur-xl border border-stone-200/80 hover:border-stone-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-2xl">
                    ✨
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 font-semibold">
                    Erstaufnahme
                  </span>
                </div>

                <h4 className="text-xl font-serif text-stone-900 mb-2">
                  Neuer Patient
                </h4>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed mb-6">
                  Sie sind zum ersten Mal bei uns? Erfassen Sie in wenigen Schritten Ihre persönlichen Stammdaten für die elektronische Fallakte.
                </p>

                <ul className="space-y-2.5 mb-6 text-xs text-stone-600 bg-stone-50/70 p-4 rounded-2xl border border-stone-100">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>Erfassung gesetzlicher Identitätsnachweise</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>Verschlüsselte Übertragung an die Praxis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>Direkte Zuweisung zur digitalen Warteschlange</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleStartNewPatient}
                className="
                  w-full py-3 rounded-xl
                  bg-stone-100 hover:bg-stone-200 text-stone-800
                  text-xs sm:text-sm font-semibold border border-stone-200/80
                  transition-all active:scale-[0.98]
                  flex items-center justify-center gap-2
                "
              >
                <span>Neuanmeldung starten</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 2: WILLKOMMEN ZURÜCK (BESTANDSPATIENTEN-KARTE)
         ───────────────────────────────────────────────────────────── */}
      {step === 'welcome_back' && (
        <div className="bg-white/90 backdrop-blur-xl border border-stone-200/80 p-6 sm:p-10 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.03)] animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-stone-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl shadow-sm">
                👤
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  Patient erkannt
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
                  Guten Tag, {patientData.gender === 'weiblich' ? 'Frau' : patientData.gender === 'männlich' ? 'Herr' : ''} {patientData.firstName} {patientData.lastName}!
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="text-xs text-stone-400 hover:text-stone-700 underline"
            >
              Abmelden / Wechseln
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/50">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold block mb-1">
                Krankenkasse & Nummer
              </span>
              <p className="text-sm font-medium text-stone-800">
                {patientData.insurance || 'Krankenkasse hinterlegt'}
              </p>
              <p className="text-xs font-mono text-stone-500 mt-0.5">
                {patientData.insuranceNumber}
              </p>
            </div>

            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/50">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold block mb-1">
                Letzter Besuch
              </span>
              <p className="text-sm font-medium text-stone-800">
                {patientData.lastVisit || 'Vor kurzem'}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Stammdaten sind aktuell
              </p>
            </div>

            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/50 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold block mb-1">
                Nächster / Geplanter Termin
              </span>
              <p className="text-sm font-medium text-stone-800">
                {patientData.upcomingAppointment || 'Heute (Akutaufnahme)'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Priorisiertes MTS-Routing aktiv
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 mb-8 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <span className="text-base">ℹ️</span>
            <div>
              Ihre Stammdaten werden automatisch übernommen. Im nächsten Schritt erfassen wir kurz Ihre heutigen Beschwerden für die Behandlungs-Priorisierung.
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep('master_data')}
              className="text-xs text-stone-500 hover:text-stone-900 font-medium"
            >
              Stammdaten anpassen / bearbeiten
            </button>

            <button
              type="button"
              onClick={() => setStep('questions')}
              className="
                px-8 py-3.5 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-sm font-semibold shadow-lg shadow-stone-900/15
                transition-all active:scale-[0.98] flex items-center gap-2
              "
            >
              <span>Weiter zum medizinischen Fragebogen</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 3: NEUANMELDUNG (STAMMDATEN-FORMULAR)
         ───────────────────────────────────────────────────────────── */}
      {step === 'master_data' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!patientData.firstName.trim() || !patientData.lastName.trim()) {
              alert('Bitte Vor- und Nachnamen angeben.');
              return;
            }
            setStep('questions');
          }}
          className="flex flex-col gap-6 animate-in fade-in duration-300"
        >
          <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">👤</span>
                <h3 className="text-xl font-semibold text-stone-900">
                  {isExistingPatient ? 'Stammdaten anpassen' : 'Persönliche Stammdaten'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStep(isExistingPatient ? 'welcome_back' : 'welcome')}
                className="text-xs text-stone-400 hover:text-stone-700"
              >
                Zurück
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Vorname *
                </label>
                <input
                  type="text"
                  required
                  value={patientData.firstName}
                  onChange={(e) => setPatientData({ ...patientData, firstName: e.target.value })}
                  placeholder="z.B. Clara"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Nachname *
                </label>
                <input
                  type="text"
                  required
                  value={patientData.lastName}
                  onChange={(e) => setPatientData({ ...patientData, lastName: e.target.value })}
                  placeholder="z.B. Schumann"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Geburtsdatum
                </label>
                <input
                  type="date"
                  value={patientData.birthDate}
                  onChange={(e) => setPatientData({ ...patientData, birthDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Geschlecht
                </label>
                <select
                  value={patientData.gender}
                  onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                >
                  <option value="weiblich">Weiblich</option>
                  <option value="männlich">Männlich</option>
                  <option value="divers">Divers</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Krankenkasse
                </label>
                <input
                  type="text"
                  value={patientData.insurance}
                  onChange={(e) => setPatientData({ ...patientData, insurance: e.target.value })}
                  placeholder="z.B. Techniker Krankenkasse"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Versichertennummer
                </label>
                <input
                  type="text"
                  value={patientData.insuranceNumber}
                  onChange={(e) => setPatientData({ ...patientData, insuranceNumber: e.target.value.toUpperCase() })}
                  placeholder="z.B. A123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Telefon / Mobil
                </label>
                <input
                  type="tel"
                  value={patientData.phone}
                  onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                  placeholder="z.B. +49 170 1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                  Notfallkontakt (Name & Rufnummer)
                </label>
                <input
                  type="text"
                  value={patientData.emergencyContact}
                  onChange={(e) => setPatientData({ ...patientData, emergencyContact: e.target.value })}
                  placeholder="z.B. Angehöriger, 0171..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(isExistingPatient ? 'welcome_back' : 'welcome')}
              className="px-5 py-3 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              ← Zurück
            </button>

            <button
              type="submit"
              className="
                px-8 py-3.5 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-sm font-semibold shadow-lg shadow-stone-900/15
                transition-all active:scale-[0.98] flex items-center gap-2
              "
            >
              <span>Weiter zu den medizinischen Fragen</span>
              <span>→</span>
            </button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 4: DYNAMISCHER FRAGEBOGEN (ANAMNESE)
         ───────────────────────────────────────────────────────────── */}
      {step === 'questions' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
                  <span>📋</span>
                  <span>Medizinische Anamnese</span>
                </h3>
                <p className="text-stone-500 text-xs sm:text-sm mt-1">
                  Dynamisches Formular für <span className="font-semibold text-stone-800">{patientData.firstName} {patientData.lastName}</span>
                </p>
              </div>

              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                JSON-Schema Engine
              </span>
            </div>

            {schemaLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
              </div>
            ) : schema.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-sm">
                Keine Fragen im Schema definiert.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {schema.map((field) => {
                  const val = answers[field.id];

                  return (
                    <div
                      key={field.id}
                      className="bg-stone-50/60 p-4 sm:p-5 rounded-2xl border border-stone-200/50 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="text-xs sm:text-sm font-semibold text-stone-900">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                      </div>

                      {field.description && (
                        <p className="text-[11px] sm:text-xs text-stone-500 leading-relaxed -mt-1">
                          {field.description}
                        </p>
                      )}

                      {/* TEXT FIELD */}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          required={field.required}
                          value={val || ''}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm mt-1"
                        />
                      )}

                      {/* TEXTAREA FIELD */}
                      {field.type === 'textarea' && (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={val || ''}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm leading-relaxed mt-1"
                        />
                      )}

                      {/* SCHMERZSKALA (SCALE 1 - 10) */}
                      {field.type === 'scale' && (
                        <div className="mt-2">
                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2">
                            {Array.from({ length: (field.max || 10) - (field.min || 1) + 1 }, (_, i) => {
                              const num = (field.min || 1) + i;
                              const isSelected = val === num;

                              // Farbcodierung
                              let colorClass = 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-200';
                              if (num <= 3) {
                                colorClass = isSelected
                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-700 border-transparent shadow'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100';
                              } else if (num <= 6) {
                                colorClass = isSelected
                                  ? 'bg-amber-500 text-white ring-2 ring-amber-600 border-transparent shadow'
                                  : 'bg-amber-50 text-amber-800 border-amber-200/70 hover:bg-amber-100';
                              } else if (num <= 8) {
                                colorClass = isSelected
                                  ? 'bg-orange-600 text-white ring-2 ring-orange-700 border-transparent shadow'
                                  : 'bg-orange-50 text-orange-800 border-orange-200/70 hover:bg-orange-100';
                              } else {
                                colorClass = isSelected
                                  ? 'bg-red-600 text-white ring-2 ring-red-700 border-transparent shadow'
                                  : 'bg-red-50 text-red-800 border-red-200/70 hover:bg-red-100';
                              }

                              return (
                                <button
                                  type="button"
                                  key={num}
                                  onClick={() => handleAnswerChange(field.id, num)}
                                  className={`
                                    py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center
                                    ${colorClass}
                                  `}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-stone-400 mt-2 px-1 font-mono">
                            <span>1 = gering</span>
                            <span>5 = mäßig</span>
                            <span>10 = extrem</span>
                          </div>
                        </div>
                      )}

                      {/* BOOLEAN FIELD (JA / NEIN TOGGLE) */}
                      {field.type === 'boolean' && (
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(field.id, true)}
                            className={`
                              px-5 py-2 rounded-xl text-xs font-semibold border transition-all
                              ${val === true
                                ? 'bg-stone-900 text-stone-50 border-stone-900 shadow-xs'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'}
                            `}
                          >
                            Ja
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(field.id, false)}
                            className={`
                              px-5 py-2 rounded-xl text-xs font-semibold border transition-all
                              ${val === false
                                ? 'bg-stone-900 text-stone-50 border-stone-900 shadow-xs'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'}
                            `}
                          >
                            Nein
                          </button>
                        </div>
                      )}

                      {/* SELECT FIELD */}
                      {field.type === 'select' && (
                        <select
                          required={field.required}
                          value={val || ''}
                          onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-base sm:text-sm mt-1"
                        >
                          <option value="">Bitte wählen...</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(isExistingPatient ? 'welcome_back' : 'master_data')}
              className="px-5 py-3 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              ← Zurück
            </button>

            <button
              type="button"
              onClick={() => setStep('review')}
              className="
                px-8 py-3.5 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-sm font-semibold shadow-lg shadow-stone-900/15
                transition-all active:scale-[0.98] flex items-center gap-2
              "
            >
              <span>Weiter zur Bestätigung</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 5: ABSCHLUSS & PRÜFUNG (REVIEW & SUBMIT)
         ───────────────────────────────────────────────────────────── */}
      {step === 'review' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-stone-200/70 shadow-xs">
            <h3 className="text-xl font-semibold text-stone-900 mb-2 flex items-center gap-2">
              <span>📋</span>
              <span>Zusammenfassung & Aufnahme abschließen</span>
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm mb-6">
              Bitte überprüfen Sie Ihre Eingaben vor der endgültigen Übermittlung an die Praxis.
            </p>

            {/* Übersicht Patientendaten */}
            <div className="bg-stone-50/80 p-5 rounded-2xl border border-stone-200/60 mb-6">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold font-mono block mb-2">
                Patientendaten
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block">Name:</span>
                  <span className="font-semibold text-stone-900">
                    {patientData.firstName} {patientData.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block">Versichertennummer:</span>
                  <span className="font-mono font-semibold text-stone-900">
                    {patientData.insuranceNumber || 'Nicht angegeben'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block">Krankenkasse:</span>
                  <span className="text-stone-800">{patientData.insurance || 'Keine Angabe'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block">Telefon:</span>
                  <span className="text-stone-800">{patientData.phone || 'Keine Angabe'}</span>
                </div>
              </div>
            </div>

            {/* Übersicht Antworten */}
            <div className="bg-stone-50/80 p-5 rounded-2xl border border-stone-200/60 mb-6">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold font-mono block mb-2">
                Erfasste Beschwerden & Anamnese
              </span>
              <div className="flex flex-col gap-2.5 text-xs">
                {schema.map((field) => (
                  <div key={field.id} className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-stone-200/40 pb-1.5 last:border-0">
                    <span className="text-stone-500 font-medium">{field.label}:</span>
                    <span className="font-semibold text-stone-900 text-right">
                      {answers[field.id] === true
                        ? 'Ja'
                        : answers[field.id] === false
                        ? 'Nein'
                        : answers[field.id] || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkbox: Daten merken */}
            <div className="bg-stone-50/90 border border-stone-200/70 rounded-2xl p-4 sm:p-5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveProfile}
                  onChange={(e) => setSaveProfile(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                />
                <div className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  <span className="font-semibold text-stone-900 block mb-0.5">
                    Meine Daten für zukünftige Besuche auf diesem Gerät/Terminal merken
                  </span>
                  Ermöglicht den schnellen Login bei künftigen Besuchen via Versichertennummer ohne erneute Eingabe der Stammdaten.
                </div>
              </label>
            </div>

            {submitError && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm">
                ⚠️ {submitError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep('questions')}
              className="px-5 py-3 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              ← Fragen bearbeiten
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="
                px-8 py-3.5 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-sm font-semibold shadow-xl shadow-stone-900/15
                transition-all active:scale-[0.98] disabled:opacity-50
                flex items-center gap-2.5
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
                  <span>✓</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCHRITT 6: ERFOLGS-ANZEIGE (STATUS-SCREEN)
         ───────────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="bg-white/90 backdrop-blur-2xl border border-stone-200/80 p-8 sm:p-12 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.04)] text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500 text-white flex items-center justify-center text-4xl mx-auto mb-6 shadow-md shadow-emerald-500/20">
            ✓
          </div>

          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
            Status: Angemeldet & Eingereiht
          </span>

          <h3 className="text-3xl sm:text-4xl font-serif text-stone-900 mt-4 mb-2">
            Erfolgreich angemeldet!
          </h3>

          <p className="text-stone-600 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-8">
            Vielen Dank, <span className="font-semibold text-stone-900">{patientData.firstName} {patientData.lastName}</span>. Ihre Daten wurden sicher an das Praxispersonal übermittelt.
          </p>

          <div className="bg-stone-50/90 border border-stone-200/60 p-6 rounded-2xl max-w-sm mx-auto mb-8">
            <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold font-mono block mb-1">
              Ihre Aufruf-Kennung
            </span>
            <span className="text-3xl font-serif text-stone-900 tracking-tight font-semibold">
              {confirmedIntake?.id ? `T-${confirmedIntake.id.substring(confirmedIntake.id.length - 4).toUpperCase()}` : 'T-0104'}
            </span>
            <p className="text-xs text-stone-500 mt-2">
              Bitte nehmen Sie im Wartebereich Platz. Ihr Aufruf erfolgt über die Monitore.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="
                w-full sm:w-auto px-6 py-3 rounded-2xl
                bg-stone-900 hover:bg-stone-800 text-stone-50
                text-xs sm:text-sm font-semibold shadow-md shadow-stone-900/10
                transition-all active:scale-[0.98]
              "
            >
              Weitere Aufnahme starten
            </button>

            <Link
              to="/reception"
              className="
                w-full sm:w-auto px-6 py-3 rounded-2xl
                bg-stone-100 hover:bg-stone-200 text-stone-700
                text-xs sm:text-sm font-medium transition-colors
              "
            >
              Live-Monitor öffnen →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
