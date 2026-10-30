import type { ISODate } from "@/lib/dates";

export type Quality = "good" | "average" | "needs_work";
export type Theme = "system" | "light" | "dark";

export type Profile = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  dailyTarget: number;
  timezone: string;
  theme: Theme;
  isDemo: boolean;
  createdAt: string;
};

export type LogQuarter = {
  rub: number;
  planned: boolean;
  quality: Quality | null;
  completedAt: string | null;
};

export type DayLog = {
  date: ISODate;
  target: number;
  planLocked: boolean;
  quarters: LogQuarter[];
};

export type DaySummary = {
  date: ISODate;
  target: number;
  done: number;
  needsWork: number;
  goalMet: boolean;
  juz: number[];
};

export class DataError extends Error {
  constructor(
    public code: "not_found" | "conflict" | "invalid" | "unauthorized",
    message: string,
  ) {
    super(message);
  }
}
