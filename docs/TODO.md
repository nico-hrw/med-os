# MedOS Yeti Entwicklungs-Roadmap & Offene Aufgaben (TODO)

Dieses Dokument erfasst geplante Architekturerweiterungen, funktionale Vertiefungen und Integrationsschritte fuer das MedOS Yeti Gesamtsystem sowie das Plugin `medos-engine-v2`.

---

## 1. Regelwerk & Constraint-Ausbau (`medos-engine-v2`)

- [ ] **Tarifvertragliche & Gesetzliche Arbeitszeitregeln (TVöD / Marburger Bund):**
  - Abbildung spezifischer Ruhezeitverkürzungen mit Ausgleichszeiträumen nach TVöD-K / TV-Ärzte.
  - Modellierung von Bereitschaftsdiensten, Rufbereitschaften und Höchstarbeitszeiten bei Bereitschaftsdienststufen.
  - Berücksichtigung von Wochenend- und Feiertagsruhezeiten sowie gesetzlichen Schichtzuschlägen.
- [ ] **Erweiterte Medizinische Facharzt- & Sicherheitsstandards:**
  - Qualifikationsmatrizen für apparative Untersuchungen (z. B. Fachkunde Strahlenschutz bei Röntgen, Sonographie-Zertifikate).
  - Hygienebeauftragter Arzt / MFA Pflichtanwesenheit bei invasiven Eingriffen.
  - Notfallmedizinisches Notfallteam (mindestens 1 Arzt mit ACLS/Notfallmedizin während voller Öffnungszeiten).
- [ ] **Erweiterte Ergonomische Richtlinien & Zirkadiane Rhythmen:**
  - Vorwärtsrotierende Schichtpläne (Frühschicht vor Spätschicht; Vermeidung von "Quick Returns" < 12h trotz Ausnahmegenehmigung).
  - Begrenzung aufeinanderfolgender Arbeitstage (max. 5–6 Tage am Stück).
  - Individuelle Mitarbeiterpräferenzen (z. B. Teilzeitmodelle, feste freie Tage für Fortbildung/Kinderbetreuung).
- [ ] **Dynamischer Regel-Editor im Frontend:**
  - Benutzerdefinierte Erstellung neuer Soft- und Hard-Constraints direkt über die Benutzeroberfläche (`/engine/constraints`) mit JSON-Schema-Validierung.

---

## 2. Klinische PVS- & Patienten-Onboarding Integration

- [ ] **Kopplung an das Modul `patient-onboarding`:**
  - Automatische Übergabe des berechneten und optimierten Schichtplans an die Terminkapazitätssteuerung.
  - Dynamische Anpassung buchbarer Terminslots im Patienten-Self-Service basierend auf der tatsächlichen Arzt- und MFA-Präsenz.
- [ ] **Interoperabilität & Standards (HL7 FHIR R4):**
  - Export von Schicht- und Saalbelegungen als FHIR `Schedule`- und `Slot`-Ressourcen.
  - Bereitstellung einer Schnittstelle zu etablierten Praxisverwaltungssystemen (PVS) via GDT/BDT oder FHIR Bridge (`hl7-fhir-bridge`).
- [ ] **Live-Feedback-Schleife (Closed-Loop Planning):**
  - Rückübermittlung realer Wartezimmer-Zahlen und Behandlungsdauern aus dem Empfangs-Dashboard in den `DemandPredictor` zur kontinuierlichen Kalibrierung stochastischer Verteilungen.

---

## 3. Schichtplan-Export Weiterentwicklung

- [ ] **Rechtssicherer PDF-Dienstplan:**
  - Generierung druckfertiger PDF-Monats- und Wochenübersichten inklusive Praxis-Briefkopf, Abteilungsstempel und Unterschriftszeilen für Praxisleitung und Betriebsrat/Mitarbeitervertretung.
- [ ] **Digitale Kalendersynchronisation (iCal / .ics):**
  - Bereitstellung personalisierter Webcal-/iCal-Feeds für Ärzte und Praxismitarbeiter zur nahtlosen Einbindung in Smartphone- und Praxiskalender.
