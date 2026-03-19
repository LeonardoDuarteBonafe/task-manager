"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";

export default function NewTaskPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!userId) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          userId,
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
        }),
      });
      router.push("/tasks");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao criar tarefa.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Nova task">
        <PageState description="Carregando sessão..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Defina uma tarefa recorrente para o MVP1." title="Nova task">
      <Card>
        <TaskForm error={error} onSubmit={handleSubmit} submitting={submitting} />
      </Card>
    </AppShell>
  );
}
