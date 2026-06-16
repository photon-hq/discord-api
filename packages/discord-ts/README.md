# @photon-ai/discord-ts

A typed TypeScript client with Zod schemas for the [Discord HTTP API](https://discord.com/developers/docs),
generated from Discord's official OpenAPI specification.

```bash
bun add @photon-ai/discord-ts
# or: npm install @photon-ai/discord-ts
```

## Usage

```ts
import { createDiscordClient, getMyUser, createMessage } from "@photon-ai/discord-ts";

const discord = createDiscordClient({ token: process.env.DISCORD_BOT_TOKEN! });

// Generated operation functions take the client plus typed params; the response
// body is returned directly (validated with the generated Zod schemas).
const me = await getMyUser({ client: discord });

await createMessage({
  client: discord,
  path: { channel_id: "123456789012345678" },
  body: { content: `Hello from ${me.username}!` },
});
```

### Authentication

`createDiscordClient({ token })` sends `Authorization: Bot <token>` on every request.

### Rate limits

HTTP 429 responses are retried automatically, honoring Discord's `retry_after`
(body) / `Retry-After` (header). Tune with `maxRetries` (default `3`):

```ts
createDiscordClient({ token, maxRetries: 5 });
```

### Errors

Non-2xx responses throw a typed `DiscordApiError` with `status`, Discord `code`,
`message`, optional field `errors`, and (for 429s) `retryAfter`.

```ts
import { DiscordApiError } from "@photon-ai/discord-ts";

try {
  await getMyUser({ client: discord });
} catch (err) {
  if (err instanceof DiscordApiError) {
    console.error(err.status, err.code, err.message);
  }
}
```

### Schemas

The generated Zod `schemas` are exported for manually validating raw payloads
(e.g. gateway or webhook events):

```ts
import { schemas } from "@photon-ai/discord-ts";

const user = schemas.zUserResponse.parse(rawPayload);
```

## Options

| Option       | Type            | Default                          | Description                          |
| ------------ | --------------- | -------------------------------- | ------------------------------------ |
| `token`      | `string`        | —                                | Bot token (`Authorization: Bot …`).  |
| `baseUrl`    | `string`        | `https://discord.com/api/v10`    | API base URL.                        |
| `fetch`      | `typeof fetch`  | global `fetch`                   | Custom fetch implementation.         |
| `maxRetries` | `number`        | `3`                              | Max automatic retries on HTTP 429.   |

---

Generated from [`discord/discord-api-spec`](https://github.com/discord/discord-api-spec).
Source and tooling: [`photon-hq/discord-api`](https://github.com/photon-hq/discord-api).
