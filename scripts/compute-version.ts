/**
 * Compute the next npm version for `@photon-ai/discord-ts`.
 *
 * Discord's HTTP API version is stable (currently 10), so we pin the semver
 * MAJOR to `info.version` from the spec. Within that:
 *   - MINOR bumps when the API surface grows (new operations or schemas added)
 *   - PATCH bumps for any other spec change (field tweaks, removals, tooling)
 *
 * Prints the version to stdout (consumed by the release workflow).
 */
import {
  type OpenApiSpec,
  operationKeys,
  readSpec,
  schemaNames,
} from "./spec-utils.ts";

const PACKAGE_NAME = "@photon-ai/discord-ts";

interface PublishedMeta {
  version: string;
}

async function latestPublishedVersion(): Promise<string | null> {
  const res = await fetch(
    `https://registry.npmjs.org/${PACKAGE_NAME.replace("/", "%2f")}/latest`
  );
  if (res.status === 404) {
    return null; // never published
  }
  if (!res.ok) {
    throw new Error(`npm registry lookup failed: ${res.status}`);
  }
  return ((await res.json()) as PublishedMeta).version;
}

/** Best-effort fetch of the previously published spec to diff the surface. */
async function publishedSpec(version: string): Promise<OpenApiSpec | null> {
  const res = await fetch(
    `https://cdn.jsdelivr.net/npm/${PACKAGE_NAME}@${version}/specs/discord-api.openapi.json`
  );
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as OpenApiSpec;
}

function surfaceGrew(prev: OpenApiSpec, next: OpenApiSpec): boolean {
  const prevOps = operationKeys(prev);
  const prevSchemas = schemaNames(prev);
  const addedOp = [...operationKeys(next)].some((k) => !prevOps.has(k));
  const addedSchema = [...schemaNames(next)].some((k) => !prevSchemas.has(k));
  return addedOp || addedSchema;
}

async function main() {
  const spec = await readSpec();
  const major = Number.parseInt(spec.info.version, 10);
  if (!Number.isFinite(major)) {
    throw new Error(`Unexpected API version: ${spec.info.version}`);
  }

  const latest = await latestPublishedVersion();
  if (!latest) {
    console.log(`${major}.0.0`);
    return;
  }

  const [prevMajor = 0, prevMinor = 0, prevPatch = 0] = latest
    .split(".")
    .map((n) => Number.parseInt(n, 10));

  // API major changed upstream → reset to <major>.0.0.
  if (major !== prevMajor) {
    console.log(`${major}.0.0`);
    return;
  }

  const prevSpec = await publishedSpec(latest);
  const grew = prevSpec ? surfaceGrew(prevSpec, spec) : false;

  const next = grew
    ? `${major}.${prevMinor + 1}.0`
    : `${major}.${prevMinor}.${prevPatch + 1}`;
  console.log(next);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
