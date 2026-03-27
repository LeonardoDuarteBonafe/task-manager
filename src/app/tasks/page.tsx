import { Suspense } from "react";
import { TasksPageClient } from "@/features/tasks";
import { PageState } from "@/components/ui/page-state";

export default function TasksPage() {
  return (
    <Suspense fallback={<PageState description="Carregando tarefas..." title="Carregando" />}>
      <TasksPageClient />
    </Suspense>
  );
}
