"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/http-client";
import { OccurrenceItem } from "./occurrence-item";
import type { OccurrencePageDto } from "./types";

const PAGE_SIZE = 10;

type FilterState = {
  status: string;
  dateFrom: string;
  dateTo: string;
  recurrenceType: string;
  sortOrder: "oldest" | "newest";
};

export function RecurrencesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const userId = session?.user?.id;

  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const [filters, setFilters] = useState<FilterState>({
    status: searchParams.get("status") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    recurrenceType: searchParams.get("recurrenceType") ?? "",
    sortOrder: searchParams.get("sortOrder") === "newest" ? "newest" : "oldest",
  });
  const [data, setData] = useState<OccurrencePageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const query = new URLSearchParams({
      userId,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortOrder: filters.sortOrder,
    });

    if (filters.status) query.set("status", filters.status);
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);

    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<OccurrencePageDto>(`/api/occurrences?${query.toString()}`);
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar recorrencias.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, userId]);

  useEffect(() => {
    setFilters({
      status: searchParams.get("status") ?? "",
      dateFrom: searchParams.get("dateFrom") ?? "",
      dateTo: searchParams.get("dateTo") ?? "",
      recurrenceType: searchParams.get("recurrenceType") ?? "",
      sortOrder: searchParams.get("sortOrder") === "newest" ? "newest" : "oldest",
    });
  }, [searchParams]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated" || !userId) return;

    void loadData();
  }, [status, userId, router, loadData]);

  function applyFilters() {
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("sortOrder", filters.sortOrder);
    if (filters.status) query.set("status", filters.status);
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);
    router.push(`${pathname}?${query.toString()}`);
  }

  async function handleOccurrenceAction(occurrenceId: string, action: "complete" | "ignore") {
    if (!userId) return;
    setActionLoadingId(occurrenceId);
    setError(null);
    try {
      await apiRequest(`/api/occurrences/${occurrenceId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Acao nao concluida.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleTaskLifecycle(taskId: string, action: "cancel" | "abort") {
    if (!userId) return;
    setActionLoadingId(taskId);
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Acao nao concluida.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <AppShell subtitle="Use filtros para explorar as recorrencias geradas." title="Recorrencias">
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-5">
          <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Todos os status</option>
            <option value="OVERDUE">Vencidas</option>
            <option value="UPCOMING">Proximas</option>
            <option value="OPEN">Abertas</option>
            <option value="COMPLETED">Concluidas</option>
            <option value="IGNORED">Ignoradas</option>
            <option value="CANCELED">Canceladas</option>
            <option value="ABORTED">Abortadas</option>
          </Select>
          <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
          <Select
            value={filters.recurrenceType}
            onChange={(event) => setFilters((current) => ({ ...current, recurrenceType: event.target.value }))}
          >
            <option value="">Todos os tipos</option>
            <option value="ONCE">Uma vez</option>
            <option value="DAILY">Diariamente</option>
            <option value="WEEKLY">Semanalmente</option>
            <option value="MONTHLY">Mensalmente</option>
          </Select>
          <Select value={filters.sortOrder} onChange={(event) => setFilters((current) => ({ ...current, sortOrder: event.target.value as "oldest" | "newest" }))}>
            <option value="oldest">Mais antigas</option>
            <option value="newest">Mais novas</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={applyFilters}>
            Aplicar filtros
          </Button>
          <Link href="/recorrencias">
            <Button type="button" variant="secondary">
              Limpar
            </Button>
          </Link>
        </div>
      </Card>

      {loading ? <PageState description="Buscando recorrencias..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && items.length === 0 ? <PageState description="Nenhuma recorrencia encontrada para os filtros atuais." title="Vazio" /> : null}
      {!loading && !error && items.length > 0
        ? items.map((occurrence) => (
            <OccurrenceItem
              key={occurrence.id}
              occurrence={occurrence}
              loadingActionId={actionLoadingId}
              onAbortTask={(taskId) => handleTaskLifecycle(taskId, "abort")}
              onCancelTask={(taskId) => handleTaskLifecycle(taskId, "cancel")}
              onComplete={(id) => handleOccurrenceAction(id, "complete")}
              onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
            />
          ))
        : null}

      {!loading && !error && data ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Pagina {data.page} de {data.totalPages} ({data.total} recorrencias)
          </p>
          <div className="flex gap-2">
            <Link href={`/recorrencias?${buildPageQuery(searchParams, Math.max(1, page - 1))}`}>
              <Button disabled={page <= 1} variant="secondary">
                Anterior
              </Button>
            </Link>
            <Link href={`/recorrencias?${buildPageQuery(searchParams, Math.min(totalPages, page + 1))}`}>
              <Button disabled={page >= totalPages} variant="secondary">
                Proxima
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}

function buildPageQuery(searchParams: URLSearchParams, page: number) {
  const query = new URLSearchParams(searchParams.toString());
  query.set("page", String(page));
  if (!query.has("sortOrder")) query.set("sortOrder", "oldest");
  return query.toString();
}
