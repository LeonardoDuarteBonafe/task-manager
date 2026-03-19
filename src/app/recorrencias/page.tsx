import { Suspense } from "react";
import { RecurrencesPageClient } from "@/components/tasks/recurrences-page-client";
import { PageState } from "@/components/ui/page-state";

export default function RecorrenciasPage() {
  return (
    <Suspense fallback={<PageState description="Carregando recorrencias..." title="Carregando" />}>
      <RecurrencesPageClient />
    </Suspense>
  );
}
