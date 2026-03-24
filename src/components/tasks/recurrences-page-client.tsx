"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { buildMockOccurrencePage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";
import {
  applyOccurrenceActionOffline,
  flushOfflineQueue,
  loadOccurrencePageFromCache,
  syncOccurrencePageFromServer,
} from "@/lib/offline/offline-store";
import { OccurrenceDialog } from "./occurrence-dialog";
import { OccurrenceItem } from "./occurrence-item";
import type { OccurrenceDetailsDto, OccurrencePageDto } from "./types";

const PAGE_SIZE = 10;

type FilterState = {
  recurrenceCode: string;
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
  const isMockMode = isForcedUser(session?.user);
  const occurrenceIdFromQuery = searchParams.get("occurrenceId");

  const urlPage = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const [offlinePage, setOfflinePage] = useState<number | null>(null);
  const page = offlinePage ?? urlPage;
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    recurrenceCode: searchParams.get("code") ?? "",
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
  const [mockOccurrences, setMockOccurrences] = useState<OccurrenceDetailsDto[]>([]);

  const loadData = useCallback(async () => {
    if (!userId) return;

    if (isMockMode) {
      const dataset = createMockDataset();
      setMockOccurrences(dataset.occurrences);
      setData(
        buildMockOccurrencePage(dataset.occurrences, page, {
          recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          recurrenceType: filters.recurrenceType,
          sortOrder: filters.sortOrder,
        }),
      );
      setLoading(false);
      setError(null);
      return;
    }

    const query = new URLSearchParams({
      userId,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortOrder: filters.sortOrder,
    });

    if (filters.recurrenceCode) query.set("recurrenceCode", filters.recurrenceCode);
    if (filters.status) query.set("status", filters.status);
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);

    setLoading(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        const cachedData = await loadOccurrencePageFromCache(userId, page, {
          recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          recurrenceType: filters.recurrenceType,
          sortOrder: filters.sortOrder,
        });
        setData(cachedData);
        setError(null);
        return;
      }

      await flushOfflineQueue();
      const payload = await syncOccurrencePageFromServer(userId, page, {
        recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        recurrenceType: filters.recurrenceType,
        sortOrder: filters.sortOrder,
      });
      setData(payload);
    } catch (requestError) {
      const cachedData = await loadOccurrencePageFromCache(userId, page, {
        recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        recurrenceType: filters.recurrenceType,
        sortOrder: filters.sortOrder,
      });
      setData(cachedData);
      if (cachedData.items.length === 0) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar recorrencias.");
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, isMockMode, page, userId]);

  useEffect(() => {
    setFilters({
      recurrenceCode: searchParams.get("code") ?? "",
      status: searchParams.get("status") ?? "",
      dateFrom: searchParams.get("dateFrom") ?? "",
      dateTo: searchParams.get("dateTo") ?? "",
      recurrenceType: searchParams.get("recurrenceType") ?? "",
      sortOrder: searchParams.get("sortOrder") === "newest" ? "newest" : "oldest",
    });
  }, [searchParams]);

  useEffect(() => {
    setOfflinePage(null);
  }, [urlPage, searchParams]);

  useEffect(() => {
    setSelectedOccurrenceId(occurrenceIdFromQuery ?? null);
  }, [occurrenceIdFromQuery]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated" || !userId) return;

    void loadData();
  }, [status, userId, router, loadData]);

  function applyFilters() {
    if (!navigator.onLine) {
      setOfflinePage(1);
      return;
    }

    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("sortOrder", filters.sortOrder);
    if (occurrenceIdFromQuery) query.set("occurrenceId", occurrenceIdFromQuery);
    if (filters.recurrenceCode) query.set("code", filters.recurrenceCode);
    if (filters.status) query.set("status", filters.status);
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
    if (filters.recurrenceType) query.set("recurrenceType", filters.recurrenceType);
    router.push(`${pathname}?${query.toString()}`);
  }

  function goToPage(nextPage: number) {
    if (!navigator.onLine) {
      setOfflinePage(nextPage);
      return;
    }

    router.push(`/recorrencias?${buildPageQuery(searchParams, nextPage)}`);
  }

  function handleCloseOccurrenceDialog() {
    setSelectedOccurrenceId(null);

    if (!occurrenceIdFromQuery) {
      return;
    }

    const query = new URLSearchParams(searchParams.toString());
    query.delete("occurrenceId");
    router.replace(query.toString() ? `${pathname}?${query.toString()}` : pathname);
  }

  async function handleOccurrenceAction(occurrenceId: string, action: "complete" | "ignore") {
    if (!userId) return;
    if (isMockMode) {
      setMockOccurrences((current) => {
        const next = current.map((occurrence) =>
          occurrence.id === occurrenceId
            ? {
                ...occurrence,
                isEnded: true,
                status: (action === "complete" ? "COMPLETED" : "IGNORED") as "COMPLETED" | "IGNORED",
                treatedAt: new Date().toISOString(),
                completedAt: action === "complete" ? new Date().toISOString() : occurrence.completedAt,
                ignoredAt: action === "ignore" ? new Date().toISOString() : occurrence.ignoredAt,
                history: [
                  { id: `mock-occ-history-${Date.now()}`, action: action === "complete" ? "COMPLETED" : "IGNORED", actedAt: new Date().toISOString() },
                  ...occurrence.history,
                ],
              }
            : occurrence,
        );
        setData(
          buildMockOccurrencePage(next, page, {
            recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
            status: filters.status,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            recurrenceType: filters.recurrenceType,
            sortOrder: filters.sortOrder,
          }),
        );
        return next;
      });
      return;
    }
    setActionLoadingId(occurrenceId);
    setError(null);
    try {
      await applyOccurrenceActionOffline(occurrenceId, userId, action);
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
    <AppShell subtitle="Filtre, abra detalhes em modal e acompanhe o historico de cada recorrencia." title="Recorrencias">
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">Todos os status</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="UPCOMING">Proximas</option>
              <option value="OPEN">Abertas</option>
              <option value="COMPLETED">Concluidas</option>
              <option value="IGNORED">Ignoradas</option>
              <option value="CANCELED">Canceladas</option>
              <option value="ABORTED">Abortadas</option>
              <option value="FAVORITES">Favoritas</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Codigo</label>
            <Input
              inputMode="numeric"
              onChange={(event) => setFilters((current) => ({ ...current, recurrenceCode: event.target.value.replace(/\D/g, "") }))}
              placeholder="Ex.: 24"
              value={filters.recurrenceCode}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
            <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ate</label>
            <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
            <Select value={filters.recurrenceType} onChange={(event) => setFilters((current) => ({ ...current, recurrenceType: event.target.value }))}>
              <option value="">Todos os tipos</option>
              <option value="ONCE">Uma vez</option>
              <option value="DAILY">Diariamente</option>
              <option value="WEEKLY">Semanalmente</option>
              <option value="MONTHLY">Mensalmente</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ordenacao</label>
            <Select value={filters.sortOrder} onChange={(event) => setFilters((current) => ({ ...current, sortOrder: event.target.value as "oldest" | "newest" }))}>
              <option value="oldest">Mais antigas</option>
              <option value="newest">Mais novas</option>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={applyFilters}>
            Aplicar filtros
          </Button>
          <Button
            onClick={() => {
              if (!navigator.onLine) {
                setFilters({
                  recurrenceCode: "",
                  status: "",
                  dateFrom: "",
                  dateTo: "",
                  recurrenceType: "",
                  sortOrder: "oldest",
                });
                setOfflinePage(1);
                return;
              }

              router.push("/recorrencias");
            }}
            type="button"
            variant="secondary"
          >
            Limpar
          </Button>
        </div>
      </Card>

      {loading ? <PageState description="Buscando recorrencias..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && items.length === 0 ? <PageState description="Nenhuma recorrencia encontrada para os filtros atuais." title="Vazio" /> : null}
      {!loading && !error && items.length > 0
        ? items.map((occurrence) => (
            <OccurrenceItem
              key={occurrence.id}
              loadingActionId={actionLoadingId}
              occurrence={occurrence}
              onComplete={(id) => handleOccurrenceAction(id, "complete")}
              onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
              onOpen={setSelectedOccurrenceId}
              onViewTask={(taskCode) => router.push(`/tasks?code=${taskCode}&page=1`)}
            />
          ))
        : null}

      {!loading && !error && data ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pagina {data.page} de {data.totalPages} ({data.total} recorrencias)
          </p>
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => goToPage(Math.max(1, page - 1))} variant="secondary">
              Anterior
            </Button>
            <Button disabled={page >= totalPages} onClick={() => goToPage(Math.min(totalPages, page + 1))} variant="secondary">
              Proxima
            </Button>
          </div>
        </Card>
      ) : null}

      <OccurrenceDialog
        occurrenceId={selectedOccurrenceId}
        onClose={handleCloseOccurrenceDialog}
        open={Boolean(selectedOccurrenceId)}
        userId={userId ?? ""}
        initialOccurrence={items.find((occurrence) => occurrence.id === selectedOccurrenceId) ?? mockOccurrences.find((occurrence) => occurrence.id === selectedOccurrenceId) ?? null}
        isMockMode={isMockMode}
        loadingActionId={actionLoadingId}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
      />
    </AppShell>
  );
}

function buildPageQuery(searchParams: URLSearchParams, page: number) {
  const query = new URLSearchParams(searchParams.toString());
  query.set("page", String(page));
  if (!query.has("sortOrder")) query.set("sortOrder", "oldest");
  return query.toString();
}
