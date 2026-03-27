import { Suspense } from "react";
import { RecurrencesPageClient } from "@/features/tasks";
import { PageState } from "@/components/ui/page-state";

export default function RecorrenciasPage() {
  return (
    <Suspense fallback={<PageState description="Carregando recorrencias..." title="Carregando" />}>
      <RecurrencesPageClient />
    </Suspense>
  );
}
