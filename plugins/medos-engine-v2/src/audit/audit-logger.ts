import { IDatabaseProxy } from '../constraints/constraint-registry';

export type AuditEventType =
  | 'SOLVER_BASELINE_COMPUTED'
  | 'DEMAND_PREDICTED'
  | 'STRESS_TEST_EXECUTED'
  | 'ALNS_OPTIMIZATION_COMPLETED'
  | 'HARD_CONSTRAINT_VIOLATION_BLOCKED'
  | 'CONFIG_UPDATED';

export interface AuditRecord {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  actor: string;
  summary: string;
  details: Record<string, unknown>;
}

export class AuditLogger {
  private inMemoryLogs: AuditRecord[] = [];
  private db?: IDatabaseProxy;

  constructor(db?: unknown) {
    this.db = db as IDatabaseProxy | undefined;
  }

  public async logEvent(
    eventType: AuditEventType,
    summary: string,
    details: Record<string, unknown> = {},
    actor = 'System/Engine-v2'
  ): Promise<AuditRecord> {
    const record: AuditRecord = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      eventType,
      actor,
      summary,
      details,
    };

    this.inMemoryLogs.unshift(record);

    if (this.inMemoryLogs.length > 500) {
      this.inMemoryLogs.pop();
    }

    if (this.db && typeof this.db.setJson === 'function') {
      try {
        const todayKey = `audit:log:${new Date().toISOString().slice(0, 10)}`;
        await this.db.setJson(todayKey, this.inMemoryLogs.slice(0, 100));
      } catch {
        // Fallback
      }
    }

    return record;
  }

  public getRecentLogs(limit = 50, filterType?: AuditEventType): AuditRecord[] {
    if (filterType) {
      return this.inMemoryLogs.filter((l) => l.eventType === filterType).slice(0, limit);
    }
    return this.inMemoryLogs.slice(0, limit);
  }
}
