import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { parseRatingParam } from "../utils/ratingParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as reviewService from "../services/review.service";

export function listReviews(req: Request, res: Response): void {
  const { data, page, limit, total } = reviewService.listReviews(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getReviewById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "review");
  res.status(200).json(reviewService.getReviewById(id));
}

export function listReviewsForProduct(req: Request, res: Response): void {
  const productId = parseIdParam(req.params.id, "product");
  const { data, page, limit, total } = reviewService.listReviewsForProduct(
    productId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function listReviewsByRating(req: Request, res: Response): void {
  const rating = parseRatingParam(req.params.rating);
  const { data, page, limit, total } = reviewService.listReviewsByRating(
    rating,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
