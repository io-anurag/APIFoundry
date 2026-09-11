import { reviewStore } from "../data/reviews.seed";
import { productStore } from "../data/products.seed";
import type { Review } from "../models/review";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "productId", "rating", "createdAt"] as const;

export function listReviews(
  rawQuery: Record<string, unknown>
): ListQueryResult<Review> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const productIdRaw = lastQueryValue(rawQuery.productId);
  const filters = productIdRaw ? [(review: Review) => String(review.productId) === productIdRaw] : [];
  const { data, total } = applyListQuery(reviewStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getReviewById(id: number): Review {
  const review = reviewStore.get(id);
  if (!review) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Review ${id} not found.`);
  return review;
}

/** Lists reviews for a product (products/:id/reviews, FR-012). 404 if the product doesn't exist first. */
export function listReviewsForProduct(
  productId: number,
  rawQuery: Record<string, unknown>
): ListQueryResult<Review> & { page: number; limit: number } {
  if (!productStore.get(productId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${productId} not found.`);
  }

  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(reviewStore.list(), query, {
    filters: [(review: Review) => review.productId === productId],
  });
  return { data, total, page: query.page, limit: query.limit };
}

/** Lists reviews with a given rating (reviews/by-rating/:rating, FR-008). */
export function listReviewsByRating(
  rating: number,
  rawQuery: Record<string, unknown>
): ListQueryResult<Review> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(reviewStore.list(), query, {
    filters: [(review: Review) => review.rating === rating],
  });
  return { data, total, page: query.page, limit: query.limit };
}
