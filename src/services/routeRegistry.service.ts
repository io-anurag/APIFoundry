import { routeRegistry } from "../data/routeRegistry.catalog";
import type { RouteInfo } from "../models/routeInfo";

/**
 * Returns the full route catalog. The catalog is already sorted and immutable at module scope, so
 * no copying or re-sorting is needed here.
 */
export function listRoutes(): RouteInfo[] {
  return routeRegistry;
}
