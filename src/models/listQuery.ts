import { HttpError } from "../utils/httpError";

export interface ListQuerySort {
  field: string;
  direction: "asc" | "desc";
}

export interface ListQuery {
  page: number;
  limit: number;
  sort?: ListQuerySort;
}

export interface ParseListQueryOptions {
  allowedSortFields: readonly string[];
}

/**
 * Deterministically picks one value out of a query parameter that Express/qs may have parsed as a
 * repeated key (an array) — "last value wins" — so a request with a conflicting repeated parameter
 * behaves identically on every call instead of depending on incidental array order.
 */
export function lastQueryValue(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : String(value);
}

function parsePositiveInt(raw: unknown, name: string, defaultValue: number, max?: number): number {
  if (raw === undefined) return defaultValue;
  const value = lastQueryValue(raw);
  const parsed = value === undefined ? NaN : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
    const bound = max !== undefined ? ` between 1 and ${max}` : " of at least 1";
    throw new HttpError(400, "VALIDATION_ERROR", `Query parameter '${name}' must be an integer${bound}.`, {
      field: name,
      value: raw,
    });
  }
  return parsed;
}

function parseSort(raw: unknown, allowedFields: readonly string[]): ListQuerySort | undefined {
  const value = lastQueryValue(raw);
  if (value === undefined) return undefined;

  const direction: ListQuerySort["direction"] = value.startsWith("-") ? "desc" : "asc";
  const field = value.startsWith("-") ? value.slice(1) : value;

  if (!field || !allowedFields.includes(field)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `Query parameter 'sort' must be one of: ${allowedFields.join(", ")} (optionally prefixed with '-').`,
      { field: "sort", value: raw }
    );
  }

  return { field, direction };
}

export function parseListQuery(query: Record<string, unknown>, options: ParseListQueryOptions): ListQuery {
  return {
    page: parsePositiveInt(query.page, "page", 1),
    limit: parsePositiveInt(query.limit, "limit", 20, 100),
    sort: parseSort(query.sort, options.allowedSortFields),
  };
}
