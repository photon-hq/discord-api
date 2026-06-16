/**
 * Vendor the upstream Discord OpenAPI spec into `specs/discord-api.openapi.json`.
 *
 * Unlike Telegram (which has no official spec), Discord publishes its own
 * OpenAPI document, so this step just downloads and deterministically
 * normalizes it for clean, reviewable diffs.
 */
import {
  type OpenApiSpec,
  SPEC_PATH,
  serializeSpec,
  UPSTREAM_SPEC_URL,
} from "./spec-utils.ts";

async function main() {
  console.log(`Fetching upstream spec: ${UPSTREAM_SPEC_URL}`);
  const res = await fetch(UPSTREAM_SPEC_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
  }

  const spec = (await res.json()) as OpenApiSpec;
  if (!spec.openapi?.startsWith("3.")) {
    throw new Error(`Unexpected OpenAPI version: ${spec.openapi}`);
  }

  const pathCount = Object.keys(spec.paths ?? {}).length;
  const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;
  console.log(
    `OpenAPI ${spec.openapi} · API version ${spec.info.version} · ${pathCount} paths · ${schemaCount} schemas`
  );

  await Bun.write(SPEC_PATH, serializeSpec(spec));
  console.log(`Wrote ${SPEC_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
