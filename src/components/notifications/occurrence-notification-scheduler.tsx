"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiRequest } from "@/lib/http-client";
import type { OccurrenceNotificationCandidate, OccurrenceNotificationDispatchResult } from "@/lib/notifications/occurrence-notification-types";
import {
  NOTIFICATIONS_SETTINGS_CHANGED_EVENT,
  getNotificationPermission,
  getNotificationsEnabled,
  isNotificationSupported,
  showTaskNotificationPreview,
} from "@/lib/notifications/web-notifications";

const POLL_INTERVAL_MS = 30_000;
const LOOKAHEAD_MINUTES = 120;
const FETCH_LIMIT = 200;

function isCandidateActive(candidate: OccurrenceNotificationCandidate) {
  return !candidate.isEnded && candidate.status === "PENDING" && !candidate.task.isEnded && candidate.task.status === "ACTIVE";
}

function getNextNotificationTime(candidate: OccurrenceNotificationCandidate) {
  const scheduledAt = new Date(candidate.scheduledAt).getTime();

  if (!candidate.lastNotificationAt) {
    return scheduledAt;
  }

  return new Date(candidate.lastNotificationAt).getTime() + candidate.task.notificationRepeatMinutes * 60_000;
}

async function withNotificationLock(occurrenceId: string, callback: () => Promise<void>) {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    await navigator.locks.request(`taskmanager-occurrence-notification-${occurrenceId}`, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        return;
      }

      await callback();
    });
    return;
  }

  await callback();
}

function useEventCallback<TArgs extends unknown[], TResult>(callback: (...args: TArgs) => TResult) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
}

export function OccurrenceNotificationScheduler() {
  const { status, data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const candidateMapRef = useRef(new Map<string, OccurrenceNotificationCandidate>());
  const timerMapRef = useRef(new Map<string, number>());
  const inFlightRef = useRef(new Set<string>());

  const clearTimer = useEventCallback((occurrenceId: string) => {
    const timerId = timerMapRef.current.get(occurrenceId);

    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerMapRef.current.delete(occurrenceId);
    }
  });

  const clearAllTimers = useEventCallback(() => {
    for (const timerId of timerMapRef.current.values()) {
      window.clearTimeout(timerId);
    }

    timerMapRef.current.clear();
  });

  const isRuntimeReady = useEventCallback(() => {
    return isNotificationSupported() && getNotificationPermission() === "granted" && getNotificationsEnabled();
  });

  const processCandidate = useEventCallback(async (occurrenceId: string) => {
    if (!userId || inFlightRef.current.has(occurrenceId) || !isRuntimeReady()) {
      return;
    }

    inFlightRef.current.add(occurrenceId);

    try {
      await withNotificationLock(occurrenceId, async () => {
        const candidate = candidateMapRef.current.get(occurrenceId);

        if (!candidate || !isCandidateActive(candidate)) {
          clearTimer(occurrenceId);
          return;
        }

        const nextNotificationTime = getNextNotificationTime(candidate);

        if (nextNotificationTime > Date.now()) {
          return;
        }

        const result = await apiRequest<OccurrenceNotificationDispatchResult>(`/api/occurrences/${occurrenceId}/notifications`, {
          method: "POST",
          body: JSON.stringify({
            userId,
            notifiedAt: new Date().toISOString(),
          }),
        });

        candidateMapRef.current.set(occurrenceId, result.occurrence);
        await showTaskNotificationPreview(
          result.occurrence.task.title,
          result.occurrence.task.scheduledTime,
          new Date(result.notifiedAt),
          result.occurrence.id,
        );
        scheduleCandidate(result.occurrence);
      });
    } catch {
      void syncCandidates();
    } finally {
      inFlightRef.current.delete(occurrenceId);
    }
  });

  const scheduleCandidate = useEventCallback((candidate: OccurrenceNotificationCandidate) => {
    clearTimer(candidate.id);

    if (!isCandidateActive(candidate) || !isRuntimeReady()) {
      return;
    }

    const delay = Math.max(0, getNextNotificationTime(candidate) - Date.now());
    const timerId = window.setTimeout(() => {
      void processCandidate(candidate.id);
    }, delay);

    timerMapRef.current.set(candidate.id, timerId);
  });

  const syncCandidates = useEventCallback(async () => {
    if (!userId || !isRuntimeReady()) {
      clearAllTimers();
      candidateMapRef.current.clear();
      return;
    }

    const items = await apiRequest<OccurrenceNotificationCandidate[]>(
      `/api/occurrences/notifications?userId=${encodeURIComponent(userId)}&lookAheadMinutes=${LOOKAHEAD_MINUTES}&limit=${FETCH_LIMIT}`,
    );

    const nextMap = new Map(items.map((item) => [item.id, item]));

    for (const occurrenceId of candidateMapRef.current.keys()) {
      if (!nextMap.has(occurrenceId)) {
        clearTimer(occurrenceId);
      }
    }

    candidateMapRef.current = nextMap;

    for (const candidate of items) {
      scheduleCandidate(candidate);
    }
  });

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      clearAllTimers();
      candidateMapRef.current.clear();
      return;
    }

    void syncCandidates();

    const intervalId = window.setInterval(() => {
      void syncCandidates();
    }, POLL_INTERVAL_MS);

    const handleRefresh = () => {
      void syncCandidates();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncCandidates();
      }
    };
    const inFlightSet = inFlightRef.current;

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    window.addEventListener(NOTIFICATIONS_SETTINGS_CHANGED_EVENT, handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener(NOTIFICATIONS_SETTINGS_CHANGED_EVENT, handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearAllTimers();
      candidateMapRef.current.clear();
      inFlightSet.clear();
    };
  }, [clearAllTimers, status, syncCandidates, userId]);

  return null;
}
