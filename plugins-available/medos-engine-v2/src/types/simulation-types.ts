export type TriageCategory = 'notfall' | 'routine' | 'schnellspur';

export type Specialty = 'Allgemeinmedizin' | 'Innere Medizin' | 'Orthopaedie' | 'Chirurgie';

export type RoomType = 'xray' | 'surgery' | 'isolation' | 'bed_ward' | 'standard';

export interface PatientDemand {
  id: string;
  arrivalTimeMins: number;
  triage: TriageCategory;
  urgencyLevel: number;
  requiredSpecialty: Specialty;
  requiredRoom?: RoomType;
  baseDurationMins: number;
  isNoShow: boolean;
}

export interface HourlyArrivalRate {
  hour: number;
  expectedArrivals: number;
  peakFactor: number;
}

export interface DemandProfile {
  date: string;
  totalExpectedPatients: number;
  noShowProbability: number;
  hourlyArrivalRates: HourlyArrivalRate[];
  generatedPatients: PatientDemand[];
}

export type SimEventType =
  | 'PATIENT_ARRIVAL'
  | 'TRIAGE_COMPLETE'
  | 'DOCTOR_CONSULT_START'
  | 'DOCTOR_CONSULT_END'
  | 'ROOM_RELEASE'
  | 'SHOCK_TRIGGER';

export interface SimEvent {
  timeMins: number;
  priority: number;
  type: SimEventType;
  patientId?: string;
  payload?: Record<string, unknown>;
}

export interface ShockScenario {
  id: string;
  type: 'STAFF_ABSENCE' | 'EMERGENCY_SURGE' | 'EQUIPMENT_OUTAGE';
  triggerTimeMins: number;
  affectedResourceId?: string;
  surgePatientCount?: number;
  durationMins?: number;
}

export interface SpilloverState {
  fromDay: string;
  toDay: string;
  unhandledPatientIds: string[];
  unhandledPatients: PatientDemand[];
  carryOverQueueLength: number;
  accumulatedDelayMins: number;
}

export interface SimulationMetrics {
  totalPatients: number;
  completedPatients: number;
  spilloverCount: number;
  avgWaitTimeMins: number;
  maxWaitTimeMins: number;
  p90WaitTimeMins: number;
  p95WaitTimeMins: number;
  doctorUtilization: Record<string, number>;
  roomUtilization: Record<string, number>;
  bottlenecks: string[];
  resilienceScore: number;
}

export interface QueueSample {
  timeMins: number;
  waitingCount: number;
  activeConsultations: number;
}

export interface SimulationRunResult {
  scenarioName: string;
  metrics: SimulationMetrics;
  spillover: SpilloverState;
  queueTimeline: QueueSample[];
  executionTimeMs: number;
}
