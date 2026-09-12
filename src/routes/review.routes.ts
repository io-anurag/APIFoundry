/**
 * Review routes: read-only listing/lookup by id, listing by rating, and the nested
 * `products/:id/reviews` lookup. No authentication is required.
 */
import { Router } from "express";
import * as reviewController from "../controllers/review.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const reviewRouter = Router({ strict: true });

reviewRouter.get("/reviews", reviewController.listReviews);
reviewRouter.all("/reviews", methodNotAllowedHandler);

reviewRouter.get("/reviews/:id", reviewController.getReviewById);
reviewRouter.all("/reviews/:id", methodNotAllowedHandler);

reviewRouter.get("/reviews/by-rating/:rating", reviewController.listReviewsByRating);
reviewRouter.all("/reviews/by-rating/:rating", methodNotAllowedHandler);

reviewRouter.get("/products/:id/reviews", reviewController.listReviewsForProduct);
reviewRouter.all("/products/:id/reviews", methodNotAllowedHandler);
