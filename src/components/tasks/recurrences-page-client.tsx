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
import { applyOccurrenceActionOffline, loadOccurrencePageFromCache, syncOccurrencePageFromServer } from "@/lib/offline/offline-store";
import { readOfflineLastUser } from "@/lib/offline/user-session";
import { OccurrenceDialog } from "./occurrence-dialog";
import { OccurrenceItem } from "./occurrence-item";
import type { OccurrenceDetailsDto, OccurrencePageDto } from "./types";

type FilterState = {
  page: number;
  name: string;
  recurrenceCode: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  recurrenceType: string;
  sortOrder: "oldest" | "newest";
};

function readFilters(searchParams: URLSearchParams) {
  return {
    page: Math.max(Number(searchParams.get("page") ?? "1"), 1),
    name: searchParams.get("name") ?? "",
    recurrenceCode: searchParams.get("code") ?? "",
    status: searchParams.get("status") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    recurrenceType: searchParams.get("recurrenceType") ?? "",
    sortOrder: searchParams.get("sortOrder") === "newest" ? "newest" : "oldest",
  } satisfies FilterState;
}

export function RecurrencesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const userId = session?.user?.id ?? offlineUserId;
  const isMockMode = isForcedUser(session?.user);
  const occurrenceIdFromQuery = searchParams.get("occurrenceId");

  const [filters, setFilters] = useState<FilterState>(() => readFilters(new URLSearchParams(searchParams.toString())));
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(occurrenceIdFromQuery);
  const [data, setData] = useState<OccurrencePageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [mockOccurrences, setMockOccurrences] = useState<OccurrenceDetailsDto[]>([]);

  useEffect(() => {
    setOfflineUserId(readOfflineLastUser()?.id ?? null);
  }, []);

  const syncUrl = useCallback(
    (nextFilters: FilterState, nextOccurrenceId?: string | null) => {
      const query = new URLSearchParams();
      query.set("page", String(nextFilters.page));
      query.set("sortOrder", nextFilters.sortOrder);
      if (nextOccurrenceId) query.set("occurrenceId", nextOccurrenceId);
      if (nextFilters.name) query.set("name", nextFilters.name);
      if (nextFilters.recurrenceCode) query.set("code", nextFilters.recurrenceCode);
      if (nextFilters.status) query.set("status", nextFilters.status);
      if (nextFilters.dateFrom) query.set("dateFrom", nextFilters.dateFrom);
      if (nextFilters.dateTo) query.set("dateTo", nextFilters.dateTo);
      if (nextFilters.recurrenceType) query.set("recurrenceType", nextFilters.recurrenceType);
      window.history.pushState(null, "", `${pathname}?${query.toString()}`);
    },
    [pathname],
  );

  const loadData = useCallback(async () => {
    if (!userId) return;

    if (isMockMode) {
      const dataset = createMockDataset();
      setMockOccurrences(dataset.occurrences);
      setData(
        buildMockOccurrencePage(dataset.occurrences, filters.page, {
          name: filters.name,
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

    setLoading(true);
    setError(null);
    try {
      const cachedData = await loadOccurrencePageFromCache(userId, filters.page, {
        name: filters.name,
        recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        recurrenceType: filters.recurrenceType,
        sortOrder: filters.sortOrder,
      });
      setData(cachedData);

      if (navigator.onLine) {
        const refreshed = await syncOccurrencePageFromServer(userId, filters.page, {
          name: filters.name,
          recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          recurrenceType: filters.recurrenceType,
          sortOrder: filters.sortOrder,
        });
        setData(refreshed);
      }
    } catch (requestError) {
      const cachedData = await loadOccurrencePageFromCache(userId, filters.page, {
        name: filters.name,
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
  }, [filters, isMockMode, userId]);

  useEffect(() => {
    const handlePopState = () => {
      const nextSearchParams = new URLSearchParams(window.location.search);
      setFilters(readFilters(nextSearchParams));
      setSelectedOccurrenceId(nextSearchParams.get("occurrenceId"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && navigator.onLine) {
      router.replace("/login");
      return;
    }

    if (!userId) return;

    void loadData();
  }, [status, userId, router, loadData]);

  useEffect(() => {
    const refresh = () => {
      void loadData();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadData]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.page !== filters.page) {
      const nextFilters = { ...filters, page: data.page };
      setFilters(nextFilters);
      syncUrl(nextFilters, selectedOccurrenceId);
    }
  }, [data, filters, selectedOccurrenceId, syncUrl]);

  function applyFilters() {
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    syncUrl(nextFilters, selectedOccurrenceId);
  }

  function goToPage(nextPage: number) {
    setFilters((current) => {
      const next = { ...current, page: nextPage };
      syncUrl(next, selectedOccurrenceId);
      return next;
    });
  }

  function handleCloseOccurrenceDialog() {
    setSelectedOccurrenceId(null);
    syncUrl(filters, null);
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
          buildMockOccurrencePage(next, filters.page, {
            recurrenceCode: filters.recurrenceCode ? Number(filters.recurrenceCode) : undefined,
            name: filters.name,
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

  if (status === "loading") {
    return (
      <AppShell subtitle="Aguarde..." title="Recorrencias">
        <PageState description="Carregando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell subtitle="Sem usuario local carregado." title="Recorrencias">
        <PageState description="Abra esta tela online ao menos uma vez com sessao ativa para liberar o modo offline local." title="Sessao indisponivel" />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Filtre, abra detalhes em modal e acompanhe o historico de cada recorrencia." title="Recorrencias">
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <Input onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} placeholder="Filtrar por nome" value={filters.name} />
          </div>
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
              const nextFilters = {
                page: 1,
                name: "",
                recurrenceCode: "",
                status: "",
                dateFrom: "",
                dateTo: "",
                recurrenceType: "",
                sortOrder: "oldest",
              } satisfies FilterState;
              setFilters(nextFilters);
              syncUrl(nextFilters, null);
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
              onOpen={(id) => {
                setSelectedOccurrenceId(id);
                syncUrl(filters, id);
              }}
              onViewTask={(taskCode) => window.location.assign(`/tasks?code=${taskCode}&page=1`)}
            />
          ))
        : null}

      {!loading && !error && data ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pagina {data.page} de {data.totalPages} ({data.total} recorrencias)
          </p>
          <div className="flex gap-2">
            <Button disabled={filters.page <= 1} onClick={() => goToPage(Math.max(1, filters.page - 1))} variant="secondary">
              Anterior
            </Button>
            <Button disabled={filters.page >= totalPages} onClick={() => goToPage(Math.min(totalPages, filters.page + 1))} variant="secondary">
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
