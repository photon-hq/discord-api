/**
 * Emit a human-readable markdown summary of API-surface changes in the spec,
 * used in the body of the daily spec-sync PR.
 *
 * By default compares the committed spec at git HEAD against the working tree.
 * Pass two file paths to compare arbitrary specs:
 *   bun scripts/api-surface-diff.ts old.json new.json
 */
import { $ } from "bun";
import {
  type OpenApiSpec,
  operationKeys,
  readSpec,
  SPEC_PATH,
  schemaNames,
} from "./spec-utils.ts";

const REPO_SPEC = "specs/discord-api.openapi.json";

async function headSpec(): Promise<OpenApiSpec | null> {
  try {
    const text = await $`git show HEAD:${REPO_SPEC}`.quiet().text();
    return JSON.parse(text) as OpenApiSpec;
  } catch {
    return null; // not committed yet
  }
}

function diffSets(prev: Set<string>, next: Set<string>) {
  const added = [...next].filter((k) => !prev.has(k)).sort();
  const removed = [...prev].filter((k) => !next.has(k)).sort();
  return { added, removed };
}

function section(title: string, items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  const list = items.map((i) => `- \`${i}\``).join("\n");
  return `### ${title} (${items.length})\n${list}\n`;
}

async function main() {
  const [oldArg, newArg] = process.argv.slice(2);

  const prev = oldArg
    ? ((await Bun.file(oldArg).json()) as OpenApiSpec)
    : await headSpec();
  const next = newArg
    ? ((await Bun.file(newArg).json()) as OpenApiSpec)
    : await readSpec(SPEC_PATH);

  if (!prev) {
    console.log("Initial spec — no previous version to diff against.");
    return;
  }

  const ops = diffSets(operationKeys(prev), operationKeys(next));
  const schemas = diffSets(schemaNames(prev), schemaNames(next));

  const versionLine =
    prev.info.version === next.info.version
      ? `API version: \`${next.info.version}\``
      : `API version: \`${prev.info.version}\` → \`${next.info.version}\``;

  // Removed operations/schemas (or an API major bump) are potentially breaking
  // for consumers; CI keys auto-merge off this marker.
  const breaking =
    ops.removed.length > 0 ||
    schemas.removed.length > 0 ||
    prev.info.version !== next.info.version;
  const breakingLine = `**Breaking:** ${breaking ? "yes" : "no"}`;

  const unchanged =
    ops.added.length === 0 &&
    ops.removed.length === 0 &&
    schemas.added.length === 0 &&
    schemas.removed.length === 0;

  if (unchanged) {
    console.log(
      `${versionLine}\n${breakingLine}\n\n_No operation/schema surface changes (field-level edits only)._`
    );
    return;
  }

  console.log(
    [
      versionLine,
      breakingLine,
      "",
      section("Added operations", ops.added),
      section("Removed operations", ops.removed),
      section("Added schemas", schemas.added),
      section("Removed schemas", schemas.removed),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
