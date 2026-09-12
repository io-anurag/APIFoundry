import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { app } from "../src/app";
import { listAppRoutes } from "./helpers/listAppRoutes";
import { routeRegistry } from "../src/data/routeRegistry.catalog";
import type { AuthType } from "../src/models/routeInfo";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function parsedDoc(): Record<string, any> {
  return yaml.load(readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8")) as Record<
    string,
    any
  >;
}

function documentedSet(doc: Record<string, any>): Set<string> {
  const set = new Set<string>();
  for (const [path, pathItem] of Object.entries(doc.paths as Record<string, any>)) {
    for (const method of METHODS) {
      if (pathItem[method]) set.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return set;
}

const EXPECTED_SECURITY: Record<AuthType, unknown> = {
  none: [],
  jwt: [{ bearerAuth: [] }],
  apiKey: [{ apiKeyAuth: [] }],
  basic: [{ basicAuth: [] }],
  adminToken: [{ adminTokenAuth: [] }],
};

describe("openapi.yaml matches the live Express route table", () => {
  it("has zero paths documented-but-missing and zero implemented-but-undocumented", () => {
    const liveSet = new Set(listAppRoutes(app).map((r) => `${r.method} ${r.path}`));
    const docSet = documentedSet(parsedDoc());

    const liveOnly = [...liveSet].filter((r) => !docSet.has(r)).sort();
    const docOnly = [...docSet].filter((r) => !liveSet.has(r)).sort();

    expect(liveOnly, `implemented but undocumented: ${JSON.stringify(liveOnly)}`).toEqual([]);
    expect(docOnly, `documented but not implemented: ${JSON.stringify(docOnly)}`).toEqual([]);
  });
});

describe("routeRegistry.catalog.ts matches the live app and openapi.yaml", () => {
  it("has the same 99 method+path pairs as the live app and the OpenAPI document", () => {
    const liveSet = new Set(listAppRoutes(app).map((r) => `${r.method} ${r.path}`));
    const docSet = documentedSet(parsedDoc());
    const catalogSet = new Set(routeRegistry.map((r) => `${r.method} ${r.path}`));

    const catalogOnly = [...catalogSet].filter((r) => !liveSet.has(r)).sort();
    const liveNotInCatalog = [...liveSet].filter((r) => !catalogSet.has(r)).sort();
    const catalogNotInDoc = [...catalogSet].filter((r) => !docSet.has(r)).sort();
    const docNotInCatalog = [...docSet].filter((r) => !catalogSet.has(r)).sort();

    expect(catalogOnly, `catalog entries with no live route: ${JSON.stringify(catalogOnly)}`).toEqual([]);
    expect(liveNotInCatalog, `live routes missing from catalog: ${JSON.stringify(liveNotInCatalog)}`).toEqual([]);
    expect(catalogNotInDoc, `catalog entries missing from openapi.yaml: ${JSON.stringify(catalogNotInDoc)}`).toEqual([]);
    expect(docNotInCatalog, `documented paths missing from catalog: ${JSON.stringify(docNotInCatalog)}`).toEqual([]);
  });

  it("has a catalog auth.type consistent with openapi.yaml's declared security for every route", () => {
    const doc = parsedDoc();
    const mismatches: string[] = [];

    for (const entry of routeRegistry) {
      const pathItem = doc.paths[entry.path];
      const operation = pathItem?.[entry.method.toLowerCase()];
      if (!operation) {
        mismatches.push(`${entry.method} ${entry.path}: no matching openapi.yaml operation`);
        continue;
      }
      const expected = EXPECTED_SECURITY[entry.auth.type];
      if (JSON.stringify(operation.security) !== JSON.stringify(expected)) {
        mismatches.push(
          `${entry.method} ${entry.path}: catalog says "${entry.auth.type}" (expects ${JSON.stringify(
            expected
          )}) but openapi.yaml has ${JSON.stringify(operation.security)}`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });
});
