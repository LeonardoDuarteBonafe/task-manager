"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { OccurrenceSection } from "@/components/tasks/occurrence-section";
import type { OccurrenceDto } from "@/components/tasks/types";
import { AppShell } from "@/components/ui/app-shell";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";

export default function DashboardPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OccurrenceDto[]>([]);
  const [upcoming, setUpcoming] = useState<OccurrenceDto[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [overdueData, upcomingData] = await Promise.all([
        apiRequest<OccurrenceDto[]>(`/api/occurrences/overdue?userId=${encodeURIComponent(userId)}&limit=5`),
        apiRequest<OccurrenceDto[]>(`/api/occurrences/upcoming?userId=${encodeURIComponent(userId)}&limit=5`),
      ]);
      setOverdue(overdueData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
      setUpcoming(upcomingData.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      void loadData();
    }
  }, [status, loadData, router]);

  const handleOccurrenceAction = async (occurrenceId: string, action: "complete" | "ignore") => {
    if (!userId) return;
    setActionLoadingId(occurrenceId);
    setError(null);
    try {
      const endpoint = action === "complete" ? "complete" : "ignore";
      await apiRequest(`/api/occurrences/${occurrenceId}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ação não concluída.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const subtitle = useMemo(() => {
    if (!session?.user?.email) return "Gerencie ocorrências vencidas e próximas.";
    return `Usuário: ${session.user.email}`;
  }, [session?.user?.email]);

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Dashboard">
        <PageState description="Verificando sessão..." title="Carregando" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle={subtitle} title="Dashboard">
      <OccurrenceSection
        actionLoadingId={actionLoadingId}
        emptyMessage="Nenhuma ocorrência vencida no momento."
        error={error}
        loading={loading}
        occurrences={overdue}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
        title="Tarefas vencidas"
        viewAllHref="/occurrences?context=overdue&page=1"
      />
      <OccurrenceSection
        actionLoadingId={actionLoadingId}
        emptyMessage="Nenhuma ocorrência próxima encontrada."
        error={error}
        loading={loading}
        occurrences={upcoming}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
        title="Próximas tarefas"
        viewAllHref="/occurrences?context=upcoming&page=1"
      />
    </AppShell>
  );
}
