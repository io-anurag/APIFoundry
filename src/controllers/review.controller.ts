import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { parseRatingParam } from "../utils/ratingParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as reviewService from "../services/review.service";

/**
 * Handles `GET /reviews`: lists reviews via `reviewService.listReviews`, applying the pagination/
 * sort/filter options in the query string, and responds `200` with a paginated envelope built by
 * `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listReviews(req: Request, res: Response): void {
  const { data, page, limit, total } = reviewService.listReviews(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /reviews/:id`: parses the `id` path param via `parseIdParam` and looks up the
 * review via `reviewService.getReviewById`, responding `200` with the review.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getReviewById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "review");
  res.status(200).json(reviewService.getReviewById(id));
}

/**
 * Handles `GET /products/:id/reviews`: parses the product `id` path param via `parseIdParam` and
 * lists that product's reviews via `reviewService.listReviewsForProduct`, applying pagination/
 * sort/filter options from the query string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the product `id` path parameter and query options.
 * @param res - Express response.
 */
export function listReviewsForProduct(req: Request, res: Response): void {
  const productId = parseIdParam(req.params.id, "product");
  const { data, page, limit, total } = reviewService.listReviewsForProduct(
    productId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /reviews/by-rating/:rating`: parses the `rating` path param via
 * `parseRatingParam` and lists reviews with that rating via
 * `reviewService.listReviewsByRating`, applying pagination/sort/filter options from the query
 * string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the `rating` path parameter and query options.
 * @param res - Express response.
 */
export function listReviewsByRating(req: Request, res: Response): void {
  const rating = parseRatingParam(req.params.rating);
  const { data, page, limit, total } = reviewService.listReviewsByRating(
    rating,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
