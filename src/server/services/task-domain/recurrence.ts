import type { RecurrenceType, Task } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { DomainError } from "./errors";

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseScheduledTimeToMinutes(scheduledTime: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(scheduledTime);
  if (!match) {
    throw new DomainError("scheduledTime must be in HH:mm format.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function normalizeWeekdays(weekdays: number[]): number[] {
  const uniqueSorted = Array.from(new Set(weekdays)).sort((a, b) => a - b);
  for (const day of uniqueSorted) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new DomainError("weekdays must contain integers from 0 (Sunday) to 6 (Saturday).");
    }
  }
  return uniqueSorted;
}

export function normalizeRecurrenceWeekdays(recurrenceType: RecurrenceType, weekdays?: number[]): number[] {
  const normalized = normalizeWeekdays(weekdays ?? []);

  if (recurrenceType === "WEEKLY" && normalized.length === 0) {
    throw new DomainError("Weekly recurrence requires at least one weekday.");
  }

  if ((recurrenceType === "DAILY" || recurrenceType === "ONCE" || recurrenceType === "MONTHLY") && normalized.length > 0) {
    throw new DomainError("Weekdays are only allowed for weekly recurrence.");
  }

  return normalized;
}

function toDateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
  };
}

function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextDateKey(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  return toUtcDateKey(new Date(Date.UTC(year, month - 1, day) + MS_PER_DAY));
}

function dateKeyToUtcDate(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function combineDateWithScheduledMinutes(dateKey: string, minutes: number, timezone: string): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const localDateTime = `${dateKey}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
  return fromZonedTime(localDateTime, timezone);
}

export function startOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0));
}

function shouldCreateForDate(
  task: Pick<Task, "recurrenceType" | "weekdays" | "startDate" | "endDate" | "timezone">,
  dateKey: string,
): boolean {
  const startDateKey = toDateKey(task.startDate, task.timezone);
  const endDateKey = task.endDate ? toDateKey(task.endDate, task.timezone) : null;

  if (dateKey < startDateKey) {
    return false;
  }

  if (endDateKey && dateKey > endDateKey) {
    return false;
  }

  if (task.recurrenceType === "ONCE") {
    return dateKey === startDateKey;
  }

  if (task.recurrenceType === "DAILY") {
    return true;
  }

  if (task.recurrenceType === "MONTHLY") {
    const startDay = parseDateKey(startDateKey).day;
    const currentDay = parseDateKey(dateKey).day;
    return startDay === currentDay;
  }

  const weekday = dateKeyToUtcDate(dateKey).getUTCDay();
  return task.weekdays.includes(weekday);
}

export function buildOccurrenceSchedule(
  task: Pick<Task, "recurrenceType" | "weekdays" | "scheduledTime" | "startDate" | "endDate" | "timezone">,
  from: Date,
  until: Date,
): Date[] {
  if (until.getTime() < from.getTime()) {
    return [];
  }

  const scheduledMinutes = parseScheduledTimeToMinutes(task.scheduledTime);
  const startKey = toDateKey(from, task.timezone);
  const endKey = toDateKey(until, task.timezone);
  const items: Date[] = [];

  for (let dateKey = startKey; dateKey <= endKey; dateKey = nextDateKey(dateKey)) {
    if (!shouldCreateForDate(task, dateKey)) continue;

    const scheduledAt = combineDateWithScheduledMinutes(dateKey, scheduledMinutes, task.timezone);
    if (scheduledAt.getTime() < from.getTime() || scheduledAt.getTime() > until.getTime()) continue;
    items.push(scheduledAt);
  }

  if (task.recurrenceType === "ONCE" && items.length > 1) {
    throw new DomainError("ONCE recurrence can only generate one occurrence.");
  }

  return items;
}

export function resolveUntilDate(input: { from: Date; until?: Date; endDate?: Date | null; horizonDays: number }): Date {
  const { from, until, endDate, horizonDays } = input;
  const cappedByHorizon = new Date(from.getTime() + horizonDays * MS_PER_DAY);

  if (!until && !endDate) {
    return cappedByHorizon;
  }

  const candidates = [cappedByHorizon];
  if (until) candidates.push(until);
  if (endDate) candidates.push(endDate);

  return new Date(Math.min(...candidates.map((item) => item.getTime())));
}

export function assertNotificationRepeatMinutes(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MINUTES_PER_DAY) {
    throw new DomainError("notificationRepeatMinutes must be an integer between 1 and 1440.");
  }
}

export function assertDateRange(startDate: Date, endDate?: Date | null): void {
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new DomainError("endDate cannot be earlier than startDate.");
  }
}

export function assertMaxOccurrences(value?: number | null): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 1) {
    throw new DomainError("maxOccurrences must be an integer greater than or equal to 1.");
  }
}
