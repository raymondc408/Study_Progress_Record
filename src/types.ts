export interface Child {
  id: string; // e.g. 'kate', 'damon'
  name: string;
  year: string;
  passcode: string; // 4-digit passcode, e.g. '1234'
  subjects: string[]; // Chinese, English, Math, Instruments...
}

export interface TaskLog {
  id: string; // childId_YYYY-MM-DD
  childId: string;
  date: string; // YYYY-MM-DD
  completions: Record<string, boolean>; // e.g. { "中文": true, "數學": false }
  notes: string;
  completedRatio: number; // 0 to 1
  createdAt: string;
  updatedAt: string;
}

export interface SummaryReport {
  id: string; // date like YYYY-MM-DD or childId_YYYY-MM-DD
  childId?: string; // Optional: can be a consolidated child report
  date: string; // YYYY-MM-DD
  summary: string;
  createdAt: string;
}

export type UserRole = "child" | "parent";
