Med-OS Engine v2 - Projektstruktur & Constraint-Verwaltung
1. Verzeichnisstruktur für Regeln und Richtlinien
Um die Vielzahl an "Soll"- und "Soll nicht"-Szenarien (Constraints) wartbar, versionierbar und nutzerlesbar zu halten, wird ein dediziertes, domänenspezifisches Ordnersystem etabliert. Diese Struktur spiegelt sich sowohl im Code-Repository (als JSON/YAML-Konfigurationen) als auch in der geplanten UI für den Endanwender wider.

config/

└── constraints/

    ├── 01_labor_law/           # Arbeitsrecht (ArbZG)

    ├── 02_medical_safety/      # Medizinische Sicherheit & Hygiene

    ├── 03_ergonomics/          # Mitarbeiter-Ergonomie & Workflow

    ├── 04_data_privacy/        # Datenschutz (DSGVO, Zugriffskontrollen)

    └── 05_economics/           # Betriebswirtschaft & Ressourcen
2. Das "Soll / Soll nicht" Klassifikationssystem (Constraint Types)
Die Regeln werden nicht mehr implizit im Code versteckt, sondern als explizite Konfigurationsobjekte definiert. Wir unterscheiden streng zwischen:
A. Hard Constraints (Zwingende "Muss" / "Darf auf keinen Fall" Regeln)
Dies sind unverhandelbare Leitplanken für den MILP-Solver (Controller). Werden diese verletzt, ist der Plan illegal und wird verworfen.

Typ: Hard_Must (Soll zwingend) / Hard_Must_Not (Soll unter keinen Umständen)
Beispiele:
Hard_Must (Arbeitsrecht): "Eine Schicht muss mindestens 4 Stunden (240 Minuten) dauern."
Hard_Must (Medizin): "Bei geplanten OP-Fällen am Tag muss zu jedem Zeitpunkt mindestens ein Arzt mit Spezialisierung 'Chirurgie' anwesend sein." [cite: 8]
Hard_Must_Not (Arbeitsrecht): "Zwischen zwei Schichten desselben Mitarbeiters dürfen nicht weniger als 11 Stunden Ruhezeit liegen."
Hard_Must_Not (Datenschutz): "Eine MFA ohne administrative Freigabe darf nicht für den Backoffice-Block 'Abrechnung' eingeteilt werden."
B. Soft Constraints (Gewünschte "Sollte" / "Sollte eher nicht" Regeln)
Dies sind Optimierungsziele für den KI-Agenten. Verletzungen machen den Plan nicht illegal, aber "teurer" in der Kostenfunktion (Penalty Score).

Typ: Soft_Prefer (Sollte bevorzugt werden) / Soft_Avoid (Sollte vermieden werden)
Beispiele:
Soft_Avoid (Ergonomie): "Ein Mitarbeiter sollte nicht zweimal am selben Tag in die Praxis pendeln müssen (Split-Shifts vermeiden, außer bei Ärzten in Notfällen)." -> Penalty: +500 Punkte pro Split-Shift.
Soft_Avoid (Ergonomie): "Ein Mitarbeiter sollte nicht mehr als 80% seiner Schicht ununterbrochen im aktiven Patientenkontakt stehen (Erschöpfungs-Guard)." [cite: 6]
Soft_Prefer (Workflow): "Mittagspausen sollten gestaffelt stattfinden, damit der Empfang durchgehend mit mindestens einer MFA besetzt ist." [cite: 6]
Soft_Prefer (Medizin): "Ein Patient sollte bevorzugt von dem Arzt behandelt werden, der ihn beim letzten Besuch gesehen hat (Continuity of Care)."
3. Aufbau einer Constraint-Definition (Beispiel)
Jede Regel wird in einem maschinen- UND menschenlesbaren Format (z.B. YAML) definiert.

# config/constraints/03_ergonomics/avoid_split_shifts.yaml

id: "ERG-001"

name: "Vermeidung von geteilten Diensten (Split-Shifts)"

category: "Ergonomics"

type: "Soft_Avoid"

description: "Angestellte sollten nicht mehrfach am Tag anreisen müssen. Einzige Ausnahme: Ärzte im Rufbereitschafts-Notfall."

target_roles: ["MFA", "Doctor"]

# Die formale Logik für den Optimizer

evaluation_logic:

  condition: "count(shifts_per_day, employee) > 1"

  exceptions:

    - condition: "employee.role == 'Doctor' AND shift.type == 'Emergency_Call'"

  penalty_score: 500

# UI-Metadaten für das Dashboard

ui_visibility: true

user_editable: true # Praxismanager kann das Gewicht (Penalty) anpassen
4. Umsetzung im Entwicklungsprozess
Trennung von Logik und Konfiguration: Die Engine liest beim Start das constraints/ Verzeichnis ein. Der Solver formuliert daraus die mathematischen Gleichungen; die Kostenfunktion generiert daraus die Penalties.
Versionierung: Die Konfigurationsdateien liegen im Git-Repository. Jede Änderung an einer medizinischen Richtlinie ist nachvollziehbar.
Erweiterbarkeit: Wenn neue gesetzliche Vorgaben kommen, wird eine neue Datei hinzugefügt, ohne dass der Kerncode der Engine umgeschrieben werden muss.
