import { Suspense } from "react";
import { OccurrencesPageClient } from "@/components/tasks/occurrences-page-client";
import { PageState } from "@/components/ui/page-state";

export default function OccurrencesPage() {
  return (
    <Suspense fallback={<PageState description="Carregando ocorrências..." title="Carregando" />}>
      <OccurrencesPageClient />
    </Suspense>
  );
}
