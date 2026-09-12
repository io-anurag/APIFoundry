import type { ListQuery } from "../models/listQuery";

export interface ApplyListQueryOptions<T> {
  filters?: Array<(record: T) => boolean>;
}

export interface ListQueryResult<T> {
  data: T[];
  total: number;
}

/**
 * Shared filter -> sort -> paginate pipeline used by every resource's list operation, so all four
 * resources apply page/limit/sort/filter identically (research.md).
 *
 * @param records - The full, unfiltered array of records to operate on.
 * @param query - The parsed list query (page, limit, and optional sort field/direction).
 * @param options - Optional predicate filters to apply (AND-combined) before sorting/pagination.
 * @returns The paginated `data` slice after filtering and sorting, plus the `total` count of matching records (pre-pagination).
 */
export function applyListQuery<T>(
  records: T[],
  query: ListQuery,
  options: ApplyListQueryOptions<T> = {}
): ListQueryResult<T> {
  let filtered = records;
  for (const predicate of options.filters ?? []) {
    filtered = filtered.filter(predicate);
  }

  if (query.sort) {
    const { field, direction } = query.sort;
    const factor = direction === "asc" ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      const left = (a as Record<string, unknown>)[field];
      const right = (b as Record<string, unknown>)[field];
      if (left === right) return 0;
      return (left! > right! ? 1 : -1) * factor;
    });
  }

  const total = filtered.length;
  const start = (query.page - 1) * query.limit;
  const data = filtered.slice(start, start + query.limit);

  return { data, total };
}
