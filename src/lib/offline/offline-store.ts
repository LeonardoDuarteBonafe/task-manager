"use client";

import type { TaskFormValues } from "@/components/tasks/task-form";
import type { OccurrenceDetailsDto, OccurrenceDto, OccurrencePageDto, TaskDto, TaskPageDto } from "@/components/tasks/types";
import { AUTH_INVALID_EVENT } from "@/lib/http-client";
import { buildMockOccurrencePage, buildMockTaskPage } from "@/lib/mocks/task-data";
import { getNotificationPermission, getNotificationsEnabled, isBackgroundPushAvailable } from "@/lib/notifications/web-notifications";
import {
  OFFLINE_BOOTSTRAP_LOOKBACK_DAYS,
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_OCCURRENCE_HORIZON_DAYS,
  OFFLINE_SYNC_TAG,
} from "./config";
import { createDefaultOfflineRuntimeState, OFFLINE_RUNTIME_EVENT, type OfflineRuntimeState, type OfflineSyncPhase } from "./events";

const TASK_STORE = "tasks";
const OCCURRENCE_STORE = "occurrences";
const QUEUE_STORE = "queue";
const METADATA_STORE = "metadata";

const TASK_FETCH_PAGE_SIZE = 100;
const OCCURRENCE_FETCH_PAGE_SIZE = 100;

type QueueOperationType = "createTask" | "updateTask" | "endTask" | "toggleFavorite" | "completeOccurrence" | "ignoreOccurrence";
type SyncStatus = "synced" | "pending" | "syncing" | "failed";
type QueueStatus = "pending" | "syncing" | "synced" | "failed";

type CachedTask = TaskDto & {
  clientId: string;
  remoteId: string | null;
  localOnly: boolean;
  syncStatus: SyncStatus;
};

type CachedOccurrence = OccurrenceDetailsDto & {
  remoteId: string | null;
  taskClientId: string;
  taskRemoteId: string | null;
  localOnly: boolean;
  syncStatus: SyncStatus;
  lastNotificationAt: string | null;
};

type QueueItem = {
  id: string;
  userId: string;
  type: QueueOperationType;
  entityId: string;
  createdAt: string;
  updatedAt: string;
  status: QueueStatus;
  attempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
};

type MetadataRecord = {
  key: string;
  value: unknown;
};

type OccurrenceFilters = {
  name?: string;
  recurrenceCode?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  recurrenceType?: string;
  sortOrder?: "oldest" | "newest";
};

type ProfileDto = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
};

type OfflineSettingsSnapshot = {
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  backgroundPushAvailable: boolean;
  currentDeviceSubscribed: boolean;
  activeSubscriptionCount: number;
  updatedAt: string;
};

type DashboardSnapshot = {
  overdue: OccurrenceDto[];
  upcoming: OccurrenceDto[];
  favorites: TaskDto[];
  updatedAt: string | null;
};

const runtimeState: OfflineRuntimeState = createDefaultOfflineRuntimeState();
let activeSyncPromise: Promise<void> | null = null;

function profileMetadataKey(userId: string) {
  return `profile:${userId}`;
}

function settingsMetadataKey(userId: string) {
  return `settings:${userId}`;
}

function bootstrapMetadataKey(userId: string) {
  return `bootstrap:${userId}`;
}

function isIndexedDbSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitRuntimeState() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_RUNTIME_EVENT));
  }
}

function setRuntimeState(next: Partial<OfflineRuntimeState>) {
  Object.assign(runtimeState, next);
  emitRuntimeState();
}

export function getOfflineRuntimeSnapshot() {
  return { ...runtimeState };
}

function openDatabase() {
  if (!isIndexedDbSupported()) {
    throw new Error("IndexedDB is not supported in this browser.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TASK_STORE)) {
        database.createObjectStore(TASK_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OCCURRENCE_STORE)) {
        database.createObjectStore(OCCURRENCE_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline database."));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T> | T) {
  const db = await openDatabase();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let callbackResult: T;
      let settled = false;

      const rejectOnce = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      Promise.resolve(callback(store))
        .then((result) => {
          callbackResult = result;
        })
        .catch((error) => {
          rejectOnce(error);

          try {
            transaction.abort();
          } catch {
            // Ignore abort failures when the transaction is already closing.
          }
        });

      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(callbackResult);
        }
      };
      transaction.onerror = () => rejectOnce(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}.`));
      transaction.onabort = () => rejectOnce(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}.`));
    });
  } finally {
    db.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function getAllFromStore<T>(storeName: string) {
  return withStore<T[]>(storeName, "readonly", (store) => requestToPromise(store.getAll() as IDBRequest<T[]>));
}

async function getFromStore<T>(storeName: string, id: string) {
  return withStore<T | undefined>(storeName, "readonly", (store) => requestToPromise(store.get(id) as IDBRequest<T | undefined>));
}

async function putIntoStore<T>(storeName: string, value: T) {
  await withStore<void>(storeName, "readwrite", async (store) => {
    await requestToPromise(store.put(value));
  });
}

async function deleteFromStore(storeName: string, id: string) {
  await withStore<void>(storeName, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

async function clearStore(storeName: string) {
  await withStore<void>(storeName, "readwrite", async (store) => {
    await requestToPromise(store.clear());
  });
}

async function getMetadata<T>(key: string) {
  const record = await getFromStore<MetadataRecord>(METADATA_STORE, key);
  return (record?.value as T | undefined) ?? undefined;
}

async function setMetadata(key: string, value: unknown) {
  await putIntoStore<MetadataRecord>(METADATA_STORE, { key, value });
}

function toIsoDateWithOffset(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getDefaultOfflineSettingsSnapshot(): OfflineSettingsSnapshot {
  return {
    notificationsEnabled: getNotificationsEnabled(),
    notificationPermission: getNotificationPermission(),
    backgroundPushAvailable: isBackgroundPushAvailable(),
    currentDeviceSubscribed: false,
    activeSubscriptionCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchApi<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT));
  }

  const payload = (await response.json()) as
    | { success: true; data: T }
    | { success: false; error: { message?: string } };

  if (!response.ok || payload.success !== true) {
    throw new Error(payload.success === false ? payload.error.message || "API request failed." : "API request failed.");
  }

  return payload.data;
}

function normalizeTask(task: TaskDto): CachedTask {
  const clientId = task.clientId ?? task.id;

  return {
    ...task,
    clientId,
    remoteId: task.id.startsWith("local-task-") ? null : task.id,
    localOnly: task.id.startsWith("local-task-"),
    syncStatus: "synced",
  };
}

function toTaskDto(task: CachedTask): TaskDto {
  return {
    ...task,
    id: task.remoteId ?? task.id,
  };
}

function normalizeOccurrence(occurrence: OccurrenceDetailsDto): CachedOccurrence {
  const taskClientId = occurrence.task.clientId ?? occurrence.task.id;

  return {
    ...occurrence,
    remoteId: occurrence.id.startsWith("local-occurrence-") ? null : occurrence.id,
    taskClientId,
    taskRemoteId: occurrence.task.id.startsWith("local-task-") ? null : occurrence.task.id,
    localOnly: occurrence.id.startsWith("local-occurrence-"),
    syncStatus: "synced",
    lastNotificationAt: null,
  };
}

function toOccurrenceDetailsDto(occurrence: CachedOccurrence): OccurrenceDetailsDto {
  return {
    ...occurrence,
    id: occurrence.remoteId ?? occurrence.id,
    taskId: occurrence.taskRemoteId ?? occurrence.taskId,
    task: {
      ...occurrence.task,
      id: occurrence.taskRemoteId ?? occurrence.task.id,
    },
  };
}

function matchesTask(candidate: CachedTask, taskId: string, clientId?: string | null) {
  return candidate.id === taskId || candidate.remoteId === taskId || (clientId ? candidate.clientId === clientId : false);
}

function localOccurrenceId(taskClientId: string, scheduledAt: string) {
  return `local-occurrence-${taskClientId}-${scheduledAt}`;
}

function buildTaskPayload(values: TaskFormValues, userId: string, clientId: string) {
  return {
    userId,
    clientId,
    title: values.title,
    notes: values.notes || null,
    startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
    scheduledTime: values.scheduledTime,
    recurrenceType: values.recurrenceType,
    weekdays: values.recurrenceType === "WEEKLY" ? values.weekdays : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
    notificationRepeatMinutes: values.notificationRepeatMinutes,
    maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
  };
}

function taskFormToCachedTask(values: TaskFormValues, userId: string, taskCode: number, clientId: string): CachedTask {
  const now = new Date().toISOString();

  return {
    id: clientId,
    remoteId: null,
    clientId,
    userId,
    taskCode,
    title: values.title,
    notes: values.notes || null,
    recurrenceType: values.recurrenceType,
    weekdays: values.recurrenceType === "WEEKLY" ? [...values.weekdays] : [],
    scheduledTime: values.scheduledTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
    endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
    notificationRepeatMinutes: values.notificationRepeatMinutes,
    maxOccurrences: values.maxOccurrences ? Number(values.maxOccurrences) : null,
    isFavorite: false,
    isEnded: false,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    endedAt: null,
    canceledAt: null,
    abortedAt: null,
    history: [],
    localOnly: true,
    syncStatus: "pending",
  };
}

function setTimeOnDate(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildGeneratedOccurrence(task: CachedTask, scheduledAt: Date, recurrenceCode: number): CachedOccurrence {
  const occurrenceId = localOccurrenceId(task.clientId, scheduledAt.toISOString());

  return {
    id: occurrenceId,
    remoteId: null,
    taskClientId: task.clientId,
    taskRemoteId: task.remoteId,
    taskId: task.id,
    userId: task.userId,
    recurrenceCode,
    scheduledAt: scheduledAt.toISOString(),
    isEnded: false,
    status: "PENDING",
    treatedAt: null,
    completedAt: null,
    ignoredAt: null,
    notificationAttempts: 0,
    history: [],
    task: {
      ...task,
      id: task.remoteId ?? task.id,
    },
    localOnly: true,
    syncStatus: task.syncStatus === "synced" ? "synced" : "pending",
    lastNotificationAt: null,
  };
}

function generateOccurrencesForTask(task: CachedTask, horizonDays = OFFLINE_OCCURRENCE_HORIZON_DAYS) {
  const startDate = new Date(task.startDate);
  const endDate = task.endDate ? new Date(task.endDate) : null;
  const limitDate = addDays(new Date(), horizonDays);
  const maxDate = endDate && endDate < limitDate ? endDate : limitDate;
  const occurrences: CachedOccurrence[] = [];
  let cursor = new Date(startDate);
  let recurrenceCode = 1;
  let created = 0;
  const maxOccurrences = task.maxOccurrences ?? Number.POSITIVE_INFINITY;

  while (cursor <= maxDate && created < maxOccurrences) {
    let shouldCreate = false;

    if (task.recurrenceType === "ONCE") {
      shouldCreate = created === 0;
    } else if (task.recurrenceType === "DAILY") {
      shouldCreate = true;
    } else if (task.recurrenceType === "WEEKLY") {
      shouldCreate = task.weekdays.includes(cursor.getDay());
    } else if (task.recurrenceType === "MONTHLY") {
      shouldCreate = cursor.getDate() === startDate.getDate();
    }

    if (shouldCreate) {
      occurrences.push(buildGeneratedOccurrence(task, setTimeOnDate(cursor, task.scheduledTime), recurrenceCode));
      created += 1;
      recurrenceCode += 1;
    }

    if (task.recurrenceType === "MONTHLY") {
      cursor = addMonths(cursor, 1);
      continue;
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

async function getAllTasks() {
  return getAllFromStore<CachedTask>(TASK_STORE);
}

async function getAllOccurrences() {
  return getAllFromStore<CachedOccurrence>(OCCURRENCE_STORE);
}

async function getAllQueueItems() {
  const items = await getAllFromStore<QueueItem>(QUEUE_STORE);
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function refreshRuntimeStateFromStorage() {
  const queue = await getAllQueueItems();
  const lastSyncAt = (await getMetadata<string>("lastSyncAt")) ?? null;
  const lastSyncError = (await getMetadata<string>("lastSyncError")) ?? null;

  setRuntimeState({
    connectivity: navigator.onLine ? "online" : "offline",
    pendingCount: queue.filter((item) => item.status === "pending" || item.status === "syncing").length,
    failedCount: queue.filter((item) => item.status === "failed").length,
    lastSyncAt,
    lastSyncError,
    syncPhase: runtimeState.syncPhase === "error" && !lastSyncError ? "idle" : runtimeState.syncPhase,
  });

  return getOfflineRuntimeSnapshot();
}

async function findTaskByAnyId(taskId: string) {
  const direct = await getFromStore<CachedTask>(TASK_STORE, taskId);
  if (direct) {
    return direct;
  }

  const tasks = await getAllTasks();
  return tasks.find((task) => task.remoteId === taskId || task.clientId === taskId) ?? null;
}

async function findOccurrenceByAnyId(occurrenceId: string) {
  const direct = await getFromStore<CachedOccurrence>(OCCURRENCE_STORE, occurrenceId);
  if (direct) {
    return direct;
  }

  const occurrences = await getAllOccurrences();
  return occurrences.find((occurrence) => occurrence.remoteId === occurrenceId) ?? null;
}

async function updateTaskSnapshotAcrossOccurrences(task: CachedTask) {
  const occurrences = await getAllOccurrences();
  const related = occurrences.filter((occurrence) => occurrence.taskClientId === task.clientId || occurrence.taskRemoteId === task.remoteId);

  await Promise.all(
    related.map((occurrence) =>
      putIntoStore(OCCURRENCE_STORE, {
        ...occurrence,
        taskId: task.id,
        taskRemoteId: task.remoteId,
        taskClientId: task.clientId,
        task: {
          ...occurrence.task,
          ...toTaskDto(task),
          id: task.remoteId ?? task.id,
        },
      }),
    ),
  );
}

async function replaceTaskOccurrences(task: CachedTask) {
  const allOccurrences = await getAllOccurrences();
  const related = allOccurrences.filter((occurrence) => occurrence.taskClientId === task.clientId);
  const generated = generateOccurrencesForTask(task);
  const generatedBySchedule = new Map(generated.map((occurrence) => [occurrence.scheduledAt, occurrence]));

  for (const occurrence of related) {
    const nextGenerated = generatedBySchedule.get(occurrence.scheduledAt);

    if (!nextGenerated) {
      if (occurrence.status === "PENDING" && occurrence.remoteId == null) {
        await deleteFromStore(OCCURRENCE_STORE, occurrence.id);
      }

      continue;
    }

    generatedBySchedule.delete(occurrence.scheduledAt);
    await putIntoStore(OCCURRENCE_STORE, {
      ...nextGenerated,
      id: occurrence.id,
      remoteId: occurrence.remoteId,
      localOnly: occurrence.localOnly,
      syncStatus: occurrence.syncStatus,
      isEnded: occurrence.isEnded,
      status: occurrence.status,
      treatedAt: occurrence.treatedAt ?? null,
      completedAt: occurrence.completedAt ?? null,
      ignoredAt: occurrence.ignoredAt ?? null,
      notificationAttempts: occurrence.notificationAttempts ?? 0,
      history: occurrence.history,
      lastNotificationAt: occurrence.lastNotificationAt,
    });
  }

  await Promise.all(Array.from(generatedBySchedule.values()).map((occurrence) => putIntoStore(OCCURRENCE_STORE, occurrence)));
}

async function pruneFutureOccurrencesForEndedTask(task: CachedTask, actedAt: string) {
  const cutoff = new Date(actedAt).getTime();
  const allOccurrences = await getAllOccurrences();
  const related = allOccurrences.filter((occurrence) => occurrence.taskClientId === task.clientId);

  await Promise.all(
    related.map(async (occurrence) => {
      if (new Date(occurrence.scheduledAt).getTime() <= cutoff) {
        return;
      }

      if (occurrence.status === "PENDING") {
        await deleteFromStore(OCCURRENCE_STORE, occurrence.id);
      }
    }),
  );
}

async function nextLocalTaskCode(userId: string) {
  const tasks = await getAllTasks();
  return tasks.filter((task) => task.userId === userId).reduce((maxCode, task) => Math.max(maxCode, task.taskCode), 0) + 1;
}

async function upsertQueueItem(item: QueueItem) {
  await putIntoStore(QUEUE_STORE, item);
  await refreshRuntimeStateFromStorage();
  await requestBackgroundSync();
}

async function enqueue(item: Omit<QueueItem, "id" | "status" | "attempts" | "lastError" | "updatedAt">) {
  const queue = await getAllQueueItems();
  const existing = queue.find((candidate) => candidate.entityId === item.entityId && candidate.type === item.type && candidate.status !== "synced");

  if (existing) {
    await upsertQueueItem({
      ...existing,
      payload: item.payload,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt,
      status: "pending",
      lastError: null,
    });
    return existing.id;
  }

  if (item.type === "updateTask") {
    const pendingCreate = queue.find((candidate) => candidate.entityId === item.entityId && candidate.type === "createTask" && candidate.status !== "synced");
    if (pendingCreate) {
      await upsertQueueItem({
        ...pendingCreate,
        payload: {
          ...pendingCreate.payload,
          ...item.payload,
        },
        updatedAt: new Date().toISOString(),
        status: "pending",
        lastError: null,
      });
      return pendingCreate.id;
    }
  }

  const queueItem: QueueItem = {
    id: createId("queue"),
    userId: item.userId,
    type: item.type,
    entityId: item.entityId,
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    status: "pending",
    attempts: 0,
    lastError: null,
    payload: item.payload,
  };

  await upsertQueueItem(queueItem);
  return queueItem.id;
}

async function markQueueItem(queueItem: QueueItem, status: QueueStatus, lastError?: string | null) {
  await upsertQueueItem({
    ...queueItem,
    status,
    attempts: status === "syncing" ? queueItem.attempts + 1 : queueItem.attempts,
    updatedAt: new Date().toISOString(),
    lastError: lastError ?? null,
  });
}

async function markMetadataSyncState(syncPhase: OfflineSyncPhase, lastSyncError?: string | null) {
  await setMetadata("lastSyncError", lastSyncError ?? null);
  setRuntimeState({
    syncPhase,
    lastSyncError: lastSyncError ?? null,
    connectivity: navigator.onLine ? "online" : "offline",
  });
}

async function fetchAllTasksFromServer(userId: string) {
  let page = 1;
  let totalPages = 1;
  const items: TaskDto[] = [];

  while (page <= totalPages) {
    const payload = await fetchApi<TaskPageDto>(`/api/tasks?userId=${encodeURIComponent(userId)}&page=${page}&pageSize=${TASK_FETCH_PAGE_SIZE}`, {
      method: "GET",
    });
    items.push(...payload.items);
    totalPages = payload.totalPages;
    page += 1;
  }

  return items;
}

async function fetchBootstrapOccurrencesFromServer(userId: string) {
  let page = 1;
  let totalPages = 1;
  const items: OccurrenceDetailsDto[] = [];
  const dateFrom = toIsoDateWithOffset(-OFFLINE_BOOTSTRAP_LOOKBACK_DAYS);
  const dateTo = toIsoDateWithOffset(OFFLINE_OCCURRENCE_HORIZON_DAYS);

  while (page <= totalPages) {
    const payload = await fetchApi<OccurrencePageDto>(
      `/api/occurrences?userId=${encodeURIComponent(userId)}&page=${page}&pageSize=${OCCURRENCE_FETCH_PAGE_SIZE}&sortOrder=oldest&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
      { method: "GET" },
    );
    items.push(...(payload.items as OccurrenceDetailsDto[]));
    totalPages = payload.totalPages;
    page += 1;
  }

  return items;
}

async function fetchProfileFromServer(userId: string) {
  return fetchApi<ProfileDto>(`/api/profile?userId=${encodeURIComponent(userId)}`, { method: "GET" });
}

async function cacheProfileSnapshot(userId: string, profile: ProfileDto) {
  await setMetadata(profileMetadataKey(userId), {
    ...profile,
    image: profile.image ?? null,
  } satisfies ProfileDto);
}

async function cacheSettingsSnapshot(userId: string, snapshot: Partial<OfflineSettingsSnapshot> = {}) {
  const current = (await getMetadata<OfflineSettingsSnapshot>(settingsMetadataKey(userId))) ?? getDefaultOfflineSettingsSnapshot();
  await setMetadata(settingsMetadataKey(userId), {
    ...current,
    ...snapshot,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
  } satisfies OfflineSettingsSnapshot);
}

async function cacheTaskSnapshot(userId: string, tasks: TaskDto[]) {
  const existingTasks = (await getAllTasks()).filter((task) => task.userId === userId);
  const remoteIds = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    const normalized = normalizeTask(task);
    const existing = existingTasks.find((candidate) => matchesTask(candidate, task.id, task.clientId));
    const hasLocalPending = existing && existing.syncStatus !== "synced";

    const nextTask: CachedTask = hasLocalPending
      ? {
          ...normalized,
          ...existing,
          id: existing.id,
          remoteId: normalized.remoteId,
          clientId: existing.clientId,
          localOnly: false,
        }
      : normalized;

    if (existing && existing.id !== nextTask.id) {
      await deleteFromStore(TASK_STORE, existing.id);
    }

    await putIntoStore(TASK_STORE, nextTask);
  }

  for (const task of existingTasks) {
    if (task.localOnly || task.syncStatus !== "synced") {
      continue;
    }

    if (task.remoteId && !remoteIds.has(task.remoteId)) {
      await deleteFromStore(TASK_STORE, task.id);
    }
  }
}

async function seedTasksFromOccurrences(userId: string, occurrences: OccurrenceDetailsDto[]) {
  const nestedTasks = occurrences.map((occurrence) => ({
    id: occurrence.task.id,
    clientId: occurrence.task.clientId ?? null,
    userId,
    taskCode: occurrence.task.taskCode,
    title: occurrence.task.title,
    notes: occurrence.task.notes,
    recurrenceType: occurrence.task.recurrenceType,
    weekdays: occurrence.task.weekdays,
    scheduledTime: occurrence.task.scheduledTime,
    timezone: occurrence.task.timezone,
    startDate: occurrence.task.startDate ?? occurrence.scheduledAt,
    endDate: occurrence.task.endDate ?? null,
    notificationRepeatMinutes: occurrence.task.notificationRepeatMinutes,
    maxOccurrences: null,
    isFavorite: occurrence.task.isFavorite,
    isEnded: occurrence.task.isEnded,
    status: occurrence.task.status,
    createdAt: occurrence.task.createdAt ?? occurrence.task.updatedAt,
    updatedAt: occurrence.task.updatedAt,
    endedAt: occurrence.task.endedAt,
    canceledAt: occurrence.task.canceledAt,
    abortedAt: occurrence.task.abortedAt,
    history: [],
  })) satisfies TaskDto[];

  const uniqueTasks = Array.from(new Map(nestedTasks.map((task) => [task.id, task])).values());
  if (uniqueTasks.length > 0) {
    await cacheTaskSnapshot(userId, uniqueTasks);
  }
}

async function cacheOccurrenceSnapshot(userId: string, occurrences: OccurrenceDetailsDto[]) {
  await seedTasksFromOccurrences(userId, occurrences);
  const existingOccurrences = (await getAllOccurrences()).filter((occurrence) => occurrence.userId === userId);
  const remoteIds = new Set(occurrences.map((occurrence) => occurrence.id));

  for (const occurrence of occurrences) {
    const normalized = normalizeOccurrence(occurrence);
    const existing = existingOccurrences.find(
      (candidate) =>
        candidate.id === occurrence.id ||
        candidate.remoteId === occurrence.id ||
        (candidate.taskClientId === normalized.taskClientId && candidate.scheduledAt === normalized.scheduledAt),
    );
    const hasLocalPending = existing && existing.syncStatus !== "synced";

    const nextOccurrence: CachedOccurrence = hasLocalPending
      ? {
          ...normalized,
          ...existing,
          id: existing.id,
          remoteId: normalized.remoteId,
          taskId: normalized.taskId,
          taskRemoteId: normalized.taskRemoteId,
          taskClientId: normalized.taskClientId,
          localOnly: false,
        }
      : {
          ...normalized,
          lastNotificationAt: existing?.lastNotificationAt ?? null,
        };

    if (existing && existing.id !== nextOccurrence.id) {
      await deleteFromStore(OCCURRENCE_STORE, existing.id);
    }

    await putIntoStore(OCCURRENCE_STORE, nextOccurrence);
  }

  for (const occurrence of existingOccurrences) {
    if (occurrence.localOnly || occurrence.syncStatus !== "synced") {
      continue;
    }

    if (occurrence.remoteId && !remoteIds.has(occurrence.remoteId)) {
      await deleteFromStore(OCCURRENCE_STORE, occurrence.id);
    }
  }
}

async function refreshRemoteSnapshot(userId: string) {
  const [tasksResult, occurrencesResult, profileResult] = await Promise.allSettled([
    fetchAllTasksFromServer(userId),
    fetchBootstrapOccurrencesFromServer(userId),
    fetchProfileFromServer(userId),
  ]);

  if (tasksResult.status === "fulfilled") {
    await cacheTaskSnapshot(userId, tasksResult.value);
  }

  if (occurrencesResult.status === "fulfilled") {
    await cacheOccurrenceSnapshot(userId, occurrencesResult.value);
  }

  if (profileResult.status === "fulfilled") {
    await cacheProfileSnapshot(userId, profileResult.value);
  }

  await cacheSettingsSnapshot(userId);

  if (tasksResult.status === "rejected" && occurrencesResult.status === "rejected" && profileResult.status === "rejected") {
    throw tasksResult.reason instanceof Error ? tasksResult.reason : new Error("Falha ao atualizar snapshot remoto.");
  }

  const syncedAt = new Date().toISOString();
  await setMetadata("lastSyncAt", syncedAt);
  await setMetadata("lastSyncError", null);
  await setMetadata(bootstrapMetadataKey(userId), syncedAt);
  setRuntimeState({ lastSyncAt: syncedAt, lastSyncError: null });
}

async function applyServerTaskToLocal(task: TaskDto) {
  const normalized = normalizeTask(task);
  const existingTasks = await getAllTasks();
  const existing = existingTasks.find((candidate) => matchesTask(candidate, task.id, task.clientId));

  if (existing && existing.id !== normalized.id) {
    await deleteFromStore(TASK_STORE, existing.id);
  }

  const nextTask: CachedTask = {
    ...(existing ?? normalized),
    ...normalized,
    id: normalized.id,
    remoteId: normalized.remoteId,
    clientId: normalized.clientId,
    localOnly: false,
    syncStatus: "synced",
  };

  await putIntoStore(TASK_STORE, nextTask);
  await updateTaskSnapshotAcrossOccurrences(nextTask);
  return nextTask;
}

async function resolveOccurrenceRemoteId(occurrence: CachedOccurrence) {
  if (occurrence.remoteId) {
    return occurrence.remoteId;
  }

  const task = await findTaskByAnyId(occurrence.taskId);
  const taskRemoteId = task?.remoteId ?? occurrence.taskRemoteId;
  if (!taskRemoteId) {
    return null;
  }

  const reconciled = await fetchApi<OccurrenceDetailsDto>(
    `/api/occurrences/reconcile?userId=${encodeURIComponent(occurrence.userId)}&taskId=${encodeURIComponent(taskRemoteId)}&scheduledAt=${encodeURIComponent(
      occurrence.scheduledAt,
    )}`,
    { method: "GET" },
  );

  const normalized = normalizeOccurrence(reconciled);
  await deleteFromStore(OCCURRENCE_STORE, occurrence.id);
  await putIntoStore(OCCURRENCE_STORE, {
    ...normalized,
    lastNotificationAt: occurrence.lastNotificationAt,
  });
  return reconciled.id;
}

async function processQueueItem(queueItem: QueueItem) {
  await markQueueItem(queueItem, "syncing");

  if (queueItem.type === "createTask") {
    const createdTask = await fetchApi<TaskDto>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(queueItem.payload),
    });

    const localTask = await findTaskByAnyId(queueItem.entityId);
    const syncedTask = await applyServerTaskToLocal(createdTask);

    if (localTask) {
      await replaceTaskOccurrences({
        ...localTask,
        ...syncedTask,
        id: syncedTask.id,
        remoteId: syncedTask.remoteId,
        localOnly: false,
        syncStatus: "synced",
      });
    }

    await markQueueItem(queueItem, "synced");
    return true;
  }

  if (queueItem.type === "updateTask") {
    const task = await findTaskByAnyId(queueItem.entityId);
    if (!task?.remoteId) {
      await markQueueItem(queueItem, "pending");
      return false;
    }

    const updatedTask = await fetchApi<TaskDto>(`/api/tasks/${task.remoteId}`, {
      method: "PUT",
      body: JSON.stringify(queueItem.payload),
    });
    await applyServerTaskToLocal(updatedTask);
    await markQueueItem(queueItem, "synced");
    return true;
  }

  if (queueItem.type === "endTask") {
    const task = await findTaskByAnyId(queueItem.entityId);
    if (!task?.remoteId) {
      await markQueueItem(queueItem, "pending");
      return false;
    }

    await fetchApi(`/api/tasks/${task.remoteId}/end`, {
      method: "POST",
      body: JSON.stringify(queueItem.payload),
    });
    await markQueueItem(queueItem, "synced");
    return true;
  }

  if (queueItem.type === "toggleFavorite") {
    const task = await findTaskByAnyId(queueItem.entityId);
    if (!task?.remoteId) {
      await markQueueItem(queueItem, "pending");
      return false;
    }

    const updatedTask = await fetchApi<TaskDto>(`/api/tasks/${task.remoteId}/favorite`, {
      method: "POST",
      body: JSON.stringify(queueItem.payload),
    });
    await applyServerTaskToLocal(updatedTask);
    await markQueueItem(queueItem, "synced");
    return true;
  }

  if (queueItem.type === "completeOccurrence" || queueItem.type === "ignoreOccurrence") {
    const occurrence = await findOccurrenceByAnyId(queueItem.entityId);
    if (!occurrence) {
      await markQueueItem(queueItem, "synced");
      return false;
    }

    const remoteId = await resolveOccurrenceRemoteId(occurrence);
    if (!remoteId) {
      await markQueueItem(queueItem, "pending");
      return false;
    }

    const action = queueItem.type === "completeOccurrence" ? "complete" : "ignore";
    const updatedOccurrence = await fetchApi<OccurrenceDetailsDto>(`/api/occurrences/${remoteId}/${action}`, {
      method: "POST",
      body: JSON.stringify({
        userId: queueItem.userId,
        [action === "complete" ? "completedAt" : "ignoredAt"]: queueItem.payload.occurredAt,
      }),
    });

    await putIntoStore(OCCURRENCE_STORE, {
      ...normalizeOccurrence(updatedOccurrence),
      lastNotificationAt: occurrence.lastNotificationAt,
    });
    await markQueueItem(queueItem, "synced");
    return true;
  }

  return false;
}

export async function flushOfflineQueue(userId?: string) {
  if (!navigator.onLine) {
    await refreshRuntimeStateFromStorage();
    return;
  }

  const queue = await getAllQueueItems();
  let syncedAnyItem = false;

  for (const queueItem of queue.filter((item) => item.status === "pending" || item.status === "failed")) {
    try {
      const changed = await processQueueItem(queueItem);
      syncedAnyItem = syncedAnyItem || changed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar alteracao offline.";
      await markQueueItem(queueItem, "failed", message);

      if (!navigator.onLine) {
        break;
      }
    }
  }

  if (syncedAnyItem && userId) {
    await refreshRemoteSnapshot(userId);
  }

  await refreshRuntimeStateFromStorage();
}

export async function synchronizeOfflineData(userId: string, reason: "bootstrap" | "foreground-sync" = "foreground-sync") {
  if (!navigator.onLine) {
    setRuntimeState({ connectivity: "offline", syncPhase: "idle" });
    await refreshRuntimeStateFromStorage();
    return;
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    await markMetadataSyncState(reason === "bootstrap" ? "bootstrapping" : "syncing");

    try {
      await flushOfflineQueue(userId);
      await refreshRemoteSnapshot(userId);
      await markMetadataSyncState("idle", null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar dados offline.";
      await markMetadataSyncState("error", message);
    } finally {
      await refreshRuntimeStateFromStorage();
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export async function bootstrapOfflineData(userId: string) {
  await synchronizeOfflineData(userId, "bootstrap");
}

export async function cacheTaskPage(userId: string, page: TaskPageDto) {
  await cacheTaskSnapshot(userId, page.items);
  await refreshRuntimeStateFromStorage();
}

export async function cacheOccurrencePage(page: OccurrencePageDto) {
  if (page.items.length > 0) {
    await cacheOccurrenceSnapshot(page.items[0].userId, page.items as OccurrenceDetailsDto[]);
  }
  await refreshRuntimeStateFromStorage();
}

export async function loadTaskPageFromCache(userId: string, page: number, filters?: { status?: string; taskCode?: number; name?: string }) {
  const tasks = await getAllTasks();
  const sortedTasks = tasks
    .filter((task) => task.userId === userId)
    .sort((left, right) => {
      if (left.isFavorite !== right.isFavorite) {
        return left.isFavorite ? -1 : 1;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  return buildMockTaskPage(
    sortedTasks.map(toTaskDto),
    page,
    filters,
  );
}

export async function loadOccurrencePageFromCache(userId: string, page: number, filters: OccurrenceFilters) {
  const occurrences = await getAllOccurrences();
  return buildMockOccurrencePage(
    occurrences.filter((occurrence) => occurrence.userId === userId).map(toOccurrenceDetailsDto),
    page,
    filters,
  );
}

function toOccurrenceListDto(occurrence: CachedOccurrence): OccurrenceDto {
  const details = toOccurrenceDetailsDto(occurrence);

  return {
    id: details.id,
    taskId: details.taskId,
    userId: details.userId,
    recurrenceCode: details.recurrenceCode,
    scheduledAt: details.scheduledAt,
    isEnded: details.isEnded,
    status: details.status,
    history: details.history.map((item) => ({
      id: item.id,
      action: item.action,
      actedAt: item.actedAt,
    })),
    task: details.task,
  };
}

export async function loadDashboardFromCache(userId: string): Promise<DashboardSnapshot> {
  const [tasks, occurrences, lastSyncAt] = await Promise.all([getAllTasks(), getAllOccurrences(), getMetadata<string>("lastSyncAt")]);
  const userTasks = tasks.filter((task) => task.userId === userId);
  const userOccurrences = occurrences.filter((occurrence) => occurrence.userId === userId);
  const now = Date.now();

  const pendingOccurrences = userOccurrences.filter(
    (occurrence) => occurrence.status === "PENDING" && !occurrence.isEnded && occurrence.task.status === "ACTIVE" && !occurrence.task.isEnded,
  );

  const overdue = pendingOccurrences
    .filter((occurrence) => new Date(occurrence.scheduledAt).getTime() <= now)
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
    .slice(0, 3)
    .map(toOccurrenceListDto);

  const upcoming = pendingOccurrences
    .filter((occurrence) => new Date(occurrence.scheduledAt).getTime() > now)
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
    .slice(0, 3)
    .map(toOccurrenceListDto);

  const favorites = userTasks
    .filter((task) => task.isFavorite)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 3)
    .map(toTaskDto);

  return {
    overdue,
    upcoming,
    favorites,
    updatedAt: lastSyncAt ?? null,
  };
}

export async function loadProfileFromCache(userId: string) {
  return (await getMetadata<ProfileDto>(profileMetadataKey(userId))) ?? null;
}

export async function syncProfileFromServer(userId: string) {
  if (!navigator.onLine) {
    return loadProfileFromCache(userId);
  }

  const profile = await fetchProfileFromServer(userId);
  await cacheProfileSnapshot(userId, profile);
  return profile;
}

export async function saveSettingsSnapshot(userId: string, snapshot: Partial<OfflineSettingsSnapshot>) {
  await cacheSettingsSnapshot(userId, snapshot);
}

export async function loadSettingsFromCache(userId: string) {
  return (await getMetadata<OfflineSettingsSnapshot>(settingsMetadataKey(userId))) ?? getDefaultOfflineSettingsSnapshot();
}

export async function hasCompletedOfflineBootstrap(userId: string) {
  const bootstrappedAt = await getMetadata<string>(bootstrapMetadataKey(userId));
  return Boolean(bootstrappedAt);
}

export async function getTaskDetailsFromCache(taskId: string) {
  const task = await findTaskByAnyId(taskId);
  return task ? toTaskDto(task) : null;
}

export async function getOccurrenceDetailsFromCache(occurrenceId: string) {
  const occurrence = await findOccurrenceByAnyId(occurrenceId);
  return occurrence ? toOccurrenceDetailsDto(occurrence) : null;
}

export async function saveTaskOffline(values: TaskFormValues, userId: string) {
  const clientId = createId("local-task");
  const taskCode = await nextLocalTaskCode(userId);
  const task = taskFormToCachedTask(values, userId, taskCode, clientId);

  await putIntoStore(TASK_STORE, task);
  await replaceTaskOccurrences(task);
  await enqueue({
    userId,
    type: "createTask",
    entityId: clientId,
    createdAt: new Date().toISOString(),
    payload: buildTaskPayload(values, userId, clientId),
  });

  await refreshRuntimeStateFromStorage();
  return toTaskDto(task);
}

export async function updateTaskOffline(taskId: string, values: TaskFormValues, userId: string) {
  const task = await findTaskByAnyId(taskId);
  if (!task) {
    throw new Error("Task not found in offline cache.");
  }

  const updatedTask: CachedTask = {
    ...task,
    ...taskFormToCachedTask(values, userId, task.taskCode, task.clientId),
    id: task.id,
    remoteId: task.remoteId,
    clientId: task.clientId,
    createdAt: task.createdAt,
    history: [{ id: createId("history"), action: "UPDATED", actedAt: new Date().toISOString() }, ...task.history],
    isFavorite: task.isFavorite,
    syncStatus: "pending",
    localOnly: task.remoteId === null,
  };

  await putIntoStore(TASK_STORE, updatedTask);
  await replaceTaskOccurrences(updatedTask);
  await updateTaskSnapshotAcrossOccurrences(updatedTask);
  await enqueue({
    userId,
    type: "updateTask",
    entityId: task.clientId,
    createdAt: new Date().toISOString(),
    payload: buildTaskPayload(values, userId, task.clientId),
  });

  await refreshRuntimeStateFromStorage();
  return toTaskDto(updatedTask);
}

export async function endTaskOffline(taskId: string, userId: string, reason?: string) {
  const task = await findTaskByAnyId(taskId);
  if (!task) {
    throw new Error("Task not found in offline cache.");
  }

  const actedAt = new Date().toISOString();
  const endedTask: CachedTask = {
    ...task,
    isEnded: true,
    status: "ENDED",
    endedAt: actedAt,
    updatedAt: actedAt,
    syncStatus: "pending",
    history: [
      {
        id: createId("history"),
        action: "ENDED",
        actedAt,
        metadata: { reason: reason?.trim() || null },
      },
      ...task.history,
    ],
  };

  await putIntoStore(TASK_STORE, endedTask);
  await pruneFutureOccurrencesForEndedTask(endedTask, actedAt);
  await updateTaskSnapshotAcrossOccurrences(endedTask);
  await enqueue({
    userId,
    type: "endTask",
    entityId: task.clientId,
    createdAt: actedAt,
    payload: {
      userId,
      endedAt: actedAt,
      reason: reason?.trim() || undefined,
    },
  });

  await refreshRuntimeStateFromStorage();
  return toTaskDto(endedTask);
}

export async function toggleTaskFavoriteOffline(taskId: string, userId: string, isFavorite: boolean) {
  const task = await findTaskByAnyId(taskId);
  if (!task) {
    throw new Error("Task not found in offline cache.");
  }

  const updatedTask: CachedTask = {
    ...task,
    isFavorite,
    updatedAt: new Date().toISOString(),
    syncStatus: task.remoteId ? "pending" : task.syncStatus,
  };

  await putIntoStore(TASK_STORE, updatedTask);
  await updateTaskSnapshotAcrossOccurrences(updatedTask);
  await enqueue({
    userId,
    type: "toggleFavorite",
    entityId: task.clientId,
    createdAt: new Date().toISOString(),
    payload: {
      userId,
      isFavorite,
    },
  });

  await refreshRuntimeStateFromStorage();
  return toTaskDto(updatedTask);
}

export async function applyOccurrenceActionOffline(occurrenceId: string, userId: string, action: "complete" | "ignore") {
  const occurrence = await findOccurrenceByAnyId(occurrenceId);
  if (!occurrence) {
    throw new Error("Occurrence not found in offline cache.");
  }

  const actedAt = new Date().toISOString();
  const nextOccurrence: CachedOccurrence = {
    ...occurrence,
    isEnded: true,
    status: action === "complete" ? "COMPLETED" : "IGNORED",
    treatedAt: actedAt,
    completedAt: action === "complete" ? actedAt : occurrence.completedAt ?? null,
    ignoredAt: action === "ignore" ? actedAt : occurrence.ignoredAt ?? null,
    syncStatus: "pending",
    history: [{ id: createId("history"), action: action === "complete" ? "COMPLETED" : "IGNORED", actedAt }, ...occurrence.history],
  };

  await putIntoStore(OCCURRENCE_STORE, nextOccurrence);
  await enqueue({
    userId,
    type: action === "complete" ? "completeOccurrence" : "ignoreOccurrence",
    entityId: occurrence.id,
    createdAt: actedAt,
    payload: {
      occurrenceId,
      occurredAt: actedAt,
    },
  });

  await refreshRuntimeStateFromStorage();
  return toOccurrenceDetailsDto(nextOccurrence);
}

export async function syncTaskPageFromServer(userId: string, page: number, filters?: { status?: string; taskCode?: number; name?: string }) {
  const query = new URLSearchParams({
    userId,
    page: String(page),
    pageSize: "100",
  });

  if (filters?.taskCode) query.set("taskCode", String(filters.taskCode));
  if (filters?.status === "FAVORITES") query.set("favorite", "true");
  else if (filters?.status) query.set("status", filters.status);
  if (filters?.name?.trim()) query.set("name", filters.name.trim());

  const payload = await fetchApi<TaskPageDto>(`/api/tasks?${query.toString()}`, { method: "GET" });
  await cacheTaskSnapshot(userId, payload.items);
  await refreshRuntimeStateFromStorage();
  return loadTaskPageFromCache(userId, page, filters);
}

export async function syncOccurrencePageFromServer(userId: string, page: number, filters: OccurrenceFilters) {
  const query = new URLSearchParams({
    userId,
    page: String(page),
    pageSize: "100",
    sortOrder: filters.sortOrder ?? "oldest",
  });

  if (filters.recurrenceCode) query.set("recurrenceCode", String(filters.recurrenceCode));
  if (filters.status) query.set("status", filters.status);
  if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) query.set("dateTo", filters.dateTo);
  if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);
  if (filters.name?.trim()) query.set("name", filters.name.trim());

  const payload = await fetchApi<OccurrencePageDto>(`/api/occurrences?${query.toString()}`, { method: "GET" });
  await cacheOccurrenceSnapshot(userId, payload.items as OccurrenceDetailsDto[]);
  await refreshRuntimeStateFromStorage();
  return loadOccurrencePageFromCache(userId, page, filters);
}

export async function syncOccurrenceDetailsFromServer(occurrenceId: string, userId: string) {
  if (!navigator.onLine) {
    return getOccurrenceDetailsFromCache(occurrenceId);
  }

  const occurrence = await fetchApi<OccurrenceDetailsDto>(`/api/occurrences/${occurrenceId}?userId=${encodeURIComponent(userId)}`, { method: "GET" });
  await putIntoStore(OCCURRENCE_STORE, {
    ...normalizeOccurrence(occurrence),
    lastNotificationAt: (await findOccurrenceByAnyId(occurrenceId))?.lastNotificationAt ?? null,
  });
  await refreshRuntimeStateFromStorage();
  return occurrence;
}

export async function markOccurrenceNotificationDelivered(occurrenceId: string, deliveredAt: string) {
  const occurrence = await findOccurrenceByAnyId(occurrenceId);
  if (!occurrence) {
    return;
  }

  await putIntoStore(OCCURRENCE_STORE, {
    ...occurrence,
    lastNotificationAt: deliveredAt,
    notificationAttempts: (occurrence.notificationAttempts ?? 0) + 1,
  });
}

export async function listOfflineNotificationCandidates(userId: string, lookAheadMinutes: number) {
  const occurrences = await getAllOccurrences();
  const lookAheadDate = Date.now() + lookAheadMinutes * 60_000;

  return occurrences.filter((occurrence) => {
    if (occurrence.userId !== userId) return false;
    if (occurrence.status !== "PENDING" || occurrence.isEnded || occurrence.task.isEnded || occurrence.task.status !== "ACTIVE") return false;
    return new Date(occurrence.scheduledAt).getTime() <= lookAheadDate;
  });
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration =
    (await navigator.serviceWorker.getRegistration().catch(() => null)) ??
    (await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 1000);
      }),
    ]));

  if (!registration || !("sync" in registration)) {
    return;
  }

  try {
    await (registration as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> };
    }).sync.register(OFFLINE_SYNC_TAG);
  } catch {
    // Background Sync is best-effort and unsupported in many browsers.
  }
}

export async function hydrateOfflineRuntimeState() {
  return refreshRuntimeStateFromStorage();
}

export async function clearOfflineUserData() {
  await clearStore(TASK_STORE);
  await clearStore(OCCURRENCE_STORE);
  await clearStore(QUEUE_STORE);
  await clearStore(METADATA_STORE);

  Object.assign(runtimeState, createDefaultOfflineRuntimeState());
  emitRuntimeState();
}

export async function resetOfflineDataForTesting() {
  await clearOfflineUserData();
}
