import { Suspense } from "react";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";
import { PageState } from "@/components/ui/page-state";

export default function TasksPage() {
  return (
    <Suspense fallback={<PageState description="Carregando tasks..." title="Carregando" />}>
      <TasksPageClient />
    </Suspense>
  );
}
