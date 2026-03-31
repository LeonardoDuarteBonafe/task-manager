"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageState } from "@/components/ui/page-state";
import { buildMockOccurrencePage, createMockDataset } from "@/lib/mocks/task-data";
import { isForcedUser } from "@/lib/mock-mode";
import { applyOccurrenceActionOffline, loadOccurrencePageFromCache, syncOccurrencePageFromServer } from "@/lib/offline/offline-store";
import { readOfflineLastUser } from "@/lib/offline/user-session";
import { cn } from "@/lib/utils";
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

const DEFAULT_FILTERS = {
  page: 1,
  name: "",
  recurrenceCode: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  recurrenceType: "",
  sortOrder: "oldest",
} satisfies FilterState;

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "UPCOMING", label: "Proximas" },
  { value: "OPEN", label: "Abertas" },
  { value: "COMPLETED", label: "Concluidas" },
  { value: "IGNORED", label: "Ignoradas" },
  { value: "CANCELED", label: "Canceladas" },
  { value: "ABORTED", label: "Abortadas" },
  { value: "FAVORITES", label: "Favoritas" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "ONCE", label: "Uma vez" },
  { value: "DAILY", label: "Diariamente" },
  { value: "WEEKLY", label: "Semanalmente" },
  { value: "MONTHLY", label: "Mensalmente" },
] as const;

const SORT_OPTIONS = [
  { value: "oldest", label: "Mais antigas" },
  { value: "newest", label: "Mais recentes" },
] as const;

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

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0a6.75 6.75 0 0113.5 0z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FilterLinesIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 transition-transform duration-[220ms]", open && "rotate-180", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M6 9l6 6l6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FilterField({
  children,
  className,
  htmlFor,
  label,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  label: string;
}) {
  return (
    <label className={cn("block min-w-0", className)} htmlFor={htmlFor}>
      <span className="recurrence-filter-label">{label}</span>
      {children}
    </label>
  );
}

function FilterTextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("recurrence-filter-input", className)} {...props} />;
}

function FilterSelect({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="recurrence-filter-select-shell">
      <select className={cn("recurrence-filter-input recurrence-filter-select", className)} {...props}>
        {children}
      </select>
      <span aria-hidden="true" className="recurrence-filter-select-icon">
        <ChevronIcon className="h-3 w-3 opacity-70" open={false} />
      </span>
    </div>
  );
}

function FilterActionButton({
  active,
  children,
  className,
  icon,
  kind,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  kind: "search" | "clear" | "more" | "mobile-toggle";
}) {
  return (
    <button
      className={cn(
        "recurrence-filter-button",
        kind === "search" && "recurrence-filter-button-search",
        kind === "clear" && "recurrence-filter-button-clear",
        kind === "more" && "recurrence-filter-button-more",
        kind === "mobile-toggle" && "recurrence-filter-mobile-toggle",
        active && "is-active",
        className,
      )}
      type="button"
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
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
  const [desktopMoreFiltersOpen, setDesktopMoreFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    syncUrl(DEFAULT_FILTERS, null);
  }

  function handleCombinedTermChange(value: string) {
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) {
      setFilters((current) => ({ ...current, name: "", recurrenceCode: "" }));
      return;
    }

    if (/^\d+$/.test(trimmedValue)) {
      setFilters((current) => ({ ...current, name: "", recurrenceCode: trimmedValue }));
      return;
    }

    setFilters((current) => ({ ...current, name: value, recurrenceCode: "" }));
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
  const combinedTermValue = filters.recurrenceCode || filters.name;
  const extraFiltersCount =
    Number(Boolean(filters.dateFrom)) +
    Number(Boolean(filters.dateTo)) +
    Number(Boolean(filters.recurrenceType)) +
    Number(filters.sortOrder !== DEFAULT_FILTERS.sortOrder);
  const totalActiveFilters = Number(Boolean(filters.name || filters.recurrenceCode)) + Number(Boolean(filters.status)) + extraFiltersCount;
  const desktopMoreFiltersActive = desktopMoreFiltersOpen || extraFiltersCount > 0;

  if (status === "loading") {
    return (
      <AppShell showPageHeader={false} subtitle="Aguarde..." title="Recorrencias">
        <PageState description="Carregando sessao..." title="Carregando" />
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell showPageHeader={false} subtitle="Sem usuario local carregado." title="Recorrencias">
        <PageState description="Abra esta tela online ao menos uma vez com sessao ativa para liberar o modo offline local." title="Sessao indisponivel" />
      </AppShell>
    );
  }

  return (
    <AppShell showPageHeader={false} subtitle="Filtre, abra detalhes em modal e acompanhe o historico de cada recorrencia." title="Recorrencias">
      <Card className="recurrence-filter-card overflow-visible p-3 sm:p-4">
        <div className="hidden md:block">
          <div className="flex w-full items-end gap-2">
            <FilterField className="flex-[2_1_0%]" htmlFor="recurrence-search-desktop" label="Nome ou codigo">
              <FilterTextInput
                id="recurrence-search-desktop"
                onChange={(event) => handleCombinedTermChange(event.target.value)}
                placeholder="Ex.: Task offline, 24..."
                value={combinedTermValue}
              />
            </FilterField>

            <FilterField className="flex-[1.2_1_0%]" htmlFor="recurrence-status-desktop" label="Status">
              <FilterSelect
                id="recurrence-status-desktop"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>

            <FilterActionButton className="shrink-0" icon={<SearchIcon />} kind="search" onClick={applyFilters}>
              Buscar
            </FilterActionButton>

            <FilterActionButton className="shrink-0" kind="clear" onClick={clearFilters}>
              Limpar
            </FilterActionButton>

            <FilterActionButton
              active={desktopMoreFiltersActive}
              aria-expanded={desktopMoreFiltersOpen}
              className="shrink-0"
              icon={<FilterLinesIcon />}
              kind="more"
              onClick={() => setDesktopMoreFiltersOpen((current) => !current)}
            >
              <span className="inline-flex items-center gap-2">
                <span>Mais filtros</span>
                {extraFiltersCount > 0 && !desktopMoreFiltersOpen ? <span className="recurrence-filter-badge">{extraFiltersCount}</span> : null}
              </span>
              <ChevronIcon open={desktopMoreFiltersOpen} />
            </FilterActionButton>
          </div>

          {desktopMoreFiltersOpen ? (
            <div className="recurrence-filter-desktop-panel">
              <div className="grid grid-cols-4 gap-2">
                <FilterField htmlFor="recurrence-date-from-desktop" label="Desde">
                  <FilterTextInput
                    className="recurrence-filter-date"
                    id="recurrence-date-from-desktop"
                    onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                    placeholder="dd/mm/aaaa"
                    type="date"
                    value={filters.dateFrom}
                  />
                </FilterField>

                <FilterField htmlFor="recurrence-date-to-desktop" label="Ate">
                  <FilterTextInput
                    className="recurrence-filter-date"
                    id="recurrence-date-to-desktop"
                    onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                    placeholder="dd/mm/aaaa"
                    type="date"
                    value={filters.dateTo}
                  />
                </FilterField>

                <FilterField htmlFor="recurrence-type-desktop" label="Tipo">
                  <FilterSelect
                    id="recurrence-type-desktop"
                    value={filters.recurrenceType}
                    onChange={(event) => setFilters((current) => ({ ...current, recurrenceType: event.target.value }))}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FilterSelect>
                </FilterField>

                <FilterField htmlFor="recurrence-sort-desktop" label="Ordenacao">
                  <FilterSelect
                    id="recurrence-sort-desktop"
                    value={filters.sortOrder}
                    onChange={(event) => setFilters((current) => ({ ...current, sortOrder: event.target.value as "oldest" | "newest" }))}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option disabled value="alphabetical">
                      Alfabetica
                    </option>
                  </FilterSelect>
                </FilterField>
              </div>
            </div>
          ) : null}
        </div>

        <div className="md:hidden">
          <FilterActionButton
            active={mobileFiltersOpen}
            aria-expanded={mobileFiltersOpen}
            className={cn(mobileFiltersOpen && "rounded-b-none")}
            icon={<FilterLinesIcon />}
            kind="mobile-toggle"
            onClick={() => setMobileFiltersOpen((current) => !current)}
          >
            <span className="inline-flex items-center gap-2">
              <span>Filtros</span>
              {totalActiveFilters > 0 ? <span className="recurrence-filter-badge">{totalActiveFilters} ativos</span> : null}
            </span>
            <ChevronIcon open={mobileFiltersOpen} />
          </FilterActionButton>

          {mobileFiltersOpen ? (
            <div className="recurrence-filter-mobile-panel">
              <div className="space-y-2">
                <FilterField htmlFor="recurrence-search-mobile" label="Nome ou codigo">
                  <FilterTextInput
                    className="text-[11px]"
                    id="recurrence-search-mobile"
                    onChange={(event) => handleCombinedTermChange(event.target.value)}
                    placeholder="Ex.: Task offline, 24..."
                    value={combinedTermValue}
                  />
                </FilterField>

                <FilterField htmlFor="recurrence-status-mobile" label="Status">
                  <FilterSelect
                    className="text-[11px]"
                    id="recurrence-status-mobile"
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FilterSelect>
                </FilterField>

                <div className="grid grid-cols-2 gap-2">
                  <FilterField htmlFor="recurrence-date-from-mobile" label="Desde">
                    <FilterTextInput
                      className="recurrence-filter-date text-[11px]"
                      id="recurrence-date-from-mobile"
                      onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      placeholder="dd/mm/aaaa"
                      type="date"
                      value={filters.dateFrom}
                    />
                  </FilterField>

                  <FilterField htmlFor="recurrence-date-to-mobile" label="Ate">
                    <FilterTextInput
                      className="recurrence-filter-date text-[11px]"
                      id="recurrence-date-to-mobile"
                      onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      placeholder="dd/mm/aaaa"
                      type="date"
                      value={filters.dateTo}
                    />
                  </FilterField>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FilterField htmlFor="recurrence-type-mobile" label="Tipo">
                    <FilterSelect
                      className="text-[11px]"
                      id="recurrence-type-mobile"
                      value={filters.recurrenceType}
                      onChange={(event) => setFilters((current) => ({ ...current, recurrenceType: event.target.value }))}
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value || "all"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </FilterSelect>
                  </FilterField>

                  <FilterField htmlFor="recurrence-sort-mobile" label="Ordenacao">
                    <FilterSelect
                      className="text-[11px]"
                      id="recurrence-sort-mobile"
                      value={filters.sortOrder}
                      onChange={(event) => setFilters((current) => ({ ...current, sortOrder: event.target.value as "oldest" | "newest" }))}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option disabled value="alphabetical">
                        Alfabetica
                      </option>
                    </FilterSelect>
                  </FilterField>
                </div>

                <div className="flex gap-2 pt-1">
                  <FilterActionButton className="flex-1 justify-center" icon={<SearchIcon />} kind="search" onClick={applyFilters}>
                    Buscar
                  </FilterActionButton>
                  <FilterActionButton kind="clear" onClick={clearFilters}>
                    Limpar
                  </FilterActionButton>
                </div>
              </div>
            </div>
          ) : null}
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
        initialOccurrence={items.find((occurrence) => occurrence.id === selectedOccurrenceId) ?? mockOccurrences.find((occurrence) => occurrence.id === selectedOccurrenceId) ?? null}
        isMockMode={isMockMode}
        loadingActionId={actionLoadingId}
        occurrenceId={selectedOccurrenceId}
        onClose={handleCloseOccurrenceDialog}
        onComplete={(id) => handleOccurrenceAction(id, "complete")}
        onIgnore={(id) => handleOccurrenceAction(id, "ignore")}
        open={Boolean(selectedOccurrenceId)}
        userId={userId ?? ""}
      />
    </AppShell>
  );
}
