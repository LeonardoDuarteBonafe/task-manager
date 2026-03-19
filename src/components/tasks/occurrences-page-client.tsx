"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { OccurrenceItem } from "./occurrence-item";
import type { OccurrenceDto, OccurrencePageDto } from "./types";

const PAGE_SIZE = 10;

export function OccurrencesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const context = searchParams.get("context") === "overdue" ? "overdue" : "upcoming";
  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);

  const [data, setData] = useState<OccurrencePageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<OccurrencePageDto>(
        `/api/occurrences?userId=${encodeURIComponent(userId)}&context=${context}&page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar ocorrências.");
    } finally {
      setLoading(false);
    }
  }, [context, page, userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      void loadPage();
    }
  }, [status, loadPage, router]);

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
      await loadPage();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ação não concluída.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const items: OccurrenceDto[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <AppShell
      subtitle="Listagem paginada de ocorrências pendentes."
      title={context === "overdue" ? "Todas as tarefas vencidas" : "Todas as próximas tarefas"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/occurrences?context=overdue&page=1">
          <Button variant={context === "overdue" ? "primary" : "secondary"}>Vencidas</Button>
        </Link>
        <Link href="/occurrences?context=upcoming&page=1">
          <Button variant={context === "upcoming" ? "primary" : "secondary"}>Próximas</Button>
        </Link>
      </div>

      {loading ? <PageState description="Buscando ocorrências..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && items.length === 0 ? (
        <PageState description="Não há ocorrências para este contexto." title="Vazio" />
      ) : null}

      {!loading && !error && items.length > 0
        ? items.map((occurrence) => (
            <OccurrenceItem
              key={occurrence.id}
              occurrence={occurrence}
              loadingActionId={actionLoadingId}
              onComplete={(id) => handleOccurrenceAction(id, "complete")}
              onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
            />
          ))
        : null}

      {!loading && !error && data ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Página {data.page} de {data.totalPages} ({data.total} itens)
          </p>
          <div className="flex gap-2">
            <Link href={`/occurrences?context=${context}&page=${Math.max(1, page - 1)}`}>
              <Button disabled={page <= 1} variant="secondary">
                Anterior
              </Button>
            </Link>
            <Link href={`/occurrences?context=${context}&page=${Math.min(totalPages, page + 1)}`}>
              <Button disabled={page >= totalPages} variant="secondary">
                Próxima
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
