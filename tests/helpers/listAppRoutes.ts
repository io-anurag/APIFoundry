import type { Express } from "express";
import { config } from "../../src/config";

export interface LiveRoute {
  method: string;
  path: string;
}

function toBracketPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walk(stack: any[], prefix: string, routes: LiveRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const path = toBracketPath(prefix + layer.route.path);
      for (const method of Object.keys(layer.route.methods)) {
        if (method === "_all") continue;
        routes.push({ method: method.toUpperCase(), path });
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      const nestedPrefix = layer.regexp?.fast_slash ? prefix : prefix + config.apiPrefix;
      walk(layer.handle.stack, nestedPrefix, routes);
    }
  }
}

/**
 * Walks the given Express app's actual registered route table (recursing into mounted
 * sub-routers) and returns every distinct method+path pair it serves, with path parameters
 * rendered in OpenAPI's `{param}` brace notation instead of Express's `:param` colon notation, so
 * the result can be compared directly against a parsed `openapi.yaml` document or the hand-authored
 * route catalog.
 *
 * @param app - The live Express application to introspect.
 * @returns Every live route as `{ method, path }`, deduplicated and sorted by path then method.
 */
export function listAppRoutes(app: Express): LiveRoute[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (app as any)._router;
  const routes: LiveRoute[] = [];
  walk(root.stack, "", routes);

  const unique = new Map<string, LiveRoute>();
  for (const r of routes) unique.set(`${r.method} ${r.path}`, r);
  return [...unique.values()].sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );
}
