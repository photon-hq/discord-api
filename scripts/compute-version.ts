#!/usr/bin/env bun
import { appendFile } from "node:fs/promises";
import {
  type OpenApiSpec,
  operationKeys,
  SPEC_PATH,
  schemaNames,
} from "./spec-utils.ts";

// Computes the next npm version for @photon-ai/discord-ts. Discord's HTTP API
// version is stable (currently 10), so the semver MAJOR is pinned to
// `info.version` from the spec. Within that major:
//   - MINOR bumps when the API surface grows (new operations or schemas added)
//   - PATCH bumps for any other spec change (field tweaks, removals, tooling)
//
// Publishing is idempotent: `should_publish` is true only when the committed
// spec differs from the spec attached to the latest released git tag, so
// re-running the release workflow on an unchanged commit is a no-op.

const PACKAGE_NAME = "@photon-ai/discord-ts";

const currentSpecText = await Bun.file(SPEC_PATH).text();
const currentSpec = JSON.parse(currentSpecText) as OpenApiSpec;
const discordVersion = String(currentSpec.info.version); // e.g. "10"
const major = Number.parseInt(discordVersion, 10);
if (!Number.isFinite(major)) {
  throw new Error(`Unexpected API version: ${discordVersion}`);
}

const getPublishedVersion = async (): Promise<string> => {
  const result = await Bun.$`npm view ${PACKAGE_NAME} version`
    .quiet()
    .nothrow();
  // A non-zero exit means the package isn't published yet.
  return result.exitCode === 0 ? result.stdout.toString().trim() : "";
};

// The spec attached to the last release tag, or null if the tag/file is
// missing. Read straight from local git (no network, works for private repos)
// — the release workflow checks out full history + tags for exactly this.
const releasedSpec = async (
  published: string
): Promise<{ text: string; spec: OpenApiSpec } | null> => {
  if (!published) {
    return null; // never published
  }
  const result =
    await Bun.$`git show v${published}:specs/discord-api.openapi.json`
      .quiet()
      .nothrow();
  if (result.exitCode !== 0) {
    return null; // tag or file missing
  }
  const text = result.stdout.toString();
  return { text, spec: JSON.parse(text) as OpenApiSpec };
};

const surfaceGrew = (prev: OpenApiSpec, next: OpenApiSpec): boolean => {
  const prevOps = operationKeys(prev);
  const prevSchemas = schemaNames(prev);
  const addedOp = [...operationKeys(next)].some((k) => !prevOps.has(k));
  const addedSchema = [...schemaNames(next)].some((k) => !prevSchemas.has(k));
  return addedOp || addedSchema;
};

const computeNextVersion = (
  published: string,
  previous: OpenApiSpec | null
): string => {
  if (!published) {
    return `${major}.0.0`;
  }
  const [prevMajor = 0, prevMinor = 0, prevPatch = 0] = published
    .split(".")
    .map((n) => Number.parseInt(n, 10));
  // Discord bumped its API major upstream → reset to <major>.0.0.
  if (major !== prevMajor) {
    return `${major}.0.0`;
  }
  const grew = previous ? surfaceGrew(previous, currentSpec) : false;
  return grew
    ? `${major}.${prevMinor + 1}.0`
    : `${major}.${prevMinor}.${prevPatch + 1}`;
};

const published = await getPublishedVersion();
const previous = await releasedSpec(published);

// Idempotent: republish only when the spec changed since the last release tag.
// A missing tag/file (null) is treated as changed.
const shouldPublish = !previous || previous.text !== currentSpecText;
const version = computeNextVersion(published, previous?.spec ?? null);

const output = [
  `version=${version}`,
  `should_publish=${shouldPublish}`,
  `discord_version=${discordVersion}`,
  `published_version=${published}`,
  "",
].join("\n");

process.stdout.write(output);

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  await appendFile(githubOutput, output);
}
