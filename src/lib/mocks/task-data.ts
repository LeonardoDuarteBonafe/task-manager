import type { OccurrenceDetailsDto, OccurrencePageDto, TaskDto, TaskPageDto } from "@/components/tasks/types";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function withTime(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function buildMockTask(
  params: Partial<TaskDto> & Pick<TaskDto, "id" | "taskCode" | "title" | "scheduledTime" | "recurrenceType" | "status">,
): TaskDto {
  const now = new Date();

  return {
    userId: "force-session-user",
    notes: null,
    weekdays: [],
    timezone: "America/Sao_Paulo",
    startDate: addDays(now, -10).toISOString(),
    endDate: null,
    notificationRepeatMinutes: 10,
    maxOccurrences: null,
    createdAt: addDays(now, -12).toISOString(),
    updatedAt: addDays(now, -1).toISOString(),
    isEnded: false,
    endedAt: null,
    canceledAt: null,
    abortedAt: null,
    history: [],
    isFavorite: false,
    ...params,
  };
}

export function createMockDataset() {
  const now = new Date();

  const tasks: TaskDto[] = [
    buildMockTask({
      id: "mock-task-1",
      taskCode: 1,
      title: "Tirar lixo",
      recurrenceType: "DAILY",
      scheduledTime: "08:00",
      status: "ACTIVE",
      isFavorite: true,
      notes: "Levar para a coleta antes das 08:30.",
      history: [{ id: "th-1", action: "UPDATED", actedAt: addDays(now, -1).toISOString(), metadata: null }],
    }),
    buildMockTask({
      id: "mock-task-2",
      taskCode: 2,
      title: "Revisar agenda da semana",
      recurrenceType: "WEEKLY",
      weekdays: [1, 4],
      scheduledTime: "09:30",
      status: "ACTIVE",
      isFavorite: true,
      notes: "Olhar compromissos e prioridades.",
      history: [{ id: "th-2", action: "CREATED", actedAt: addDays(now, -6).toISOString(), metadata: null }],
    }),
    buildMockTask({
      id: "mock-task-3",
      taskCode: 3,
      title: "Tomar vitamina",
      recurrenceType: "DAILY",
      scheduledTime: "07:00",
      status: "ACTIVE",
      notes: "Depois do cafe da manha.",
      history: [{ id: "th-3", action: "UPDATED", actedAt: addDays(now, -2).toISOString(), metadata: null }],
    }),
    buildMockTask({
      id: "mock-task-4",
      taskCode: 4,
      title: "Fechar relatorio mensal",
      recurrenceType: "MONTHLY",
      scheduledTime: "17:00",
      status: "ENDED",
      isEnded: true,
      endedAt: addDays(now, -3).toISOString(),
      history: [{ id: "th-4", action: "ENDED", actedAt: addDays(now, -3).toISOString(), metadata: null }],
    }),
  ];

  const occurrences: OccurrenceDetailsDto[] = [
    {
      id: "mock-occ-1",
      taskId: "mock-task-1",
      userId: "force-session-user",
      recurrenceCode: 1,
      scheduledAt: withTime(addDays(now, -1), 8, 0).toISOString(),
      isEnded: false,
      status: "PENDING",
      treatedAt: null,
      completedAt: null,
      ignoredAt: null,
      notificationAttempts: 1,
      history: [{ id: "oh-1", action: "CREATED", actedAt: addDays(now, -1).toISOString() }],
      task: { ...tasks[0], createdAt: tasks[0].createdAt },
    },
    {
      id: "mock-occ-2",
      taskId: "mock-task-2",
      userId: "force-session-user",
      recurrenceCode: 2,
      scheduledAt: withTime(addDays(now, 1), 9, 30).toISOString(),
      isEnded: false,
      status: "PENDING",
      treatedAt: null,
      completedAt: null,
      ignoredAt: null,
      notificationAttempts: 0,
      history: [{ id: "oh-2", action: "CREATED", actedAt: now.toISOString() }],
      task: { ...tasks[1], createdAt: tasks[1].createdAt },
    },
    {
      id: "mock-occ-3",
      taskId: "mock-task-3",
      userId: "force-session-user",
      recurrenceCode: 3,
      scheduledAt: withTime(addDays(now, 2), 7, 0).toISOString(),
      isEnded: false,
      status: "PENDING",
      treatedAt: null,
      completedAt: null,
      ignoredAt: null,
      notificationAttempts: 0,
      history: [{ id: "oh-3", action: "CREATED", actedAt: now.toISOString() }],
      task: { ...tasks[2], createdAt: tasks[2].createdAt },
    },
    {
      id: "mock-occ-4",
      taskId: "mock-task-3",
      userId: "force-session-user",
      recurrenceCode: 4,
      scheduledAt: withTime(addDays(now, -3), 7, 0).toISOString(),
      isEnded: true,
      status: "COMPLETED",
      treatedAt: addDays(now, -3).toISOString(),
      completedAt: addDays(now, -3).toISOString(),
      ignoredAt: null,
      notificationAttempts: 1,
      history: [{ id: "oh-4", action: "COMPLETED", actedAt: addDays(now, -3).toISOString() }],
      task: { ...tasks[2], createdAt: tasks[2].createdAt },
    },
  ];

  return { tasks, occurrences };
}

export function buildMockTaskPage(tasks: TaskDto[], page: number, filters?: string | { status?: string; taskCode?: number; name?: string }): TaskPageDto {
  const status = typeof filters === "string" ? filters : filters?.status;
  const taskCode = typeof filters === "string" ? undefined : filters?.taskCode;
  const name = typeof filters === "string" ? undefined : filters?.name?.trim().toLocaleLowerCase();

  let filtered = status
    ? status === "FAVORITES"
      ? tasks.filter((task) => task.isFavorite)
      : tasks.filter((task) => task.status === status)
    : tasks;

  if (taskCode) {
    filtered = filtered.filter((task) => task.taskCode === taskCode);
  }

  if (name) {
    filtered = filtered.filter((task) => task.title.toLocaleLowerCase().includes(name));
  }

  return paginate(filtered, page, 10);
}

export function buildMockOccurrencePage(
  occurrences: OccurrenceDetailsDto[],
  page: number,
  filters: {
    name?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    recurrenceType?: string;
    recurrenceCode?: number;
    sortOrder?: "oldest" | "newest";
  },
): OccurrencePageDto {
  const now = Date.now();
  let filtered = [...occurrences];
  const name = filters.name?.trim().toLocaleLowerCase();

  if (name) {
    filtered = filtered.filter((occurrence) => occurrence.task.title.toLocaleLowerCase().includes(name));
  }

  if (filters.status) {
    filtered = filtered.filter((occurrence) => {
      if (filters.status === "OVERDUE") return occurrence.status === "PENDING" && new Date(occurrence.scheduledAt).getTime() < now;
      if (filters.status === "UPCOMING") return occurrence.status === "PENDING" && new Date(occurrence.scheduledAt).getTime() >= now;
      if (filters.status === "OPEN") return occurrence.status === "PENDING";
      if (filters.status === "COMPLETED") return occurrence.status === "COMPLETED";
      if (filters.status === "IGNORED") return occurrence.status === "IGNORED";
      if (filters.status === "CANCELED") return occurrence.task.status === "CANCELED";
      if (filters.status === "ABORTED") return occurrence.task.status === "ABORTED";
      if (filters.status === "FAVORITES") return occurrence.task.isFavorite;
      return true;
    });
  }

  if (filters.dateFrom) {
    const dateFrom = filters.dateFrom;
    filtered = filtered.filter((occurrence) => new Date(occurrence.scheduledAt) >= new Date(dateFrom));
  }

  if (filters.dateTo) {
    const dateTo = filters.dateTo;
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter((occurrence) => new Date(occurrence.scheduledAt) <= end);
  }

  if (filters.recurrenceType) {
    filtered = filtered.filter((occurrence) => occurrence.task.recurrenceType === filters.recurrenceType);
  }

  if (filters.recurrenceCode) {
    filtered = filtered.filter((occurrence) => occurrence.recurrenceCode === filters.recurrenceCode);
  }

  filtered.sort((a, b) =>
    filters.sortOrder === "newest"
      ? new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      : new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return paginate(filtered, page, 10);
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(page, 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
