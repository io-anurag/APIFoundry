import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";

const openapiPath = join(__dirname, "..", "openapi.yaml");
const rawText = readFileSync(openapiPath, "utf-8");
const parsed = yaml.load(rawText) as Record<string, any>;

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function collectRefs(node: unknown, refs: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "$ref" && typeof value === "string") {
        refs.push(value);
      } else {
        collectRefs(value, refs);
      }
    }
  }
}

function resolveRef(doc: Record<string, any>, ref: string): unknown {
  const segments = ref.replace(/^#\//, "").split("/");
  let node: unknown = doc;
  for (const segment of segments) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

describe("openapi.yaml structural integrity", () => {
  it("contains no allOf/oneOf/anyOf schema combinators", () => {
    expect(rawText).not.toContain("allOf:");
    expect(rawText).not.toContain("oneOf:");
    expect(rawText).not.toContain("anyOf:");
  });

  it("declares the minimal required top-level fields", () => {
    expect(parsed.openapi).toMatch(/^3\.\d+\.\d+$/);
    expect(typeof parsed.info?.title).toBe("string");
    expect(parsed.info.title.length).toBeGreaterThan(0);
    expect(typeof parsed.info?.version).toBe("string");
    expect(parsed.info.version.length).toBeGreaterThan(0);
  });

  it("gives every operation an explicit security array and at least one response", () => {
    for (const [path, pathItem] of Object.entries(parsed.paths as Record<string, any>)) {
      for (const method of METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;
        expect(
          Array.isArray(operation.security),
          `${method.toUpperCase()} ${path} must have an explicit security array`
        ).toBe(true);
        expect(
          operation.responses && Object.keys(operation.responses).length > 0,
          `${method.toUpperCase()} ${path} must document at least one response`
        ).toBe(true);
      }
    }
  });

  it("declares /auth/token-info as unauthenticated (it is not gated by `authenticate`)", () => {
    expect(parsed.paths["/auth/token-info"].get.security).toEqual([]);
  });

  it("resolves every $ref to something that actually exists in the document", () => {
    const refs: string[] = [];
    collectRefs(parsed, refs);
    const unresolved = refs.filter((ref) => resolveRef(parsed, ref) === undefined);
    expect(unresolved).toEqual([]);
  });
});
