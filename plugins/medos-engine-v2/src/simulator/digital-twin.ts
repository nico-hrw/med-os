import {
  PatientDemand,
  QueueSample,
  ShockScenario,
  SimEvent,
  SimulationMetrics,
  SimulationRunResult,
  SpilloverState,
} from '../types/simulation-types';
import { EventHeap } from './event-heap';
import { SpilloverMemory } from './spillover-memory';

export interface DoctorResource {
  id: string;
  name: string;
  specialty: string;
  isAvailable: boolean;
  totalBusyMinutes: number;
}

export interface RoomResource {
  id: string;
  type: string;
  isOccupied: boolean;
  totalOccupiedMinutes: number;
}

export interface SimulationConfig {
  dayLengthMinutes?: number; // 600 min (08:00 - 18:00)
  enableSpillover?: boolean;
}

export class DigitalTwinSimulator {
  private eventHeap = new EventHeap();
  private spilloverMemory = new SpilloverMemory();

  public runDaySimulation(
    dayId: string,
    nextDayId: string,
    patients: PatientDemand[],
    staff: Array<{ id: string; role: string; skills: string[] }>,
    shocks: ShockScenario[] = [],
    config: SimulationConfig = {}
  ): SimulationRunResult {
    const startTime = performance.now();
    const dayLength = config.dayLengthMinutes ?? 600;

    // Ressourcen aufbauen
    const doctors: DoctorResource[] = staff
      .filter((s) => s.role === 'Doctor')
      .map((d) => ({
        id: d.id,
        name: d.id,
        specialty: d.skills[0] || 'Allgemeinmedizin',
        isAvailable: true,
        totalBusyMinutes: 0,
      }));

    const rooms: Record<string, RoomResource> = {
      standard_1: { id: 'standard_1', type: 'standard', isOccupied: false, totalOccupiedMinutes: 0 },
      standard_2: { id: 'standard_2', type: 'standard', isOccupied: false, totalOccupiedMinutes: 0 },
      xray_1: { id: 'xray_1', type: 'xray', isOccupied: false, totalOccupiedMinutes: 0 },
      surgery_1: { id: 'surgery_1', type: 'surgery', isOccupied: false, totalOccupiedMinutes: 0 },
      isolation_1: { id: 'isolation_1', type: 'isolation', isOccupied: false, totalOccupiedMinutes: 0 },
    };

    // Warteschlangen (sortiert nach Dringlichkeit 0 = Notfall bis 3 = AU)
    const waitingQueue: PatientDemand[] = [];
    const patientArrivalMap = new Map<string, number>();
    const waitTimes: number[] = [];
    const queueSamples: QueueSample[] = [];

    let completedPatientsCount = 0;
    let activeConsultations = 0;

    // 1. Initialisiere Ereignisse aus Patientenankuenften
    for (const p of patients) {
      if (p.isNoShow) continue; // No-Shows erscheinen nicht
      patientArrivalMap.set(p.id, p.arrivalTimeMins);
      this.eventHeap.push({
        timeMins: p.arrivalTimeMins,
        priority: p.urgencyLevel,
        type: 'PATIENT_ARRIVAL',
        patientId: p.id,
        payload: { patient: p },
      });
    }

    // 2. Initialisiere Schock-Szenarien
    for (const shock of shocks) {
      this.eventHeap.push({
        timeMins: shock.triggerTimeMins,
        priority: -1, // Hoechste Prioritaet
        type: 'SHOCK_TRIGGER',
        payload: { shock },
      });
    }

    let currentTime = 0;
    let lastSampleTime = -15;

    // 3. Haupt-Ereignisschleife des Event-Heaps
    while (!this.eventHeap.isEmpty()) {
      const event = this.eventHeap.pop()!;
      currentTime = event.timeMins;

      // Periodische Abtastung der Warteschlange fuer Auslastungs-Graphen
      if (currentTime - lastSampleTime >= 15 && currentTime <= dayLength) {
        queueSamples.push({
          timeMins: currentTime,
          waitingCount: waitingQueue.length,
          activeConsultations,
        });
        lastSampleTime = currentTime;
      }

      // Ereignisbehandlung
      switch (event.type) {
        case 'PATIENT_ARRIVAL': {
          const patient = (event.payload as any)?.patient as PatientDemand;
          if (patient) {
            // Einfuegen in Warteschlange nach Dringlichkeit (0 zuerst)
            waitingQueue.push(patient);
            waitingQueue.sort((a, b) => a.urgencyLevel - b.urgencyLevel || a.arrivalTimeMins - b.arrivalTimeMins);
            this.tryAssignNextPatients(currentTime, waitingQueue, doctors, rooms, waitTimes, patientArrivalMap, (count) => {
              activeConsultations += count;
            });
          }
          break;
        }

        case 'DOCTOR_CONSULT_END': {
          activeConsultations = Math.max(0, activeConsultations - 1);
          completedPatientsCount++;

          const doctorId = (event.payload as any)?.doctorId as string;
          const roomId = (event.payload as any)?.roomId as string;
          const duration = (event.payload as any)?.duration as number;

          const doc = doctors.find((d) => d.id === doctorId);
          if (doc) {
            doc.isAvailable = true;
            doc.totalBusyMinutes += duration;
          }

          if (roomId && rooms[roomId]) {
            rooms[roomId].isOccupied = false;
            rooms[roomId].totalOccupiedMinutes += duration;
          }

          // Sofort naechste wartende Patienten zuteilen
          this.tryAssignNextPatients(currentTime, waitingQueue, doctors, rooms, waitTimes, patientArrivalMap, (count) => {
            activeConsultations += count;
          });
          break;
        }

        case 'SHOCK_TRIGGER': {
          const shock = (event.payload as any)?.shock as ShockScenario;
          if (shock) {
            if (shock.type === 'STAFF_ABSENCE' && shock.affectedResourceId) {
              const absentDoc = doctors.find((d) => d.id === shock.affectedResourceId);
              if (absentDoc) {
                absentDoc.isAvailable = false;
              }
            } else if (shock.type === 'EMERGENCY_SURGE') {
              const surgeCount = shock.surgePatientCount || 6;
              for (let i = 0; i < surgeCount; i++) {
                const emergencyPat: PatientDemand = {
                  id: `SURGE-${shock.id}-${i + 1}`,
                  arrivalTimeMins: currentTime,
                  triage: 'notfall',
                  urgencyLevel: 0,
                  requiredSpecialty: 'Chirurgie',
                  requiredRoom: 'surgery',
                  baseDurationMins: 35,
                  isNoShow: false,
                };
                waitingQueue.unshift(emergencyPat);
                patientArrivalMap.set(emergencyPat.id, currentTime);
              }
              this.tryAssignNextPatients(currentTime, waitingQueue, doctors, rooms, waitTimes, patientArrivalMap, (count) => {
                activeConsultations += count;
              });
            }
          }
          break;
        }
      }
    }

    // 4. Nicht behandelte Patienten (Rueckstau am Ende des Tages) ermitteln
    const unservedPatients = [...waitingQueue];
    const spilloverState: SpilloverState = this.spilloverMemory.captureSpillover(
      dayId,
      nextDayId,
      unservedPatients
    );

    // 5. Metriken und Resilienz-Score berechnen
    const metrics = this.computeMetrics(
      patients.length,
      completedPatientsCount,
      unservedPatients.length,
      waitTimes,
      doctors,
      rooms,
      dayLength
    );

    const execTime = performance.now() - startTime;

    return {
      scenarioName: shocks.length > 0 ? `Stresstest (${shocks.map((s) => s.type).join(', ')})` : 'Regulärer Praxistag',
      metrics,
      spillover: spilloverState,
      queueTimeline: queueSamples,
      executionTimeMs: parseFloat(execTime.toFixed(2)),
    };
  }

  private tryAssignNextPatients(
    currentTime: number,
    queue: PatientDemand[],
    doctors: DoctorResource[],
    rooms: Record<string, RoomResource>,
    waitTimes: number[],
    arrivalMap: Map<string, number>,
    onAssigned: (count: number) => void
  ): void {
    let assignedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const patient = queue[i];

      // Finde passenden freien Arzt (bevorzugt Fachrichtung, Fallback Allgemein)
      const availableDoc =
        doctors.find((d) => d.isAvailable && d.specialty === patient.requiredSpecialty) ||
        doctors.find((d) => d.isAvailable && d.specialty === 'Allgemeinmedizin');

      if (!availableDoc) continue;

      // Finde passenden freien Raum
      const requiredType = patient.requiredRoom || 'standard';
      const availableRoom = Object.values(rooms).find(
        (r) => !r.isOccupied && (r.type === requiredType || (requiredType === 'standard' && r.type === 'standard'))
      );

      if (!availableRoom && requiredType !== 'standard') {
        continue; // Spezialraum zwingend erforderlich aber belegt
      }

      // Zuweisung erfolgreich
      queue.splice(i, 1);
      i--;

      availableDoc.isAvailable = false;
      if (availableRoom) availableRoom.isOccupied = true;

      const arrivalTime = arrivalMap.get(patient.id) ?? currentTime;
      const waitTime = Math.max(0, currentTime - arrivalTime);
      waitTimes.push(waitTime);

      assignedCount++;

      // Event fuer Ende der Behandlung planen
      this.eventHeap.push({
        timeMins: currentTime + patient.baseDurationMins,
        priority: 1,
        type: 'DOCTOR_CONSULT_END',
        patientId: patient.id,
        payload: {
          doctorId: availableDoc.id,
          roomId: availableRoom?.id,
          duration: patient.baseDurationMins,
        },
      });
    }

    if (assignedCount > 0) {
      onAssigned(assignedCount);
    }
  }

  private computeMetrics(
    total: number,
    completed: number,
    spillover: number,
    waitTimes: number[],
    doctors: DoctorResource[],
    rooms: Record<string, RoomResource>,
    dayLength: number
  ): SimulationMetrics {
    const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
    const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

    const sortedWait = [...waitTimes].sort((a, b) => a - b);
    const p90Index = Math.floor(sortedWait.length * 0.9);
    const p95Index = Math.floor(sortedWait.length * 0.95);
    const p90 = sortedWait.length > 0 ? sortedWait[p90Index] ?? 0 : 0;
    const p95 = sortedWait.length > 0 ? sortedWait[p95Index] ?? 0 : 0;

    const docUtil: Record<string, number> = {};
    for (const d of doctors) {
      docUtil[d.name] = parseFloat(Math.min(1, d.totalBusyMinutes / dayLength).toFixed(2));
    }

    const roomUtil: Record<string, number> = {};
    for (const [key, r] of Object.entries(rooms)) {
      roomUtil[key] = parseFloat(Math.min(1, r.totalOccupiedMinutes / dayLength).toFixed(2));
    }

    const bottlenecks: string[] = [];
    if (avgWait > 30) bottlenecks.push('Durchschnittliche Wartezeit ueberschreitet 30 Minuten');
    if (spillover > 5) bottlenecks.push(`Kritischer Spillover: ${spillover} Patienten muessen uebertragen werden`);
    if (roomUtil['surgery_1'] && roomUtil['surgery_1'] > 0.85) bottlenecks.push('OP-Zentrum nahe Kapazitaetsgrenze');
    if (roomUtil['xray_1'] && roomUtil['xray_1'] > 0.80) bottlenecks.push('Roentgen-Engpass identifiziert');

    // Resilienz-Score (0 bis 100)
    let score = 100;
    score -= Math.min(40, avgWait * 0.8);
    score -= Math.min(30, spillover * 5);
    if (maxWait > 60) score -= 15;
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
      totalPatients: total,
      completedPatients: completed,
      spilloverCount: spillover,
      avgWaitTimeMins: parseFloat(avgWait.toFixed(1)),
      maxWaitTimeMins: maxWait,
      p90WaitTimeMins: p90,
      p95WaitTimeMins: p95,
      doctorUtilization: docUtil,
      roomUtilization: roomUtil,
      bottlenecks,
      resilienceScore: finalScore,
    };
  }
}
