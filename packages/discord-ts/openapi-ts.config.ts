import { defineConfig } from "@hey-api/openapi-ts";

// Generates the Discord HTTP API client into `src/generated/` from the vendored
// OpenAPI document (`bun run generate:openapi`). The public surface
// (`createDiscordClient`, error handling, auth, rate-limit retry) lives in the
// hand-written `src/index.ts`; everything operation-specific below is fully
// generated and gitignored.
export default defineConfig({
  input: "../../specs/discord-api.openapi.json",
  output: {
    path: "src/generated",
    // tsdown + Biome own formatting/linting of the published bundle; keep
    // codegen output raw and deterministic (no prettier/eslint post-processing).
    postProcess: [],
  },
  plugins: [
    {
      name: "@hey-api/client-fetch",
      // Build-time default base URL. Auth header + rate-limit retry are applied
      // at runtime by `createDiscordClient`.
      runtimeConfigPath: "./src/hey-api.ts",
      // Discord returns proper HTTP error codes; throw on them so the error
      // interceptor can surface a typed `DiscordApiError`.
      throwOnError: true,
    },
    "@hey-api/typescript",
    {
      name: "@hey-api/sdk",
      // Tree-shakeable standalone functions (one per Discord operation).
      operations: { strategy: "flat" },
      // Return the response body directly instead of the `{ data, error }` envelope.
      responseStyle: "data",
      // Validate request bodies and responses at runtime using the generated Zod schemas.
      validator: "zod",
    },
    "zod",
  ],
});
