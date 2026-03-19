import type { ListOccurrencesInput } from "./task-domain/types";
import { listOccurrencesPaginated } from "./list-occurrences";

const DEFAULT_LIMIT = 100;

export async function getOverdueOccurrences(input: ListOccurrencesInput) {
  const result = await listOccurrencesPaginated({
    userId: input.userId,
    context: "overdue",
    referenceDate: input.referenceDate,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? input.limit ?? DEFAULT_LIMIT,
  });
  return result.items;
}
