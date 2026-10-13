export type ConstraintCategory =
  | 'labor_law'
  | 'medical_safety'
  | 'ergonomics'
  | 'data_privacy'
  | 'economics';

export type ConstraintType =
  | 'Hard_Must'
  | 'Hard_Must_Not'
  | 'Soft_Prefer'
  | 'Soft_Avoid';

export interface ConstraintDefinition {
  id: string;
  name: string;
  category: ConstraintCategory;
  type: ConstraintType;
  description: string;
  target_roles: string[];
  evaluation_logic: {
    condition: string;
    exceptions?: Array<{ condition: string; reason: string }>;
    penalty_score?: number;
  };
  ui_visibility: boolean;
  user_editable: boolean;
  enabled: boolean;
}

export interface SolverRequest {
  startDate: string;
  endDate: string;
  staffPool: Array<{ id: string; role: string; skills: string[] }>;
  hardConstraints: ConstraintDefinition[];
}

export interface SolverResponse {
  isFeasible: boolean;
  shiftSkeleton: Array<{ employeeId: string; startTime: string; endTime: string; room?: string }>;
  computationTimeMs: number;
  error?: string;
}
