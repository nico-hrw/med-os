import { ConstraintDefinition } from '../types/engine-types';

export interface IDatabaseProxy {
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, data: unknown): Promise<void>;
  upsert?(key: string, payload: string): Promise<void>;
}

export class ConstraintRegistry {
  private db?: IDatabaseProxy;
  private constraints: Map<string, ConstraintDefinition> = new Map();
  private readonly storageKey = 'constraints:definitions';

  constructor(db?: unknown) {
    this.db = db as IDatabaseProxy | undefined;
  }

  public async initializeFromDefaults(jsonString: string): Promise<void> {
    try {
      const parsed = JSON.parse(jsonString) as ConstraintDefinition[];
      if (!Array.isArray(parsed)) {
        throw new Error('Default constraints configuration must be an array');
      }

      for (const item of parsed) {
        this.constraints.set(item.id, item);
      }

      if (this.db && typeof this.db.setJson === 'function') {
        await this.db.setJson(this.storageKey, Array.from(this.constraints.values()));
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize constraints from defaults: ${error.message}`);
    }
  }

  public getHardConstraints(): ConstraintDefinition[] {
    const results: ConstraintDefinition[] = [];
    for (const constraint of this.constraints.values()) {
      if (
        constraint.enabled &&
        (constraint.type === 'Hard_Must' || constraint.type === 'Hard_Must_Not')
      ) {
        results.push(constraint);
      }
    }
    return results;
  }

  public getAllConstraints(): ConstraintDefinition[] {
    return Array.from(this.constraints.values());
  }

  public getConstraint(id: string): ConstraintDefinition | undefined {
    return this.constraints.get(id);
  }

  public registerConstraint(constraint: ConstraintDefinition): void {
    this.constraints.set(constraint.id, constraint);
  }
}
