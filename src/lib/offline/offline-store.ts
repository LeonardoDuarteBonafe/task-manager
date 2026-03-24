"use client";

import type { TaskFormValues } from "@/components/tasks/task-form";
import type { OccurrenceDetailsDto, OccurrencePageDto, TaskDto, TaskPageDto } from "@/components/tasks/types";
import { buildMockOccurrencePage, buildMockTaskPage } from "@/lib/mocks/task-data";

const DB_NAME = "taskmanager-offline";
const DB_VERSION = 1;
const TASK_STORE = "tasks";
const OCCURRENCE_STORE = "occurrences";
const QUEUE_STORE = "queue";

type QueueOperationType = "createTask" | "updateTask" | "completeOccurrence" | "ignoreOccurrence";

type CachedTask = TaskDto & {
  clientId: string;
  remoteId: string | null;
  localOnly: boolean;
  syncStatus: "synced" | "pending" | "error";
};

type CachedOccurrence = OccurrenceDetailsDto & {
  remoteId: string | null;
  taskClientId: string;
  taskRemoteId: string | null;
  localOnly: boolean;
  syncStatus: "synced" | "pending" | "error";
  lastNotificationAt: string | null;
};

type QueueItem = {
  id: string;
  userId: string;
  type: QueueOperationType;
  entityId: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

type OccurrenceFilters = {
  recurrenceCode?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  recurrenceType?: string;
  sortOrder?: "oldest" | "newest";
};

function isIndexedDbSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase() {
  if (!isIndexedDbSupported()) {
    throw new Error("IndexedDB is not supported in this browser.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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
            // Ignore abort failures after transaction is already finishing.
          }
        });

      transaction.oncomplete = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(callbackResult);
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
  return withStore<T | undefined>(storeName, "readonly", async (store) => {
    const result = await requestToPromise(store.get(id) as IDBRequest<T | undefined>);
    return result;
  });
}

async function putIntoStore<T>(storeName: string, value: T) {
  return withStore<void>(storeName, "readwrite", async (store) => {
    await requestToPromise(store.put(value));
  });
}

async function deleteFromStore(storeName: string, id: string) {
  return withStore<void>(storeName, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

async function fetchApi<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

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

function matchesTask(existing: CachedTask, task: TaskDto) {
  return existing.id === task.id || existing.remoteId === task.id || existing.clientId === (task.clientId ?? task.id);
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

function generateOccurrencesForTask(task: CachedTask, horizonDays = 30) {
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

async function enqueue(item: QueueItem) {
  await putIntoStore(QUEUE_STORE, item);
  await requestBackgroundSync();
}

async function replaceTaskOccurrences(task: CachedTask) {
  const allOccurrences = await getAllOccurrences();
  const related = allOccurrences.filter((occurrence) => occurrence.taskClientId === task.clientId);
  const relatedByScheduledAt = new Map(related.map((occurrence) => [occurrence.scheduledAt, occurrence]));
  const generated = generateOccurrencesForTask(task);

  await Promise.all(related.map((occurrence) => deleteFromStore(OCCURRENCE_STORE, occurrence.id)));

  await Promise.all(
    generated.map((occurrence) => {
      const existing = relatedByScheduledAt.get(occurrence.scheduledAt);

      if (!existing) {
        return putIntoStore(OCCURRENCE_STORE, occurrence);
      }

      return putIntoStore(OCCURRENCE_STORE, {
        ...occurrence,
        id: existing.id,
        remoteId: existing.remoteId,
        localOnly: existing.localOnly,
        syncStatus: existing.syncStatus,
        isEnded: existing.isEnded,
        status: existing.status,
        treatedAt: existing.treatedAt ?? null,
        completedAt: existing.completedAt ?? null,
        ignoredAt: existing.ignoredAt ?? null,
        notificationAttempts: existing.notificationAttempts ?? 0,
        history: existing.history,
        lastNotificationAt: existing.lastNotificationAt,
      });
    }),
  );
}

async function nextLocalTaskCode(userId: string) {
  const tasks = await getAllTasks();
  return tasks.filter((task) => task.userId === userId).reduce((maxCode, task) => Math.max(maxCode, task.taskCode), 0) + 1;
}

export async function cacheTaskPage(userId: string, page: TaskPageDto) {
  const existingTasks = await getAllTasks();
  const incomingIds = new Set(page.items.map((task) => task.id));

  for (const task of page.items) {
    const normalized = normalizeTask(task);
    const existing = existingTasks.find((candidate) => matchesTask(candidate, task));

    if (existing && existing.id !== normalized.id) {
      await deleteFromStore(TASK_STORE, existing.id);
    }

    await putIntoStore(TASK_STORE, {
      ...(existing ?? normalized),
      ...normalized,
      localOnly: false,
      syncStatus: "synced",
    });
  }

  const localOnlyTasks = existingTasks.filter((task) => task.userId === userId && task.localOnly);
  for (const task of localOnlyTasks) {
    if (!incomingIds.has(task.id)) {
      await putIntoStore(TASK_STORE, task);
    }
  }
}

export async function cacheOccurrencePage(page: OccurrencePageDto) {
  const existingOccurrences = await getAllOccurrences();

  for (const occurrence of page.items) {
    const normalized = normalizeOccurrence(occurrence as OccurrenceDetailsDto);
    const existing = existingOccurrences.find(
      (candidate) =>
        candidate.id === occurrence.id ||
        candidate.remoteId === occurrence.id ||
        (candidate.taskClientId === normalized.taskClientId && candidate.scheduledAt === normalized.scheduledAt),
    );

    if (existing && existing.id !== normalized.id) {
      await deleteFromStore(OCCURRENCE_STORE, existing.id);
    }

    await putIntoStore(OCCURRENCE_STORE, {
      ...(existing ?? normalized),
      ...normalized,
      localOnly: false,
      syncStatus: "synced",
      lastNotificationAt: existing?.lastNotificationAt ?? null,
    });
  }
}

export async function loadTaskPageFromCache(userId: string, page: number, filters?: { status?: string; taskCode?: number }) {
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

export async function getOccurrenceDetailsFromCache(occurrenceId: string) {
  const occurrence = await getFromStore<CachedOccurrence>(OCCURRENCE_STORE, occurrenceId);
  return occurrence ? toOccurrenceDetailsDto(occurrence) : null;
}

export async function saveTaskOffline(values: TaskFormValues, userId: string) {
  const clientId = createId("local-task");
  const taskCode = await nextLocalTaskCode(userId);
  const task = taskFormToCachedTask(values, userId, taskCode, clientId);

  await putIntoStore(TASK_STORE, task);
  await replaceTaskOccurrences(task);
  await enqueue({
    id: createId("queue"),
    userId,
    type: "createTask",
    entityId: clientId,
    createdAt: new Date().toISOString(),
    payload: buildTaskPayload(values, userId, clientId),
  });

  return toTaskDto(task);
}

export async function updateTaskOffline(taskId: string, values: TaskFormValues, userId: string) {
  const task = await getFromStore<CachedTask>(TASK_STORE, taskId);
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
    history: task.history,
    isFavorite: task.isFavorite,
    syncStatus: "pending",
    localOnly: task.remoteId === null,
  };

  await putIntoStore(TASK_STORE, updatedTask);
  await replaceTaskOccurrences(updatedTask);
  await enqueue({
    id: createId("queue"),
    userId,
    type: "updateTask",
    entityId: task.clientId,
    createdAt: new Date().toISOString(),
    payload: buildTaskPayload(values, userId, task.clientId),
  });

  return toTaskDto(updatedTask);
}

export async function applyOccurrenceActionOffline(occurrenceId: string, userId: string, action: "complete" | "ignore") {
  const occurrence = await getFromStore<CachedOccurrence>(OCCURRENCE_STORE, occurrenceId);
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
    syncStatus: occurrence.remoteId ? "pending" : occurrence.syncStatus,
    history: [{ id: createId("history"), action: action === "complete" ? "COMPLETED" : "IGNORED", actedAt }, ...occurrence.history],
  };

  await putIntoStore(OCCURRENCE_STORE, nextOccurrence);
  await enqueue({
    id: createId("queue"),
    userId,
    type: action === "complete" ? "completeOccurrence" : "ignoreOccurrence",
    entityId: occurrenceId,
    createdAt: actedAt,
    payload: {
      occurrenceId,
      occurredAt: actedAt,
    },
  });

  return toOccurrenceDetailsDto(nextOccurrence);
}

async function upsertTaskFromServer(task: TaskDto) {
  const existingTasks = await getAllTasks();
  const normalized = normalizeTask(task);
  const existing = existingTasks.find((candidate) => matchesTask(candidate, task));

  if (existing && existing.id !== normalized.id) {
    await deleteFromStore(TASK_STORE, existing.id);
  }

  await putIntoStore(TASK_STORE, {
    ...(existing ?? normalized),
    ...normalized,
    localOnly: false,
    syncStatus: "synced",
  });
}

async function getTaskByEntityId(entityId: string) {
  const directMatch = await getFromStore<CachedTask>(TASK_STORE, entityId);
  if (directMatch) {
    return directMatch;
  }

  const allTasks = await getAllTasks();
  return allTasks.find((task) => task.clientId === entityId || task.remoteId === entityId) ?? null;
}

async function resolveOccurrenceRemoteId(occurrence: CachedOccurrence) {
  if (occurrence.remoteId) {
    return occurrence.remoteId;
  }

  const task = await getFromStore<CachedTask>(TASK_STORE, occurrence.taskId);
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

  const nextOccurrence: CachedOccurrence = {
    ...occurrence,
    id: reconciled.id,
    remoteId: reconciled.id,
    taskId: reconciled.taskId,
    taskRemoteId: reconciled.task.id,
    taskClientId: reconciled.task.clientId ?? occurrence.taskClientId,
    task: {
      ...reconciled.task,
    },
    localOnly: false,
    syncStatus: "synced",
  };

  await deleteFromStore(OCCURRENCE_STORE, occurrence.id);
  await putIntoStore(OCCURRENCE_STORE, nextOccurrence);
  return reconciled.id;
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) {
    return;
  }

  const items = await getAllQueueItems();

  for (const item of items) {
    try {
      if (item.type === "createTask") {
        const createdTask = await fetchApi<TaskDto>("/api/tasks", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });

        await upsertTaskFromServer(createdTask);
        const cachedTask = (await getAllTasks()).find((task) => task.clientId === (item.payload.clientId as string));
        if (cachedTask) {
          await replaceTaskOccurrences({
            ...cachedTask,
            id: createdTask.id,
            remoteId: createdTask.id,
            localOnly: false,
            syncStatus: "synced",
          });
        }
      }

      if (item.type === "updateTask") {
        const task = await getTaskByEntityId(item.entityId);
        if (!task) {
          await deleteFromStore(QUEUE_STORE, item.id);
          continue;
        }

        if (!task?.remoteId) {
          continue;
        }

        const updatedTask = await fetchApi<TaskDto>(`/api/tasks/${task.remoteId}`, {
          method: "PUT",
          body: JSON.stringify(item.payload),
        });
        await upsertTaskFromServer(updatedTask);
      }

      if (item.type === "completeOccurrence" || item.type === "ignoreOccurrence") {
        const occurrence = await getFromStore<CachedOccurrence>(OCCURRENCE_STORE, item.entityId);
        if (!occurrence) {
          await deleteFromStore(QUEUE_STORE, item.id);
          continue;
        }

        const remoteId = await resolveOccurrenceRemoteId(occurrence);
        if (!remoteId) {
          continue;
        }

        const action = item.type === "completeOccurrence" ? "complete" : "ignore";
        const updatedOccurrence = await fetchApi<OccurrenceDetailsDto>(`/api/occurrences/${remoteId}/${action}`, {
          method: "POST",
          body: JSON.stringify({
            userId: item.userId,
            [action === "complete" ? "completedAt" : "ignoredAt"]: item.payload.occurredAt,
          }),
        });

        await putIntoStore(OCCURRENCE_STORE, {
          ...normalizeOccurrence(updatedOccurrence),
          lastNotificationAt: occurrence.lastNotificationAt,
        });
      }

      await deleteFromStore(QUEUE_STORE, item.id);
    } catch (error) {
      if (!navigator.onLine) {
        return;
      }

      console.error("Offline queue flush failed.", error);
    }
  }
}

export async function syncTaskPageFromServer(userId: string, page: number, filters?: { status?: string; taskCode?: number }) {
  const query = new URLSearchParams({
    userId,
    page: String(page),
    pageSize: "10",
  });

  if (filters?.taskCode) query.set("taskCode", String(filters.taskCode));
  if (filters?.status === "FAVORITES") query.set("favorite", "true");
  else if (filters?.status) query.set("status", filters.status);

  const payload = await fetchApi<TaskPageDto>(`/api/tasks?${query.toString()}`, { method: "GET" });
  await cacheTaskPage(userId, payload);
  return payload;
}

export async function syncOccurrencePageFromServer(userId: string, page: number, filters: OccurrenceFilters) {
  const query = new URLSearchParams({
    userId,
    page: String(page),
    pageSize: "10",
    sortOrder: filters.sortOrder ?? "oldest",
  });

  if (filters.recurrenceCode) query.set("recurrenceCode", String(filters.recurrenceCode));
  if (filters.status) query.set("status", filters.status);
  if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) query.set("dateTo", filters.dateTo);
  if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);

  const payload = await fetchApi<OccurrencePageDto>(`/api/occurrences?${query.toString()}`, { method: "GET" });
  await cacheOccurrencePage(payload);
  return payload;
}

export async function syncOccurrenceDetailsFromServer(occurrenceId: string, userId: string) {
  const occurrence = await fetchApi<OccurrenceDetailsDto>(`/api/occurrences/${occurrenceId}?userId=${encodeURIComponent(userId)}`, { method: "GET" });
  await putIntoStore(OCCURRENCE_STORE, normalizeOccurrence(occurrence));
  return occurrence;
}

export async function markOccurrenceNotificationDelivered(occurrenceId: string, deliveredAt: string) {
  const occurrence = await getFromStore<CachedOccurrence>(OCCURRENCE_STORE, occurrenceId);
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
    }).sync.register("taskmanager-offline-sync");
  } catch {
    // Background Sync is best-effort and unsupported in many browsers.
  }
}
