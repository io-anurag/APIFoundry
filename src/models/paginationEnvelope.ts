export interface PaginationEnvelope<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Builds the standard pagination response envelope (`{ data, pagination: {...} }`), computing
 * `totalPages`, `hasNext`, and `hasPrevious` from the given page/limit/total.
 * @param data - The page of items to include in the response.
 * @param page - Current page number (1-based).
 * @param limit - Maximum number of items per page.
 * @param total - Total number of items across all pages.
 * @returns The assembled pagination envelope.
 */
export function buildPaginationEnvelope<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginationEnvelope<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
