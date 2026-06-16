/**
 * Shared helpers for working with the vendored Discord OpenAPI spec.
 */

export const UPSTREAM_SPEC_URL =
  "https://raw.githubusercontent.com/discord/discord-api-spec/refs/heads/main/specs/openapi.json";

export const SPEC_PATH = new URL(
  "../specs/discord-api.openapi.json",
  import.meta.url
).pathname;

export const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
] as const;

export interface OpenApiSpec {
  components?: { schemas?: Record<string, unknown> };
  info: { version: string; title?: string };
  openapi: string;
  paths?: Record<string, Record<string, { operationId?: string }>>;
}

/**
 * Recursively sort object keys so the committed spec is byte-stable regardless
 * of upstream key ordering — keeps diffs meaningful. Arrays keep their order.
 */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep) as unknown as T;
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return value;
}

/** Stable, pretty JSON with a trailing newline. */
export function serializeSpec(spec: OpenApiSpec): string {
  return `${JSON.stringify(sortKeysDeep(spec), null, 2)}\n`;
}

/** The set of `METHOD path` operation keys, e.g. `POST /channels/{id}/messages`. */
export function operationKeys(spec: OpenApiSpec): Set<string> {
  const keys = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (item[method]) {
        keys.add(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return keys;
}

export function schemaNames(spec: OpenApiSpec): Set<string> {
  return new Set(Object.keys(spec.components?.schemas ?? {}));
}

export async function readSpec(path = SPEC_PATH): Promise<OpenApiSpec> {
  return (await Bun.file(path).json()) as OpenApiSpec;
}
