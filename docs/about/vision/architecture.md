Med-OS Engine v2 - Zielbild & Systemarchitektur
1. Vision & Gesamtziel
Entwicklung einer hybriden, hochpräzisen Berechnungs- und Vorhersage-Engine für medizinische Einrichtungen (Praxen & Kliniken). Die Engine fungiert als intelligentes Backend-Plugin für ein Praxisverwaltungssystem (SAP-ähnliches Interface). Das Kernziel ist die autonome Übernahme von ca. 70% der digitalen Planungsarbeit (Schichtplanung, Ressourcenzuteilung, Auslastungsvorhersage) für medizinisches Personal und Patienten.
2. Paradigma: Neuro-Symbolische KI
Das System kombiniert harte mathematische Garantien mit adaptiven KI-Modellen. Es ist kein isolierter, freidrehender KI-Agent ("Blackbox"), sondern ein kontrolliertes System aus vier Ebenen:

Der Controller (MILP-Solver): Das deterministische Sicherheitsfundament. Berechnet das legale Schicht-Skelett und garantiert die Einhaltung von Mindestbesetzungen, Arbeitsrecht (ArbZG) und Facharzt-Anwesenheiten (Hard Constraints).
Der Prädiktive KI-Agent: Ein Machine-Learning-Modell für die Nachfragevorhersage. Lernt saisonale Schwankungen (Krankheitswellen), tageszeitliche Verteilungen (Morning Rush) und stochastische No-Show-Raten für intelligentes Overbooking.
Der Stresstest-Simulator (Digitaler Zwilling): Ein vektorisierter High-Performance-Simulator (NumPy/heapq). Konfrontiert den Basisplan mit extremen, zufälligen Szenarien (Notfälle, Materialengpässe, mehrtägiger Backlog-Spillover) in Millisekunden.
Der Optimierende KI-Agent: Ein Reinforcement-Learning oder metaheuristischer Agent (z. B. ALNS), der den Plan basierend auf den Stresstests feinjustiert (Pausenverschiebungen, asynchrone Aufgaben), ohne die Regeln des Controllers zu brechen.
3. Architektur-Prinzipien
Plugin-Architektur: Die Engine ist als versionierbares, zustandsloses Backend-Modul konzipiert. Die spätere Auslagerung in eine eigenständige Instanz (Microservice) via REST/gRPC-API ist strukturell vorbereitet.
Maximale Sicherheit (Fail-Safe): Fällt ein KI-Modul aus, fällt das System iterativ auf den mathematischen Solver (Controller) und notfalls auf eine statische Baseline zurück. Niemals entsteht ein illegaler Dienstplan.
Vollständige Observability (Logging): Jeder KI-Eingriff, jede Stresstest-Anomalie und jede Solver-Entscheidung muss lückenlos, revisionssicher und nachvollziehbar geloggt werden (Audit-Fähigkeit).
Nutzerlesbarkeit: Regeln, Constraints und Parameter müssen so strukturiert sein, dass Praxismanager oder medizinische Administratoren sie in einem Interface nachvollziehen können.
4. Kernverbesserungen gegenüber v1 (Lessons Learned)
Ablösung der fehleranfälligen Greedy-Heuristik durch den MILP-Solver zur Vermeidung lokaler Minima.
Einführung eines "Multi-Day Memory": Patientenrückstaus (Spillover) werden auf Folgetage übertragen.
Eliminierung von SimPy-Performance-Overhead zugunsten eines flachen Event-Heaps für Echtzeit-Massensimulationen.
