import { userStore } from "../data/users.seed";
import { customerStore } from "../data/customers.seed";
import { productStore } from "../data/products.seed";
import { categoryStore } from "../data/categories.seed";
import { postStore } from "../data/posts.seed";
import { commentStore } from "../data/comments.seed";
import { reviewStore } from "../data/reviews.seed";
import type { SearchResult } from "../models/searchResult";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

/**
 * Gathers every searchable record across all seeded resources (users, customers, products,
 * categories, posts, comments, reviews) into a single flat, heterogeneous list.
 *
 * @returns Every resource's records mapped into the common `SearchResult` shape.
 */
function collectResults(): SearchResult[] {
  const results: SearchResult[] = [];

  for (const user of userStore.list()) {
    results.push({ resourceType: "user", id: String(user.id), label: user.name, snippet: user.email });
  }
  for (const customer of customerStore.list()) {
    results.push({
      resourceType: "customer",
      id: String(customer.id),
      label: customer.name,
      snippet: customer.email,
    });
  }
  for (const product of productStore.list()) {
    results.push({
      resourceType: "product",
      id: String(product.id),
      label: product.name,
      snippet: product.description,
    });
  }
  for (const category of categoryStore.list()) {
    results.push({
      resourceType: "category",
      id: String(category.id),
      label: category.name,
      snippet: category.description,
    });
  }
  for (const post of postStore.list()) {
    results.push({ resourceType: "post", id: String(post.id), label: post.title, snippet: post.body });
  }
  for (const comment of commentStore.list()) {
    results.push({ resourceType: "comment", id: String(comment.id), label: comment.body });
  }
  for (const review of reviewStore.list()) {
    results.push({
      resourceType: "review",
      id: String(review.id),
      label: review.body || `${review.rating}-star review`,
    });
  }

  return results;
}

/**
 * Case-insensitively checks whether a search result's label/snippet contains the search term.
 *
 * @param result - The candidate search result.
 * @param needle - The lowercased search term to look for.
 * @returns True if `needle` appears in the result's combined label and snippet text.
 */
function matches(result: SearchResult, needle: string): boolean {
  const haystack = `${result.label} ${result.snippet ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

/**
 * Cross-resource search (FR-020-FR-023). Case-insensitively matches `q` against the label/snippet of
 * users, customers, products, categories, posts, comments, and reviews. `q` is required and
 * non-empty; a well-formed query with no matches returns 200 + empty data, never 404. Only
 * `page`/`limit` apply — the combined result set is heterogeneous, so no `sort` field is offered
 * (research.md).
 *
 * @param rawQuery - Raw query-string parameters; must include a non-empty `q`, plus optional `page`/`limit`.
 * @returns The matching page of heterogeneous search results plus the total count, page, and limit used.
 * @throws HttpError 400 VALIDATION_ERROR if `q` is missing or empty.
 */
export function search(
  rawQuery: Record<string, unknown>
): ListQueryResult<SearchResult> & { page: number; limit: number } {
  const q = lastQueryValue(rawQuery.q);
  if (!q) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'q' is required and must not be empty.", {
      field: "q",
    });
  }

  const query = parseListQuery(rawQuery, { allowedSortFields: [] });
  const needle = q.toLowerCase();
  const { data, total } = applyListQuery(collectResults(), query, {
    filters: [(result: SearchResult) => matches(result, needle)],
  });
  return { data, total, page: query.page, limit: query.limit };
}
