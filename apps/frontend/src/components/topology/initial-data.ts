import { Node, Edge } from 'reactflow';
import { CustomNodeData } from './CustomNode';

export const initialNodes: Node<CustomNodeData>[] = [
  {
    id: 'core',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: 'Microkernel Core',
      status: 'active',
      description: 'Zentraler Orchestrator für alle Plugins.',
      concept: 'Der Core fungiert als extrem sicherer Bus. Er übernimmt selbst keine medizinische Geschäftslogik, sondern vermittelt ausschließlich Nachrichten und lädt Module strikt nach dem "Least Privilege"-Prinzip.',
    },
  },
  {
    id: 'patient-onboarding',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: 'Patienten-Onboarding',
      status: 'active',
      description: 'Verwaltet die Aufnahmeprozesse.',
      concept: 'Sammelt und verifiziert sensible Patientendaten (KYC) und leitet erste Triage-Schritte zur Risikobewertung direkt bei der Notaufnahme ein.',
    },
  },
  {
    id: 'scheduling',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: 'Predictive Scheduling',
      status: 'planned',
      description: 'KI-gestützte Terminvergabe.',
      concept: 'Nutzt maschinelles Lernen, um die Auslastung von OP-Sälen und Fachärzten proaktiv zu optimieren.',
      mathModel: 'Markov-Entscheidungskette (MDP) zur Minimierung von Leerlaufzeiten: V(s) = max_a (R(s,a) + γ Σ P(s\'|s,a)V(s\'))',
    },
  },
  {
    id: 'hl7',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: 'HL7-Schnittstelle',
      status: 'active',
      description: 'Legacy-Integration.',
      concept: 'Übersetzt moderne JSON- und protobuf-Payloads in das klassische HL7 v2 / v3 Format, um den Datenaustausch mit älteren Großgeräten (z.B. MRT, Röntgen) sicherzustellen.',
    },
  },
  {
    id: 'legacy-db',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monolith DB Sync',
      status: 'deprecated',
      description: 'Veraltete Datenbank-Synchronisation.',
      concept: 'Dieses Modul wurde vollständig durch die neue Event-Sourcing Architektur abgelöst und dient nur noch als Read-Only Gateway zu archivierten Altakten.',
    },
  }
];

export const initialEdges: Edge[] = [
  { id: 'e-core-onboarding', source: 'core', target: 'patient-onboarding' },
  { id: 'e-core-scheduling', source: 'core', target: 'scheduling' },
  { id: 'e-core-hl7', source: 'core', target: 'hl7' },
  { id: 'e-hl7-legacy', source: 'hl7', target: 'legacy-db' },
];
