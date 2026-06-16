# discord-api

Auto-generated, type-safe client libraries for the [Discord HTTP API](https://discord.com/developers/docs),
generated from Discord's official OpenAPI specification.

Currently targets TypeScript via the [`@photon-ai/discord-ts`](./packages/discord-ts) package.

## How it works

1. **Spec sync** — A daily workflow vendors the upstream spec from
   [`discord/discord-api-spec`](https://github.com/discord/discord-api-spec), normalizes it
   deterministically, and opens a PR only when the API surface changes.
2. **Code generation** — [`@hey-api/openapi-ts`](https://heyapi.dev) converts the spec into a
   typed SDK with Zod schemas, wrapped by a hand-written `createDiscordClient` factory.
3. **Publishing** — Merges to `main` that touch the spec build, test, compute the next version,
   and publish to npm with provenance via OIDC Trusted Publishing.

## Usage

```bash
bun add @photon-ai/discord-ts
```

```ts
import { createDiscordClient, getMyUser } from "@photon-ai/discord-ts";

const discord = createDiscordClient({ token: process.env.DISCORD_BOT_TOKEN! });

// Each generated SDK function takes the client plus typed params.
const me = await getMyUser({ client: discord });
console.log(me.username);
```

The client sends `Authorization: Bot <token>`, transparently retries on HTTP 429 honoring
`retry_after`, and throws a typed `DiscordApiError` for other error responses. Generated Zod
`schemas` are exported for manual validation of raw payloads (e.g. gateway/webhook events).

## Development

```bash
bun install
bun run generate:openapi   # vendor specs/discord-api.openapi.json from upstream
bun run generate:client    # regenerate packages/discord-ts/src/generated
bun run typecheck
bun run build
bun test
```

## Releasing

Publishing uses npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no
stored tokens. The package/repo must be registered once as a Trusted Publisher for
`@photon-ai/discord-ts` before the first automated release.
