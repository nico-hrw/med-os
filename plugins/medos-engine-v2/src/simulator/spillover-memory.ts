import { PatientDemand, SpilloverState } from '../types/simulation-types';

export class SpilloverMemory {
  private memoryHistory: Map<string, SpilloverState> = new Map();
  private currentBacklog: PatientDemand[] = [];

  public captureSpillover(
    fromDay: string,
    toDay: string,
    unservedPatients: PatientDemand[]
  ): SpilloverState {
    const unhandled = [...unservedPatients];
    this.currentBacklog = unhandled;

    const carryOverPatients = unhandled.map((patient) => ({
      ...patient,
      arrivalTimeMins: 0,
      urgencyLevel: Math.max(0, patient.urgencyLevel - 1),
    }));

    const state: SpilloverState = {
      fromDay,
      toDay,
      unhandledPatientIds: unhandled.map((p) => p.id),
      unhandledPatients: carryOverPatients,
      carryOverQueueLength: carryOverPatients.length,
      accumulatedDelayMins: carryOverPatients.reduce((acc, p) => acc + (600 - p.arrivalTimeMins), 0),
    };

    this.memoryHistory.set(fromDay, state);
    return state;
  }

  public getPendingBacklog(): PatientDemand[] {
    return [...this.currentBacklog];
  }

  public clear(): void {
    this.currentBacklog = [];
    this.memoryHistory.clear();
  }

  public getHistory(fromDay: string): SpilloverState | undefined {
    return this.memoryHistory.get(fromDay);
  }

  public getAllHistory(): SpilloverState[] {
    return Array.from(this.memoryHistory.values());
  }
}
